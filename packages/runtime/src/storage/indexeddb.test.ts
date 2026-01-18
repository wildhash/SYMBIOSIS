/**
 * @fileoverview Tests for IndexedDB storage adapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { IndexedDBStorage, StorageError, StorageErrorCode, createIndexedDBStorage } from './indexeddb';

// Mock IndexedDB for Node.js testing environment
const mockIndexedDB = {
  open: vi.fn(),
};

describe('IndexedDBStorage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // @ts-expect-error - mocking indexedDB for tests
    globalThis.indexedDB = mockIndexedDB;
  });

  describe('constructor', () => {
    it('should create storage with default config', () => {
      const storage = new IndexedDBStorage();
      expect(storage).toBeInstanceOf(IndexedDBStorage);
    });

    it('should create storage with custom config', () => {
      const storage = new IndexedDBStorage({
        databaseName: 'test-db',
        storeName: 'test-store',
        version: 2,
      });
      expect(storage).toBeInstanceOf(IndexedDBStorage);
    });
  });

  describe('initialize', () => {
    it('should return error when IndexedDB not available', async () => {
      // @ts-expect-error - testing unavailable indexedDB
      globalThis.indexedDB = undefined;

      const storage = new IndexedDBStorage();
      const result = await storage.initialize();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(StorageErrorCode.NOT_AVAILABLE);
        expect(result.error.context).toBeDefined();
        expect(result.error.context?.databaseName).toBe('symbiosis');
      }
    });
  });

  describe('get/set', () => {
    it('should return undefined when db not initialized', async () => {
      const storage = new IndexedDBStorage();
      const result = await storage.get('key');
      expect(result).toBeUndefined();
    });
  });

  describe('keys', () => {
    it('should return empty array when db not initialized', async () => {
      const storage = new IndexedDBStorage();
      const result = await storage.keys();
      expect(result).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should return false when db not initialized', async () => {
      const storage = new IndexedDBStorage();
      const result = await storage.delete('key');
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should not throw when db not initialized', async () => {
      const storage = new IndexedDBStorage();
      await expect(storage.clear()).resolves.toBeUndefined();
    });
  });

  describe('close', () => {
    it('should not throw when db not initialized', () => {
      const storage = new IndexedDBStorage();
      expect(() => storage.close()).not.toThrow();
    });
  });

  describe('createIndexedDBStorage', () => {
    it('should create a storage instance', () => {
      const storage = createIndexedDBStorage();
      expect(storage).toBeInstanceOf(IndexedDBStorage);
    });
  });
});

describe('StorageError', () => {
  describe('constructor', () => {
    it('should create error with basic properties', () => {
      const error = new StorageError(
        'Test error message',
        StorageErrorCode.READ_FAILED,
      );

      expect(error.message).toBe('Test error message');
      expect(error.code).toBe(StorageErrorCode.READ_FAILED);
      expect(error.name).toBe('StorageError');
      expect(error.originalError).toBeUndefined();
      expect(error.context).toBeUndefined();
    });

    it('should create error with original error', () => {
      const originalError = new Error('Original error');
      const error = new StorageError(
        'Wrapped error',
        StorageErrorCode.WRITE_FAILED,
        originalError,
      );

      expect(error.originalError).toBe(originalError);
      expect(error.cause).toBe(originalError);
    });

    it('should create error with context', () => {
      const context = { key: 'test-key', storeName: 'test-store' };
      const error = new StorageError(
        'Error with context',
        StorageErrorCode.DELETE_FAILED,
        undefined,
        context,
      );

      expect(error.context).toEqual(context);
    });

    it('should create error with all properties', () => {
      const originalError = new Error('Original');
      const context = { operation: 'get', key: 'mykey' };
      const error = new StorageError(
        'Full error',
        StorageErrorCode.QUOTA_EXCEEDED,
        originalError,
        context,
      );

      expect(error.message).toBe('Full error');
      expect(error.code).toBe(StorageErrorCode.QUOTA_EXCEEDED);
      expect(error.originalError).toBe(originalError);
      expect(error.context).toEqual(context);
    });
  });

  describe('toJSON', () => {
    it('should serialize error to JSON', () => {
      const originalError = new Error('Cause');
      const context = { key: 'test' };
      const error = new StorageError(
        'JSON test',
        StorageErrorCode.TRANSACTION_FAILED,
        originalError,
        context,
      );

      const json = error.toJSON();

      expect(json.name).toBe('StorageError');
      expect(json.message).toBe('JSON test');
      expect(json.code).toBe(StorageErrorCode.TRANSACTION_FAILED);
      expect(json.originalError).toBe('Cause');
      expect(json.context).toEqual(context);
      expect(json.stack).toBeDefined();
    });

    it('should handle undefined original error in JSON', () => {
      const error = new StorageError('No cause', StorageErrorCode.UNKNOWN);
      const json = error.toJSON();

      expect(json.originalError).toBeUndefined();
    });
  });
});

describe('StorageErrorCode', () => {
  it('should have all expected error codes', () => {
    expect(StorageErrorCode.NOT_AVAILABLE).toBe('NOT_AVAILABLE');
    expect(StorageErrorCode.OPEN_FAILED).toBe('OPEN_FAILED');
    expect(StorageErrorCode.READ_FAILED).toBe('READ_FAILED');
    expect(StorageErrorCode.WRITE_FAILED).toBe('WRITE_FAILED');
    expect(StorageErrorCode.DELETE_FAILED).toBe('DELETE_FAILED');
    expect(StorageErrorCode.QUOTA_EXCEEDED).toBe('QUOTA_EXCEEDED');
    expect(StorageErrorCode.VERSION_MISMATCH).toBe('VERSION_MISMATCH');
    expect(StorageErrorCode.TRANSACTION_FAILED).toBe('TRANSACTION_FAILED');
    expect(StorageErrorCode.NOT_FOUND).toBe('NOT_FOUND');
    expect(StorageErrorCode.PERMISSION_DENIED).toBe('PERMISSION_DENIED');
    expect(StorageErrorCode.BLOCKED).toBe('BLOCKED');
    expect(StorageErrorCode.UNKNOWN).toBe('UNKNOWN');
  });
});
