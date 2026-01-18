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
 * Storage error codes
 */
export enum StorageErrorCode {
  NOT_AVAILABLE = 'NOT_AVAILABLE',
  OPEN_FAILED = 'OPEN_FAILED',
  READ_FAILED = 'READ_FAILED',
  WRITE_FAILED = 'WRITE_FAILED',
  DELETE_FAILED = 'DELETE_FAILED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  VERSION_MISMATCH = 'VERSION_MISMATCH',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  NOT_FOUND = 'NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  BLOCKED = 'BLOCKED',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Storage error with enhanced context
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: StorageErrorCode,
    public readonly cause?: Error,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'StorageError';

    // Capture stack trace
    if (Error.captureStackTrace !== undefined) {
      Error.captureStackTrace(this, StorageError);
    }
  }

  /**
   * Convert error to JSON for logging
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      cause: this.cause?.message,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Extract meaningful error info from DOMException
 * @param error - The DOMException from IndexedDB
 * @returns Mapped error message and code
 */
function extractIndexedDBError(error: DOMException | null): {
  message: string;
  code: StorageErrorCode;
} {
  if (error === null) {
    return {
      message: 'Unknown IndexedDB error',
      code: StorageErrorCode.UNKNOWN,
    };
  }

  // Map DOMException names to our error codes
  const errorMap: Record<string, { message: string; code: StorageErrorCode }> = {
    QuotaExceededError: {
      message: 'Storage quota exceeded - try clearing some data',
      code: StorageErrorCode.QUOTA_EXCEEDED,
    },
    VersionError: {
      message: 'Database version mismatch - may need to clear and reload',
      code: StorageErrorCode.VERSION_MISMATCH,
    },
    NotFoundError: {
      message: 'Database or object store not found',
      code: StorageErrorCode.NOT_FOUND,
    },
    InvalidStateError: {
      message: 'Database is in invalid state - transaction may have been aborted',
      code: StorageErrorCode.TRANSACTION_FAILED,
    },
    TransactionInactiveError: {
      message: 'Transaction is no longer active',
      code: StorageErrorCode.TRANSACTION_FAILED,
    },
    AbortError: {
      message: 'Transaction was aborted',
      code: StorageErrorCode.TRANSACTION_FAILED,
    },
    NotAllowedError: {
      message: 'Permission denied - user may have blocked storage',
      code: StorageErrorCode.PERMISSION_DENIED,
    },
  };

  const mapped = errorMap[error.name];
  if (mapped !== undefined) {
    return mapped;
  }

  return {
    message: `IndexedDB error: ${error.name} - ${error.message}`,
    code: StorageErrorCode.UNKNOWN,
  };
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
      return err(
        new StorageError('IndexedDB not available', StorageErrorCode.NOT_AVAILABLE, undefined, {
          databaseName: this.config.databaseName,
        }),
      );
    }

    return new Promise((resolve) => {
      const request = indexedDB.open(this.config.databaseName, this.config.version);

      request.onerror = (): void => {
        const errorInfo = extractIndexedDBError(request.error);
        resolve(
          err(
            new StorageError(
              `Failed to open database "${this.config.databaseName}": ${errorInfo.message}`,
              errorInfo.code,
              request.error ?? undefined,
              { databaseName: this.config.databaseName, version: this.config.version },
            ),
          ),
        );
      };

      request.onblocked = (): void => {
        resolve(
          err(
            new StorageError(
              `Database "${this.config.databaseName}" is blocked - close other tabs using this database`,
              StorageErrorCode.BLOCKED,
              undefined,
              { databaseName: this.config.databaseName, version: this.config.version },
            ),
          ),
        );
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
      try {
        const transaction = this.db?.transaction(this.config.storeName, 'readonly');
        if (transaction === undefined) {
          resolve(undefined);
          return;
        }

        const store = transaction.objectStore(this.config.storeName);
        const request = store.get(key);

        request.onerror = (): void => {
          const errorInfo = extractIndexedDBError(request.error);
          reject(
            new StorageError(
              `Failed to read key "${key}": ${errorInfo.message}`,
              StorageErrorCode.READ_FAILED,
              request.error ?? undefined,
              { key, storeName: this.config.storeName },
            ),
          );
        };

        request.onsuccess = (): void => {
          resolve(request.result as T | undefined);
        };

        transaction.onerror = (): void => {
          const errorInfo = extractIndexedDBError(transaction.error);
          reject(
            new StorageError(
              `Transaction failed while reading key "${key}": ${errorInfo.message}`,
              StorageErrorCode.TRANSACTION_FAILED,
              transaction.error ?? undefined,
              { key, storeName: this.config.storeName },
            ),
          );
        };
      } catch (error) {
        reject(
          new StorageError(
            `Unexpected error reading key "${key}": ${error instanceof Error ? error.message : 'Unknown'}`,
            StorageErrorCode.READ_FAILED,
            error instanceof Error ? error : undefined,
            { key, storeName: this.config.storeName },
          ),
        );
      }
    });
  }

  /**
   * Set a value in storage
   * @param key - The key to set
   * @param value - The value to store
   */
  public async set<T>(key: string, value: T): Promise<void> {
    if (this.db === null) {
      throw new StorageError(
        'Database not initialized',
        StorageErrorCode.WRITE_FAILED,
        undefined,
        { key, storeName: this.config.storeName },
      );
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db?.transaction(this.config.storeName, 'readwrite');
        if (transaction === undefined) {
          reject(
            new StorageError(
              `Failed to create transaction for key "${key}"`,
              StorageErrorCode.TRANSACTION_FAILED,
              undefined,
              { key, storeName: this.config.storeName },
            ),
          );
          return;
        }

        const store = transaction.objectStore(this.config.storeName);
        const request = store.put(value, key);

        request.onerror = (): void => {
          const errorInfo = extractIndexedDBError(request.error);
          reject(
            new StorageError(
              `Failed to write key "${key}": ${errorInfo.message}`,
              errorInfo.code === StorageErrorCode.QUOTA_EXCEEDED
                ? StorageErrorCode.QUOTA_EXCEEDED
                : StorageErrorCode.WRITE_FAILED,
              request.error ?? undefined,
              { key, storeName: this.config.storeName },
            ),
          );
        };

        request.onsuccess = (): void => {
          resolve();
        };

        transaction.onerror = (): void => {
          const errorInfo = extractIndexedDBError(transaction.error);
          reject(
            new StorageError(
              `Transaction failed while writing key "${key}": ${errorInfo.message}`,
              StorageErrorCode.TRANSACTION_FAILED,
              transaction.error ?? undefined,
              { key, storeName: this.config.storeName },
            ),
          );
        };
      } catch (error) {
        reject(
          new StorageError(
            `Unexpected error writing key "${key}": ${error instanceof Error ? error.message : 'Unknown'}`,
            StorageErrorCode.WRITE_FAILED,
            error instanceof Error ? error : undefined,
            { key, storeName: this.config.storeName },
          ),
        );
      }
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
      try {
        const transaction = this.db?.transaction(this.config.storeName, 'readwrite');
        if (transaction === undefined) {
          resolve(false);
          return;
        }

        const store = transaction.objectStore(this.config.storeName);
        const request = store.delete(key);

        request.onerror = (): void => {
          const errorInfo = extractIndexedDBError(request.error);
          reject(
            new StorageError(
              `Failed to delete key "${key}": ${errorInfo.message}`,
              StorageErrorCode.DELETE_FAILED,
              request.error ?? undefined,
              { key, storeName: this.config.storeName },
            ),
          );
        };

        request.onsuccess = (): void => {
          resolve(true);
        };

        transaction.onerror = (): void => {
          const errorInfo = extractIndexedDBError(transaction.error);
          reject(
            new StorageError(
              `Transaction failed while deleting key "${key}": ${errorInfo.message}`,
              StorageErrorCode.TRANSACTION_FAILED,
              transaction.error ?? undefined,
              { key, storeName: this.config.storeName },
            ),
          );
        };
      } catch (error) {
        reject(
          new StorageError(
            `Unexpected error deleting key "${key}": ${error instanceof Error ? error.message : 'Unknown'}`,
            StorageErrorCode.DELETE_FAILED,
            error instanceof Error ? error : undefined,
            { key, storeName: this.config.storeName },
          ),
        );
      }
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
      try {
        const transaction = this.db?.transaction(this.config.storeName, 'readwrite');
        if (transaction === undefined) {
          resolve();
          return;
        }

        const store = transaction.objectStore(this.config.storeName);
        const request = store.clear();

        request.onerror = (): void => {
          const errorInfo = extractIndexedDBError(request.error);
          reject(
            new StorageError(
              `Failed to clear storage: ${errorInfo.message}`,
              StorageErrorCode.DELETE_FAILED,
              request.error ?? undefined,
              { storeName: this.config.storeName },
            ),
          );
        };

        request.onsuccess = (): void => {
          resolve();
        };

        transaction.onerror = (): void => {
          const errorInfo = extractIndexedDBError(transaction.error);
          reject(
            new StorageError(
              `Transaction failed while clearing storage: ${errorInfo.message}`,
              StorageErrorCode.TRANSACTION_FAILED,
              transaction.error ?? undefined,
              { storeName: this.config.storeName },
            ),
          );
        };
      } catch (error) {
        reject(
          new StorageError(
            `Unexpected error clearing storage: ${error instanceof Error ? error.message : 'Unknown'}`,
            StorageErrorCode.DELETE_FAILED,
            error instanceof Error ? error : undefined,
            { storeName: this.config.storeName },
          ),
        );
      }
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
      try {
        const transaction = this.db?.transaction(this.config.storeName, 'readonly');
        if (transaction === undefined) {
          resolve([]);
          return;
        }

        const store = transaction.objectStore(this.config.storeName);
        const request = store.getAllKeys();

        request.onerror = (): void => {
          const errorInfo = extractIndexedDBError(request.error);
          reject(
            new StorageError(
              `Failed to retrieve keys: ${errorInfo.message}`,
              StorageErrorCode.READ_FAILED,
              request.error ?? undefined,
              { storeName: this.config.storeName },
            ),
          );
        };

        request.onsuccess = (): void => {
          resolve(request.result.map(String));
        };

        transaction.onerror = (): void => {
          const errorInfo = extractIndexedDBError(transaction.error);
          reject(
            new StorageError(
              `Transaction failed while retrieving keys: ${errorInfo.message}`,
              StorageErrorCode.TRANSACTION_FAILED,
              transaction.error ?? undefined,
              { storeName: this.config.storeName },
            ),
          );
        };
      } catch (error) {
        reject(
          new StorageError(
            `Unexpected error retrieving keys: ${error instanceof Error ? error.message : 'Unknown'}`,
            StorageErrorCode.READ_FAILED,
            error instanceof Error ? error : undefined,
            { storeName: this.config.storeName },
          ),
        );
      }
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
