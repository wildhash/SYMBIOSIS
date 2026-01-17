/**
 * @fileoverview Tests for EventBus
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { firstValueFrom, take, toArray } from 'rxjs';

import { EventType, noopLogger } from '@symbiosis/shared';

import { EventBus, createEventBus } from './event-bus';
import type { IEventBusConfig } from '../types/kernel';

describe('EventBus', () => {
  let eventBus: EventBus;
  const defaultConfig: IEventBusConfig = {
    replayBufferSize: 10,
    enableLogging: false,
  };

  beforeEach(() => {
    eventBus = new EventBus(defaultConfig, noopLogger);
  });

  afterEach(() => {
    eventBus.destroy();
  });

  describe('emit', () => {
    it('should emit events with generated IDs', () => {
      const id = eventBus.emit(EventType.KERNEL_READY, 'test', { status: 'ready' });

      expect(id).toBeDefined();
      expect(id.startsWith('evt_')).toBe(true);
    });

    it('should increment event counter', () => {
      eventBus.emit(EventType.KERNEL_READY, 'test', {});
      eventBus.emit(EventType.KERNEL_READY, 'test', {});
      eventBus.emit(EventType.KERNEL_READY, 'test', {});

      expect(eventBus.getEventCount()).toBe(3);
    });

    it('should include correlation ID when provided', async () => {
      const eventPromise = firstValueFrom(eventBus.on());
      eventBus.emit(EventType.KERNEL_READY, 'test', {}, { correlationId: 'corr-123' });

      const event = await eventPromise;
      expect(event.correlationId).toBe('corr-123');
    });

    it('should include metadata when provided', async () => {
      const eventPromise = firstValueFrom(eventBus.on());
      eventBus.emit(EventType.KERNEL_READY, 'test', {}, { metadata: { key: 'value' } });

      const event = await eventPromise;
      expect(event.metadata).toEqual({ key: 'value' });
    });
  });

  describe('on', () => {
    it('should receive all events when no filter provided', async () => {
      const eventsPromise = firstValueFrom(eventBus.on().pipe(take(2), toArray()));

      eventBus.emit(EventType.KERNEL_READY, 'source1', {});
      eventBus.emit(EventType.AGENT_SPAWNED, 'source2', {});

      const events = await eventsPromise;
      expect(events).toHaveLength(2);
    });

    it('should filter by event type', async () => {
      const eventsPromise = firstValueFrom(
        eventBus.on({ types: [EventType.KERNEL_READY] }).pipe(take(1), toArray()),
      );

      eventBus.emit(EventType.AGENT_SPAWNED, 'test', {});
      eventBus.emit(EventType.KERNEL_READY, 'test', {});

      const events = await eventsPromise;
      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe(EventType.KERNEL_READY);
    });

    it('should filter by source', async () => {
      const eventsPromise = firstValueFrom(
        eventBus.on({ sources: ['source1'] }).pipe(take(1), toArray()),
      );

      eventBus.emit(EventType.KERNEL_READY, 'source2', {});
      eventBus.emit(EventType.KERNEL_READY, 'source1', {});

      const events = await eventsPromise;
      expect(events).toHaveLength(1);
      expect(events[0]?.source).toBe('source1');
    });

    it('should filter by correlation ID', async () => {
      const eventsPromise = firstValueFrom(
        eventBus.on({ correlationId: 'corr-1' }).pipe(take(1), toArray()),
      );

      eventBus.emit(EventType.KERNEL_READY, 'test', {}, { correlationId: 'corr-2' });
      eventBus.emit(EventType.KERNEL_READY, 'test', {}, { correlationId: 'corr-1' });

      const events = await eventsPromise;
      expect(events).toHaveLength(1);
      expect(events[0]?.correlationId).toBe('corr-1');
    });
  });

  describe('onType', () => {
    it('should filter by specific event type', async () => {
      const eventPromise = firstValueFrom(eventBus.onType(EventType.AGENT_READY));

      eventBus.emit(EventType.KERNEL_READY, 'test', {});
      eventBus.emit(EventType.AGENT_READY, 'test', { agentId: 'agent-1' });

      const event = await eventPromise;
      expect(event.type).toBe(EventType.AGENT_READY);
    });
  });

  describe('onSource', () => {
    it('should filter by specific source', async () => {
      const eventPromise = firstValueFrom(eventBus.onSource('agent-manager'));

      eventBus.emit(EventType.KERNEL_READY, 'kernel', {});
      eventBus.emit(EventType.AGENT_SPAWNED, 'agent-manager', {});

      const event = await eventPromise;
      expect(event.source).toBe('agent-manager');
    });
  });

  describe('onCorrelation', () => {
    it('should filter by specific correlation ID', async () => {
      const eventPromise = firstValueFrom(eventBus.onCorrelation('task-123'));

      eventBus.emit(EventType.TASK_STARTED, 'test', {}, { correlationId: 'task-456' });
      eventBus.emit(EventType.TASK_COMPLETED, 'test', {}, { correlationId: 'task-123' });

      const event = await eventPromise;
      expect(event.correlationId).toBe('task-123');
    });
  });

  describe('onWithReplay', () => {
    it('should replay recent events to new subscribers', async () => {
      // Emit events before subscribing
      eventBus.emit(EventType.KERNEL_READY, 'test', { seq: 1 });
      eventBus.emit(EventType.KERNEL_READY, 'test', { seq: 2 });

      // Subscribe after events were emitted
      const eventsPromise = firstValueFrom(eventBus.onWithReplay().pipe(take(2), toArray()));

      const events = await eventsPromise;
      expect(events).toHaveLength(2);
    });

    it('should respect replay buffer size', async () => {
      // Create bus with small buffer
      const smallBus = new EventBus({ replayBufferSize: 2, enableLogging: false }, noopLogger);

      // Emit more events than buffer size
      smallBus.emit(EventType.KERNEL_READY, 'test', { seq: 1 });
      smallBus.emit(EventType.KERNEL_READY, 'test', { seq: 2 });
      smallBus.emit(EventType.KERNEL_READY, 'test', { seq: 3 });

      // Should only get last 2 events
      const eventsPromise = firstValueFrom(smallBus.onWithReplay().pipe(take(2), toArray()));

      const events = await eventsPromise;
      expect(events).toHaveLength(2);

      smallBus.destroy();
    });
  });

  describe('waitFor', () => {
    it('should resolve when matching event is emitted', async () => {
      const waitPromise = eventBus.waitFor({ types: [EventType.TASK_COMPLETED] });

      // Emit the event after a short delay
      setTimeout(() => {
        eventBus.emit(EventType.TASK_COMPLETED, 'test', { result: 'success' });
      }, 10);

      const event = await waitPromise;
      expect(event.type).toBe(EventType.TASK_COMPLETED);
    });

    it('should reject on timeout', async () => {
      const waitPromise = eventBus.waitFor({ types: [EventType.TASK_COMPLETED] }, 50);

      await expect(waitPromise).rejects.toThrow('Timeout waiting for event');
    });
  });

  describe('destroy', () => {
    it('should complete all streams', () => {
      const completeSpy = vi.fn();
      eventBus.on().subscribe({ complete: completeSpy });

      eventBus.destroy();

      expect(completeSpy).toHaveBeenCalled();
    });
  });

  describe('createEventBus', () => {
    it('should create an event bus instance', () => {
      const bus = createEventBus(defaultConfig, noopLogger);
      expect(bus).toBeInstanceOf(EventBus);
      bus.destroy();
    });
  });
});
