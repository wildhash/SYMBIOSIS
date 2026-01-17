/**
 * @fileoverview Base agent class that all agents extend
 * @module @symbiosis/agents/base/agent
 */

import { BehaviorSubject } from 'rxjs';
import type { Observable } from 'rxjs';

import type { ILogger, Result } from '@symbiosis/shared';
import {
  AgentState,
  AgentError,
  AgentErrorCode,
  ok,
  err,
} from '@symbiosis/shared';
import type { IAgentConfig, IAgentTask, IAgentResult, IAgentMetrics } from '@symbiosis/shared';
import type { EventBus } from '@symbiosis/kernel';
import { EventType } from '@symbiosis/kernel';

import { AgentLifecycle } from './lifecycle';

// ============================================================================
// ABSTRACT BASE AGENT
// ============================================================================

/**
 * Abstract base class for all SymbiOS agents
 */
export abstract class BaseAgent {
  protected readonly config: IAgentConfig;
  protected readonly logger: ILogger;
  protected readonly eventBus: EventBus;
  protected readonly lifecycle: AgentLifecycle;
  protected readonly metricsSubject: BehaviorSubject<IAgentMetrics>;

  private activeTasks: number;
  private totalTasks: number;
  private successfulTasks: number;
  private failedTasks: number;
  private totalExecutionTime: number;
  private totalTokensUsed: number;

  constructor(config: IAgentConfig, logger: ILogger, eventBus: EventBus) {
    this.config = config;
    this.logger = logger.child !== undefined
      ? (logger as { child: (name: string) => ILogger }).child(config.id)
      : logger;
    this.eventBus = eventBus;
    this.lifecycle = new AgentLifecycle(config.id, this.logger);
    this.metricsSubject = new BehaviorSubject<IAgentMetrics>({
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      averageExecutionTimeMs: 0,
      totalTokensUsed: 0,
    });

    this.activeTasks = 0;
    this.totalTasks = 0;
    this.successfulTasks = 0;
    this.failedTasks = 0;
    this.totalExecutionTime = 0;
    this.totalTokensUsed = 0;
  }

  /**
   * Get agent ID
   */
  public get id(): string {
    return this.config.id;
  }

  /**
   * Get agent type
   */
  public get type(): string {
    return this.config.type;
  }

  /**
   * Get agent name
   */
  public get name(): string {
    return this.config.name;
  }

  /**
   * Initialize the agent
   * @returns Result indicating success or failure
   */
  public async initialize(): Promise<Result<void, AgentError>> {
    try {
      this.logger.info(`Initializing agent ${this.config.id}`);

      await this.onInitialize();

      await this.lifecycle.transitionTo(AgentState.READY);

      this.eventBus.emit(EventType.AGENT_SPAWNED, this.config.id, {
        agentId: this.config.id,
        type: this.config.type,
      });

      return ok(undefined);
    } catch (error) {
      await this.lifecycle.transitionTo(AgentState.ERROR);
      return err(
        new AgentError(
          `Failed to initialize agent: ${error instanceof Error ? error.message : 'Unknown'}`,
          AgentErrorCode.INITIALIZATION_FAILED,
          this.config.id,
        ),
      );
    }
  }

  /**
   * Execute a task
   * @param task - The task to execute
   * @returns Result containing the agent result
   */
  public async execute(task: IAgentTask): Promise<Result<IAgentResult, AgentError>> {
    if (!this.lifecycle.canAcceptTasks()) {
      return err(
        new AgentError(
          `Agent ${this.config.id} is not ready to accept tasks`,
          AgentErrorCode.NOT_READY,
          this.config.id,
        ),
      );
    }

    if (this.activeTasks >= this.config.maxConcurrentTasks) {
      return err(
        new AgentError(
          `Agent ${this.config.id} has reached max concurrent tasks`,
          AgentErrorCode.NOT_READY,
          this.config.id,
        ),
      );
    }

    this.activeTasks++;
    await this.lifecycle.transitionTo(AgentState.BUSY);

    this.eventBus.emit(EventType.TASK_STARTED, this.config.id, {
      taskId: task.id,
      agentId: this.config.id,
    });

    const startTime = Date.now();

    try {
      const result = await this.onExecute(task);

      const executionTime = Date.now() - startTime;
      this.totalTasks++;
      this.totalExecutionTime += executionTime;

      if (result.success) {
        this.successfulTasks++;
        this.totalTokensUsed += result.tokensUsed;

        this.eventBus.emit(EventType.TASK_COMPLETED, this.config.id, {
          taskId: task.id,
          agentId: this.config.id,
          executionTimeMs: executionTime,
        });
      } else {
        this.failedTasks++;

        this.eventBus.emit(EventType.TASK_FAILED, this.config.id, {
          taskId: task.id,
          agentId: this.config.id,
          error: result.error,
        });
      }

      this.updateMetrics();

      return ok(result);
    } catch (error) {
      this.failedTasks++;
      this.totalTasks++;
      this.updateMetrics();

      this.eventBus.emit(EventType.TASK_FAILED, this.config.id, {
        taskId: task.id,
        agentId: this.config.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return err(
        new AgentError(
          `Task execution failed: ${error instanceof Error ? error.message : 'Unknown'}`,
          AgentErrorCode.EXECUTION_FAILED,
          this.config.id,
        ),
      );
    } finally {
      this.activeTasks--;
      if (this.activeTasks === 0) {
        await this.lifecycle.transitionTo(AgentState.IDLE);
      }
    }
  }

  /**
   * Terminate the agent
   * @returns Result indicating success or failure
   */
  public async terminate(): Promise<Result<void, AgentError>> {
    try {
      this.logger.info(`Terminating agent ${this.config.id}`);

      await this.onTerminate();

      await this.lifecycle.transitionTo(AgentState.TERMINATED);

      this.eventBus.emit(EventType.AGENT_TERMINATED, this.config.id, {
        agentId: this.config.id,
      });

      return ok(undefined);
    } catch (error) {
      return err(
        new AgentError(
          `Failed to terminate agent: ${error instanceof Error ? error.message : 'Unknown'}`,
          AgentErrorCode.TERMINATED,
          this.config.id,
        ),
      );
    }
  }

  /**
   * Get current agent state
   * @returns Current state
   */
  public getState(): AgentState {
    return this.lifecycle.getState();
  }

  /**
   * Get observable of state changes
   * @returns Observable of states
   */
  public getStateStream(): Observable<AgentState> {
    return this.lifecycle.getStateStream();
  }

  /**
   * Get current metrics
   * @returns Current metrics
   */
  public getMetrics(): IAgentMetrics {
    return this.metricsSubject.getValue();
  }

  /**
   * Get observable of metrics changes
   * @returns Observable of metrics
   */
  public getMetricsStream(): Observable<IAgentMetrics> {
    return this.metricsSubject.asObservable();
  }

  /**
   * Check if agent can handle a task
   * @param task - The task to check
   * @returns True if can handle
   */
  public abstract canHandle(task: IAgentTask): boolean;

  // ==========================================================================
  // PROTECTED ABSTRACT METHODS
  // ==========================================================================

  /**
   * Called during initialization
   */
  protected abstract onInitialize(): Promise<void>;

  /**
   * Called to execute a task
   * @param task - The task to execute
   */
  protected abstract onExecute(task: IAgentTask): Promise<IAgentResult>;

  /**
   * Called during termination
   */
  protected abstract onTerminate(): Promise<void>;

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private updateMetrics(): void {
    const metrics: IAgentMetrics = {
      totalTasks: this.totalTasks,
      successfulTasks: this.successfulTasks,
      failedTasks: this.failedTasks,
      averageExecutionTimeMs:
        this.totalTasks > 0 ? this.totalExecutionTime / this.totalTasks : 0,
      totalTokensUsed: this.totalTokensUsed,
    };
    this.metricsSubject.next(metrics);
  }
}
