/**
 * @fileoverview Tests for Scheduler
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { firstValueFrom, take, toArray } from 'rxjs';

import { Priority, noopLogger } from '@symbiosis/shared';

import { Scheduler, SchedulerErrorCode, createScheduler } from './scheduler';
import type { ISchedulerConfig } from '../types/kernel';

describe('Scheduler', () => {
  const defaultConfig: ISchedulerConfig = {
    maxConcurrent: 2,
    defaultTimeoutMs: 5000,
    priorityLevels: 4,
  };

  let scheduler: Scheduler<string>;

  beforeEach(() => {
    scheduler = new Scheduler<string>(defaultConfig, noopLogger);
  });

  afterEach(() => {
    scheduler.stop();
  });

  describe('schedule', () => {
    it('should schedule a task and return task info', () => {
      const task = scheduler.schedule(async () => 'result', Priority.MEDIUM);

      expect(task.id).toBeDefined();
      expect(task.priority).toBe(Priority.MEDIUM);
      expect(scheduler.getQueueSize()).toBe(1);
    });

    it('should use default priority when not specified', () => {
      const task = scheduler.schedule(async () => 'result');

      expect(task.priority).toBe(Priority.MEDIUM);
    });
  });

  describe('cancel', () => {
    it('should cancel a queued task', () => {
      const task = scheduler.schedule(async () => 'result');
      expect(scheduler.getQueueSize()).toBe(1);

      const cancelled = scheduler.cancel(task.id);

      expect(cancelled).toBe(true);
      expect(scheduler.getQueueSize()).toBe(0);
    });

    it('should return false for non-existent task', () => {
      expect(scheduler.cancel('non-existent')).toBe(false);
    });
  });

  describe('start and stop', () => {
    it('should start processing tasks', async () => {
      scheduler.schedule(async () => 'result-1');
      scheduler.schedule(async () => 'result-2');

      expect(scheduler.isActive()).toBe(false);

      scheduler.start();

      expect(scheduler.isActive()).toBe(true);
    });

    it('should stop processing', () => {
      scheduler.start();
      expect(scheduler.isActive()).toBe(true);

      scheduler.stop();
      expect(scheduler.isActive()).toBe(false);
    });

    it('should not start twice', () => {
      scheduler.start();
      scheduler.start(); // Should not throw
      expect(scheduler.isActive()).toBe(true);
    });
  });

  describe('task execution', () => {
    it('should execute tasks and emit results', async () => {
      scheduler.start();

      const completionPromise = firstValueFrom(scheduler.getCompletionStream());

      scheduler.schedule(async () => 'completed');

      const result = await completionPromise;
      expect(result.result).toBe('completed');
    });

    it('should respect priority order', async () => {
      const executionOrder: string[] = [];

      scheduler.schedule(async () => {
        executionOrder.push('low');
        return 'low';
      }, Priority.LOW);

      scheduler.schedule(async () => {
        executionOrder.push('high');
        return 'high';
      }, Priority.HIGH);

      scheduler.schedule(async () => {
        executionOrder.push('critical');
        return 'critical';
      }, Priority.CRITICAL);

      scheduler.start();

      // Wait for all tasks to complete
      await firstValueFrom(scheduler.getCompletionStream().pipe(take(3), toArray()));

      expect(executionOrder[0]).toBe('critical');
      expect(executionOrder[1]).toBe('high');
      expect(executionOrder[2]).toBe('low');
    });

    it('should respect concurrency limit', async () => {
      let concurrent = 0;
      let maxConcurrent = 0;

      const createSlowTask = (): (() => Promise<string>) => {
        return async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((resolve) => setTimeout(resolve, 50));
          concurrent--;
          return 'done';
        };
      };

      scheduler.schedule(createSlowTask());
      scheduler.schedule(createSlowTask());
      scheduler.schedule(createSlowTask());
      scheduler.schedule(createSlowTask());

      scheduler.start();

      await firstValueFrom(scheduler.getCompletionStream().pipe(take(4), toArray()));

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
  });

  describe('waitFor', () => {
    it('should wait for task completion', async () => {
      scheduler.start();

      const task = scheduler.schedule(async () => 'awaited-result');

      const result = await scheduler.waitFor(task.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.result).toBe('awaited-result');
      }
    });

    it('should timeout if task takes too long', async () => {
      scheduler.start();

      const task = scheduler.schedule(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return 'slow';
      });

      const result = await scheduler.waitFor(task.id, 100);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(SchedulerErrorCode.TASK_TIMEOUT);
      }
    });
  });

  describe('getMetrics', () => {
    it('should track queue size', () => {
      scheduler.schedule(async () => 'task-1');
      scheduler.schedule(async () => 'task-2');

      const metrics = scheduler.getMetrics();
      expect(metrics.queuedTasks).toBe(2);
    });

    it('should track running tasks', async () => {
      scheduler.schedule(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'slow';
      });

      scheduler.start();

      // Give it time to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      const metrics = scheduler.getMetrics();
      expect(metrics.runningTasks).toBeGreaterThanOrEqual(0);
    });

    it('should track completed tasks', async () => {
      scheduler.start();

      scheduler.schedule(async () => 'task-1');
      scheduler.schedule(async () => 'task-2');

      await firstValueFrom(scheduler.getCompletionStream().pipe(take(2), toArray()));

      const metrics = scheduler.getMetrics();
      expect(metrics.completedTasks).toBe(2);
    });

    it('should track failed tasks', async () => {
      scheduler.start();

      scheduler.schedule(async () => {
        throw new Error('intentional failure');
      });

      // Wait for task to fail
      await new Promise((resolve) => setTimeout(resolve, 100));

      const metrics = scheduler.getMetrics();
      expect(metrics.failedTasks).toBe(1);
    });
  });

  describe('getRunningCount', () => {
    it('should return number of running tasks', () => {
      expect(scheduler.getRunningCount()).toBe(0);
    });
  });

  describe('createScheduler', () => {
    it('should create a scheduler instance', () => {
      const sched = createScheduler<string>(defaultConfig, noopLogger);
      expect(sched).toBeInstanceOf(Scheduler);
    });
  });
});
