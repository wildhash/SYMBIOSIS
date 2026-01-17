/**
 * @fileoverview Tests for Logger utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { Logger, LogLevel, createLogger, noopLogger } from './logger';
import type { ILogEntry } from './logger';

describe('Logger', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should create a logger with default config', () => {
      const logger = new Logger();
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should create a logger with custom config', () => {
      const logger = new Logger({
        source: 'test',
        minLevel: LogLevel.WARN,
      });
      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe('logging methods', () => {
    it('should log warn messages to console', () => {
      const logger = new Logger({ source: 'test' });
      logger.warn('test warning');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should log error messages to console', () => {
      const logger = new Logger({ source: 'test' });
      logger.error('test error');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should include context in log output', () => {
      const logger = new Logger({ source: 'test' });
      logger.warn('test message', { key: 'value' });
      expect(consoleWarnSpy).toHaveBeenCalled();
      const call = consoleWarnSpy.mock.calls[0];
      expect(call).toBeDefined();
      if (call !== undefined && call[0] !== undefined) {
        expect(String(call[0])).toContain('{"key":"value"}');
      }
    });

    it('should respect minLevel configuration', () => {
      const logger = new Logger({
        source: 'test',
        minLevel: LogLevel.ERROR,
      });
      logger.warn('should not appear');
      logger.error('should appear');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('listeners', () => {
    it('should notify listeners on log', () => {
      const logger = new Logger({ source: 'test', enableConsole: false });
      const listener = vi.fn();

      logger.addListener(listener);
      logger.warn('test message');

      expect(listener).toHaveBeenCalledTimes(1);
      const entry = listener.mock.calls[0]?.[0] as ILogEntry | undefined;
      expect(entry).toBeDefined();
      if (entry !== undefined) {
        expect(entry.message).toBe('test message');
        expect(entry.level).toBe(LogLevel.WARN);
        expect(entry.source).toBe('test');
      }
    });

    it('should allow removing listeners', () => {
      const logger = new Logger({ source: 'test', enableConsole: false });
      const listener = vi.fn();

      const remove = logger.addListener(listener);
      logger.warn('first');
      remove();
      logger.warn('second');

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should handle listener errors gracefully', () => {
      const logger = new Logger({ source: 'test', enableConsole: false });
      const badListener = vi.fn().mockImplementation(() => {
        throw new Error('listener error');
      });
      const goodListener = vi.fn();

      logger.addListener(badListener);
      logger.addListener(goodListener);
      logger.warn('test');

      expect(badListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
    });
  });

  describe('child', () => {
    it('should create a child logger with prefixed source', () => {
      const parent = new Logger({ source: 'parent', enableConsole: false });
      const listener = vi.fn();
      parent.addListener(listener);

      const child = parent.child('child');
      child.warn('test');

      const entry = listener.mock.calls[0]?.[0] as ILogEntry | undefined;
      expect(entry).toBeDefined();
      if (entry !== undefined) {
        expect(entry.source).toBe('parent:child');
      }
    });

    it('should share listeners with parent', () => {
      const parent = new Logger({ source: 'parent', enableConsole: false });
      const listener = vi.fn();
      parent.addListener(listener);

      const child = parent.child('child');
      child.warn('child message');

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('structured logging', () => {
    it('should output structured JSON when enabled', () => {
      const logger = new Logger({
        source: 'test',
        enableStructured: true,
      });
      logger.warn('structured message');

      expect(consoleWarnSpy).toHaveBeenCalled();
      const call = consoleWarnSpy.mock.calls[0];
      expect(call).toBeDefined();
      if (call !== undefined && call[0] !== undefined) {
        const parsed = JSON.parse(String(call[0])) as Record<string, unknown>;
        expect(parsed['message']).toBe('structured message');
        expect(parsed['source']).toBe('test');
        expect(parsed['level']).toBe('WARN');
      }
    });
  });

  describe('createLogger', () => {
    it('should create a logger with the given source', () => {
      const logger = createLogger('my-source');
      expect(logger).toBeDefined();
    });
  });

  describe('noopLogger', () => {
    it('should have all logging methods', () => {
      expect(noopLogger.debug).toBeDefined();
      expect(noopLogger.info).toBeDefined();
      expect(noopLogger.warn).toBeDefined();
      expect(noopLogger.error).toBeDefined();
    });

    it('should not throw when called', () => {
      expect(() => noopLogger.debug('test')).not.toThrow();
      expect(() => noopLogger.info('test')).not.toThrow();
      expect(() => noopLogger.warn('test')).not.toThrow();
      expect(() => noopLogger.error('test')).not.toThrow();
    });
  });
});
