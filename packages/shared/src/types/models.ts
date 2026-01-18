/**
 * @fileoverview Model-related types for the SymbiOS kernel
 * @module @symbiosis/shared/types/models
 */

/**
 * Available LLM providers in the SymbiOS ecosystem
 */
export enum ModelProvider {
  ANTHROPIC = 'anthropic',
  OPENAI = 'openai',
  GOOGLE = 'google',
  DEEPSEEK = 'deepseek',
  LOCAL = 'local',
}

/**
 * Capabilities that models can have
 */
export enum ModelCapability {
  SAFETY_CRITICAL = 'safety_critical',
  CODE_GENERATION = 'code_generation',
  REASONING = 'reasoning',
  FAST_RESPONSE = 'fast_response',
  COST_OPTIMIZED = 'cost_optimized',
  VISION = 'vision',
  LONG_CONTEXT = 'long_context',
}

/**
 * Task categories for routing decisions
 */
export enum TaskCategory {
  SAFETY_REVIEW = 'safety_review',
  CODE_GENERATION = 'code_generation',
  CODE_REVIEW = 'code_review',
  ARCHITECTURE = 'architecture',
  GENERAL = 'general',
  FAST_LOOKUP = 'fast_lookup',
}

/**
 * Task priority levels
 */
export enum Priority {
  CRITICAL = 0,
  HIGH = 1,
  MEDIUM = 2,
  LOW = 3,
}

/**
 * Approval levels for operations
 */
export enum ApprovalLevel {
  AUTO = 'auto',
  NOTIFY = 'notify',
  APPROVE = 'approve',
  BLOCK = 'block',
}

/**
 * Model configuration interface
 */
export interface IModelConfig {
  readonly provider: ModelProvider;
  readonly modelId: string;
  readonly capabilities: readonly ModelCapability[];
  readonly costPerMillionTokens: number;
  readonly maxContextTokens: number;
  readonly averageLatencyMs: number;
  readonly rateLimitPerMinute: number;
  readonly isAvailable: boolean;
}

/**
 * Token usage tracking
 */
export interface ITokenUsage {
  readonly prompt: number;
  readonly completion: number;
  readonly total: number;
}

/**
 * Model response structure
 */
export interface IModelResponse {
  readonly content: string;
  readonly tokensUsed: ITokenUsage;
  readonly finishReason: 'stop' | 'length' | 'content_filter' | 'error';
  readonly modelId: string;
}

/**
 * Message structure for conversations
 */
export interface IMessage {
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
  readonly timestamp: Date;
}

/**
 * Task context for routing
 */
export interface ITaskContext {
  readonly agentId: string;
  readonly conversationId: string;
  readonly previousMessages: readonly IMessage[];
  readonly tokenBudget: number;
}
