/**
 * @fileoverview Approval gate for human-in-the-loop operations
 * @module @symbiosis/kernel/safety/approval-gate
 */

import { Subject, BehaviorSubject } from 'rxjs';
import { filter } from 'rxjs/operators';
import type { Observable } from 'rxjs';

import type { ILogger } from '@symbiosis/shared';
import { ok, err } from '@symbiosis/shared';
import type { Result } from '@symbiosis/shared';
import { ApprovalLevel } from '@symbiosis/shared';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Approval request status
 */
export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  DENIED = 'denied',
  TIMEOUT = 'timeout',
  AUTO_APPROVED = 'auto_approved',
}

/**
 * Approval request interface
 */
export interface IApprovalRequest {
  readonly id: string;
  readonly operation: string;
  readonly description: string;
  readonly level: ApprovalLevel;
  readonly agentId: string;
  readonly context: Record<string, unknown>;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  status: ApprovalStatus;
  resolvedAt?: Date | undefined;
  resolvedBy?: string | undefined;
  reason?: string | undefined;
}

/**
 * Approval gate configuration
 */
export interface IApprovalGateConfig {
  readonly defaultTimeoutMs: number;
  readonly autoApproveLevel: ApprovalLevel;
}

/**
 * Approval gate error
 */
export class ApprovalGateError extends Error {
  constructor(
    message: string,
    public readonly code: ApprovalGateErrorCode,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApprovalGateError';
  }
}

/**
 * Approval gate error codes
 */
export enum ApprovalGateErrorCode {
  REQUEST_NOT_FOUND = 'REQUEST_NOT_FOUND',
  ALREADY_RESOLVED = 'ALREADY_RESOLVED',
  EXPIRED = 'EXPIRED',
  BLOCKED = 'BLOCKED',
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Approval gate for human-in-the-loop operations
 */
export class ApprovalGate {
  private readonly requests: Map<string, IApprovalRequest>;
  private readonly requestStream: Subject<IApprovalRequest>;
  private readonly pendingCount: BehaviorSubject<number>;
  private readonly config: IApprovalGateConfig;
  private readonly logger: ILogger;
  private requestCounter: number;

  constructor(config: IApprovalGateConfig, logger: ILogger) {
    this.config = config;
    this.logger = logger;
    this.requests = new Map();
    this.requestStream = new Subject();
    this.pendingCount = new BehaviorSubject(0);
    this.requestCounter = 0;
  }

  /**
   * Request approval for an operation
   * @param operation - Name of the operation
   * @param description - Human-readable description
   * @param level - Required approval level
   * @param agentId - ID of the requesting agent
   * @param context - Additional context
   * @param timeoutMs - Optional custom timeout
   * @returns Result containing the request or an error
   */
  public requestApproval(
    operation: string,
    description: string,
    level: ApprovalLevel,
    agentId: string,
    context: Record<string, unknown> = {},
    timeoutMs?: number,
  ): Result<IApprovalRequest, ApprovalGateError> {
    // Handle blocked operations
    if (level === ApprovalLevel.BLOCK) {
      return err(
        new ApprovalGateError('Operation is blocked', ApprovalGateErrorCode.BLOCKED),
      );
    }

    // Handle auto-approved operations
    if (level === ApprovalLevel.AUTO || this.shouldAutoApprove(level)) {
      const autoRequest = this.createRequest(
        operation,
        description,
        level,
        agentId,
        context,
        timeoutMs,
      );
      autoRequest.status = ApprovalStatus.AUTO_APPROVED;
      autoRequest.resolvedAt = new Date();
      this.requests.set(autoRequest.id, autoRequest);
      this.logger.info(`Auto-approved operation: ${operation}`);
      return ok(autoRequest);
    }

    const request = this.createRequest(
      operation,
      description,
      level,
      agentId,
      context,
      timeoutMs,
    );
    this.requests.set(request.id, request);
    this.updatePendingCount();
    this.requestStream.next(request);

    this.logger.info(`Approval requested: ${operation} (${request.id})`);

    // Set up timeout
    const timeout = timeoutMs ?? this.config.defaultTimeoutMs;
    setTimeout(() => {
      this.handleTimeout(request.id);
    }, timeout);

    return ok(request);
  }

  /**
   * Approve a pending request
   * @param requestId - ID of the request to approve
   * @param approvedBy - ID of the approver
   * @param reason - Optional reason
   * @returns Result indicating success or failure
   */
  public approve(
    requestId: string,
    approvedBy: string,
    reason?: string,
  ): Result<IApprovalRequest, ApprovalGateError> {
    return this.resolveRequest(requestId, ApprovalStatus.APPROVED, approvedBy, reason);
  }

  /**
   * Deny a pending request
   * @param requestId - ID of the request to deny
   * @param deniedBy - ID of the denier
   * @param reason - Reason for denial
   * @returns Result indicating success or failure
   */
  public deny(
    requestId: string,
    deniedBy: string,
    reason: string,
  ): Result<IApprovalRequest, ApprovalGateError> {
    return this.resolveRequest(requestId, ApprovalStatus.DENIED, deniedBy, reason);
  }

  /**
   * Get a request by ID
   * @param requestId - The request ID
   * @returns The request if found
   */
  public getRequest(requestId: string): IApprovalRequest | undefined {
    return this.requests.get(requestId);
  }

  /**
   * Get all pending requests
   * @returns Array of pending requests
   */
  public getPendingRequests(): readonly IApprovalRequest[] {
    return Array.from(this.requests.values()).filter(
      (r) => r.status === ApprovalStatus.PENDING,
    );
  }

  /**
   * Get observable of new approval requests
   * @returns Observable of approval requests
   */
  public getRequestStream(): Observable<IApprovalRequest> {
    return this.requestStream.asObservable();
  }

  /**
   * Get observable of pending approval requests requiring attention
   * @returns Observable of pending requests
   */
  public getPendingStream(): Observable<IApprovalRequest> {
    return this.requestStream.pipe(
      filter((r) => r.level === ApprovalLevel.APPROVE),
    );
  }

  /**
   * Get observable of pending count changes
   * @returns Observable of pending counts
   */
  public getPendingCountStream(): Observable<number> {
    return this.pendingCount.asObservable();
  }

  /**
   * Wait for a request to be resolved
   * @param requestId - The request ID to wait for
   * @param pollIntervalMs - Polling interval
   * @returns Promise that resolves with the final request status
   */
  public async waitForResolution(
    requestId: string,
    pollIntervalMs = 100,
  ): Promise<Result<IApprovalRequest, ApprovalGateError>> {
    const request = this.requests.get(requestId);
    if (request === undefined) {
      return err(
        new ApprovalGateError('Request not found', ApprovalGateErrorCode.REQUEST_NOT_FOUND, requestId),
      );
    }

    while (request.status === ApprovalStatus.PENDING) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

      // Check if expired
      if (new Date() > request.expiresAt) {
        this.handleTimeout(requestId);
        break;
      }
    }

    const finalRequest = this.requests.get(requestId);
    if (finalRequest === undefined) {
      return err(
        new ApprovalGateError('Request not found', ApprovalGateErrorCode.REQUEST_NOT_FOUND, requestId),
      );
    }

    return ok(finalRequest);
  }

  /**
   * Check if a request was approved
   * @param requestId - The request ID
   * @returns True if approved or auto-approved
   */
  public isApproved(requestId: string): boolean {
    const request = this.requests.get(requestId);
    if (request === undefined) {
      return false;
    }
    return (
      request.status === ApprovalStatus.APPROVED ||
      request.status === ApprovalStatus.AUTO_APPROVED
    );
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private createRequest(
    operation: string,
    description: string,
    level: ApprovalLevel,
    agentId: string,
    context: Record<string, unknown>,
    timeoutMs?: number,
  ): IApprovalRequest {
    this.requestCounter++;
    const id = `apr_${Date.now().toString(36)}_${this.requestCounter.toString(36)}`;
    const now = new Date();
    const timeout = timeoutMs ?? this.config.defaultTimeoutMs;

    return {
      id,
      operation,
      description,
      level,
      agentId,
      context,
      createdAt: now,
      expiresAt: new Date(now.getTime() + timeout),
      status: ApprovalStatus.PENDING,
    };
  }

  private shouldAutoApprove(level: ApprovalLevel): boolean {
    const levelOrder = [ApprovalLevel.AUTO, ApprovalLevel.NOTIFY, ApprovalLevel.APPROVE, ApprovalLevel.BLOCK];
    const requestedIndex = levelOrder.indexOf(level);
    const autoIndex = levelOrder.indexOf(this.config.autoApproveLevel);
    return requestedIndex <= autoIndex;
  }

  private resolveRequest(
    requestId: string,
    status: ApprovalStatus,
    resolvedBy: string,
    reason?: string,
  ): Result<IApprovalRequest, ApprovalGateError> {
    const request = this.requests.get(requestId);
    if (request === undefined) {
      return err(
        new ApprovalGateError('Request not found', ApprovalGateErrorCode.REQUEST_NOT_FOUND, requestId),
      );
    }

    if (request.status !== ApprovalStatus.PENDING) {
      return err(
        new ApprovalGateError('Request already resolved', ApprovalGateErrorCode.ALREADY_RESOLVED, requestId),
      );
    }

    if (new Date() > request.expiresAt) {
      return err(
        new ApprovalGateError('Request expired', ApprovalGateErrorCode.EXPIRED, requestId),
      );
    }

    request.status = status;
    request.resolvedAt = new Date();
    request.resolvedBy = resolvedBy;
    request.reason = reason;

    this.updatePendingCount();
    this.logger.info(`Request ${requestId} resolved: ${status}`);

    return ok(request);
  }

  private handleTimeout(requestId: string): void {
    const request = this.requests.get(requestId);
    if (request !== undefined && request.status === ApprovalStatus.PENDING) {
      request.status = ApprovalStatus.TIMEOUT;
      request.resolvedAt = new Date();
      this.updatePendingCount();
      this.logger.warn(`Request ${requestId} timed out`);
    }
  }

  private updatePendingCount(): void {
    const count = Array.from(this.requests.values()).filter(
      (r) => r.status === ApprovalStatus.PENDING,
    ).length;
    this.pendingCount.next(count);
  }
}

/**
 * Create an approval gate instance
 * @param config - Approval gate configuration
 * @param logger - Logger instance
 * @returns Configured approval gate
 */
export function createApprovalGate(
  config: IApprovalGateConfig,
  logger: ILogger,
): ApprovalGate {
  return new ApprovalGate(config, logger);
}
