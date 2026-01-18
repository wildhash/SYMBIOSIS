/**
 * @fileoverview Circuit breaker implementation to prevent infinite loops,
 * cost explosions, and runaway agent behavior.
 *
 * Implements the "Fuel-based execution" pattern from Grok's council input.
 * @module @symbiosis/kernel/safety/circuit-breaker
 */

import { BehaviorSubject } from 'rxjs';
import type { Observable } from 'rxjs';

import type { ILogger } from '@symbiosis/shared';
import { ok, err } from '@symbiosis/shared';
import type { Result } from '@symbiosis/shared';
import { CircuitBreakerError, CircuitBreakerErrorCode } from '@symbiosis/shared';

import type {
  ICircuitBreakerConfig,
  IExecutionBudget,
  IExecutionContext,
} from '../types/kernel';
import { CircuitState } from '../types/kernel';

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Circuit breaker for preventing runaway execution
 */
export class CircuitBreaker {
  private readonly state: BehaviorSubject<CircuitState>;
  private readonly contexts: Map<string, IExecutionContext>;
  private readonly config: ICircuitBreakerConfig;
  private readonly logger: ILogger;

  private failureCount: number;
  private successCount: number;
  private lastFailureTime: Date | null;

  constructor(config: ICircuitBreakerConfig, logger: ILogger) {
    this.config = config;
    this.logger = logger;
    this.state = new BehaviorSubject<CircuitState>(CircuitState.CLOSED);
    this.contexts = new Map();
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }

  /**
   * Create a new execution context with budget constraints.
   * @param id - Unique context ID
   * @param agentId - ID of the agent owning this context
   * @param customBudget - Optional custom budget overrides
   * @returns Result containing the context or an error
   */
  public createContext(
    id: string,
    agentId: string,
    customBudget?: Partial<IExecutionBudget>,
  ): Result<IExecutionContext, CircuitBreakerError> {
    // Check if circuit is open
    if (this.state.getValue() === CircuitState.OPEN) {
      // Check if we should attempt recovery
      if (this.shouldAttemptRecovery()) {
        this.state.next(CircuitState.HALF_OPEN);
        this.logger.info('Circuit breaker entering half-open state');
      } else {
        return err(
          new CircuitBreakerError('Circuit breaker is open', CircuitBreakerErrorCode.CIRCUIT_OPEN, id),
        );
      }
    }

    const budget: IExecutionBudget = {
      maxTokens: customBudget?.maxTokens ?? this.config.defaultBudget.maxTokens,
      maxTurns: customBudget?.maxTurns ?? this.config.defaultBudget.maxTurns,
      maxTimeMs: customBudget?.maxTimeMs ?? this.config.defaultBudget.maxTimeMs,
      maxCostCents: customBudget?.maxCostCents ?? this.config.defaultBudget.maxCostCents,
      currentFuel: customBudget?.currentFuel ?? this.config.defaultBudget.currentFuel,
    };

    const context: IExecutionContext = {
      id,
      agentId,
      startTime: new Date(),
      budget,
      tokensUsed: 0,
      turnsExecuted: 0,
      costAccumulated: 0,
    };

    this.contexts.set(id, context);
    this.logger.info(`Created execution context ${id} for agent ${agentId}`);

    return ok(context);
  }

  /**
   * Check if an operation can proceed within budget constraints.
   * @param contextId - The context ID to check
   * @returns Result indicating if operation can proceed
   */
  public canProceed(contextId: string): Result<boolean, CircuitBreakerError> {
    const context = this.contexts.get(contextId);
    if (context === undefined) {
      return err(
        new CircuitBreakerError(
          'Context not found',
          CircuitBreakerErrorCode.BUDGET_EXCEEDED,
          contextId,
        ),
      );
    }

    // Check fuel (Grok's pattern)
    if (context.budget.currentFuel <= 0) {
      return err(
        new CircuitBreakerError('Fuel depleted', CircuitBreakerErrorCode.FUEL_DEPLETED, contextId),
      );
    }

    // Check token budget
    if (context.tokensUsed >= context.budget.maxTokens) {
      return err(
        new CircuitBreakerError(
          'Token budget exceeded',
          CircuitBreakerErrorCode.BUDGET_EXCEEDED,
          contextId,
        ),
      );
    }

    // Check turn limit
    if (context.turnsExecuted >= context.budget.maxTurns) {
      return err(
        new CircuitBreakerError(
          'Max turns exceeded',
          CircuitBreakerErrorCode.MAX_TURNS_EXCEEDED,
          contextId,
        ),
      );
    }

    // Check cost ceiling
    if (context.costAccumulated >= context.budget.maxCostCents) {
      return err(
        new CircuitBreakerError(
          'Cost budget exceeded',
          CircuitBreakerErrorCode.BUDGET_EXCEEDED,
          contextId,
        ),
      );
    }

    // Check timeout
    const elapsed = Date.now() - context.startTime.getTime();
    if (elapsed >= context.budget.maxTimeMs) {
      return err(
        new CircuitBreakerError('Execution timeout', CircuitBreakerErrorCode.TIMEOUT, contextId),
      );
    }

    return ok(true);
  }

  /**
   * Record resource consumption for a context.
   * @param contextId - The context ID
   * @param tokens - Tokens used
   * @param costCents - Cost in cents
   * @returns Result containing updated context
   */
  public recordUsage(
    contextId: string,
    tokens: number,
    costCents: number,
  ): Result<IExecutionContext, CircuitBreakerError> {
    const context = this.contexts.get(contextId);
    if (context === undefined) {
      return err(
        new CircuitBreakerError(
          'Context not found',
          CircuitBreakerErrorCode.BUDGET_EXCEEDED,
          contextId,
        ),
      );
    }

    // Update mutable fields
    context.tokensUsed += tokens;
    context.costAccumulated += costCents;
    context.turnsExecuted += 1;
    context.budget.currentFuel -= 1; // Decrement fuel per turn

    this.logger.debug(
      `Context ${contextId}: tokens=${String(context.tokensUsed)}/${String(context.budget.maxTokens)}, ` +
        `turns=${String(context.turnsExecuted)}/${String(context.budget.maxTurns)}, ` +
        `fuel=${String(context.budget.currentFuel)}`,
    );

    return ok(context);
  }

  /**
   * Get context by ID
   * @param contextId - The context ID
   * @returns The context if found
   */
  public getContext(contextId: string): IExecutionContext | undefined {
    return this.contexts.get(contextId);
  }

  /**
   * Record a successful operation (for circuit breaker state).
   */
  public recordSuccess(): void {
    this.successCount++;

    if (this.state.getValue() === CircuitState.HALF_OPEN) {
      if (this.successCount >= this.config.successThreshold) {
        this.state.next(CircuitState.CLOSED);
        this.failureCount = 0;
        this.successCount = 0;
        this.logger.info('Circuit breaker closed after successful recovery');
      }
    }
  }

  /**
   * Record a failed operation (for circuit breaker state).
   */
  public recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    this.successCount = 0;

    if (this.state.getValue() === CircuitState.HALF_OPEN) {
      this.state.next(CircuitState.OPEN);
      this.logger.warn('Circuit breaker re-opened after failure during recovery');
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state.next(CircuitState.OPEN);
      this.logger.warn(`Circuit breaker opened after ${String(this.failureCount)} failures`);
    }
  }

  /**
   * Get observable of circuit state changes.
   * @returns Observable of circuit states
   */
  public getStateStream(): Observable<CircuitState> {
    return this.state.asObservable();
  }

  /**
   * Get current circuit state.
   * @returns Current circuit state
   */
  public getState(): CircuitState {
    return this.state.getValue();
  }

  /**
   * Get failure count
   * @returns Current failure count
   */
  public getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Get success count
   * @returns Current success count
   */
  public getSuccessCount(): number {
    return this.successCount;
  }

  /**
   * Release a context (cleanup).
   * @param contextId - The context ID to release
   */
  public releaseContext(contextId: string): void {
    this.contexts.delete(contextId);
    this.logger.info(`Released execution context ${contextId}`);
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private shouldAttemptRecovery(): boolean {
    if (this.lastFailureTime === null) {
      return true;
    }

    const elapsed = Date.now() - this.lastFailureTime.getTime();
    return elapsed >= this.config.resetTimeoutMs;
  }
}

/**
 * Create a circuit breaker instance
 * @param config - Circuit breaker configuration
 * @param logger - Logger instance
 * @returns Configured circuit breaker
 */
export function createCircuitBreaker(
  config: ICircuitBreakerConfig,
  logger: ILogger,
): CircuitBreaker {
  return new CircuitBreaker(config, logger);
}
