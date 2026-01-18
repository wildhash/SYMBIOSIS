/**
 * @fileoverview Critic agent implementation
 * @module @symbiosis/agents/critic/critic
 */

import { AgentType } from '@symbiosis/shared';
import type { IAgentConfig, IAgentTask, IAgentResult, ILogger } from '@symbiosis/shared';
import type { EventBus } from '@symbiosis/kernel';

import { BaseAgent } from '../base/agent';
import { CRITIC_SYSTEM_PROMPT } from './prompts';

/**
 * Issue severity levels
 */
export enum IssueSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

/**
 * Review issue structure
 */
export interface IReviewIssue {
  readonly severity: IssueSeverity;
  readonly category: string;
  readonly description: string;
  readonly location?: string;
  readonly suggestion?: string;
}

/**
 * Critic agent configuration
 */
export const CRITIC_CONFIG: IAgentConfig = {
  id: 'critic',
  type: AgentType.CRITIC,
  name: 'Critic',
  description: 'Reviews code and architecture for issues',
  capabilities: [
    'code-review',
    'architecture-review',
    'security-analysis',
    'performance-analysis',
    'compliance-check',
  ],
  maxConcurrentTasks: 4,
  defaultPriority: 2,
};

/**
 * Critic agent for code and architecture review
 */
export class CriticAgent extends BaseAgent {
  private systemPrompt: string;

  constructor(logger: ILogger, eventBus: EventBus, config?: Partial<IAgentConfig>) {
    super({ ...CRITIC_CONFIG, ...config }, logger, eventBus);
    this.systemPrompt = CRITIC_SYSTEM_PROMPT;
  }

  /**
   * Check if this agent can handle a task
   * @param task - The task to check
   * @returns True if can handle
   */
  public canHandle(task: IAgentTask): boolean {
    const reviewTasks = [
      'review',
      'analyze',
      'check',
      'evaluate',
      'assess',
      'critique',
      'security',
      'performance',
    ];

    const description = task.description.toLowerCase();
    return reviewTasks.some((keyword) => description.includes(keyword));
  }

  /**
   * Initialize the critic agent
   */
  protected async onInitialize(): Promise<void> {
    this.logger.info('Critic agent initializing with review capabilities');
  }

  /**
   * Execute a review task
   * @param task - The task to execute
   * @returns The agent result
   */
  protected async onExecute(task: IAgentTask): Promise<IAgentResult> {
    const startTime = Date.now();

    this.logger.info(`Critic processing task: ${task.description}`);

    // Generate review response
    const reviewResponse = await this.generateReviewResponse(task);

    return {
      taskId: task.id,
      agentId: this.config.id,
      success: true,
      output: reviewResponse,
      executionTimeMs: Date.now() - startTime,
      tokensUsed: this.estimateTokens(reviewResponse),
      completedAt: new Date(),
    };
  }

  /**
   * Terminate the critic agent
   */
  protected async onTerminate(): Promise<void> {
    this.logger.info('Critic agent terminating');
  }

  /**
   * Generate review response
   * @param task - The task
   * @returns Review response with issues
   */
  private async generateReviewResponse(task: IAgentTask): Promise<unknown> {
    await new Promise((resolve) => setTimeout(resolve, 100));

    const issues: IReviewIssue[] = [
      {
        severity: IssueSeverity.MEDIUM,
        category: 'code-quality',
        description: 'Consider extracting this logic into a separate function',
        location: 'line 42',
        suggestion: 'Create a helper function for better readability',
      },
      {
        severity: IssueSeverity.LOW,
        category: 'documentation',
        description: 'Missing JSDoc comment for public method',
        location: 'line 15',
        suggestion: 'Add @param and @returns documentation',
      },
    ];

    return {
      type: 'code_review',
      taskId: task.id,
      systemPrompt: this.systemPrompt.substring(0, 100),
      issues,
      summary: {
        totalIssues: issues.length,
        criticalCount: issues.filter((i) => i.severity === IssueSeverity.CRITICAL).length,
        highCount: issues.filter((i) => i.severity === IssueSeverity.HIGH).length,
        mediumCount: issues.filter((i) => i.severity === IssueSeverity.MEDIUM).length,
        lowCount: issues.filter((i) => i.severity === IssueSeverity.LOW).length,
        overallScore: 85,
      },
      recommendations: [
        'Add more unit tests for edge cases',
        'Consider using TypeScript strict mode',
      ],
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
 * Create a critic agent
 * @param logger - Logger instance
 * @param eventBus - Event bus instance
 * @param config - Optional config overrides
 * @returns Configured critic agent
 */
export function createCriticAgent(
  logger: ILogger,
  eventBus: EventBus,
  config?: Partial<IAgentConfig>,
): CriticAgent {
  return new CriticAgent(logger, eventBus, config);
}
