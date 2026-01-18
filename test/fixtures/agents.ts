/**
 * @fileoverview Agent test fixtures
 */

import { AgentType, Priority } from '@symbiosis/shared';
import type { IAgentConfig, IAgentTask } from '@symbiosis/shared';

/**
 * Create a mock agent config
 */
export function createMockAgentConfig(
  overrides?: Partial<IAgentConfig>,
): IAgentConfig {
  return {
    id: 'test-agent',
    type: AgentType.CODER,
    name: 'Test Agent',
    description: 'A test agent for unit tests',
    capabilities: ['testing'],
    maxConcurrentTasks: 2,
    defaultPriority: Priority.MEDIUM,
    ...overrides,
  };
}

/**
 * Create a mock agent task
 */
export function createMockAgentTask(
  overrides?: Partial<IAgentTask>,
): IAgentTask {
  return {
    id: `task-${Date.now()}`,
    agentId: 'test-agent',
    description: 'Test task',
    input: {},
    priority: Priority.MEDIUM,
    requiresApproval: false,
    timeoutMs: 5000,
    createdAt: new Date(),
    ...overrides,
  };
}
