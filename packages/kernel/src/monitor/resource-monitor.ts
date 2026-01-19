/**
 * @fileoverview Resource Monitor for tracking token usage, agent activity, and system resources
 * @module @symbiosis/kernel/monitor/resource-monitor
 */

import { BehaviorSubject, interval, takeUntil, Subject, type Observable } from 'rxjs';

/**
 * Token usage statistics for resource monitoring
 */
export interface ITokenUsageStats {
  readonly totalTokens: number;
  readonly tokensPerMinute: number;
  readonly costCentsPerMinute: number;
  readonly budgetRemainingCents: number;
}

/**
 * Active agent information
 */
export interface IActiveAgent {
  readonly agentId: string;
  readonly taskId: string;
  readonly startedAt: Date;
  readonly turnsExecuted: number;
  readonly tokensConsumed: number;
  readonly status: AgentStatus;
}

/**
 * Agent status enum
 */
export type AgentStatus = 'running' | 'waiting' | 'stuck';

/**
 * Complete resource snapshot at a point in time
 */
export interface IResourceSnapshot {
  readonly timestamp: Date;
  readonly tokenUsage: ITokenUsageStats;
  readonly activeAgents: readonly IActiveAgent[];
  readonly pendingTasks: number;
  readonly memoryUsageMB: number;
  readonly apiCallsPerMinute: Readonly<Record<string, number>>;
}

/**
 * Resource limits configuration
 */
export interface IResourceLimits {
  readonly maxTokensPerMinute: number;
  readonly maxCostCentsPerMinute: number;
  readonly maxActiveAgents: number;
  readonly maxAgentTurns: number;
  readonly stuckThresholdMs: number;
  readonly budgetCents: number;
}

/**
 * Default resource limits
 */
export const DEFAULT_RESOURCE_LIMITS: IResourceLimits = {
  maxTokensPerMinute: 100_000,
  maxCostCentsPerMinute: 100, // $1 per minute max
  maxActiveAgents: 5,
  maxAgentTurns: 50,
  stuckThresholdMs: 300_000, // 5 minutes
  budgetCents: 1000, // $10 default budget
};

/**
 * Result of permission check
 */
export interface IPermissionResult {
  readonly allowed: boolean;
  readonly reason?: string;
}

/**
 * Token history entry for tracking usage over time
 */
interface ITokenHistoryEntry {
  readonly timestamp: Date;
  readonly tokens: number;
  readonly costCents: number;
}

/**
 * API call history entry
 */
interface IApiCallEntry {
  readonly timestamp: Date;
  readonly provider: string;
}

/**
 * Resource Monitor for tracking system resources and enforcing limits
 *
 * Provides:
 * - Token usage tracking per minute
 * - Active agent monitoring
 * - Stuck agent detection and killing
 * - Rate limiting and budget enforcement
 * - Memory usage monitoring (browser environment)
 */
export class ResourceMonitor {
  private readonly snapshot$: BehaviorSubject<IResourceSnapshot>;
  private readonly destroy$: Subject<void>;
  private readonly limits: IResourceLimits;
  private readonly activeAgents: Map<string, IActiveAgent>;
  private tokenHistory: ITokenHistoryEntry[];
  private apiCallHistory: IApiCallEntry[];
  private totalTokensConsumed: number;
  private totalCostCents: number;

  /**
   * Create a new Resource Monitor
   * @param limits - Resource limits configuration
   */
  constructor(limits: Partial<IResourceLimits> = {}) {
    this.limits = { ...DEFAULT_RESOURCE_LIMITS, ...limits };
    this.activeAgents = new Map();
    this.tokenHistory = [];
    this.apiCallHistory = [];
    this.totalTokensConsumed = 0;
    this.totalCostCents = 0;
    this.destroy$ = new Subject();

    this.snapshot$ = new BehaviorSubject<IResourceSnapshot>(this.createSnapshot());

    // Poll every 5 seconds
    interval(5000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateSnapshot();
        this.detectStuckAgents();
      });
  }

  /**
   * Get the current resource snapshot
   * @returns Current resource snapshot
   */
  public getSnapshot(): IResourceSnapshot {
    return this.snapshot$.getValue();
  }

  /**
   * Get observable of resource snapshots
   * @returns Observable of resource snapshots
   */
  public getSnapshot$(): Observable<IResourceSnapshot> {
    return this.snapshot$.asObservable();
  }

  /**
   * Get current resource limits
   * @returns Current resource limits
   */
  public getLimits(): IResourceLimits {
    return this.limits;
  }

  /**
   * Record token usage for an agent
   * @param agentId - The agent ID
   * @param tokens - Number of tokens used
   * @param costCents - Cost in cents
   */
  public recordTokenUsage(agentId: string, tokens: number, costCents: number): void {
    const now = new Date();

    this.tokenHistory.push({ timestamp: now, tokens, costCents });
    this.totalTokensConsumed += tokens;
    this.totalCostCents += costCents;

    // Clean up old entries (keep last 5 minutes)
    this.cleanupHistory();

    // Update active agent
    const agent = this.activeAgents.get(agentId);
    if (agent !== undefined) {
      this.activeAgents.set(agentId, {
        ...agent,
        tokensConsumed: agent.tokensConsumed + tokens,
        turnsExecuted: agent.turnsExecuted + 1,
      });
    }

    this.updateSnapshot();
  }

  /**
   * Record an API call for rate limiting
   * @param provider - The API provider name
   */
  public recordApiCall(provider: string): void {
    this.apiCallHistory.push({ timestamp: new Date(), provider });
    this.cleanupHistory();
    this.updateSnapshot();
  }

  /**
   * Start tracking an agent
   * @param agentId - The agent ID
   * @param taskId - The task ID being executed
   * @returns True if the agent was started, false if limits exceeded
   */
  public startAgent(agentId: string, taskId: string): boolean {
    // Check limits
    if (this.activeAgents.size >= this.limits.maxActiveAgents) {
      return false;
    }

    this.activeAgents.set(agentId, {
      agentId,
      taskId,
      startedAt: new Date(),
      turnsExecuted: 0,
      tokensConsumed: 0,
      status: 'running',
    });

    this.updateSnapshot();
    return true;
  }

  /**
   * Stop tracking an agent
   * @param agentId - The agent ID
   */
  public stopAgent(agentId: string): void {
    this.activeAgents.delete(agentId);
    this.updateSnapshot();
  }

  /**
   * Update agent status
   * @param agentId - The agent ID
   * @param status - The new status
   */
  public updateAgentStatus(agentId: string, status: AgentStatus): void {
    const agent = this.activeAgents.get(agentId);
    if (agent !== undefined) {
      this.activeAgents.set(agentId, { ...agent, status });
      this.updateSnapshot();
    }
  }

  /**
   * Kill stuck agents that have exceeded limits
   * @returns Array of killed agent IDs
   */
  public killStuckAgents(): string[] {
    const killed: string[] = [];
    const now = Date.now();

    for (const [agentId, agent] of this.activeAgents) {
      const runtime = now - agent.startedAt.getTime();

      // Kill if stuck (exceeded threshold) or exceeded max turns
      if (runtime > this.limits.stuckThresholdMs || agent.turnsExecuted > this.limits.maxAgentTurns) {
        this.activeAgents.delete(agentId);
        killed.push(agentId);
      }
    }

    if (killed.length > 0) {
      this.updateSnapshot();
    }

    return killed;
  }

  /**
   * Check if an operation can proceed based on current limits
   * @returns Permission result with reason if denied
   */
  public canProceed(): IPermissionResult {
    const snapshot = this.snapshot$.getValue();

    if (snapshot.tokenUsage.tokensPerMinute > this.limits.maxTokensPerMinute) {
      return { allowed: false, reason: 'Token rate limit exceeded' };
    }

    if (snapshot.tokenUsage.costCentsPerMinute > this.limits.maxCostCentsPerMinute) {
      return { allowed: false, reason: 'Cost rate limit exceeded' };
    }

    if (snapshot.tokenUsage.budgetRemainingCents <= 0) {
      return { allowed: false, reason: 'Budget exhausted' };
    }

    return { allowed: true };
  }

  /**
   * Check if a new agent can be started
   * @returns Permission result with reason if denied
   */
  public canStartAgent(): IPermissionResult {
    if (this.activeAgents.size >= this.limits.maxActiveAgents) {
      return { allowed: false, reason: `Maximum active agents (${this.limits.maxActiveAgents}) reached` };
    }

    return this.canProceed();
  }

  /**
   * Get list of currently active agents
   * @returns Array of active agents
   */
  public getActiveAgents(): readonly IActiveAgent[] {
    return Array.from(this.activeAgents.values());
  }

  /**
   * Set the pending tasks count
   * @param count - Number of pending tasks
   */
  public setPendingTasks(count: number): void {
    const current = this.snapshot$.getValue();
    this.snapshot$.next({ ...current, pendingTasks: count });
  }

  /**
   * Destroy the resource monitor and cleanup resources
   */
  public destroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Create a new resource snapshot
   */
  private createSnapshot(): IResourceSnapshot {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    // Calculate tokens per minute
    const recentTokens = this.tokenHistory
      .filter((h) => h.timestamp > oneMinuteAgo)
      .reduce((sum, h) => sum + h.tokens, 0);

    const recentCost = this.tokenHistory
      .filter((h) => h.timestamp > oneMinuteAgo)
      .reduce((sum, h) => sum + h.costCents, 0);

    // Calculate API calls per minute by provider
    const apiCallsPerMinute: Record<string, number> = {};
    const recentApiCalls = this.apiCallHistory.filter((h) => h.timestamp > oneMinuteAgo);
    for (const call of recentApiCalls) {
      apiCallsPerMinute[call.provider] = (apiCallsPerMinute[call.provider] ?? 0) + 1;
    }

    return {
      timestamp: now,
      tokenUsage: {
        totalTokens: this.totalTokensConsumed,
        tokensPerMinute: recentTokens,
        costCentsPerMinute: recentCost,
        budgetRemainingCents: this.limits.budgetCents - this.totalCostCents,
      },
      activeAgents: Array.from(this.activeAgents.values()),
      pendingTasks: 0,
      memoryUsageMB: this.getMemoryUsage(),
      apiCallsPerMinute,
    };
  }

  /**
   * Update the current snapshot
   */
  private updateSnapshot(): void {
    this.snapshot$.next(this.createSnapshot());
  }

  /**
   * Detect and mark stuck agents
   */
  private detectStuckAgents(): void {
    const now = Date.now();
    const warningThreshold = this.limits.stuckThresholdMs / 2;

    for (const [agentId, agent] of this.activeAgents) {
      const runtime = now - agent.startedAt.getTime();
      const isStuck = runtime > warningThreshold;

      if (isStuck && agent.status !== 'stuck') {
        this.activeAgents.set(agentId, { ...agent, status: 'stuck' });
      }
    }
  }

  /**
   * Clean up old history entries
   */
  private cleanupHistory(): void {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    this.tokenHistory = this.tokenHistory.filter((h) => h.timestamp > fiveMinutesAgo);
    this.apiCallHistory = this.apiCallHistory.filter((h) => h.timestamp > fiveMinutesAgo);
  }

  /**
   * Get current memory usage in MB (browser environment)
   */
  private getMemoryUsage(): number {
    // Node.js environment
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memory = process.memoryUsage();
      return Math.round(memory.heapUsed / 1024 / 1024);
    }
    
    // Browser environment
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = performance as Performance & {
        memory?: { usedJSHeapSize: number };
      };
      if (memory.memory !== undefined) {
        return Math.round(memory.memory.usedJSHeapSize / 1024 / 1024);
      }
    }
    
    return 0;
  }
}

/**
 * Create a new Resource Monitor instance
 * @param limits - Optional resource limits
 * @returns ResourceMonitor instance
 */
export function createResourceMonitor(limits?: Partial<IResourceLimits>): ResourceMonitor {
  return new ResourceMonitor(limits);
}
