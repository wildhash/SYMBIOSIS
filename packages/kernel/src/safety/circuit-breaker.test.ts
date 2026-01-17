/**
 * @fileoverview Tests for CircuitBreaker
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { firstValueFrom, take, toArray } from 'rxjs';

import { noopLogger, CircuitBreakerErrorCode } from '@symbiosis/shared';

import { CircuitBreaker, createCircuitBreaker } from './circuit-breaker';
import { CircuitState } from '../types/kernel';
import type { ICircuitBreakerConfig, IExecutionBudget } from '../types/kernel';

describe('CircuitBreaker', () => {
  const defaultBudget: IExecutionBudget = {
    maxTokens: 1000,
    maxTurns: 10,
    maxTimeMs: 60000,
    maxCostCents: 100,
    currentFuel: 10,
  };

  const defaultConfig: ICircuitBreakerConfig = {
    failureThreshold: 3,
    successThreshold: 2,
    resetTimeoutMs: 1000,
    defaultBudget,
  };

  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker(defaultConfig, noopLogger);
  });

  describe('createContext', () => {
    it('should create a context with default budget', () => {
      const result = circuitBreaker.createContext('ctx-1', 'agent-1');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe('ctx-1');
        expect(result.value.agentId).toBe('agent-1');
        expect(result.value.budget.maxTokens).toBe(1000);
        expect(result.value.tokensUsed).toBe(0);
      }
    });

    it('should create a context with custom budget', () => {
      const result = circuitBreaker.createContext('ctx-2', 'agent-1', {
        maxTokens: 500,
        currentFuel: 5,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.budget.maxTokens).toBe(500);
        expect(result.value.budget.currentFuel).toBe(5);
        // Other values should use defaults
        expect(result.value.budget.maxTurns).toBe(10);
      }
    });

    it('should fail when circuit is open', () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }

      const result = circuitBreaker.createContext('ctx-3', 'agent-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(CircuitBreakerErrorCode.CIRCUIT_OPEN);
      }
    });
  });

  describe('canProceed', () => {
    it('should return true for valid context with budget', () => {
      circuitBreaker.createContext('ctx-1', 'agent-1');

      const result = circuitBreaker.canProceed('ctx-1');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    it('should fail for non-existent context', () => {
      const result = circuitBreaker.canProceed('non-existent');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(CircuitBreakerErrorCode.BUDGET_EXCEEDED);
      }
    });

    it('should fail when fuel is depleted', () => {
      circuitBreaker.createContext('ctx-1', 'agent-1', { currentFuel: 1 });

      // Use up the fuel
      circuitBreaker.recordUsage('ctx-1', 100, 10);

      const result = circuitBreaker.canProceed('ctx-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(CircuitBreakerErrorCode.FUEL_DEPLETED);
      }
    });

    it('should fail when token budget exceeded', () => {
      circuitBreaker.createContext('ctx-1', 'agent-1', { maxTokens: 100, currentFuel: 100 });

      // Use up tokens
      circuitBreaker.recordUsage('ctx-1', 150, 10);

      const result = circuitBreaker.canProceed('ctx-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(CircuitBreakerErrorCode.BUDGET_EXCEEDED);
      }
    });

    it('should fail when max turns exceeded', () => {
      circuitBreaker.createContext('ctx-1', 'agent-1', { maxTurns: 2, currentFuel: 100 });

      // Execute turns
      circuitBreaker.recordUsage('ctx-1', 10, 1);
      circuitBreaker.recordUsage('ctx-1', 10, 1);

      const result = circuitBreaker.canProceed('ctx-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(CircuitBreakerErrorCode.MAX_TURNS_EXCEEDED);
      }
    });

    it('should fail when cost budget exceeded', () => {
      circuitBreaker.createContext('ctx-1', 'agent-1', { maxCostCents: 10, currentFuel: 100 });

      // Accumulate costs
      circuitBreaker.recordUsage('ctx-1', 10, 15);

      const result = circuitBreaker.canProceed('ctx-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(CircuitBreakerErrorCode.BUDGET_EXCEEDED);
      }
    });

    it('should fail when timeout exceeded', () => {
      vi.useFakeTimers();

      circuitBreaker.createContext('ctx-1', 'agent-1', { maxTimeMs: 1000, currentFuel: 100 });

      // Advance time past timeout
      vi.advanceTimersByTime(1500);

      const result = circuitBreaker.canProceed('ctx-1');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(CircuitBreakerErrorCode.TIMEOUT);
      }

      vi.useRealTimers();
    });
  });

  describe('recordUsage', () => {
    it('should update context usage', () => {
      circuitBreaker.createContext('ctx-1', 'agent-1');

      const result = circuitBreaker.recordUsage('ctx-1', 100, 5);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.tokensUsed).toBe(100);
        expect(result.value.costAccumulated).toBe(5);
        expect(result.value.turnsExecuted).toBe(1);
        expect(result.value.budget.currentFuel).toBe(9);
      }
    });

    it('should fail for non-existent context', () => {
      const result = circuitBreaker.recordUsage('non-existent', 100, 5);

      expect(result.ok).toBe(false);
    });
  });

  describe('circuit state management', () => {
    it('should start in closed state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should open after failure threshold', () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should transition to half-open after reset timeout', () => {
      vi.useFakeTimers();

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Advance past reset timeout
      vi.advanceTimersByTime(1500);

      // Try to create a context - should trigger half-open
      circuitBreaker.createContext('ctx-1', 'agent-1');
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);

      vi.useRealTimers();
    });

    it('should close from half-open after success threshold', () => {
      vi.useFakeTimers();

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }

      // Advance past reset timeout
      vi.advanceTimersByTime(1500);

      // Trigger half-open
      circuitBreaker.createContext('ctx-1', 'agent-1');
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);

      // Record successes
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);

      circuitBreaker.recordSuccess();
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      vi.useRealTimers();
    });

    it('should re-open from half-open on failure', () => {
      vi.useFakeTimers();

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }

      // Advance past reset timeout
      vi.advanceTimersByTime(1500);

      // Trigger half-open
      circuitBreaker.createContext('ctx-1', 'agent-1');
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);

      // Record failure
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      vi.useRealTimers();
    });
  });

  describe('getStateStream', () => {
    it('should emit state changes', async () => {
      const statesPromise = firstValueFrom(
        circuitBreaker.getStateStream().pipe(take(2), toArray()),
      );

      // Trigger state change
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }

      const states = await statesPromise;
      expect(states).toContain(CircuitState.CLOSED);
      expect(states).toContain(CircuitState.OPEN);
    });
  });

  describe('getContext', () => {
    it('should return context by ID', () => {
      circuitBreaker.createContext('ctx-1', 'agent-1');

      const context = circuitBreaker.getContext('ctx-1');

      expect(context).toBeDefined();
      expect(context?.id).toBe('ctx-1');
    });

    it('should return undefined for non-existent context', () => {
      const context = circuitBreaker.getContext('non-existent');

      expect(context).toBeUndefined();
    });
  });

  describe('releaseContext', () => {
    it('should remove context', () => {
      circuitBreaker.createContext('ctx-1', 'agent-1');
      expect(circuitBreaker.getContext('ctx-1')).toBeDefined();

      circuitBreaker.releaseContext('ctx-1');
      expect(circuitBreaker.getContext('ctx-1')).toBeUndefined();
    });
  });

  describe('getFailureCount and getSuccessCount', () => {
    it('should track failure count', () => {
      expect(circuitBreaker.getFailureCount()).toBe(0);

      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();

      expect(circuitBreaker.getFailureCount()).toBe(2);
    });

    it('should track success count', () => {
      expect(circuitBreaker.getSuccessCount()).toBe(0);

      circuitBreaker.recordSuccess();
      circuitBreaker.recordSuccess();

      expect(circuitBreaker.getSuccessCount()).toBe(2);
    });
  });

  describe('createCircuitBreaker', () => {
    it('should create a circuit breaker instance', () => {
      const cb = createCircuitBreaker(defaultConfig, noopLogger);
      expect(cb).toBeInstanceOf(CircuitBreaker);
    });
  });
});
