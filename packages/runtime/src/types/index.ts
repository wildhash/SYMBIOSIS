/**
 * @fileoverview Runtime type exports
 * @module @symbiosis/runtime/types
 */

/**
 * Storage adapter interface
 */
export interface IStorageAdapter {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

/**
 * File system adapter interface
 */
export interface IFileSystemAdapter {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  readDir(path: string): Promise<string[]>;
}

/**
 * Inference adapter interface for local models
 */
export interface IInferenceAdapter {
  isAvailable(): Promise<boolean>;
  load(modelPath: string): Promise<void>;
  infer(input: string): Promise<string>;
  unload(): Promise<void>;
}

/**
 * Runtime environment info
 */
export interface IRuntimeEnvironment {
  readonly isOnline: boolean;
  readonly hasWebGPU: boolean;
  readonly hasIndexedDB: boolean;
  readonly hasOPFS: boolean;
  readonly userAgent: string;
}
