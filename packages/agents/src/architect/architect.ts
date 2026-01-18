/**
 * @fileoverview Architect agent implementation
 * @module @symbiosis/agents/architect/architect
 */

import { AgentType } from '@symbiosis/shared';
import type { IAgentConfig, IAgentTask, IAgentResult, ILogger } from '@symbiosis/shared';
import type { EventBus } from '@symbiosis/kernel';

import { BaseAgent } from '../base/agent';
import { ARCHITECT_SYSTEM_PROMPT } from './prompts';

/**
 * Architect agent configuration
 */
export const ARCHITECT_CONFIG: IAgentConfig = {
  id: 'architect',
  type: AgentType.ARCHITECT,
  name: 'Architect',
  description: 'Designs system architecture and component structures',
  capabilities: [
    'system-design',
    'api-design',
    'component-planning',
    'technology-selection',
    'scalability-analysis',
  ],
  maxConcurrentTasks: 3,
  defaultPriority: 1,
};

/**
 * Extended configuration options for ArchitectAgent
 */
export interface IArchitectOptions {
  /** Optional simulation delay in milliseconds (defaults to 0 in production) */
  readonly simulationDelayMs?: number;
}

/**
 * Architect agent for system design tasks
 */
export class ArchitectAgent extends BaseAgent {
  private systemPrompt: string;
  private readonly simulationDelayMs: number;

  constructor(
    logger: ILogger,
    eventBus: EventBus,
    config?: Partial<IAgentConfig>,
    options?: IArchitectOptions,
  ) {
    super({ ...ARCHITECT_CONFIG, ...config }, logger, eventBus);
    this.systemPrompt = ARCHITECT_SYSTEM_PROMPT;
    this.simulationDelayMs = options?.simulationDelayMs ?? 0;
  }

  /**
   * Check if this agent can handle a task
   * @param task - The task to check
   * @returns True if can handle
   */
  public canHandle(task: IAgentTask): boolean {
    const architectureTasks = [
      'design',
      'architecture',
      'system',
      'component',
      'api',
      'interface',
      'scalability',
      'structure',
    ];

    const description = task.description.toLowerCase();
    return architectureTasks.some((keyword) => description.includes(keyword));
  }

  /**
   * Initialize the architect agent
   */
  protected async onInitialize(): Promise<void> {
    this.logger.info('Architect agent initializing with system design capabilities');
  }

  /**
   * Execute an architecture task
   * @param task - The task to execute
   * @returns The agent result
   */
  protected async onExecute(task: IAgentTask): Promise<IAgentResult> {
    const startTime = Date.now();

    this.logger.info(`Architect processing task: ${task.description}`);

    // In a real implementation, this would call the LLM via the router
    // For now, we simulate the response
    const architectureResponse = await this.generateArchitectureResponse(task);

    return {
      taskId: task.id,
      agentId: this.config.id,
      success: true,
      output: architectureResponse,
      executionTimeMs: Date.now() - startTime,
      tokensUsed: this.estimateTokens(architectureResponse),
      completedAt: new Date(),
    };
  }

  /**
   * Terminate the architect agent
   */
  protected async onTerminate(): Promise<void> {
    this.logger.info('Architect agent terminating');
  }

  /**
   * Generate architecture response
   * @param task - The task
   * @returns Architecture response
   */
  private async generateArchitectureResponse(task: IAgentTask): Promise<unknown> {
    // Only delay in simulation/dev mode when explicitly configured
    if (this.simulationDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.simulationDelayMs));
    }

    // In production, this would be an actual LLM call
    return {
      type: 'architecture_design',
      taskId: task.id,
      systemPrompt: this.systemPrompt.substring(0, 100),
      components: [
        {
          name: 'Core Module',
          description: 'Main application logic',
          interfaces: ['IModule', 'ILifecycle'],
        },
      ],
      recommendations: [
        'Use dependency injection for better testability',
        'Implement circuit breaker pattern for external services',
        'Consider event-driven architecture for scalability',
      ],
      estimatedComplexity: 'medium',
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
 * Create an architect agent
 * @param logger - Logger instance
 * @param eventBus - Event bus instance
 * @param config - Optional config overrides
 * @param options - Optional architect-specific options
 * @returns Configured architect agent
 */
export function createArchitectAgent(
  logger: ILogger,
  eventBus: EventBus,
  config?: Partial<IAgentConfig>,
  options?: IArchitectOptions,
): ArchitectAgent {
  return new ArchitectAgent(logger, eventBus, config, options);
}
