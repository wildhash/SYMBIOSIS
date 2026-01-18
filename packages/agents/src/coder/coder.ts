/**
 * @fileoverview Coder agent implementation
 * @module @symbiosis/agents/coder/coder
 */

import { AgentType } from '@symbiosis/shared';
import type { IAgentConfig, IAgentTask, IAgentResult, ILogger } from '@symbiosis/shared';
import type { EventBus } from '@symbiosis/kernel';

import { BaseAgent } from '../base/agent';
import { CODER_SYSTEM_PROMPT } from './prompts';

/**
 * Coder agent configuration
 */
export const CODER_CONFIG: IAgentConfig = {
  id: 'coder',
  type: AgentType.CODER,
  name: 'Coder',
  description: 'Writes, modifies, and reviews code',
  capabilities: [
    'code-generation',
    'code-modification',
    'bug-fixing',
    'refactoring',
    'code-review',
    'testing',
  ],
  maxConcurrentTasks: 5,
  defaultPriority: 2,
};

/**
 * Coder agent for code-related tasks
 */
export class CoderAgent extends BaseAgent {
  private systemPrompt: string;

  constructor(logger: ILogger, eventBus: EventBus, config?: Partial<IAgentConfig>) {
    super({ ...CODER_CONFIG, ...config }, logger, eventBus);
    this.systemPrompt = CODER_SYSTEM_PROMPT;
  }

  /**
   * Check if this agent can handle a task
   * @param task - The task to check
   * @returns True if can handle
   */
  public canHandle(task: IAgentTask): boolean {
    const codingTasks = [
      'code',
      'implement',
      'write',
      'create',
      'fix',
      'bug',
      'refactor',
      'function',
      'class',
      'component',
      'test',
    ];

    const description = task.description.toLowerCase();
    return codingTasks.some((keyword) => description.includes(keyword));
  }

  /**
   * Initialize the coder agent
   */
  protected async onInitialize(): Promise<void> {
    this.logger.info('Coder agent initializing with code generation capabilities');
  }

  /**
   * Execute a coding task
   * @param task - The task to execute
   * @returns The agent result
   */
  protected async onExecute(task: IAgentTask): Promise<IAgentResult> {
    const startTime = Date.now();

    this.logger.info(`Coder processing task: ${task.description}`);

    // In a real implementation, this would call the LLM via the router
    const codeResponse = await this.generateCodeResponse(task);

    return {
      taskId: task.id,
      agentId: this.config.id,
      success: true,
      output: codeResponse,
      executionTimeMs: Date.now() - startTime,
      tokensUsed: this.estimateTokens(codeResponse),
      completedAt: new Date(),
    };
  }

  /**
   * Terminate the coder agent
   */
  protected async onTerminate(): Promise<void> {
    this.logger.info('Coder agent terminating');
  }

  /**
   * Generate code response
   * @param task - The task
   * @returns Code response
   */
  private async generateCodeResponse(task: IAgentTask): Promise<unknown> {
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      type: 'code_generation',
      taskId: task.id,
      systemPrompt: this.systemPrompt.substring(0, 100),
      code: '// Generated code placeholder',
      language: 'typescript',
      tests: '// Generated tests placeholder',
      documentation: 'Generated documentation',
    };
  }

  /**
   * Estimate token usage
   * @param response - The response object
   * @returns Estimated tokens
   */
  private estimateTokens(response: unknown): number {
    const jsonStr = JSON.stringify(response);
    return Math.ceil(jsonStr.length / 4);
  }
}

/**
 * Create a coder agent
 * @param logger - Logger instance
 * @param eventBus - Event bus instance
 * @param config - Optional config overrides
 * @returns Configured coder agent
 */
export function createCoderAgent(
  logger: ILogger,
  eventBus: EventBus,
  config?: Partial<IAgentConfig>,
): CoderAgent {
  return new CoderAgent(logger, eventBus, config);
}
