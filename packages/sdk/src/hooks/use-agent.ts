/**
 * @fileoverview React hook for interacting with SymbiOS agents
 * @module @symbiosis/sdk/hooks/use-agent
 */

import { useState, useCallback } from 'react';

import type { IAgentTask } from '@symbiosis/shared';
import { AgentType, Priority } from '@symbiosis/shared';
import type { BaseAgent } from '@symbiosis/agents';

import type { IUseAgentReturn } from '../types/index';

/**
 * Use agent hook options
 */
export interface IUseAgentOptions {
  readonly agentType: AgentType;
  readonly agent?: BaseAgent;
  readonly defaultPriority?: Priority;
  readonly requiresApproval?: boolean;
  readonly timeoutMs?: number;
}

/**
 * React hook for interacting with a SymbiOS agent
 * @param options - Hook options
 * @returns Agent interaction methods and state
 */
export function useAgent<T = unknown>(options: IUseAgentOptions): IUseAgentReturn<T> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<T | null>(null);

  const execute = useCallback(
    async (taskDescription: string): Promise<void> => {
      if (options.agent === undefined) {
        setError(new Error('Agent not provided'));
        return;
      }

      setIsLoading(true);
      setError(null);

      const task: IAgentTask = {
        id: `task_${Date.now().toString(36)}`,
        agentId: options.agent.id,
        description: taskDescription,
        input: { description: taskDescription },
        priority: options.defaultPriority ?? Priority.MEDIUM,
        requiresApproval: options.requiresApproval ?? false,
        timeoutMs: options.timeoutMs ?? 30000,
        createdAt: new Date(),
      };

      try {
        const agentResult = await options.agent.execute(task);

        if (agentResult.ok) {
          setResult(agentResult.value.output as T);
        } else {
          setError(new Error(agentResult.error.message));
        }
      } catch (e) {
        setError(e instanceof Error ? e : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    },
    [options.agent, options.defaultPriority, options.requiresApproval, options.timeoutMs],
  );

  return {
    isLoading,
    error,
    result,
    execute,
  };
}
