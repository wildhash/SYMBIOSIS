/**
 * @fileoverview Core kernel types
 * @module @symbiosis/kernel/types/kernel
 */

import type {
  IModelConfig,
  ITaskContext,
  ModelCapability,
  ModelProvider,
  Priority,
  TaskCategory,
  ApprovalLevel,
  ITokenUsage,
  IModelResponse,
} from '@symbiosis/shared';

/**
 * Routing strategy types
 */
export type RoutingStrategy = 'rule_based' | 'cost_optimized' | 'latency_optimized' | 'capability_match';

/**
 * Routing request interface
 */
export interface IRoutingRequest {
  readonly id: string;
  readonly task: string;
  readonly category: TaskCategory;
  readonly priority: Priority;
  readonly requiredCapabilities?: readonly ModelCapability[];
  readonly maxCostCents?: number;
  readonly maxLatencyMs?: number;
  readonly preferredProvider?: ModelProvider;
  readonly context?: ITaskContext;
}

/**
 * Routing decision interface
 */
export interface IRoutingDecision {
  readonly requestId: string;
  readonly selectedModel: IModelConfig;
  readonly reasoning: string;
  readonly estimatedCostCents: number;
  readonly estimatedLatencyMs: number;
  readonly approvalLevel: ApprovalLevel;
  readonly fallbackChain: readonly IModelConfig[];
  readonly timestamp: Date;
}

/**
 * Routing result interface
 */
export interface IRoutingResult {
  readonly decision: IRoutingDecision;
  readonly response: IModelResponse;
  readonly actualCostCents: number;
  readonly actualLatencyMs: number;
  readonly retryCount: number;
}

/**
 * Router configuration
 */
export interface IRouterConfig {
  readonly models: readonly IModelConfig[];
  readonly defaultStrategy: RoutingStrategy;
  readonly circuitBreakerThreshold: number;
  readonly maxRetries: number;
  readonly timeoutMs: number;
}

/**
 * Router metrics
 */
export interface IRouterMetrics {
  readonly totalRequests: number;
  readonly successfulRequests: number;
  readonly failedRequests: number;
  readonly averageLatencyMs: number;
  readonly totalCostCents: number;
  readonly modelUsage: ReadonlyMap<string, number>;
}

/**
 * Execution budget for circuit breaker
 */
export interface IExecutionBudget {
  readonly maxTokens: number;
  readonly maxTurns: number;
  readonly maxTimeMs: number;
  readonly maxCostCents: number;
  currentFuel: number;
}

/**
 * Execution context for tracking
 */
export interface IExecutionContext {
  readonly id: string;
  readonly agentId: string;
  readonly startTime: Date;
  readonly budget: IExecutionBudget;
  tokensUsed: number;
  turnsExecuted: number;
  costAccumulated: number;
}

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

/**
 * Circuit breaker configuration
 */
export interface ICircuitBreakerConfig {
  readonly failureThreshold: number;
  readonly successThreshold: number;
  readonly resetTimeoutMs: number;
  readonly defaultBudget: IExecutionBudget;
}

/**
 * Event bus configuration
 */
export interface IEventBusConfig {
  readonly replayBufferSize: number;
  readonly enableLogging: boolean;
}

/**
 * Scheduler configuration
 */
export interface ISchedulerConfig {
  readonly maxConcurrent: number;
  readonly defaultTimeoutMs: number;
  readonly priorityLevels: number;
}

/**
 * Scheduled task
 */
export interface IScheduledTask<T = unknown> {
  readonly id: string;
  readonly priority: Priority;
  readonly createdAt: Date;
  readonly timeoutMs: number;
  readonly execute: () => Promise<T>;
}
