/**
 * @fileoverview Event types for the SymbiOS event bus
 * @module @symbiosis/shared/types/events
 */

/**
 * All event types in the SymbiOS system
 */
export enum EventType {
  // Kernel Events
  KERNEL_READY = 'kernel:ready',
  KERNEL_ERROR = 'kernel:error',
  KERNEL_SHUTDOWN = 'kernel:shutdown',

  // Agent Lifecycle
  AGENT_SPAWNED = 'agent:spawned',
  AGENT_READY = 'agent:ready',
  AGENT_BUSY = 'agent:busy',
  AGENT_IDLE = 'agent:idle',
  AGENT_ERROR = 'agent:error',
  AGENT_TERMINATED = 'agent:terminated',

  // Task Events
  TASK_QUEUED = 'task:queued',
  TASK_STARTED = 'task:started',
  TASK_PROGRESS = 'task:progress',
  TASK_COMPLETED = 'task:completed',
  TASK_FAILED = 'task:failed',
  TASK_CANCELLED = 'task:cancelled',

  // Routing Events
  ROUTE_REQUESTED = 'route:requested',
  ROUTE_DECIDED = 'route:decided',
  ROUTE_EXECUTED = 'route:executed',
  ROUTE_FAILED = 'route:failed',

  // Approval Events
  APPROVAL_REQUIRED = 'approval:required',
  APPROVAL_GRANTED = 'approval:granted',
  APPROVAL_DENIED = 'approval:denied',
  APPROVAL_TIMEOUT = 'approval:timeout',

  // Safety Events
  CIRCUIT_OPENED = 'safety:circuit_opened',
  CIRCUIT_CLOSED = 'safety:circuit_closed',
  BUDGET_WARNING = 'safety:budget_warning',
  BUDGET_EXCEEDED = 'safety:budget_exceeded',
}

/**
 * Base event interface
 */
export interface IEvent<T = unknown> {
  readonly id: string;
  readonly type: EventType;
  readonly source: string;
  readonly timestamp: Date;
  readonly payload: T;
  readonly correlationId?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

/**
 * Event filter for subscriptions
 */
export interface IEventFilter {
  readonly types?: readonly EventType[];
  readonly sources?: readonly string[];
  readonly correlationId?: string;
}

/**
 * Event handler type
 */
export type EventHandler<T = unknown> = (event: IEvent<T>) => void | Promise<void>;
