/**
 * @fileoverview Tests for AgentLifecycle
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { firstValueFrom, take, toArray } from 'rxjs';

import { AgentState, noopLogger } from '@symbiosis/shared';

import { AgentLifecycle, LifecycleEvent } from './lifecycle';

describe('AgentLifecycle', () => {
  let lifecycle: AgentLifecycle;

  beforeEach(() => {
    lifecycle = new AgentLifecycle('test-agent', noopLogger);
  });

  describe('getState', () => {
    it('should start in INITIALIZING state', () => {
      expect(lifecycle.getState()).toBe(AgentState.INITIALIZING);
    });
  });

  describe('transitionTo', () => {
    it('should transition to valid states', async () => {
      await lifecycle.transitionTo(AgentState.READY);
      expect(lifecycle.getState()).toBe(AgentState.READY);
    });

    it('should not transition to invalid states', async () => {
      // INITIALIZING cannot go directly to BUSY
      await lifecycle.transitionTo(AgentState.BUSY);
      expect(lifecycle.getState()).toBe(AgentState.INITIALIZING);
    });

    it('should allow READY -> BUSY transition', async () => {
      await lifecycle.transitionTo(AgentState.READY);
      await lifecycle.transitionTo(AgentState.BUSY);
      expect(lifecycle.getState()).toBe(AgentState.BUSY);
    });

    it('should allow BUSY -> IDLE transition', async () => {
      await lifecycle.transitionTo(AgentState.READY);
      await lifecycle.transitionTo(AgentState.BUSY);
      await lifecycle.transitionTo(AgentState.IDLE);
      expect(lifecycle.getState()).toBe(AgentState.IDLE);
    });

    it('should allow transition to ERROR from most states', async () => {
      await lifecycle.transitionTo(AgentState.READY);
      await lifecycle.transitionTo(AgentState.ERROR);
      expect(lifecycle.getState()).toBe(AgentState.ERROR);
    });

    it('should not allow transitions from TERMINATED', async () => {
      await lifecycle.transitionTo(AgentState.READY);
      await lifecycle.transitionTo(AgentState.TERMINATED);
      await lifecycle.transitionTo(AgentState.READY);
      expect(lifecycle.getState()).toBe(AgentState.TERMINATED);
    });
  });

  describe('getStateStream', () => {
    it('should emit state changes', async () => {
      const statesPromise = firstValueFrom(
        lifecycle.getStateStream().pipe(take(2), toArray()),
      );

      await lifecycle.transitionTo(AgentState.READY);

      const states = await statesPromise;
      expect(states).toContain(AgentState.INITIALIZING);
      expect(states).toContain(AgentState.READY);
    });
  });

  describe('onEvent', () => {
    it('should call hooks on lifecycle events', async () => {
      const hook = vi.fn().mockResolvedValue(undefined);
      lifecycle.onEvent(LifecycleEvent.INITIALIZED, hook);

      await lifecycle.transitionTo(AgentState.READY);

      expect(hook).toHaveBeenCalled();
    });

    it('should allow unsubscribing from hooks', async () => {
      const hook = vi.fn().mockResolvedValue(undefined);
      const unsubscribe = lifecycle.onEvent(LifecycleEvent.INITIALIZED, hook);

      unsubscribe();
      await lifecycle.transitionTo(AgentState.READY);

      expect(hook).not.toHaveBeenCalled();
    });

    it('should handle hook errors gracefully', async () => {
      const badHook = vi.fn().mockRejectedValue(new Error('hook error'));
      lifecycle.onEvent(LifecycleEvent.INITIALIZED, badHook);

      // Should not throw
      await lifecycle.transitionTo(AgentState.READY);

      expect(lifecycle.getState()).toBe(AgentState.READY);
    });
  });

  describe('isReady', () => {
    it('should return false when not ready', () => {
      expect(lifecycle.isReady()).toBe(false);
    });

    it('should return true when ready', async () => {
      await lifecycle.transitionTo(AgentState.READY);
      expect(lifecycle.isReady()).toBe(true);
    });
  });

  describe('canAcceptTasks', () => {
    it('should return false when initializing', () => {
      expect(lifecycle.canAcceptTasks()).toBe(false);
    });

    it('should return true when ready', async () => {
      await lifecycle.transitionTo(AgentState.READY);
      expect(lifecycle.canAcceptTasks()).toBe(true);
    });

    it('should return true when idle', async () => {
      await lifecycle.transitionTo(AgentState.READY);
      await lifecycle.transitionTo(AgentState.IDLE);
      expect(lifecycle.canAcceptTasks()).toBe(true);
    });

    it('should return false when busy', async () => {
      await lifecycle.transitionTo(AgentState.READY);
      await lifecycle.transitionTo(AgentState.BUSY);
      expect(lifecycle.canAcceptTasks()).toBe(false);
    });
  });
});
