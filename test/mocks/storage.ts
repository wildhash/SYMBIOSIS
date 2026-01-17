/**
 * @fileoverview Storage mock for testing
 */

import type { IStorageAdapter } from '@symbiosis/runtime';

/**
 * In-memory storage adapter for testing
 */
export class MockStorage implements IStorageAdapter {
  private data: Map<string, unknown>;

  constructor() {
    this.data = new Map();
  }

  public async get<T>(key: string): Promise<T | undefined> {
    return this.data.get(key) as T | undefined;
  }

  public async set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }

  public async delete(key: string): Promise<boolean> {
    return this.data.delete(key);
  }

  public async clear(): Promise<void> {
    this.data.clear();
  }

  public async keys(): Promise<string[]> {
    return Array.from(this.data.keys());
  }
}
