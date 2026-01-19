/**
 * @fileoverview Tests for Resource Monitor
 * @module @symbiosis/kernel/monitor/resource-monitor.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createResourceMonitor,
  DEFAULT_RESOURCE_LIMITS,
  type ResourceMonitor,
  type IResourceLimits,
} from './resource-monitor';

describe('ResourceMonitor', () => {
  let monitor: ResourceMonitor;

  beforeEach(() => {
    vi.useFakeTimers();
    monitor = createResourceMonitor();
  });

  afterEach(() => {
    monitor.destroy();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create with default limits', () => {
      const limits = monitor.getLimits();
      expect(limits).toEqual(DEFAULT_RESOURCE_LIMITS);
    });

    it('should allow custom limits', () => {
      const customLimits: Partial<IResourceLimits> = {
        maxTokensPerMinute: 50_000,
        maxActiveAgents: 10,
      };
      const customMonitor = createResourceMonitor(customLimits);
      const limits = customMonitor.getLimits();

      expect(limits.maxTokensPerMinute).toBe(50_000);
      expect(limits.maxActiveAgents).toBe(10);
      expect(limits.maxCostCentsPerMinute).toBe(DEFAULT_RESOURCE_LIMITS.maxCostCentsPerMinute);

      customMonitor.destroy();
    });
  });

  describe('getSnapshot', () => {
    it('should return initial snapshot', () => {
      const snapshot = monitor.getSnapshot();

      expect(snapshot.timestamp).toBeInstanceOf(Date);
      expect(snapshot.tokenUsage.totalTokens).toBe(0);
      expect(snapshot.tokenUsage.tokensPerMinute).toBe(0);
      expect(snapshot.activeAgents).toHaveLength(0);
      expect(snapshot.pendingTasks).toBe(0);
    });

    it('should return observable', () => {
      const snapshot$ = monitor.getSnapshot$();
      expect(snapshot$).toBeDefined();
      expect(typeof snapshot$.subscribe).toBe('function');
    });
  });

  describe('startAgent', () => {
    it('should start an agent successfully', () => {
      const result = monitor.startAgent('agent-1', 'task-1');
      expect(result).toBe(true);

      const agents = monitor.getActiveAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0].agentId).toBe('agent-1');
      expect(agents[0].taskId).toBe('task-1');
      expect(agents[0].status).toBe('running');
    });

    it('should track agent in snapshot', () => {
      monitor.startAgent('agent-1', 'task-1');

      const snapshot = monitor.getSnapshot();
      expect(snapshot.activeAgents).toHaveLength(1);
      expect(snapshot.activeAgents[0].agentId).toBe('agent-1');
    });

    it('should reject when max agents reached', () => {
      const limitedMonitor = createResourceMonitor({ maxActiveAgents: 2 });

      expect(limitedMonitor.startAgent('agent-1', 'task-1')).toBe(true);
      expect(limitedMonitor.startAgent('agent-2', 'task-2')).toBe(true);
      expect(limitedMonitor.startAgent('agent-3', 'task-3')).toBe(false);

      limitedMonitor.destroy();
    });
  });

  describe('stopAgent', () => {
    it('should stop an agent', () => {
      monitor.startAgent('agent-1', 'task-1');
      expect(monitor.getActiveAgents()).toHaveLength(1);

      monitor.stopAgent('agent-1');
      expect(monitor.getActiveAgents()).toHaveLength(0);
    });

    it('should handle stopping non-existent agent', () => {
      monitor.stopAgent('non-existent');
      expect(monitor.getActiveAgents()).toHaveLength(0);
    });
  });

  describe('updateAgentStatus', () => {
    it('should update agent status', () => {
      monitor.startAgent('agent-1', 'task-1');
      monitor.updateAgentStatus('agent-1', 'waiting');

      const agents = monitor.getActiveAgents();
      expect(agents[0].status).toBe('waiting');
    });

    it('should handle updating non-existent agent', () => {
      monitor.updateAgentStatus('non-existent', 'stuck');
      // Should not throw
    });
  });

  describe('recordTokenUsage', () => {
    it('should record token usage', () => {
      monitor.startAgent('agent-1', 'task-1');
      monitor.recordTokenUsage('agent-1', 1000, 10);

      const snapshot = monitor.getSnapshot();
      expect(snapshot.tokenUsage.totalTokens).toBe(1000);
      expect(snapshot.tokenUsage.tokensPerMinute).toBe(1000);
    });

    it('should accumulate token usage', () => {
      monitor.startAgent('agent-1', 'task-1');
      monitor.recordTokenUsage('agent-1', 1000, 10);
      monitor.recordTokenUsage('agent-1', 2000, 20);

      const snapshot = monitor.getSnapshot();
      expect(snapshot.tokenUsage.totalTokens).toBe(3000);
    });

    it('should update agent token count and turns', () => {
      monitor.startAgent('agent-1', 'task-1');
      monitor.recordTokenUsage('agent-1', 1000, 10);
      monitor.recordTokenUsage('agent-1', 500, 5);

      const agents = monitor.getActiveAgents();
      expect(agents[0].tokensConsumed).toBe(1500);
      expect(agents[0].turnsExecuted).toBe(2);
    });

    it('should track budget remaining', () => {
      const limitedMonitor = createResourceMonitor({ budgetCents: 100 });
      limitedMonitor.startAgent('agent-1', 'task-1');
      limitedMonitor.recordTokenUsage('agent-1', 1000, 50);

      const snapshot = limitedMonitor.getSnapshot();
      expect(snapshot.tokenUsage.budgetRemainingCents).toBe(50);

      limitedMonitor.destroy();
    });
  });

  describe('recordApiCall', () => {
    it('should record API calls', () => {
      monitor.recordApiCall('openai');
      monitor.recordApiCall('openai');
      monitor.recordApiCall('anthropic');

      const snapshot = monitor.getSnapshot();
      expect(snapshot.apiCallsPerMinute['openai']).toBe(2);
      expect(snapshot.apiCallsPerMinute['anthropic']).toBe(1);
    });
  });

  describe('canProceed', () => {
    it('should allow when under limits', () => {
      const result = monitor.canProceed();
      expect(result.allowed).toBe(true);
    });

    it('should deny when budget exhausted', () => {
      const limitedMonitor = createResourceMonitor({ budgetCents: 10 });
      limitedMonitor.startAgent('agent-1', 'task-1');
      limitedMonitor.recordTokenUsage('agent-1', 1000, 15);

      const result = limitedMonitor.canProceed();
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Budget exhausted');

      limitedMonitor.destroy();
    });
  });

  describe('canStartAgent', () => {
    it('should allow when under limits', () => {
      const result = monitor.canStartAgent();
      expect(result.allowed).toBe(true);
    });

    it('should deny when max agents reached', () => {
      const limitedMonitor = createResourceMonitor({ maxActiveAgents: 1 });
      limitedMonitor.startAgent('agent-1', 'task-1');

      const result = limitedMonitor.canStartAgent();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Maximum active agents');

      limitedMonitor.destroy();
    });
  });

  describe('killStuckAgents', () => {
    it('should kill agents exceeding threshold', () => {
      const limitedMonitor = createResourceMonitor({ stuckThresholdMs: 1000 });
      limitedMonitor.startAgent('agent-1', 'task-1');

      // Advance time past threshold
      vi.advanceTimersByTime(2000);

      const killed = limitedMonitor.killStuckAgents();
      expect(killed).toContain('agent-1');
      expect(limitedMonitor.getActiveAgents()).toHaveLength(0);

      limitedMonitor.destroy();
    });

    it('should kill agents exceeding max turns', () => {
      const limitedMonitor = createResourceMonitor({ maxAgentTurns: 2 });
      limitedMonitor.startAgent('agent-1', 'task-1');
      limitedMonitor.recordTokenUsage('agent-1', 100, 1);
      limitedMonitor.recordTokenUsage('agent-1', 100, 1);
      limitedMonitor.recordTokenUsage('agent-1', 100, 1);

      const killed = limitedMonitor.killStuckAgents();
      expect(killed).toContain('agent-1');

      limitedMonitor.destroy();
    });

    it('should not kill agents under limits', () => {
      monitor.startAgent('agent-1', 'task-1');

      const killed = monitor.killStuckAgents();
      expect(killed).toHaveLength(0);
      expect(monitor.getActiveAgents()).toHaveLength(1);
    });
  });

  describe('setPendingTasks', () => {
    it('should update pending tasks count', () => {
      monitor.setPendingTasks(5);

      const snapshot = monitor.getSnapshot();
      expect(snapshot.pendingTasks).toBe(5);
    });
  });

  describe('periodic updates', () => {
    it('should detect stuck agents on interval', () => {
      const limitedMonitor = createResourceMonitor({ stuckThresholdMs: 10000 });
      limitedMonitor.startAgent('agent-1', 'task-1');

      // Agent should be running initially
      expect(limitedMonitor.getActiveAgents()[0].status).toBe('running');

      // Advance past warning threshold (half of stuck threshold = 5000ms)
      // Plus need to wait for the interval (5000ms) to fire for detection
      vi.advanceTimersByTime(10000);

      // Agent should be marked as stuck (detected in the interval callback)
      expect(limitedMonitor.getActiveAgents()[0].status).toBe('stuck');

      limitedMonitor.destroy();
    });
  });

  describe('destroy', () => {
    it('should clean up resources', () => {
      const localMonitor = createResourceMonitor();
      localMonitor.startAgent('agent-1', 'task-1');

      // Should not throw
      localMonitor.destroy();
    });
  });
});
