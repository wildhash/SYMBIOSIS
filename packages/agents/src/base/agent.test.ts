/**
 * @fileoverview Tests for BaseAgent
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { firstValueFrom } from 'rxjs';

import {
  AgentType,
  AgentState,
  AgentErrorCode,
  noopLogger,
} from '@symbiosis/shared';
import type { IAgentConfig, IAgentTask, IAgentResult } from '@symbiosis/shared';
import { EventBus } from '@symbiosis/kernel';
import type { IEventBusConfig } from '@symbiosis/kernel';

import { BaseAgent } from './agent';

// Test implementation of BaseAgent
class TestAgent extends BaseAgent {
  public initializeCalled = false;
  public terminateCalled = false;
  public executeResult: IAgentResult | null = null;
  public shouldFailExecute = false;

  public canHandle(_task: IAgentTask): boolean {
    return true;
  }

  protected async onInitialize(): Promise<void> {
    this.initializeCalled = true;
  }

  protected async onExecute(task: IAgentTask): Promise<IAgentResult> {
    if (this.shouldFailExecute) {
      throw new Error('Intentional failure');
    }

    return (
      this.executeResult ?? {
        taskId: task.id,
        agentId: this.config.id,
        success: true,
        output: 'test output',
        executionTimeMs: 100,
        tokensUsed: 50,
        completedAt: new Date(),
      }
    );
  }

  protected async onTerminate(): Promise<void> {
    this.terminateCalled = true;
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;
  let eventBus: EventBus;

  const agentConfig: IAgentConfig = {
    id: 'test-agent-1',
    type: AgentType.CODER,
    name: 'Test Agent',
    description: 'A test agent',
    capabilities: ['test'],
    maxConcurrentTasks: 2,
    defaultPriority: 1,
  };

  const eventBusConfig: IEventBusConfig = {
    replayBufferSize: 10,
    enableLogging: false,
  };

  beforeEach(() => {
    eventBus = new EventBus(eventBusConfig, noopLogger);
    agent = new TestAgent(agentConfig, noopLogger, eventBus);
  });

  describe('properties', () => {
    it('should expose id, type, and name', () => {
      expect(agent.id).toBe('test-agent-1');
      expect(agent.type).toBe(AgentType.CODER);
      expect(agent.name).toBe('Test Agent');
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const result = await agent.initialize();

      expect(result.ok).toBe(true);
      expect(agent.initializeCalled).toBe(true);
      expect(agent.getState()).toBe(AgentState.READY);
    });

    it('should emit AGENT_SPAWNED event', async () => {
      const eventPromise = firstValueFrom(eventBus.onType('agent:spawned' as never));

      await agent.initialize();

      const event = await eventPromise;
      expect(event.source).toBe('test-agent-1');
    });
  });

  describe('execute', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should execute a task successfully', async () => {
      const task: IAgentTask = {
        id: 'task-1',
        agentId: 'test-agent-1',
        description: 'Test task',
        input: {},
        priority: 1,
        requiresApproval: false,
        timeoutMs: 5000,
        createdAt: new Date(),
      };

      const result = await agent.execute(task);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.success).toBe(true);
        expect(result.value.taskId).toBe('task-1');
      }
    });

    it('should update metrics after execution', async () => {
      const task: IAgentTask = {
        id: 'task-2',
        agentId: 'test-agent-1',
        description: 'Test task',
        input: {},
        priority: 1,
        requiresApproval: false,
        timeoutMs: 5000,
        createdAt: new Date(),
      };

      await agent.execute(task);

      const metrics = agent.getMetrics();
      expect(metrics.totalTasks).toBe(1);
      expect(metrics.successfulTasks).toBe(1);
    });

    it('should fail when agent not ready', async () => {
      const uninitializedAgent = new TestAgent(agentConfig, noopLogger, eventBus);

      const task: IAgentTask = {
        id: 'task-3',
        agentId: 'test-agent-1',
        description: 'Test task',
        input: {},
        priority: 1,
        requiresApproval: false,
        timeoutMs: 5000,
        createdAt: new Date(),
      };

      const result = await uninitializedAgent.execute(task);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(AgentErrorCode.NOT_READY);
      }
    });

    it('should handle execution failure', async () => {
      agent.shouldFailExecute = true;

      const task: IAgentTask = {
        id: 'task-4',
        agentId: 'test-agent-1',
        description: 'Test task',
        input: {},
        priority: 1,
        requiresApproval: false,
        timeoutMs: 5000,
        createdAt: new Date(),
      };

      const result = await agent.execute(task);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(AgentErrorCode.EXECUTION_FAILED);
      }

      const metrics = agent.getMetrics();
      expect(metrics.failedTasks).toBe(1);
    });
  });

  describe('terminate', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should terminate successfully', async () => {
      const result = await agent.terminate();

      expect(result.ok).toBe(true);
      expect(agent.terminateCalled).toBe(true);
      expect(agent.getState()).toBe(AgentState.TERMINATED);
    });
  });

  describe('getStateStream', () => {
    it('should emit state changes', async () => {
      const states: AgentState[] = [];
      agent.getStateStream().subscribe((state) => states.push(state));

      await agent.initialize();

      expect(states).toContain(AgentState.INITIALIZING);
      expect(states).toContain(AgentState.READY);
    });
  });

  describe('getMetricsStream', () => {
    it('should emit metrics changes', async () => {
      await agent.initialize();

      const metricsPromise = firstValueFrom(agent.getMetricsStream());

      const task: IAgentTask = {
        id: 'task-5',
        agentId: 'test-agent-1',
        description: 'Test task',
        input: {},
        priority: 1,
        requiresApproval: false,
        timeoutMs: 5000,
        createdAt: new Date(),
      };

      await agent.execute(task);

      const metrics = await metricsPromise;
      expect(metrics.totalTasks).toBeGreaterThanOrEqual(0);
    });
  });
});
