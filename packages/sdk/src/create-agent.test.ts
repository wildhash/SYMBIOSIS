/**
 * @fileoverview Tests for agent factory
 */

import { describe, it, expect } from 'vitest';

import { AgentType, noopLogger } from '@symbiosis/shared';
import { EventBus } from '@symbiosis/kernel';
import type { IEventBusConfig } from '@symbiosis/kernel';
import { ArchitectAgent, CoderAgent, ExecutorAgent, CriticAgent } from '@symbiosis/agents';

import { createAgent, createAgents } from './create-agent';

const eventBusConfig: IEventBusConfig = {
  replayBufferSize: 10,
  enableLogging: false,
};

describe('createAgent', () => {
  it('should create an Architect agent', () => {
    const eventBus = new EventBus(eventBusConfig, noopLogger);
    const agent = createAgent({
      type: AgentType.ARCHITECT,
      logger: noopLogger,
      eventBus,
    });

    expect(agent).toBeInstanceOf(ArchitectAgent);
  });

  it('should create a Coder agent', () => {
    const eventBus = new EventBus(eventBusConfig, noopLogger);
    const agent = createAgent({
      type: AgentType.CODER,
      logger: noopLogger,
      eventBus,
    });

    expect(agent).toBeInstanceOf(CoderAgent);
  });

  it('should create an Executor agent', () => {
    const eventBus = new EventBus(eventBusConfig, noopLogger);
    const agent = createAgent({
      type: AgentType.EXECUTOR,
      logger: noopLogger,
      eventBus,
    });

    expect(agent).toBeInstanceOf(ExecutorAgent);
  });

  it('should create a Critic agent', () => {
    const eventBus = new EventBus(eventBusConfig, noopLogger);
    const agent = createAgent({
      type: AgentType.CRITIC,
      logger: noopLogger,
      eventBus,
    });

    expect(agent).toBeInstanceOf(CriticAgent);
  });

  it('should throw for unimplemented agent types', () => {
    const eventBus = new EventBus(eventBusConfig, noopLogger);

    expect(() =>
      createAgent({
        type: AgentType.TERMINAL,
        logger: noopLogger,
        eventBus,
      }),
    ).toThrow('not yet implemented');
  });
});

describe('createAgents', () => {
  it('should create multiple agents', () => {
    const types = [AgentType.ARCHITECT, AgentType.CODER, AgentType.CRITIC];
    const agents = createAgents(types, { logger: noopLogger });

    expect(agents.size).toBe(3);
    expect(agents.get(AgentType.ARCHITECT)).toBeInstanceOf(ArchitectAgent);
    expect(agents.get(AgentType.CODER)).toBeInstanceOf(CoderAgent);
    expect(agents.get(AgentType.CRITIC)).toBeInstanceOf(CriticAgent);
  });

  it('should skip unsupported agent types', () => {
    const types = [AgentType.ARCHITECT, AgentType.TERMINAL];
    const agents = createAgents(types, { logger: noopLogger });

    expect(agents.size).toBe(1);
    expect(agents.get(AgentType.ARCHITECT)).toBeInstanceOf(ArchitectAgent);
    expect(agents.get(AgentType.TERMINAL)).toBeUndefined();
  });
});
