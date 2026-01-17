/**
 * @fileoverview SDK type exports
 * @module @symbiosis/sdk/types
 */

export type {
  IAgentConfig,
  IAgentTask,
  IAgentResult,
  ILogger,
} from '@symbiosis/shared';

export type { IRouterConfig, IEventBusConfig } from '@symbiosis/kernel';

/**
 * SDK initialization options
 */
export interface ISymbiosisOptions {
  readonly logger?: ILogger;
  readonly autoStart?: boolean;
  readonly debugMode?: boolean;
}

/**
 * Kernel context provided to components
 */
export interface IKernelContext {
  readonly isReady: boolean;
  readonly isOnline: boolean;
  readonly agentCount: number;
}

/**
 * Agent hook return type
 */
export interface IUseAgentReturn<T> {
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly result: T | null;
  readonly execute: (task: string) => Promise<void>;
}
