/**
 * @fileoverview IndexedDB storage adapter
 * @module @symbiosis/runtime/storage/indexeddb
 */

import type { Result } from '@symbiosis/shared';
import { ok, err } from '@symbiosis/shared';

import type { IStorageAdapter } from '../types/index';
import type { IIndexedDBConfig } from './types';
import { DEFAULT_INDEXEDDB_CONFIG } from './types';

/**
 * Storage error
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: StorageErrorCode,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Storage error codes
 */
export enum StorageErrorCode {
  NOT_AVAILABLE = 'NOT_AVAILABLE',
  OPEN_FAILED = 'OPEN_FAILED',
  READ_FAILED = 'READ_FAILED',
  WRITE_FAILED = 'WRITE_FAILED',
  DELETE_FAILED = 'DELETE_FAILED',
}

/**
 * IndexedDB storage adapter
 */
export class IndexedDBStorage implements IStorageAdapter {
  private readonly config: IIndexedDBConfig;
  private db: IDBDatabase | null;

  constructor(config: IIndexedDBConfig = DEFAULT_INDEXEDDB_CONFIG) {
    this.config = config;
    this.db = null;
  }

  /**
   * Initialize the storage
   * @returns Result indicating success
   */
  public async initialize(): Promise<Result<void, StorageError>> {
    if (typeof indexedDB === 'undefined') {
      return err(new StorageError('IndexedDB not available', StorageErrorCode.NOT_AVAILABLE));
    }

    return new Promise((resolve) => {
      const request = indexedDB.open(this.config.databaseName, this.config.version);

      request.onerror = (): void => {
        resolve(err(new StorageError('Failed to open database', StorageErrorCode.OPEN_FAILED)));
      };

      request.onsuccess = (): void => {
        this.db = request.result;
        resolve(ok(undefined));
      };

      request.onupgradeneeded = (event): void => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.config.storeName)) {
          db.createObjectStore(this.config.storeName);
        }
      };
    });
  }

  /**
   * Get a value from storage
   * @param key - The key to get
   * @returns The value if found
   */
  public async get<T>(key: string): Promise<T | undefined> {
    if (this.db === null) {
      return undefined;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db?.transaction(this.config.storeName, 'readonly');
      if (transaction === undefined) {
        resolve(undefined);
        return;
      }

      const store = transaction.objectStore(this.config.storeName);
      const request = store.get(key);

      request.onerror = (): void => {
        reject(new StorageError('Read failed', StorageErrorCode.READ_FAILED));
      };

      request.onsuccess = (): void => {
        resolve(request.result as T | undefined);
      };
    });
  }

  /**
   * Set a value in storage
   * @param key - The key to set
   * @param value - The value to store
   */
  public async set<T>(key: string, value: T): Promise<void> {
    if (this.db === null) {
      throw new StorageError('Database not initialized', StorageErrorCode.WRITE_FAILED);
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db?.transaction(this.config.storeName, 'readwrite');
      if (transaction === undefined) {
        reject(new StorageError('Transaction failed', StorageErrorCode.WRITE_FAILED));
        return;
      }

      const store = transaction.objectStore(this.config.storeName);
      const request = store.put(value, key);

      request.onerror = (): void => {
        reject(new StorageError('Write failed', StorageErrorCode.WRITE_FAILED));
      };

      request.onsuccess = (): void => {
        resolve();
      };
    });
  }

  /**
   * Delete a value from storage
   * @param key - The key to delete
   * @returns True if deleted
   */
  public async delete(key: string): Promise<boolean> {
    if (this.db === null) {
      return false;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db?.transaction(this.config.storeName, 'readwrite');
      if (transaction === undefined) {
        resolve(false);
        return;
      }

      const store = transaction.objectStore(this.config.storeName);
      const request = store.delete(key);

      request.onerror = (): void => {
        reject(new StorageError('Delete failed', StorageErrorCode.DELETE_FAILED));
      };

      request.onsuccess = (): void => {
        resolve(true);
      };
    });
  }

  /**
   * Clear all values from storage
   */
  public async clear(): Promise<void> {
    if (this.db === null) {
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db?.transaction(this.config.storeName, 'readwrite');
      if (transaction === undefined) {
        resolve();
        return;
      }

      const store = transaction.objectStore(this.config.storeName);
      const request = store.clear();

      request.onerror = (): void => {
        reject(new StorageError('Clear failed', StorageErrorCode.DELETE_FAILED));
      };

      request.onsuccess = (): void => {
        resolve();
      };
    });
  }

  /**
   * Get all keys in storage
   * @returns Array of keys
   */
  public async keys(): Promise<string[]> {
    if (this.db === null) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db?.transaction(this.config.storeName, 'readonly');
      if (transaction === undefined) {
        resolve([]);
        return;
      }

      const store = transaction.objectStore(this.config.storeName);
      const request = store.getAllKeys();

      request.onerror = (): void => {
        reject(new StorageError('Keys read failed', StorageErrorCode.READ_FAILED));
      };

      request.onsuccess = (): void => {
        resolve(request.result.map(String));
      };
    });
  }

  /**
   * Close the database connection
   */
  public close(): void {
    if (this.db !== null) {
      this.db.close();
      this.db = null;
    }
  }
}

/**
 * Create an IndexedDB storage instance
 * @param config - Optional configuration
 * @returns Configured storage adapter
 */
export function createIndexedDBStorage(config?: Partial<IIndexedDBConfig>): IndexedDBStorage {
  return new IndexedDBStorage({ ...DEFAULT_INDEXEDDB_CONFIG, ...config });
}
