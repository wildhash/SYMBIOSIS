/**
 * @fileoverview Executor agent implementation
 * @module @symbiosis/agents/executor/executor
 */

import { AgentType } from '@symbiosis/shared';
import type { IAgentConfig, IAgentTask, IAgentResult, ILogger } from '@symbiosis/shared';
import type { EventBus } from '@symbiosis/kernel';

import { BaseAgent } from '../base/agent';
import type { Sandbox, ISandboxConfig } from './sandbox';
import { createSandbox } from './sandbox';
import {
  validateCode,
  isSupportedLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
  type IValidationResult,
} from './validator';

/**
 * Maximum allowed code length to prevent DoS
 */
const MAX_CODE_LENGTH = 100_000;

/**
 * Result of code validation (legacy interface for backward compatibility)
 */
export interface ICodeValidationResult {
  readonly isValid: boolean;
  readonly sanitizedCode: string;
  readonly blockedPatterns: readonly string[];
  readonly errors: readonly string[];
}

/**
 * Validate and sanitize code input
 * This function performs basic input validation before AST-based validation
 * @param code - The code to validate
 * @returns Validation result with sanitized code
 */
export function validateAndSanitizeCode(code: unknown): ICodeValidationResult {
  const errors: string[] = [];

  // Type validation
  if (code === null || code === undefined) {
    return {
      isValid: false,
      sanitizedCode: '',
      blockedPatterns: [],
      errors: ['Code input is required'],
    };
  }

  if (typeof code !== 'string') {
    return {
      isValid: false,
      sanitizedCode: '',
      blockedPatterns: [],
      errors: [`Invalid code type: expected string, got ${typeof code}`],
    };
  }

  // Empty check
  const trimmedCode = code.trim();
  if (trimmedCode.length === 0) {
    return {
      isValid: false,
      sanitizedCode: '',
      blockedPatterns: [],
      errors: ['Code cannot be empty'],
    };
  }

  // Length validation (prevent DoS)
  if (trimmedCode.length > MAX_CODE_LENGTH) {
    return {
      isValid: false,
      sanitizedCode: '',
      blockedPatterns: [],
      errors: [`Code exceeds maximum length of ${MAX_CODE_LENGTH} characters`],
    };
  }

  return {
    isValid: errors.length === 0,
    sanitizedCode: trimmedCode,
    blockedPatterns: [],
    errors,
  };
}

/**
 * Validate language parameter
 * @param language - The language to validate
 * @returns Validation result with language or error
 */
export function validateLanguage(
  language: unknown,
): { isValid: true; language: SupportedLanguage } | { isValid: false; error: string } {
  const languageInput = language ?? 'javascript';
  
  if (typeof languageInput !== 'string') {
    return {
      isValid: false,
      error: `Language must be a string, got ${typeof languageInput}`,
    };
  }
  
  if (!isSupportedLanguage(languageInput)) {
    return {
      isValid: false,
      error: `Unsupported language: "${String(languageInput)}". Supported: ${SUPPORTED_LANGUAGES.join(', ')}`,
    };
  }

  return { isValid: true, language: languageInput };
}

/**
 * Convert AST validation result to legacy format
 */
function convertValidationResult(result: IValidationResult): ICodeValidationResult {
  return {
    isValid: result.isValid,
    sanitizedCode: result.sanitizedCode ?? '',
    blockedPatterns: result.violations.map((v) => v.message),
    errors: result.violations.filter((v) => v.severity === 'error').map((v) => v.message),
  };
}

/**
 * Executor agent configuration
 */
export const EXECUTOR_CONFIG: IAgentConfig = {
  id: 'executor',
  type: AgentType.EXECUTOR,
  name: 'Executor',
  description: 'Executes code in sandboxed environment',
  capabilities: [
    'code-execution',
    'script-running',
    'command-execution',
    'environment-management',
  ],
  maxConcurrentTasks: 2,
  defaultPriority: 3,
};

/**
 * Executor agent for running code
 */
export class ExecutorAgent extends BaseAgent {
  private sandbox: Sandbox;

  constructor(
    logger: ILogger,
    eventBus: EventBus,
    config?: Partial<IAgentConfig>,
    sandboxConfig?: Partial<ISandboxConfig>,
  ) {
    super({ ...EXECUTOR_CONFIG, ...config }, logger, eventBus);
    this.sandbox = createSandbox(sandboxConfig);
  }

  /**
   * Check if this agent can handle a task
   * @param task - The task to check
   * @returns True if can handle
   */
  public canHandle(task: IAgentTask): boolean {
    const executionTasks = ['execute', 'run', 'script', 'command', 'shell', 'eval'];

    const description = task.description.toLowerCase();
    return executionTasks.some((keyword) => description.includes(keyword));
  }

  /**
   * Initialize the executor agent
   */
  protected async onInitialize(): Promise<void> {
    this.logger.info('Executor agent initializing sandbox environment');

    const result = await this.sandbox.initialize();
    if (!result.ok) {
      throw new Error(`Failed to initialize sandbox: ${result.error.message}`);
    }
  }

  /**
   * Execute a code execution task
   * @param task - The task to execute
   * @returns The agent result
   */
  protected async onExecute(task: IAgentTask): Promise<IAgentResult> {
    const startTime = Date.now();

    this.logger.info(`Executor processing task: ${task.description}`);

    const input = task.input as { code?: unknown; language?: unknown } | undefined;

    // Validate language first
    const languageResult = validateLanguage(input?.language);
    if (!languageResult.isValid) {
      this.logger.warn(`Language validation failed: ${languageResult.error}`);
      return {
        taskId: task.id,
        agentId: this.config.id,
        success: false,
        output: null,
        error: languageResult.error,
        executionTimeMs: Date.now() - startTime,
        tokensUsed: 0,
        completedAt: new Date(),
      };
    }

    const language = languageResult.language;

    // Validate basic code input (type, length, etc.)
    const basicValidation = validateAndSanitizeCode(input?.code);
    if (!basicValidation.isValid) {
      const errorMessage = `Invalid code input: ${basicValidation.errors.join(', ')}`;
      this.logger.warn(`Code validation failed: ${errorMessage}`);
      return {
        taskId: task.id,
        agentId: this.config.id,
        success: false,
        output: null,
        error: errorMessage,
        executionTimeMs: Date.now() - startTime,
        tokensUsed: 0,
        completedAt: new Date(),
      };
    }

    // Perform AST-based security validation
    const securityValidation = validateCode(basicValidation.sanitizedCode, language);
    const validation = convertValidationResult(securityValidation);

    if (!validation.isValid) {
      const errorMessage = `Code security validation failed: ${validation.blockedPatterns.join('; ')}`;
      this.logger.warn(`Security validation failed: ${errorMessage}`);
      return {
        taskId: task.id,
        agentId: this.config.id,
        success: false,
        output: null,
        error: errorMessage,
        executionTimeMs: Date.now() - startTime,
        tokensUsed: 0,
        completedAt: new Date(),
      };
    }

    // Log warnings if any were found
    const warnings = securityValidation.violations.filter((v) => v.severity === 'warning');
    if (warnings.length > 0) {
      this.logger.warn(`Code validation warnings: ${warnings.map((w) => w.message).join(', ')}`);
    }

    const code = validation.sanitizedCode;

    const result = await this.sandbox.execute(code, language);

    if (!result.ok) {
      return {
        taskId: task.id,
        agentId: this.config.id,
        success: false,
        output: null,
        error: result.error.message,
        executionTimeMs: Date.now() - startTime,
        tokensUsed: 0,
        completedAt: new Date(),
      };
    }

    return {
      taskId: task.id,
      agentId: this.config.id,
      success: result.value.exitCode === 0,
      output: {
        stdout: result.value.stdout,
        stderr: result.value.stderr,
        exitCode: result.value.exitCode,
      },
      executionTimeMs: Date.now() - startTime,
      tokensUsed: 0,
      completedAt: new Date(),
    };
  }

  /**
   * Terminate the executor agent
   */
  protected async onTerminate(): Promise<void> {
    this.logger.info('Executor agent terminating sandbox');
    await this.sandbox.destroy();
  }
}

/**
 * Create an executor agent
 * @param logger - Logger instance
 * @param eventBus - Event bus instance
 * @param config - Optional config overrides
 * @param sandboxConfig - Optional sandbox config
 * @returns Configured executor agent
 */
export function createExecutorAgent(
  logger: ILogger,
  eventBus: EventBus,
  config?: Partial<IAgentConfig>,
  sandboxConfig?: Partial<ISandboxConfig>,
): ExecutorAgent {
  return new ExecutorAgent(logger, eventBus, config, sandboxConfig);
}
