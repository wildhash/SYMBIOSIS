/**
 * @fileoverview Tests for PriorityQueue
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { Priority } from '@symbiosis/shared';

import { PriorityQueue } from './priority-queue';
import type { IScheduledTask } from '../types/kernel';

describe('PriorityQueue', () => {
  let queue: PriorityQueue<string>;

  const createTask = (id: string, priority: Priority): IScheduledTask<string> => ({
    id,
    priority,
    createdAt: new Date(),
    timeoutMs: 5000,
    execute: async () => `result-${id}`,
  });

  beforeEach(() => {
    queue = new PriorityQueue<string>();
  });

  describe('enqueue', () => {
    it('should add tasks to the queue', () => {
      queue.enqueue(createTask('task-1', Priority.MEDIUM));
      expect(queue.size()).toBe(1);
    });

    it('should add tasks to correct priority level', () => {
      queue.enqueue(createTask('task-1', Priority.HIGH));
      queue.enqueue(createTask('task-2', Priority.LOW));
      expect(queue.sizeAt(Priority.HIGH)).toBe(1);
      expect(queue.sizeAt(Priority.LOW)).toBe(1);
    });
  });

  describe('dequeue', () => {
    it('should return undefined for empty queue', () => {
      expect(queue.dequeue()).toBeUndefined();
    });

    it('should return highest priority task first', () => {
      queue.enqueue(createTask('low', Priority.LOW));
      queue.enqueue(createTask('critical', Priority.CRITICAL));
      queue.enqueue(createTask('high', Priority.HIGH));

      expect(queue.dequeue()?.id).toBe('critical');
      expect(queue.dequeue()?.id).toBe('high');
      expect(queue.dequeue()?.id).toBe('low');
    });

    it('should maintain FIFO within same priority', () => {
      queue.enqueue(createTask('first', Priority.MEDIUM));
      queue.enqueue(createTask('second', Priority.MEDIUM));
      queue.enqueue(createTask('third', Priority.MEDIUM));

      expect(queue.dequeue()?.id).toBe('first');
      expect(queue.dequeue()?.id).toBe('second');
      expect(queue.dequeue()?.id).toBe('third');
    });
  });

  describe('peek', () => {
    it('should return undefined for empty queue', () => {
      expect(queue.peek()).toBeUndefined();
    });

    it('should return highest priority task without removing', () => {
      queue.enqueue(createTask('low', Priority.LOW));
      queue.enqueue(createTask('high', Priority.HIGH));

      expect(queue.peek()?.id).toBe('high');
      expect(queue.size()).toBe(2);
    });
  });

  describe('remove', () => {
    it('should remove task by id', () => {
      queue.enqueue(createTask('task-1', Priority.MEDIUM));
      queue.enqueue(createTask('task-2', Priority.MEDIUM));

      expect(queue.remove('task-1')).toBe(true);
      expect(queue.size()).toBe(1);
      expect(queue.get('task-1')).toBeUndefined();
    });

    it('should return false for non-existent task', () => {
      expect(queue.remove('non-existent')).toBe(false);
    });
  });

  describe('get', () => {
    it('should find task by id', () => {
      queue.enqueue(createTask('task-1', Priority.HIGH));
      queue.enqueue(createTask('task-2', Priority.LOW));

      const task = queue.get('task-2');
      expect(task?.id).toBe('task-2');
    });

    it('should return undefined for non-existent task', () => {
      expect(queue.get('non-existent')).toBeUndefined();
    });
  });

  describe('isEmpty', () => {
    it('should return true for empty queue', () => {
      expect(queue.isEmpty()).toBe(true);
    });

    it('should return false for non-empty queue', () => {
      queue.enqueue(createTask('task-1', Priority.MEDIUM));
      expect(queue.isEmpty()).toBe(false);
    });
  });

  describe('size', () => {
    it('should return correct total size', () => {
      queue.enqueue(createTask('task-1', Priority.HIGH));
      queue.enqueue(createTask('task-2', Priority.LOW));
      queue.enqueue(createTask('task-3', Priority.CRITICAL));

      expect(queue.size()).toBe(3);
    });
  });

  describe('sizeAt', () => {
    it('should return correct size at priority', () => {
      queue.enqueue(createTask('task-1', Priority.HIGH));
      queue.enqueue(createTask('task-2', Priority.HIGH));
      queue.enqueue(createTask('task-3', Priority.LOW));

      expect(queue.sizeAt(Priority.HIGH)).toBe(2);
      expect(queue.sizeAt(Priority.LOW)).toBe(1);
      expect(queue.sizeAt(Priority.MEDIUM)).toBe(0);
    });
  });

  describe('clear', () => {
    it('should remove all tasks', () => {
      queue.enqueue(createTask('task-1', Priority.HIGH));
      queue.enqueue(createTask('task-2', Priority.LOW));

      queue.clear();

      expect(queue.isEmpty()).toBe(true);
      expect(queue.size()).toBe(0);
    });
  });

  describe('toArray', () => {
    it('should return all tasks in priority order', () => {
      queue.enqueue(createTask('low', Priority.LOW));
      queue.enqueue(createTask('critical', Priority.CRITICAL));
      queue.enqueue(createTask('high', Priority.HIGH));

      const tasks = queue.toArray();

      expect(tasks).toHaveLength(3);
      expect(tasks[0]?.id).toBe('critical');
      expect(tasks[1]?.id).toBe('high');
      expect(tasks[2]?.id).toBe('low');
    });
  });
});
