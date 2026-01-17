/**
 * @fileoverview Tests for IndexedDB storage adapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { IndexedDBStorage, StorageErrorCode, createIndexedDBStorage } from './indexeddb';

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
