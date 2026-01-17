/**
 * @fileoverview Error types for SymbiOS
 * @module @symbiosis/shared/types/errors
 */

/**
 * Base error class for all SymbiOS errors
 */
export abstract class SymbiosError extends Error {
  public abstract readonly code: string;
  public readonly timestamp: Date;

  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace !== undefined) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for logging/serialization
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
      cause: this.cause instanceof Error ? this.cause.message : undefined,
    };
  }
}

/**
 * Router error codes
 */
export enum RouterErrorCode {
  NO_AVAILABLE_MODEL = 'NO_AVAILABLE_MODEL',
  ALL_MODELS_FAILED = 'ALL_MODELS_FAILED',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',
}

/**
 * Router-specific error
 */
export class RouterError extends SymbiosError {
  public readonly code: RouterErrorCode;

  constructor(
    message: string,
    code: RouterErrorCode,
    public readonly requestId?: string,
    cause?: Error,
  ) {
    super(message, cause);
    this.code = code;
  }
}

/**
 * Circuit breaker error codes
 */
export enum CircuitBreakerErrorCode {
  CIRCUIT_OPEN = 'CIRCUIT_OPEN',
  BUDGET_EXCEEDED = 'BUDGET_EXCEEDED',
  FUEL_DEPLETED = 'FUEL_DEPLETED',
  TIMEOUT = 'TIMEOUT',
  MAX_TURNS_EXCEEDED = 'MAX_TURNS_EXCEEDED',
}

/**
 * Circuit breaker specific error
 */
export class CircuitBreakerError extends SymbiosError {
  public readonly code: CircuitBreakerErrorCode;

  constructor(
    message: string,
    code: CircuitBreakerErrorCode,
    public readonly contextId?: string,
    cause?: Error,
  ) {
    super(message, cause);
    this.code = code;
  }
}

/**
 * Agent error codes
 */
export enum AgentErrorCode {
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  TIMEOUT = 'TIMEOUT',
  INVALID_TASK = 'INVALID_TASK',
  NOT_READY = 'NOT_READY',
  TERMINATED = 'TERMINATED',
}

/**
 * Agent-specific error
 */
export class AgentError extends SymbiosError {
  public readonly code: AgentErrorCode;

  constructor(
    message: string,
    code: AgentErrorCode,
    public readonly agentId?: string,
    cause?: Error,
  ) {
    super(message, cause);
    this.code = code;
  }
}

/**
 * Validation error codes
 */
export enum ValidationErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED = 'MISSING_REQUIRED',
  TYPE_MISMATCH = 'TYPE_MISMATCH',
  OUT_OF_RANGE = 'OUT_OF_RANGE',
}

/**
 * Validation-specific error
 */
export class ValidationError extends SymbiosError {
  public readonly code: ValidationErrorCode;

  constructor(
    message: string,
    code: ValidationErrorCode,
    public readonly field?: string,
    cause?: Error,
  ) {
    super(message, cause);
    this.code = code;
  }
}
