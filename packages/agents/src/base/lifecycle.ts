/**
 * @fileoverview Agent lifecycle management
 * @module @symbiosis/agents/base/lifecycle
 */

import { BehaviorSubject } from 'rxjs';
import type { Observable } from 'rxjs';

import { AgentState } from '@symbiosis/shared';
import type { ILogger } from '@symbiosis/shared';

/**
 * Lifecycle events
 */
export enum LifecycleEvent {
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  STARTING = 'starting',
  STARTED = 'started',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error',
}

/**
 * Lifecycle hook function type
 */
export type LifecycleHook = () => Promise<void>;

/**
 * Agent lifecycle manager
 */
export class AgentLifecycle {
  private readonly stateSubject: BehaviorSubject<AgentState>;
  private readonly hooks: Map<LifecycleEvent, LifecycleHook[]>;
  private readonly logger: ILogger;
  private readonly agentId: string;

  constructor(agentId: string, logger: ILogger) {
    this.agentId = agentId;
    this.logger = logger;
    this.stateSubject = new BehaviorSubject<AgentState>(AgentState.INITIALIZING);
    this.hooks = new Map();

    for (const event of Object.values(LifecycleEvent)) {
      this.hooks.set(event, []);
    }
  }

  /**
   * Get current agent state
   * @returns Current state
   */
  public getState(): AgentState {
    return this.stateSubject.getValue();
  }

  /**
   * Get observable of state changes
   * @returns Observable of states
   */
  public getStateStream(): Observable<AgentState> {
    return this.stateSubject.asObservable();
  }

  /**
   * Transition to a new state
   * @param newState - The new state
   */
  public async transitionTo(newState: AgentState): Promise<void> {
    const currentState = this.stateSubject.getValue();

    if (!this.isValidTransition(currentState, newState)) {
      this.logger.warn(
        `Invalid state transition: ${currentState} -> ${newState} for agent ${this.agentId}`,
      );
      return;
    }

    this.logger.info(`Agent ${this.agentId} transitioning: ${currentState} -> ${newState}`);

    // Execute pre-transition hooks
    await this.executeHooks(this.getPreTransitionEvent(newState));

    // Update state
    this.stateSubject.next(newState);

    // Execute post-transition hooks
    await this.executeHooks(this.getPostTransitionEvent(newState));
  }

  /**
   * Register a lifecycle hook
   * @param event - The lifecycle event
   * @param hook - The hook function
   * @returns Unsubscribe function
   */
  public onEvent(event: LifecycleEvent, hook: LifecycleHook): () => void {
    const eventHooks = this.hooks.get(event);
    if (eventHooks !== undefined) {
      eventHooks.push(hook);
    }

    return (): void => {
      const hooks = this.hooks.get(event);
      if (hooks !== undefined) {
        const index = hooks.indexOf(hook);
        if (index > -1) {
          hooks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Check if agent is in a ready state
   * @returns True if ready
   */
  public isReady(): boolean {
    return this.stateSubject.getValue() === AgentState.READY;
  }

  /**
   * Check if agent can accept tasks
   * @returns True if can accept
   */
  public canAcceptTasks(): boolean {
    const state = this.stateSubject.getValue();
    return state === AgentState.READY || state === AgentState.IDLE;
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private isValidTransition(from: AgentState, to: AgentState): boolean {
    const validTransitions: Record<AgentState, AgentState[]> = {
      [AgentState.INITIALIZING]: [AgentState.READY, AgentState.ERROR],
      [AgentState.READY]: [AgentState.BUSY, AgentState.IDLE, AgentState.ERROR, AgentState.TERMINATED],
      [AgentState.BUSY]: [AgentState.READY, AgentState.IDLE, AgentState.ERROR],
      [AgentState.IDLE]: [AgentState.READY, AgentState.BUSY, AgentState.ERROR, AgentState.TERMINATED],
      [AgentState.ERROR]: [AgentState.READY, AgentState.TERMINATED],
      [AgentState.TERMINATED]: [],
    };

    return validTransitions[from].includes(to);
  }

  private getPreTransitionEvent(state: AgentState): LifecycleEvent {
    switch (state) {
      case AgentState.INITIALIZING:
        return LifecycleEvent.INITIALIZING;
      case AgentState.READY:
        return LifecycleEvent.STARTING;
      case AgentState.TERMINATED:
        return LifecycleEvent.STOPPING;
      case AgentState.ERROR:
        return LifecycleEvent.ERROR;
      default:
        return LifecycleEvent.STARTING;
    }
  }

  private getPostTransitionEvent(state: AgentState): LifecycleEvent {
    switch (state) {
      case AgentState.READY:
        return LifecycleEvent.INITIALIZED;
      case AgentState.TERMINATED:
        return LifecycleEvent.STOPPED;
      default:
        return LifecycleEvent.STARTED;
    }
  }

  private async executeHooks(event: LifecycleEvent): Promise<void> {
    const eventHooks = this.hooks.get(event);
    if (eventHooks === undefined) {
      return;
    }

    for (const hook of eventHooks) {
      try {
        await hook();
      } catch (error) {
        this.logger.error(
          `Lifecycle hook error for ${event}: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
      }
    }
  }
}
