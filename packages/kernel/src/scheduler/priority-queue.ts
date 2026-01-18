/**
 * @fileoverview Priority queue implementation for task scheduling
 * @module @symbiosis/kernel/scheduler/priority-queue
 */

import type { Priority } from '@symbiosis/shared';

import type { IScheduledTask } from '../types/kernel';

/**
 * Priority queue for scheduled tasks
 */
export class PriorityQueue<T = unknown> {
  private readonly queues: Map<Priority, IScheduledTask<T>[]>;
  private readonly priorities: Priority[];

  constructor() {
    this.queues = new Map();
    this.priorities = [0, 1, 2, 3] as Priority[];

    for (const priority of this.priorities) {
      this.queues.set(priority, []);
    }
  }

  /**
   * Add a task to the queue
   * @param task - The task to enqueue
   */
  public enqueue(task: IScheduledTask<T>): void {
    const queue = this.queues.get(task.priority);
    if (queue !== undefined) {
      queue.push(task);
    }
  }

  /**
   * Remove and return the highest priority task
   * @returns The highest priority task, or undefined if empty
   */
  public dequeue(): IScheduledTask<T> | undefined {
    for (const priority of this.priorities) {
      const queue = this.queues.get(priority);
      if (queue !== undefined && queue.length > 0) {
        return queue.shift();
      }
    }
    return undefined;
  }

  /**
   * Peek at the highest priority task without removing it
   * @returns The highest priority task, or undefined if empty
   */
  public peek(): IScheduledTask<T> | undefined {
    for (const priority of this.priorities) {
      const queue = this.queues.get(priority);
      if (queue !== undefined && queue.length > 0) {
        return queue[0];
      }
    }
    return undefined;
  }

  /**
   * Remove a task by ID
   * @param taskId - The task ID to remove
   * @returns True if the task was found and removed
   */
  public remove(taskId: string): boolean {
    for (const priority of this.priorities) {
      const queue = this.queues.get(priority);
      if (queue !== undefined) {
        const index = queue.findIndex((t) => t.id === taskId);
        if (index !== -1) {
          queue.splice(index, 1);
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Get a task by ID without removing it
   * @param taskId - The task ID to find
   * @returns The task if found
   */
  public get(taskId: string): IScheduledTask<T> | undefined {
    for (const priority of this.priorities) {
      const queue = this.queues.get(priority);
      if (queue !== undefined) {
        const task = queue.find((t) => t.id === taskId);
        if (task !== undefined) {
          return task;
        }
      }
    }
    return undefined;
  }

  /**
   * Check if the queue is empty
   * @returns True if the queue is empty
   */
  public isEmpty(): boolean {
    for (const priority of this.priorities) {
      const queue = this.queues.get(priority);
      if (queue !== undefined && queue.length > 0) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get the total number of tasks in the queue
   * @returns The total count
   */
  public size(): number {
    let total = 0;
    for (const priority of this.priorities) {
      const queue = this.queues.get(priority);
      if (queue !== undefined) {
        total += queue.length;
      }
    }
    return total;
  }

  /**
   * Get the count of tasks at a specific priority
   * @param priority - The priority level
   * @returns The count at that priority
   */
  public sizeAt(priority: Priority): number {
    const queue = this.queues.get(priority);
    return queue?.length ?? 0;
  }

  /**
   * Clear all tasks from the queue
   */
  public clear(): void {
    for (const priority of this.priorities) {
      const queue = this.queues.get(priority);
      if (queue !== undefined) {
        queue.length = 0;
      }
    }
  }

  /**
   * Get all tasks as an array (ordered by priority)
   * @returns Array of all tasks
   */
  public toArray(): readonly IScheduledTask<T>[] {
    const result: IScheduledTask<T>[] = [];
    for (const priority of this.priorities) {
      const queue = this.queues.get(priority);
      if (queue !== undefined) {
        result.push(...queue);
      }
    }
    return result;
  }
}
