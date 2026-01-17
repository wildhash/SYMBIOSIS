/**
 * @fileoverview Executor agent implementation
 * @module @symbiosis/agents/executor/executor
 */

import { AgentType } from '@symbiosis/shared';
import type { IAgentConfig, IAgentTask, IAgentResult, ILogger } from '@symbiosis/shared';
import type { EventBus } from '@symbiosis/kernel';

import { BaseAgent } from '../base/agent';
import { Sandbox, createSandbox } from './sandbox';
import type { ISandboxConfig } from './sandbox';

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

    const input = task.input as { code?: string; language?: string } | undefined;
    const code = input?.code ?? '// No code provided';
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
