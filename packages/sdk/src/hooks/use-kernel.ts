/**
 * @fileoverview React hook for accessing the SymbiOS kernel
 * @module @symbiosis/sdk/hooks/use-kernel
 */

import { useState, useEffect, useMemo } from 'react';

import type { ILogger } from '@symbiosis/shared';
import { noopLogger } from '@symbiosis/shared';
import { EventBus, Router, CircuitBreaker } from '@symbiosis/kernel';
import type { IRouterConfig, ICircuitBreakerConfig, IEventBusConfig } from '@symbiosis/kernel';

import type { IKernelContext } from '../types/index';

/**
 * Kernel instance
 */
interface IKernelInstance {
  readonly eventBus: EventBus;
  readonly router: Router;
  readonly circuitBreaker: CircuitBreaker;
}

/**
 * Use kernel hook options
 */
export interface IUseKernelOptions {
  readonly routerConfig?: IRouterConfig;
  readonly eventBusConfig?: IEventBusConfig;
  readonly circuitBreakerConfig?: ICircuitBreakerConfig;
  readonly logger?: ILogger;
}

/**
 * Default event bus config
 */
const DEFAULT_EVENT_BUS_CONFIG: IEventBusConfig = {
  replayBufferSize: 100,
  enableLogging: false,
};

/**
 * Hook return type
 */
export interface IUseKernelReturn {
  readonly context: IKernelContext;
  readonly kernel: IKernelInstance | null;
  readonly isInitialized: boolean;
  readonly error: Error | null;
}

/**
 * React hook for accessing the SymbiOS kernel
 * @param options - Hook options
 * @returns Kernel context and instance
 */
export function useKernel(options: IUseKernelOptions = {}): IUseKernelReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  const logger = options.logger ?? noopLogger;
  const eventBusConfig = options.eventBusConfig ?? DEFAULT_EVENT_BUS_CONFIG;

  // Create kernel instances
  const kernel = useMemo((): IKernelInstance | null => {
    if (options.routerConfig === undefined || options.circuitBreakerConfig === undefined) {
      return null;
    }

    try {
      const eventBus = new EventBus(eventBusConfig, logger);
      const router = new Router(options.routerConfig, logger);
      const circuitBreaker = new CircuitBreaker(options.circuitBreakerConfig, logger);

      return { eventBus, router, circuitBreaker };
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to create kernel'));
      return null;
    }
  }, [options.routerConfig, options.circuitBreakerConfig, eventBusConfig, logger]);

  // Handle online/offline status
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleOnline = (): void => {
      setIsOnline(true);
    };

    const handleOffline = (): void => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return (): void => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize kernel
  useEffect(() => {
    if (kernel !== null) {
      setIsInitialized(true);
      logger.info('Kernel initialized');
    }
  }, [kernel, logger]);

  // Create context
  const context: IKernelContext = useMemo(
    () => ({
      isReady: isInitialized && kernel !== null,
      isOnline,
      agentCount: 0, // Would be tracked by agent manager
    }),
    [isInitialized, isOnline, kernel],
  );

  return {
    context,
    kernel,
    isInitialized,
    error,
  };
}
