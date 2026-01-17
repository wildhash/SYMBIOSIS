/**
 * @fileoverview Storage type definitions
 * @module @symbiosis/runtime/storage/types
 */

export type { IStorageAdapter } from '../types/index';

/**
 * IndexedDB configuration
 */
export interface IIndexedDBConfig {
  readonly databaseName: string;
  readonly storeName: string;
  readonly version: number;
}

/**
 * Default IndexedDB configuration
 */
export const DEFAULT_INDEXEDDB_CONFIG: IIndexedDBConfig = {
  databaseName: 'symbiosis',
  storeName: 'data',
  version: 1,
};
