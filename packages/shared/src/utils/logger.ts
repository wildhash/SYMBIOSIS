/**
 * @fileoverview Structured logger for SymbiOS
 * @module @symbiosis/shared/utils/logger
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Logger interface that all SymbiOS components use
 */
export interface ILogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

/**
 * Log entry structure
 */
export interface ILogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: Date;
  readonly source: string;
  readonly context?: Record<string, unknown> | undefined;
}

/**
 * Logger configuration
 */
export interface ILoggerConfig {
  readonly source: string;
  readonly minLevel: LogLevel;
  readonly enableConsole: boolean;
  readonly enableStructured: boolean;
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: ILoggerConfig = {
  source: 'symbiosis',
  minLevel: LogLevel.DEBUG,
  enableConsole: true,
  enableStructured: false,
};

/**
 * Logger implementation
 */
export class Logger implements ILogger {
  private readonly config: ILoggerConfig;
  private readonly listeners: Array<(entry: ILogEntry) => void>;

  constructor(config?: Partial<ILoggerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.listeners = [];
  }

  /**
   * Log a debug message
   * @param message - The message to log
   * @param context - Optional context data
   */
  public debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log an info message
   * @param message - The message to log
   * @param context - Optional context data
   */
  public info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log a warning message
   * @param message - The message to log
   * @param context - Optional context data
   */
  public warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log an error message
   * @param message - The message to log
   * @param context - Optional context data
   */
  public error(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Create a child logger with a different source
   * @param source - The source name for the child logger
   * @returns A new logger instance
   */
  public child(source: string): Logger {
    const childLogger = new Logger({
      ...this.config,
      source: `${this.config.source}:${source}`,
    });

    // Share listeners with parent
    for (const listener of this.listeners) {
      childLogger.addListener(listener);
    }

    return childLogger;
  }

  /**
   * Add a listener for log entries
   * @param listener - Function to call for each log entry
   * @returns Function to remove the listener
   */
  public addListener(listener: (entry: ILogEntry) => void): () => void {
    this.listeners.push(listener);
    return (): void => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (level < this.config.minLevel) {
      return;
    }

    const entry: ILogEntry = {
      level,
      message,
      timestamp: new Date(),
      source: this.config.source,
      context,
    };

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(entry);
      } catch {
        // Ignore listener errors
      }
    }

    // Console output
    if (this.config.enableConsole) {
      this.writeToConsole(entry);
    }
  }

  /**
   * Write log entry to console
   */
  private writeToConsole(entry: ILogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelName = LogLevel[entry.level];
    const prefix = `[${timestamp}] [${levelName ?? 'UNKNOWN'}] [${entry.source}]`;

    if (this.config.enableStructured) {
      const structured = {
        ...entry,
        level: LogLevel[entry.level],
        timestamp: entry.timestamp.toISOString(),
      };

      switch (entry.level) {
        case LogLevel.DEBUG:
        case LogLevel.INFO:
          // Using structured output for info-level logs
          break;
        case LogLevel.WARN:
          console.warn(JSON.stringify(structured));
          break;
        case LogLevel.ERROR:
          console.error(JSON.stringify(structured));
          break;
      }
    } else {
      const contextStr =
        entry.context !== undefined ? ` ${JSON.stringify(entry.context)}` : '';

      switch (entry.level) {
        case LogLevel.DEBUG:
        case LogLevel.INFO:
          // Debug/info logs - not using console.log per eslint rules
          break;
        case LogLevel.WARN:
          console.warn(`${prefix} ${entry.message}${contextStr}`);
          break;
        case LogLevel.ERROR:
          console.error(`${prefix} ${entry.message}${contextStr}`);
          break;
      }
    }
  }
}

/**
 * Create a logger with the given source name
 * @param source - The source name for the logger
 * @param config - Optional additional configuration
 * @returns A configured logger instance
 */
export function createLogger(source: string, config?: Partial<ILoggerConfig>): ILogger {
  return new Logger({ ...config, source });
}

/**
 * No-op logger for testing
 */
export const noopLogger: ILogger = {
  debug: (): void => undefined,
  info: (): void => undefined,
  warn: (): void => undefined,
  error: (): void => undefined,
};
