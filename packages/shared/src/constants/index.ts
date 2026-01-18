/**
 * @fileoverview Constants for SymbiOS
 * @module @symbiosis/shared/constants
 */

/**
 * Default budget configuration for execution contexts
 */
export const DEFAULT_EXECUTION_BUDGET = {
  maxTokens: 100000,
  maxTurns: 50,
  maxTimeMs: 300000, // 5 minutes
  maxCostCents: 500,
  currentFuel: 100,
} as const;

/**
 * Default router configuration
 */
export const DEFAULT_ROUTER_CONFIG = {
  circuitBreakerThreshold: 5,
  maxRetries: 3,
  timeoutMs: 30000,
} as const;

/**
 * Default event bus configuration
 */
export const DEFAULT_EVENT_BUS_CONFIG = {
  replayBufferSize: 100,
  enableLogging: true,
} as const;

/**
 * Model provider default configurations
 */
export const MODEL_DEFAULTS = {
  anthropic: {
    modelId: 'claude-3-opus',
    costPerMillionTokens: 15,
    maxContextTokens: 200000,
    averageLatencyMs: 500,
    rateLimitPerMinute: 60,
  },
  openai: {
    modelId: 'gpt-5.2',
    costPerMillionTokens: 10,
    maxContextTokens: 128000,
    averageLatencyMs: 300,
    rateLimitPerMinute: 100,
  },
  google: {
    modelId: 'gemini-2.0-pro',
    costPerMillionTokens: 8,
    maxContextTokens: 1000000,
    averageLatencyMs: 400,
    rateLimitPerMinute: 80,
  },
  deepseek: {
    modelId: 'deepseek-v3',
    costPerMillionTokens: 2,
    maxContextTokens: 64000,
    averageLatencyMs: 350,
    rateLimitPerMinute: 120,
  },
  local: {
    modelId: 'llama-3-8b',
    costPerMillionTokens: 0,
    maxContextTokens: 8192,
    averageLatencyMs: 100,
    rateLimitPerMinute: 1000,
  },
} as const;

/**
 * Version information
 */
export const VERSION = {
  major: 0,
  minor: 1,
  patch: 0,
  prerelease: 'alpha',
  full: '0.1.0-alpha',
} as const;
