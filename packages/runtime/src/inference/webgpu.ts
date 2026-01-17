/**
 * @fileoverview WebGPU-based local inference adapter
 * @module @symbiosis/runtime/inference/webgpu
 */

import type { Result } from '@symbiosis/shared';
import { ok, err } from '@symbiosis/shared';

import type { IInferenceAdapter } from '../types/index';
import type { IWebGPUConfig } from './types';
import { DEFAULT_WEBGPU_CONFIG } from './types';

/**
 * Inference error
 */
export class InferenceError extends Error {
  constructor(
    message: string,
    public readonly code: InferenceErrorCode,
  ) {
    super(message);
    this.name = 'InferenceError';
  }
}

/**
 * Inference error codes
 */
export enum InferenceErrorCode {
  NOT_AVAILABLE = 'NOT_AVAILABLE',
  LOAD_FAILED = 'LOAD_FAILED',
  INFERENCE_FAILED = 'INFERENCE_FAILED',
  MODEL_NOT_LOADED = 'MODEL_NOT_LOADED',
}

/**
 * WebGPU inference adapter for local model execution
 */
export class WebGPUInference implements IInferenceAdapter {
  private readonly config: IWebGPUConfig;
  private isModelLoaded: boolean;
  private modelPath: string | null;

  constructor(config: IWebGPUConfig = DEFAULT_WEBGPU_CONFIG) {
    this.config = config;
    this.isModelLoaded = false;
    this.modelPath = null;
  }

  /**
   * Check if WebGPU is available
   * @returns True if available
   */
  public async isAvailable(): Promise<boolean> {
    if (typeof navigator === 'undefined') {
      return false;
    }

    try {
      const gpu = (navigator as Navigator & { gpu?: unknown }).gpu;
      if (gpu === undefined) {
        return false;
      }
      // WebGPU is available
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load a model
   * @param modelPath - Path to the model
   */
  public async load(modelPath: string): Promise<void> {
    const available = await this.isAvailable();
    if (!available) {
      throw new InferenceError('WebGPU not available', InferenceErrorCode.NOT_AVAILABLE);
    }

    // In production, this would load the actual model
    // For now, we simulate loading
    await new Promise((resolve) => setTimeout(resolve, 100));

    this.modelPath = modelPath;
    this.isModelLoaded = true;
  }

  /**
   * Run inference
   * @param input - Input text
   * @returns Generated output
   */
  public async infer(input: string): Promise<string> {
    if (!this.isModelLoaded) {
      throw new InferenceError('Model not loaded', InferenceErrorCode.MODEL_NOT_LOADED);
    }

    // In production, this would run actual inference
    // For now, we simulate
    await new Promise((resolve) => setTimeout(resolve, 50));

    return `[Local inference result for: ${input.substring(0, 50)}...]`;
  }

  /**
   * Unload the model
   */
  public async unload(): Promise<void> {
    this.isModelLoaded = false;
    this.modelPath = null;
  }

  /**
   * Get current configuration
   * @returns Current config
   */
  public getConfig(): IWebGPUConfig {
    return this.config;
  }

  /**
   * Check if model is loaded
   * @returns True if loaded
   */
  public isLoaded(): boolean {
    return this.isModelLoaded;
  }
}

/**
 * Check WebGPU availability
 * @returns Result indicating availability
 */
export async function checkWebGPUAvailability(): Promise<Result<boolean, InferenceError>> {
  const inference = new WebGPUInference();
  const available = await inference.isAvailable();
  return ok(available);
}

/**
 * Create a WebGPU inference adapter
 * @param config - Optional configuration
 * @returns Configured inference adapter
 */
export function createWebGPUInference(config?: Partial<IWebGPUConfig>): WebGPUInference {
  return new WebGPUInference({ ...DEFAULT_WEBGPU_CONFIG, ...config });
}
