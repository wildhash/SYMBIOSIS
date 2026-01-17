/**
 * @fileoverview Task scheduler for managing concurrent operations
 * @module @symbiosis/kernel/scheduler/scheduler
 */

import { Subject, BehaviorSubject } from 'rxjs';
import type { Observable } from 'rxjs';

import type { ILogger, Result } from '@symbiosis/shared';
import { Priority, ok, err } from '@symbiosis/shared';

import { PriorityQueue } from './priority-queue';
import type { ISchedulerConfig, IScheduledTask } from '../types/kernel';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Task execution result
 */
export interface ITaskExecutionResult<T = unknown> {
  readonly taskId: string;
  readonly result: T;
  readonly executionTimeMs: number;
  readonly completedAt: Date;
}

/**
 * Scheduler error
 */
export class SchedulerError extends Error {
  constructor(
    message: string,
    public readonly code: SchedulerErrorCode,
    public readonly taskId?: string,
  ) {
    super(message);
    this.name = 'SchedulerError';
  }
}

/**
 * Scheduler error codes
 */
export enum SchedulerErrorCode {
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  TASK_TIMEOUT = 'TASK_TIMEOUT',
  TASK_CANCELLED = 'TASK_CANCELLED',
  SCHEDULER_STOPPED = 'SCHEDULER_STOPPED',
  MAX_CONCURRENT_REACHED = 'MAX_CONCURRENT_REACHED',
}

/**
 * Scheduler metrics
 */
export interface ISchedulerMetrics {
  readonly queuedTasks: number;
  readonly runningTasks: number;
  readonly completedTasks: number;
  readonly failedTasks: number;
  readonly averageWaitTimeMs: number;
  readonly averageExecutionTimeMs: number;
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Task scheduler with priority queue and concurrency control
 */
export class Scheduler<T = unknown> {
  private readonly queue: PriorityQueue<T>;
  private readonly running: Map<string, Promise<T>>;
  private readonly completionStream: Subject<ITaskExecutionResult<T>>;
  private readonly metricsSubject: BehaviorSubject<ISchedulerMetrics>;
  private readonly config: ISchedulerConfig;
  private readonly logger: ILogger;
  private isRunning: boolean;
  private taskCounter: number;
  private completedCount: number;
  private failedCount: number;
  private totalWaitTimeMs: number;
  private totalExecutionTimeMs: number;

  constructor(config: ISchedulerConfig, logger: ILogger) {
    this.config = config;
    this.logger = logger;
    this.queue = new PriorityQueue<T>();
    this.running = new Map();
    this.completionStream = new Subject();
    this.metricsSubject = new BehaviorSubject<ISchedulerMetrics>({
      queuedTasks: 0,
      runningTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageWaitTimeMs: 0,
      averageExecutionTimeMs: 0,
    });
    this.isRunning = false;
    this.taskCounter = 0;
    this.completedCount = 0;
    this.failedCount = 0;
    this.totalWaitTimeMs = 0;
    this.totalExecutionTimeMs = 0;
  }

  /**
   * Schedule a task for execution
   * @param execute - The function to execute
   * @param priority - Task priority
   * @param timeoutMs - Optional timeout override
   * @returns The scheduled task
   */
  public schedule(
    execute: () => Promise<T>,
    priority: Priority = Priority.MEDIUM,
    timeoutMs?: number,
  ): IScheduledTask<T> {
    this.taskCounter++;
    const id = `task_${Date.now().toString(36)}_${this.taskCounter.toString(36)}`;

    const task: IScheduledTask<T> = {
      id,
      priority,
      createdAt: new Date(),
      timeoutMs: timeoutMs ?? this.config.defaultTimeoutMs,
      execute,
    };

    this.queue.enqueue(task);
    this.updateMetrics();
    this.logger.debug(`Scheduled task ${id} with priority ${String(priority)}`);

    // Process queue if running
    if (this.isRunning) {
      void this.processQueue();
    }

    return task;
  }

  /**
   * Cancel a queued task
   * @param taskId - The task ID to cancel
   * @returns True if the task was cancelled
   */
  public cancel(taskId: string): boolean {
    const removed = this.queue.remove(taskId);
    if (removed) {
      this.logger.info(`Cancelled task ${taskId}`);
      this.updateMetrics();
    }
    return removed;
  }

  /**
   * Start the scheduler
   */
  public start(): void {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    this.logger.info('Scheduler started');
    void this.processQueue();
  }

  /**
   * Stop the scheduler
   */
  public stop(): void {
    this.isRunning = false;
    this.logger.info('Scheduler stopped');
  }

  /**
   * Wait for a task to complete
   * @param taskId - The task ID to wait for
   * @param timeoutMs - Optional timeout
   * @returns Result containing the execution result
   */
  public async waitFor(
    taskId: string,
    timeoutMs?: number,
  ): Promise<Result<ITaskExecutionResult<T>, SchedulerError>> {
    return new Promise((resolve) => {
      const timeout = timeoutMs ?? this.config.defaultTimeoutMs;
      const timeoutId = setTimeout(() => {
        subscription.unsubscribe();
        resolve(
          err(new SchedulerError('Task timed out', SchedulerErrorCode.TASK_TIMEOUT, taskId)),
        );
      }, timeout);

      const subscription = this.completionStream.subscribe((result) => {
        if (result.taskId === taskId) {
          clearTimeout(timeoutId);
          subscription.unsubscribe();
          resolve(ok(result));
        }
      });
    });
  }

  /**
   * Get observable of task completions
   * @returns Observable of task execution results
   */
  public getCompletionStream(): Observable<ITaskExecutionResult<T>> {
    return this.completionStream.asObservable();
  }

  /**
   * Get current scheduler metrics
   * @returns Current metrics
   */
  public getMetrics(): ISchedulerMetrics {
    return this.metricsSubject.getValue();
  }

  /**
   * Get observable of metrics changes
   * @returns Observable of metrics
   */
  public getMetricsStream(): Observable<ISchedulerMetrics> {
    return this.metricsSubject.asObservable();
  }

  /**
   * Check if scheduler is running
   * @returns True if running
   */
  public isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get the number of queued tasks
   * @returns Queue size
   */
  public getQueueSize(): number {
    return this.queue.size();
  }

  /**
   * Get the number of running tasks
   * @returns Running task count
   */
  public getRunningCount(): number {
    return this.running.size;
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private async processQueue(): Promise<void> {
    while (this.isRunning && !this.queue.isEmpty()) {
      // Check concurrency limit
      if (this.running.size >= this.config.maxConcurrent) {
        // Wait for a slot to open
        await Promise.race(Array.from(this.running.values()));
        continue;
      }

      const task = this.queue.dequeue();
      if (task === undefined) {
        break;
      }

      void this.executeTask(task);
    }
  }

  private async executeTask(task: IScheduledTask<T>): Promise<void> {
    const startTime = Date.now();
    const waitTime = startTime - task.createdAt.getTime();
    this.totalWaitTimeMs += waitTime;

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new SchedulerError('Task timed out', SchedulerErrorCode.TASK_TIMEOUT, task.id));
      }, task.timeoutMs);
    });

    const executionPromise = task.execute();
    this.running.set(task.id, executionPromise);
    this.updateMetrics();

    try {
      const result = await Promise.race([executionPromise, timeoutPromise]);
      const executionTime = Date.now() - startTime;
      this.totalExecutionTimeMs += executionTime;
      this.completedCount++;

      const executionResult: ITaskExecutionResult<T> = {
        taskId: task.id,
        result,
        executionTimeMs: executionTime,
        completedAt: new Date(),
      };

      this.completionStream.next(executionResult);
      this.logger.debug(`Task ${task.id} completed in ${String(executionTime)}ms`);
    } catch (error) {
      this.failedCount++;
      this.logger.error(`Task ${task.id} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.running.delete(task.id);
      this.updateMetrics();

      // Continue processing
      if (this.isRunning) {
        void this.processQueue();
      }
    }
  }

  private updateMetrics(): void {
    const totalCompleted = this.completedCount + this.failedCount;
    const metrics: ISchedulerMetrics = {
      queuedTasks: this.queue.size(),
      runningTasks: this.running.size,
      completedTasks: this.completedCount,
      failedTasks: this.failedCount,
      averageWaitTimeMs: totalCompleted > 0 ? this.totalWaitTimeMs / totalCompleted : 0,
      averageExecutionTimeMs: this.completedCount > 0 ? this.totalExecutionTimeMs / this.completedCount : 0,
    };
    this.metricsSubject.next(metrics);
  }
}

/**
 * Create a scheduler instance
 * @param config - Scheduler configuration
 * @param logger - Logger instance
 * @returns Configured scheduler
 */
export function createScheduler<T = unknown>(
  config: ISchedulerConfig,
  logger: ILogger,
): Scheduler<T> {
  return new Scheduler<T>(config, logger);
}
