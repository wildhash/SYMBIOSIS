/**
 * @fileoverview Multi-model router that dispatches tasks to optimal LLM
 * based on capability, cost, safety requirements, and availability.
 *
 * @example
 * const router = new Router(config, logger);
 * const result = await router.route({
 *   id: 'req-1',
 *   task: 'Generate code for React component',
 *   category: TaskCategory.CODE_GENERATION,
 *   priority: Priority.HIGH,
 * });
 *
 * @module @symbiosis/kernel/router/router
 */

import { Subject, BehaviorSubject } from 'rxjs';
import { filter } from 'rxjs/operators';
import type { Observable } from 'rxjs';

import type { ILogger, IModelConfig, IModelResponse, ITokenUsage, Result } from '@symbiosis/shared';
import {
  ModelProvider,
  ModelCapability,
  TaskCategory,
  Priority,
  ApprovalLevel,
  RouterError,
  RouterErrorCode,
  ok,
  err,
} from '@symbiosis/shared';

import type {
  IRouterConfig,
  IRoutingRequest,
  IRoutingDecision,
  IRoutingResult,
  IRouterMetrics,
} from '../types/kernel';

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Multi-model router for SymbiOS kernel
 */
export class Router {
  private readonly models: Map<string, IModelConfig>;
  private readonly modelHealth: Map<string, BehaviorSubject<boolean>>;
  private readonly requestStream: Subject<IRoutingRequest>;
  private readonly metricsSubject: BehaviorSubject<IRouterMetrics>;
  private readonly logger: ILogger;
  private readonly config: IRouterConfig;

  constructor(config: IRouterConfig, logger: ILogger) {
    this.config = config;
    this.logger = logger;
    this.models = new Map(config.models.map((m) => [m.modelId, m]));
    this.modelHealth = new Map(
      config.models.map((m) => [m.modelId, new BehaviorSubject<boolean>(m.isAvailable)]),
    );
    this.requestStream = new Subject<IRoutingRequest>();
    this.metricsSubject = new BehaviorSubject<IRouterMetrics>({
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatencyMs: 0,
      totalCostCents: 0,
      modelUsage: new Map(),
    });
  }

  /**
   * Route a task to the optimal model and execute it.
   * @param request - The routing request
   * @returns Result containing the routing result or an error
   */
  public async route(request: IRoutingRequest): Promise<Result<IRoutingResult, RouterError>> {
    const validationResult = this.validateRequest(request);
    if (!validationResult.ok) {
      return validationResult;
    }

    this.requestStream.next(request);

    const decision = this.makeRoutingDecision(request);
    if (!decision.ok) {
      this.updateMetrics(decision);
      return decision;
    }

    const executionResult = await this.executeWithFallback(request, decision.value);
    this.updateMetrics(executionResult);

    return executionResult;
  }

  /**
   * Get observable stream of routing requests for monitoring.
   * @returns Observable of routing requests
   */
  public getRequestStream(): Observable<IRoutingRequest> {
    return this.requestStream.pipe(
      filter((request): request is IRoutingRequest => request !== null),
    );
  }

  /**
   * Get current router metrics.
   * @returns Current metrics
   */
  public getMetrics(): IRouterMetrics {
    return this.metricsSubject.getValue();
  }

  /**
   * Get observable of metrics changes.
   * @returns Observable of metrics
   */
  public getMetricsStream(): Observable<IRouterMetrics> {
    return this.metricsSubject.asObservable();
  }

  /**
   * Update model availability (e.g., from health checks).
   * @param modelId - The model ID
   * @param isHealthy - Whether the model is healthy
   */
  public setModelHealth(modelId: string, isHealthy: boolean): void {
    const healthSubject = this.modelHealth.get(modelId);
    if (healthSubject !== undefined) {
      healthSubject.next(isHealthy);
      this.logger.info(`Model ${modelId} health updated: ${String(isHealthy)}`);
    }
  }

  /**
   * Get model health status
   * @param modelId - The model ID
   * @returns Whether the model is healthy
   */
  public isModelHealthy(modelId: string): boolean {
    const healthSubject = this.modelHealth.get(modelId);
    return healthSubject?.getValue() ?? false;
  }

  /**
   * Get all available models
   * @returns Array of available model configs
   */
  public getAvailableModels(): readonly IModelConfig[] {
    return Array.from(this.models.values()).filter((model) => {
      const healthSubject = this.modelHealth.get(model.modelId);
      return healthSubject?.getValue() ?? false;
    });
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private validateRequest(request: IRoutingRequest): Result<void, RouterError> {
    if (request.task.trim() === '') {
      return err(
        new RouterError('Task cannot be empty', RouterErrorCode.INVALID_REQUEST, request.id),
      );
    }

    if (request.maxCostCents !== undefined && request.maxCostCents <= 0) {
      return err(
        new RouterError('Max cost must be positive', RouterErrorCode.INVALID_REQUEST, request.id),
      );
    }

    return ok(undefined);
  }

  private makeRoutingDecision(
    request: IRoutingRequest,
  ): Result<IRoutingDecision, RouterError> {
    const availableModels = this.getFilteredModels(request);

    if (availableModels.length === 0) {
      return err(
        new RouterError(
          'No models available for this request',
          RouterErrorCode.NO_AVAILABLE_MODEL,
          request.id,
        ),
      );
    }

    const rankedModels = this.rankModels(availableModels, request);
    const selectedModel = rankedModels[0];

    if (selectedModel === undefined) {
      return err(
        new RouterError('Failed to select model', RouterErrorCode.NO_AVAILABLE_MODEL, request.id),
      );
    }

    const approvalLevel = this.determineApprovalLevel(request, selectedModel);

    const decision: IRoutingDecision = {
      requestId: request.id,
      selectedModel,
      reasoning: this.generateReasoning(request, selectedModel),
      estimatedCostCents: this.estimateCost(request, selectedModel),
      estimatedLatencyMs: selectedModel.averageLatencyMs,
      approvalLevel,
      fallbackChain: rankedModels.slice(1),
      timestamp: new Date(),
    };

    return ok(decision);
  }

  private getFilteredModels(request: IRoutingRequest): IModelConfig[] {
    return Array.from(this.models.values()).filter((model) => {
      // Check health
      const healthSubject = this.modelHealth.get(model.modelId);
      if (healthSubject === undefined || !healthSubject.getValue()) {
        return false;
      }

      // Check required capabilities
      if (request.requiredCapabilities !== undefined) {
        const hasAllCapabilities = request.requiredCapabilities.every((cap) =>
          model.capabilities.includes(cap),
        );
        if (!hasAllCapabilities) {
          return false;
        }
      }

      // Check cost constraint
      if (request.maxCostCents !== undefined) {
        const estimatedCost = this.estimateCost(request, model);
        if (estimatedCost > request.maxCostCents) {
          return false;
        }
      }

      // Check latency constraint
      if (request.maxLatencyMs !== undefined && model.averageLatencyMs > request.maxLatencyMs) {
        return false;
      }

      return true;
    });
  }

  private rankModels(models: IModelConfig[], request: IRoutingRequest): IModelConfig[] {
    // Rule-based routing: category → optimal provider mapping
    const categoryModelMap: Record<TaskCategory, ModelProvider[]> = {
      [TaskCategory.SAFETY_REVIEW]: [ModelProvider.ANTHROPIC],
      [TaskCategory.CODE_GENERATION]: [ModelProvider.OPENAI, ModelProvider.ANTHROPIC],
      [TaskCategory.CODE_REVIEW]: [ModelProvider.ANTHROPIC, ModelProvider.OPENAI],
      [TaskCategory.ARCHITECTURE]: [ModelProvider.ANTHROPIC, ModelProvider.OPENAI],
      [TaskCategory.GENERAL]: [
        ModelProvider.OPENAI,
        ModelProvider.ANTHROPIC,
        ModelProvider.GOOGLE,
      ],
      [TaskCategory.FAST_LOOKUP]: [ModelProvider.LOCAL, ModelProvider.GOOGLE],
    };

    const preferredProviders = categoryModelMap[request.category];

    return [...models].sort((a, b) => {
      // Priority 1: Preferred provider for category
      const aProviderRank = preferredProviders.indexOf(a.provider);
      const bProviderRank = preferredProviders.indexOf(b.provider);
      const aRank = aProviderRank === -1 ? 999 : aProviderRank;
      const bRank = bProviderRank === -1 ? 999 : bProviderRank;

      if (aRank !== bRank) {
        return aRank - bRank;
      }

      // Priority 2: User preference
      if (request.preferredProvider !== undefined) {
        if (a.provider === request.preferredProvider) {
          return -1;
        }
        if (b.provider === request.preferredProvider) {
          return 1;
        }
      }

      // Priority 3: Cost (lower is better)
      return a.costPerMillionTokens - b.costPerMillionTokens;
    });
  }

  private determineApprovalLevel(
    request: IRoutingRequest,
    _model: IModelConfig,
  ): ApprovalLevel {
    // Safety-critical tasks always require approval
    if (request.category === TaskCategory.SAFETY_REVIEW) {
      return ApprovalLevel.APPROVE;
    }

    // High priority tasks notify
    if (request.priority === Priority.CRITICAL) {
      return ApprovalLevel.NOTIFY;
    }

    // Code execution requires approval
    if (
      request.requiredCapabilities?.includes(ModelCapability.CODE_GENERATION) === true &&
      request.context?.agentId === 'executor'
    ) {
      return ApprovalLevel.APPROVE;
    }

    return ApprovalLevel.AUTO;
  }

  private estimateCost(request: IRoutingRequest, model: IModelConfig): number {
    // Rough estimation: task length * 4 (avg chars per token) for input
    // Plus estimated 500 tokens for output
    const estimatedInputTokens = Math.ceil(request.task.length / 4);
    const estimatedOutputTokens = 500;
    const totalTokens = estimatedInputTokens + estimatedOutputTokens;

    return (totalTokens / 1_000_000) * model.costPerMillionTokens * 100; // Convert to cents
  }

  private generateReasoning(request: IRoutingRequest, model: IModelConfig): string {
    const reasons: string[] = [];

    reasons.push(`Task category "${request.category}" maps to ${model.provider}`);

    if (request.requiredCapabilities !== undefined && request.requiredCapabilities.length > 0) {
      reasons.push(`Model has required capabilities: ${request.requiredCapabilities.join(', ')}`);
    }

    if (request.preferredProvider === model.provider) {
      reasons.push('Matches user preference');
    }

    return reasons.join('; ');
  }

  private async executeWithFallback(
    request: IRoutingRequest,
    decision: IRoutingDecision,
  ): Promise<Result<IRoutingResult, RouterError>> {
    const startTime = Date.now();
    let retryCount = 0;
    let lastError: RouterError | null = null;

    const modelsToTry = [decision.selectedModel, ...decision.fallbackChain];

    for (const model of modelsToTry) {
      try {
        const response = await this.callModel(model, request);

        return ok({
          decision,
          response,
          actualCostCents: this.calculateActualCost(response.tokensUsed, model),
          actualLatencyMs: Date.now() - startTime,
          retryCount,
        });
      } catch (error) {
        retryCount++;
        lastError = new RouterError(
          `Model ${model.modelId} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          RouterErrorCode.ALL_MODELS_FAILED,
          request.id,
        );
        this.logger.warn(`Retry ${String(retryCount)}: ${lastError.message}`);
      }
    }

    return err(
      lastError ??
        new RouterError('All models failed', RouterErrorCode.ALL_MODELS_FAILED, request.id),
    );
  }

  private async callModel(
    model: IModelConfig,
    request: IRoutingRequest,
  ): Promise<IModelResponse> {
    // This is where actual API calls would happen
    // For now, we'll simulate with a placeholder
    this.logger.info(`Calling model ${model.modelId} for request ${request.id}`);

    // Simulate API call latency
    await new Promise((resolve) => setTimeout(resolve, 100));

    // TODO: Implement actual API calls to Claude, GPT-5.2, etc.
    return {
      content: `[${model.modelId}] Response to: ${request.task.substring(0, 50)}...`,
      tokensUsed: {
        prompt: Math.ceil(request.task.length / 4),
        completion: 100,
        total: Math.ceil(request.task.length / 4) + 100,
      },
      finishReason: 'stop',
      modelId: model.modelId,
    };
  }

  private calculateActualCost(usage: ITokenUsage, model: IModelConfig): number {
    return (usage.total / 1_000_000) * model.costPerMillionTokens * 100;
  }

  private updateMetrics(result: Result<IRoutingResult, RouterError>): void {
    const current = this.metricsSubject.getValue();

    let updated: IRouterMetrics;

    if (result.ok) {
      const newModelUsage = new Map(current.modelUsage);
      const modelId = result.value.decision.selectedModel.modelId;
      newModelUsage.set(modelId, (newModelUsage.get(modelId) ?? 0) + 1);

      updated = {
        totalRequests: current.totalRequests + 1,
        successfulRequests: current.successfulRequests + 1,
        failedRequests: current.failedRequests,
        averageLatencyMs:
          (current.averageLatencyMs * current.totalRequests + result.value.actualLatencyMs) /
          (current.totalRequests + 1),
        totalCostCents: current.totalCostCents + result.value.actualCostCents,
        modelUsage: newModelUsage,
      };
    } else {
      updated = {
        totalRequests: current.totalRequests + 1,
        successfulRequests: current.successfulRequests,
        failedRequests: current.failedRequests + 1,
        averageLatencyMs: current.averageLatencyMs,
        totalCostCents: current.totalCostCents,
        modelUsage: current.modelUsage,
      };
    }

    this.metricsSubject.next(updated);
  }
}

/**
 * Create a router instance
 * @param config - Router configuration
 * @param logger - Logger instance
 * @returns Configured router
 */
export function createRouter(config: IRouterConfig, logger: ILogger): Router {
  return new Router(config, logger);
}
