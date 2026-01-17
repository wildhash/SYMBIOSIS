/**
 * @fileoverview RxJS-based event bus for inter-agent and kernel communication.
 * Provides typed, observable event streams with filtering and replay capabilities.
 * @module @symbiosis/kernel/bus/event-bus
 */

import { Subject, ReplaySubject } from 'rxjs';
import { filter, share, takeUntil } from 'rxjs/operators';
import type { Observable } from 'rxjs';

import type { ILogger, IEvent, IEventFilter, EventType } from '@symbiosis/shared';

import type { IEventBusConfig } from '../types/kernel';

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Event bus for SymbiOS kernel communication
 */
export class EventBus {
  private readonly eventStream: Subject<IEvent>;
  private readonly replayStream: ReplaySubject<IEvent>;
  private readonly destroy$: Subject<void>;
  private readonly config: IEventBusConfig;
  private readonly logger: ILogger;
  private eventCounter: number;

  constructor(config: IEventBusConfig, logger: ILogger) {
    this.config = config;
    this.logger = logger;
    this.eventStream = new Subject<IEvent>();
    this.replayStream = new ReplaySubject<IEvent>(config.replayBufferSize);
    this.destroy$ = new Subject<void>();
    this.eventCounter = 0;

    // Pipe main stream to replay stream
    this.eventStream.pipe(takeUntil(this.destroy$)).subscribe((event) => {
      this.replayStream.next(event);
      if (this.config.enableLogging) {
        this.logger.debug(`Event: ${event.type} from ${event.source}`);
      }
    });
  }

  /**
   * Emit an event to the bus.
   * @param type - The event type
   * @param source - The source of the event
   * @param payload - The event payload
   * @param options - Optional correlation ID and metadata
   * @returns The generated event ID
   */
  public emit<T>(
    type: EventType,
    source: string,
    payload: T,
    options?: { readonly correlationId?: string; readonly metadata?: Record<string, unknown> },
  ): string {
    const id = this.generateEventId();

    const event: IEvent<T> = {
      id,
      type,
      source,
      timestamp: new Date(),
      payload,
      correlationId: options?.correlationId,
      metadata: options?.metadata,
    };

    this.eventStream.next(event);
    return id;
  }

  /**
   * Subscribe to events with optional filtering.
   * @param eventFilter - Optional filter for events
   * @returns Observable of matching events
   */
  public on<T = unknown>(eventFilter?: IEventFilter): Observable<IEvent<T>> {
    return this.eventStream.pipe(
      filter((event): event is IEvent<T> => this.matchesFilter(event, eventFilter)),
      share(),
    );
  }

  /**
   * Subscribe to events with replay of recent history.
   * @param eventFilter - Optional filter for events
   * @returns Observable of matching events including replay
   */
  public onWithReplay<T = unknown>(eventFilter?: IEventFilter): Observable<IEvent<T>> {
    return this.replayStream.pipe(
      filter((event): event is IEvent<T> => this.matchesFilter(event, eventFilter)),
      share(),
    );
  }

  /**
   * Subscribe to a specific event type.
   * @param type - The event type to subscribe to
   * @returns Observable of matching events
   */
  public onType<T = unknown>(type: EventType): Observable<IEvent<T>> {
    return this.on<T>({ types: [type] });
  }

  /**
   * Subscribe to events from a specific source.
   * @param source - The source to filter by
   * @returns Observable of matching events
   */
  public onSource<T = unknown>(source: string): Observable<IEvent<T>> {
    return this.on<T>({ sources: [source] });
  }

  /**
   * Subscribe to events with a specific correlation ID.
   * @param correlationId - The correlation ID to filter by
   * @returns Observable of matching events
   */
  public onCorrelation<T = unknown>(correlationId: string): Observable<IEvent<T>> {
    return this.on<T>({ correlationId });
  }

  /**
   * Wait for a specific event (promise-based).
   * @param eventFilter - Filter for the expected event
   * @param timeoutMs - Optional timeout in milliseconds
   * @returns Promise that resolves with the matching event
   */
  public async waitFor<T = unknown>(
    eventFilter: IEventFilter,
    timeoutMs?: number,
  ): Promise<IEvent<T>> {
    return new Promise((resolve, reject) => {
      const timeout =
        timeoutMs !== undefined
          ? setTimeout(() => {
              subscription.unsubscribe();
              reject(new Error(`Timeout waiting for event: ${JSON.stringify(eventFilter)}`));
            }, timeoutMs)
          : null;

      const subscription = this.on<T>(eventFilter).subscribe((event) => {
        if (timeout !== null) {
          clearTimeout(timeout);
        }
        subscription.unsubscribe();
        resolve(event);
      });
    });
  }

  /**
   * Get the current event counter value
   * @returns The current event counter
   */
  public getEventCount(): number {
    return this.eventCounter;
  }

  /**
   * Destroy the event bus and clean up resources.
   */
  public destroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.eventStream.complete();
    this.replayStream.complete();
    this.logger.info('Event bus destroyed');
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private generateEventId(): string {
    this.eventCounter++;
    return `evt_${Date.now().toString(36)}_${this.eventCounter.toString(36)}`;
  }

  private matchesFilter(event: IEvent, eventFilter?: IEventFilter): boolean {
    if (eventFilter === undefined) {
      return true;
    }

    if (eventFilter.types !== undefined && !eventFilter.types.includes(event.type)) {
      return false;
    }

    if (eventFilter.sources !== undefined && !eventFilter.sources.includes(event.source)) {
      return false;
    }

    if (
      eventFilter.correlationId !== undefined &&
      event.correlationId !== eventFilter.correlationId
    ) {
      return false;
    }

    return true;
  }
}

/**
 * Create an event bus instance
 * @param config - Event bus configuration
 * @param logger - Logger instance
 * @returns Configured event bus
 */
export function createEventBus(config: IEventBusConfig, logger: ILogger): EventBus {
  return new EventBus(config, logger);
}
