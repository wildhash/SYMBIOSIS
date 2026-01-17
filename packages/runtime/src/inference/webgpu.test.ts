/**
 * @fileoverview Tests for WebGPU inference adapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  WebGPUInference,
  checkWebGPUAvailability,
  createWebGPUInference,
} from './webgpu';

describe('WebGPUInference', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const inference = new WebGPUInference();
      expect(inference).toBeInstanceOf(WebGPUInference);
    });

    it('should create instance with custom config', () => {
      const inference = new WebGPUInference({
        maxTokens: 512,
        temperature: 0.5,
        topP: 0.95,
      });
      expect(inference).toBeInstanceOf(WebGPUInference);
    });
  });

  describe('isAvailable', () => {
    it('should return false when navigator is undefined', async () => {
      const originalNavigator = globalThis.navigator;
      // @ts-expect-error - testing undefined navigator
      globalThis.navigator = undefined;

      const inference = new WebGPUInference();
      const available = await inference.isAvailable();

      expect(available).toBe(false);

      globalThis.navigator = originalNavigator;
    });

    it('should return false when WebGPU not in navigator', async () => {
      const originalNavigator = globalThis.navigator;
      // @ts-expect-error - mocking navigator
      globalThis.navigator = {};

      const inference = new WebGPUInference();
      const available = await inference.isAvailable();

      expect(available).toBe(false);

      globalThis.navigator = originalNavigator;
    });
  });

  describe('load', () => {
    it('should throw when WebGPU not available', async () => {
      const originalNavigator = globalThis.navigator;
      // @ts-expect-error - mocking navigator
      globalThis.navigator = {};

      const inference = new WebGPUInference();

      await expect(inference.load('model.bin')).rejects.toThrow('WebGPU not available');

      globalThis.navigator = originalNavigator;
    });
  });

  describe('infer', () => {
    it('should throw when model not loaded', async () => {
      const inference = new WebGPUInference();

      await expect(inference.infer('test input')).rejects.toThrow('Model not loaded');
    });
  });

  describe('unload', () => {
    it('should reset loaded state', async () => {
      const inference = new WebGPUInference();

      await inference.unload();

      expect(inference.isLoaded()).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('should return current config', () => {
      const inference = new WebGPUInference({ maxTokens: 256 });
      const config = inference.getConfig();

      expect(config.maxTokens).toBe(256);
    });
  });

  describe('isLoaded', () => {
    it('should return false initially', () => {
      const inference = new WebGPUInference();
      expect(inference.isLoaded()).toBe(false);
    });
  });

  describe('getModelPath', () => {
    it('should return null when not loaded', () => {
      const inference = new WebGPUInference();
      expect(inference.getModelPath()).toBeNull();
    });
  });

  describe('checkWebGPUAvailability', () => {
    it('should return result', async () => {
      const result = await checkWebGPUAvailability();
      expect(result.ok).toBe(true);
    });
  });

  describe('createWebGPUInference', () => {
    it('should create an inference instance', () => {
      const inference = createWebGPUInference();
      expect(inference).toBeInstanceOf(WebGPUInference);
    });
  });
});
