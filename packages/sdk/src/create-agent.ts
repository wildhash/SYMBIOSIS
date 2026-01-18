/**
 * @fileoverview Factory function for creating agents
 * @module @symbiosis/sdk/create-agent
 */

import type { ILogger, IAgentConfig } from '@symbiosis/shared';
import { AgentType, noopLogger } from '@symbiosis/shared';
import { EventBus } from '@symbiosis/kernel';
import type { IEventBusConfig } from '@symbiosis/kernel';
import type { BaseAgent } from '@symbiosis/agents';
import {
  ArchitectAgent,
  CoderAgent,
  ExecutorAgent,
  CriticAgent,
} from '@symbiosis/agents';

/**
 * Agent factory options
 */
export interface ICreateAgentOptions {
  readonly type: AgentType;
  readonly config?: Partial<IAgentConfig>;
  readonly logger?: ILogger;
  readonly eventBus?: EventBus;
}

/**
 * Default event bus config for agent creation
 */
const DEFAULT_EVENT_BUS_CONFIG: IEventBusConfig = {
  replayBufferSize: 50,
  enableLogging: false,
};

/**
 * Create an agent of the specified type
 * @param options - Agent creation options
 * @returns The created agent
 */
export function createAgent(options: ICreateAgentOptions): BaseAgent {
  const logger = options.logger ?? noopLogger;
  const eventBus = options.eventBus ?? new EventBus(DEFAULT_EVENT_BUS_CONFIG, logger);

  switch (options.type) {
    case AgentType.ARCHITECT:
      return new ArchitectAgent(logger, eventBus, options.config);

    case AgentType.CODER:
      return new CoderAgent(logger, eventBus, options.config);

    case AgentType.EXECUTOR:
      return new ExecutorAgent(logger, eventBus, options.config);

    case AgentType.CRITIC:
      return new CriticAgent(logger, eventBus, options.config);

    case AgentType.TERMINAL:
    case AgentType.MANAGER:
      // These would be implemented separately
      throw new Error(`Agent type ${options.type} not yet implemented`);

    default: {
      // Exhaustive check
      const exhaustiveCheck: never = options.type;
      throw new Error(`Unknown agent type: ${String(exhaustiveCheck)}`);
    }
  }
}

/**
 * Create multiple agents
 * @param types - Array of agent types to create
 * @param options - Shared options
 * @returns Map of agents by type
 */
export function createAgents(
  types: readonly AgentType[],
  options?: { readonly logger?: ILogger; readonly eventBus?: EventBus },
): Map<AgentType, BaseAgent> {
  const agents = new Map<AgentType, BaseAgent>();
  const logger = options?.logger ?? noopLogger;
  const eventBus = options?.eventBus ?? new EventBus(DEFAULT_EVENT_BUS_CONFIG, logger);

  for (const type of types) {
    try {
      const agent = createAgent({ type, logger, eventBus });
      agents.set(type, agent);
    } catch {
      // Skip unsupported agent types
    }
  }

  return agents;
}
