/**
 * @fileoverview Agent-related types for SymbiOS
 * @module @symbiosis/shared/types/agents
 */

/**
 * Types of agents available in SymbiOS
 */
export enum AgentType {
  ARCHITECT = 'architect',
  CODER = 'coder',
  EXECUTOR = 'executor',
  CRITIC = 'critic',
  TERMINAL = 'terminal',
  MANAGER = 'manager',
}

/**
 * Agent lifecycle states
 */
export enum AgentState {
  INITIALIZING = 'initializing',
  READY = 'ready',
  BUSY = 'busy',
  IDLE = 'idle',
  ERROR = 'error',
  TERMINATED = 'terminated',
}

/**
 * Agent configuration
 */
export interface IAgentConfig {
  readonly id: string;
  readonly type: AgentType;
  readonly name: string;
  readonly description: string;
  readonly capabilities: readonly string[];
  readonly maxConcurrentTasks: number;
  readonly defaultPriority: number;
}

/**
 * Agent task definition
 */
export interface IAgentTask {
  readonly id: string;
  readonly agentId: string;
  readonly description: string;
  readonly input: unknown;
  readonly priority: number;
  readonly requiresApproval: boolean;
  readonly timeoutMs: number;
  readonly createdAt: Date;
}

/**
 * Agent task result
 */
export interface IAgentResult {
  readonly taskId: string;
  readonly agentId: string;
  readonly success: boolean;
  readonly output: unknown;
  readonly error?: string;
  readonly executionTimeMs: number;
  readonly tokensUsed: number;
  readonly completedAt: Date;
}

/**
 * Agent metrics
 */
export interface IAgentMetrics {
  readonly totalTasks: number;
  readonly successfulTasks: number;
  readonly failedTasks: number;
  readonly averageExecutionTimeMs: number;
  readonly totalTokensUsed: number;
}

/**
 * Inter-agent message
 */
export interface IAgentMessage {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly type: string;
  readonly payload: unknown;
  readonly timestamp: Date;
  readonly correlationId?: string;
}
