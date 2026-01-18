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

/**
 * Blocked patterns for code security validation
 * These patterns detect potentially dangerous code constructs
 */
const BLOCKED_PATTERNS: readonly RegExp[] = [
  /\beval\s*\(/g,
  /\bFunction\s*\(/g,
  /\brequire\s*\(/g,
  /\bimport\s*\(/g,
  /\bprocess\./g,
  /\b__proto__\b/g,
  /\bconstructor\s*\[/g,
  /\bchild_process\b/g,
  /\bfs\./g,
  /\bexec\s*\(/g,
  /\bspawn\s*\(/g,
];

/**
 * Maximum allowed code length to prevent DoS
 */
const MAX_CODE_LENGTH = 100_000;

/**
 * Result of code validation
 */
export interface ICodeValidationResult {
  readonly isValid: boolean;
  readonly sanitizedCode: string;
  readonly blockedPatterns: readonly string[];
  readonly errors: readonly string[];
}

/**
 * Validate and sanitize code input
 * @param code - The code to validate
 * @returns Validation result with sanitized code
 */
export function validateAndSanitizeCode(code: unknown): ICodeValidationResult {
  const errors: string[] = [];
  const blockedPatterns: string[] = [];

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

  // Pattern detection and sanitization
  let sanitizedCode = trimmedCode;
  for (const pattern of BLOCKED_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    const matches = trimmedCode.match(pattern);
    if (matches !== null) {
      blockedPatterns.push(...matches);
      sanitizedCode = sanitizedCode.replace(pattern, '/* BLOCKED: $& */');
    }
  }

  return {
    isValid: blockedPatterns.length === 0 && errors.length === 0,
    sanitizedCode,
    blockedPatterns,
    errors,
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

    const input = task.input as { code?: unknown; language?: string } | undefined;

    // Validate and sanitize code input
    const validation = validateAndSanitizeCode(input?.code);

    if (!validation.isValid) {
      const errorMessage =
        validation.errors.length > 0
          ? `Invalid code input: ${validation.errors.join(', ')}`
          : `Blocked dangerous patterns detected: ${validation.blockedPatterns.join(', ')}`;

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

    // Log blocked patterns if any were found (code was sanitized)
    if (validation.blockedPatterns.length > 0) {
      this.logger.warn(
        `Blocked dangerous patterns in code: ${validation.blockedPatterns.join(', ')}`,
      );
    }

    const code = validation.sanitizedCode;
    const language = (input?.language ?? 'javascript') as 'javascript' | 'typescript' | 'shell';

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
