/**
 * @fileoverview Inference type definitions
 * @module @symbiosis/runtime/inference/types
 */

export type { IInferenceAdapter } from '../types/index';

/**
 * WebGPU inference configuration
 */
export interface IWebGPUConfig {
  readonly maxTokens: number;
  readonly temperature: number;
  readonly topP: number;
}

/**
 * Default WebGPU configuration
 */
export const DEFAULT_WEBGPU_CONFIG: IWebGPUConfig = {
  maxTokens: 1024,
  temperature: 0.7,
  topP: 0.9,
};
