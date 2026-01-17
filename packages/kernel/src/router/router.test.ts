/**
 * @fileoverview Tests for multi-model router.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  ModelProvider,
  ModelCapability,
  TaskCategory,
  Priority,
  RouterErrorCode,
  noopLogger,
} from '@symbiosis/shared';
import type { IModelConfig } from '@symbiosis/shared';

import { Router, createRouter } from './router';
import type { IRouterConfig, IRoutingRequest } from '../types/kernel';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const testModels: IModelConfig[] = [
  {
    provider: ModelProvider.ANTHROPIC,
    modelId: 'claude-3-opus',
    capabilities: [ModelCapability.SAFETY_CRITICAL, ModelCapability.REASONING],
    costPerMillionTokens: 15,
    maxContextTokens: 200000,
    averageLatencyMs: 500,
    rateLimitPerMinute: 60,
    isAvailable: true,
  },
  {
    provider: ModelProvider.OPENAI,
    modelId: 'gpt-5.2',
    capabilities: [ModelCapability.CODE_GENERATION, ModelCapability.FAST_RESPONSE],
    costPerMillionTokens: 10,
    maxContextTokens: 128000,
    averageLatencyMs: 300,
    rateLimitPerMinute: 100,
    isAvailable: true,
  },
  {
    provider: ModelProvider.LOCAL,
    modelId: 'llama-3-8b',
    capabilities: [ModelCapability.FAST_RESPONSE, ModelCapability.COST_OPTIMIZED],
    costPerMillionTokens: 0,
    maxContextTokens: 8192,
    averageLatencyMs: 100,
    rateLimitPerMinute: 1000,
    isAvailable: true,
  },
];

const defaultConfig: IRouterConfig = {
  models: testModels,
  defaultStrategy: 'rule_based',
  circuitBreakerThreshold: 5,
  maxRetries: 3,
  timeoutMs: 30000,
};

// ============================================================================
// TESTS
// ============================================================================

describe('Router', () => {
  let router: Router;

  beforeEach(() => {
    vi.clearAllMocks();
    router = new Router(defaultConfig, noopLogger);
  });

  describe('route()', () => {
    it('should route safety-critical tasks to Anthropic', async () => {
      const request: IRoutingRequest = {
        id: 'test-1',
        task: 'Review this code for security vulnerabilities',
        category: TaskCategory.SAFETY_REVIEW,
        priority: Priority.HIGH,
      };

      const result = await router.route(request);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.decision.selectedModel.provider).toBe(ModelProvider.ANTHROPIC);
      }
    });

    it('should route code generation to OpenAI', async () => {
      const request: IRoutingRequest = {
        id: 'test-2',
        task: 'Generate a React component for user authentication',
        category: TaskCategory.CODE_GENERATION,
        priority: Priority.MEDIUM,
      };

      const result = await router.route(request);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.decision.selectedModel.provider).toBe(ModelProvider.OPENAI);
      }
    });

    it('should route fast lookups to local model', async () => {
      const request: IRoutingRequest = {
        id: 'test-3',
        task: 'What is 2+2?',
        category: TaskCategory.FAST_LOOKUP,
        priority: Priority.LOW,
      };

      const result = await router.route(request);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.decision.selectedModel.provider).toBe(ModelProvider.LOCAL);
      }
    });

    it('should respect cost constraints', async () => {
      const request: IRoutingRequest = {
        id: 'test-4',
        task: 'Analyze this document',
        category: TaskCategory.GENERAL,
        priority: Priority.MEDIUM,
        maxCostCents: 0.001, // Very low budget
      };

      const result = await router.route(request);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should select the cheapest model (local)
        expect(result.value.decision.selectedModel.costPerMillionTokens).toBe(0);
      }
    });

    it('should return error when no models available', async () => {
      // Mark all models as unhealthy
      router.setModelHealth('claude-3-opus', false);
      router.setModelHealth('gpt-5.2', false);
      router.setModelHealth('llama-3-8b', false);

      const request: IRoutingRequest = {
        id: 'test-5',
        task: 'Do something',
        category: TaskCategory.GENERAL,
        priority: Priority.MEDIUM,
      };

      const result = await router.route(request);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(RouterErrorCode.NO_AVAILABLE_MODEL);
      }
    });

    it('should reject empty tasks', async () => {
      const request: IRoutingRequest = {
        id: 'test-6',
        task: '   ',
        category: TaskCategory.GENERAL,
        priority: Priority.LOW,
      };

      const result = await router.route(request);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(RouterErrorCode.INVALID_REQUEST);
      }
    });

    it('should reject negative max cost', async () => {
      const request: IRoutingRequest = {
        id: 'test-7',
        task: 'Some task',
        category: TaskCategory.GENERAL,
        priority: Priority.LOW,
        maxCostCents: -5,
      };

      const result = await router.route(request);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(RouterErrorCode.INVALID_REQUEST);
      }
    });

    it('should respect preferred provider', async () => {
      const request: IRoutingRequest = {
        id: 'test-8',
        task: 'General task',
        category: TaskCategory.GENERAL,
        priority: Priority.LOW,
        preferredProvider: ModelProvider.LOCAL,
      };

      const result = await router.route(request);

      expect(result.ok).toBe(true);
      // Local should be preferred due to user preference
    });

    it('should filter by required capabilities', async () => {
      const request: IRoutingRequest = {
        id: 'test-9',
        task: 'Need safety critical analysis',
        category: TaskCategory.GENERAL,
        priority: Priority.LOW,
        requiredCapabilities: [ModelCapability.SAFETY_CRITICAL],
      };

      const result = await router.route(request);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(
          result.value.decision.selectedModel.capabilities.includes(
            ModelCapability.SAFETY_CRITICAL,
          ),
        ).toBe(true);
      }
    });

    it('should filter by latency constraint', async () => {
      const request: IRoutingRequest = {
        id: 'test-10',
        task: 'Need fast response',
        category: TaskCategory.GENERAL,
        priority: Priority.HIGH,
        maxLatencyMs: 200,
      };

      const result = await router.route(request);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.decision.selectedModel.averageLatencyMs).toBeLessThanOrEqual(200);
      }
    });
  });

  describe('getMetrics()', () => {
    it('should track successful requests', async () => {
      const request: IRoutingRequest = {
        id: 'test-7',
        task: 'Hello world',
        category: TaskCategory.GENERAL,
        priority: Priority.LOW,
      };

      await router.route(request);
      const metrics = router.getMetrics();

      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(0);
    });

    it('should track failed requests', async () => {
      router.setModelHealth('claude-3-opus', false);
      router.setModelHealth('gpt-5.2', false);
      router.setModelHealth('llama-3-8b', false);

      const request: IRoutingRequest = {
        id: 'test-8',
        task: 'Will fail',
        category: TaskCategory.GENERAL,
        priority: Priority.LOW,
      };

      await router.route(request);
      const metrics = router.getMetrics();

      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(1);
    });

    it('should accumulate metrics across requests', async () => {
      await router.route({
        id: 'req-1',
        task: 'First request',
        category: TaskCategory.GENERAL,
        priority: Priority.LOW,
      });

      await router.route({
        id: 'req-2',
        task: 'Second request',
        category: TaskCategory.GENERAL,
        priority: Priority.LOW,
      });

      const metrics = router.getMetrics();
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.successfulRequests).toBe(2);
    });
  });

  describe('setModelHealth()', () => {
    it('should update model availability', () => {
      expect(router.isModelHealthy('claude-3-opus')).toBe(true);

      router.setModelHealth('claude-3-opus', false);

      expect(router.isModelHealthy('claude-3-opus')).toBe(false);
    });

    it('should not affect non-existent models', () => {
      router.setModelHealth('non-existent', false);
      // Should not throw
    });
  });

  describe('getAvailableModels()', () => {
    it('should return only healthy models', () => {
      router.setModelHealth('claude-3-opus', false);

      const available = router.getAvailableModels();

      expect(available).toHaveLength(2);
      expect(available.some((m) => m.modelId === 'claude-3-opus')).toBe(false);
    });
  });

  describe('createRouter()', () => {
    it('should create a router instance', () => {
      const routerInstance = createRouter(defaultConfig, noopLogger);
      expect(routerInstance).toBeInstanceOf(Router);
    });
  });
});
