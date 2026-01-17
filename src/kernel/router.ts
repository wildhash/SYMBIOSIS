import { LLMProvider, TaskRequirements, LLMConfig } from './types';
import { LLM_CONFIGS } from './llm-config';

/**
 * Distributed LLM Kernel Router
 * Routes tasks to the most appropriate LLM based on capability, cost, and safety
 */
export class KernelRouter {
  private providers: Map<LLMProvider, LLMConfig> = new Map();
  private offlineMode: boolean = false;

  constructor() {
    // Initialize all providers
    Object.entries(LLM_CONFIGS).forEach(([provider, config]) => {
      this.providers.set(provider as LLMProvider, config);
    });

    // Detect offline mode
    this.detectOfflineMode();
  }

  /**
   * Route a task to the best LLM provider
   */
  routeTask(requirements: TaskRequirements): LLMProvider {
    if (this.offlineMode) {
      return this.getOfflineFallback();
    }

    const scores = new Map<LLMProvider, number>();

    for (const [provider, config] of this.providers) {
      const score = this.calculateScore(config, requirements);
      scores.set(provider, score);
    }

    // Select provider with highest score
    let bestProvider: LLMProvider = 'claude';
    let bestScore = -1;

    for (const [provider, score] of scores) {
      if (score > bestScore) {
        bestScore = score;
        bestProvider = provider;
      }
    }

    return bestProvider;
  }

  /**
   * Calculate routing score based on requirements and capabilities
   */
  private calculateScore(
    config: LLMConfig,
    requirements: TaskRequirements
  ): number {
    let score = 0;
    let weight = 0;

    const caps = config.capabilities;

    // Weight by requirements
    if (requirements.requiresReasoning) {
      score += caps.reasoning * 3;
      weight += 3;
    }

    if (requirements.requiresCoding) {
      score += caps.coding * 3;
      weight += 3;
    }

    if (requirements.requiresAnalysis) {
      score += caps.analysis * 2;
      weight += 2;
    }

    if (requirements.prioritySpeed) {
      score += caps.speed * 2;
      weight += 2;
    }

    if (requirements.priorityCost) {
      score += caps.costEfficiency * 2;
      weight += 2;
    }

    if (requirements.requiresSafety) {
      score += caps.safety * 3;
      weight += 3;
    }

    // Complexity factor
    if (requirements.complexity === 'high') {
      score += caps.reasoning * 2;
      weight += 2;
    } else if (requirements.complexity === 'low') {
      score += caps.costEfficiency * 1.5;
      weight += 1.5;
    }

    // If no specific requirements, balance all factors
    if (weight === 0) {
      score =
        caps.reasoning * 0.2 +
        caps.coding * 0.2 +
        caps.analysis * 0.15 +
        caps.speed * 0.15 +
        caps.costEfficiency * 0.15 +
        caps.safety * 0.15;
      weight = 1;
    }

    return weight > 0 ? score / weight : score;
  }

  /**
   * Detect if we're in offline mode
   */
  private detectOfflineMode(): void {
    if (typeof window !== 'undefined') {
      this.offlineMode = !navigator.onLine;

      window.addEventListener('online', () => {
        this.offlineMode = false;
      });

      window.addEventListener('offline', () => {
        this.offlineMode = true;
      });
    }
  }

  /**
   * Get offline fallback provider
   */
  private getOfflineFallback(): LLMProvider {
    // In offline mode, we'd use a local model or cached responses
    // For now, return the most cost-efficient option
    return 'deepseek';
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(provider: LLMProvider): LLMConfig | undefined {
    return this.providers.get(provider);
  }

  /**
   * Update provider configuration (e.g., add API keys)
   */
  updateProviderConfig(provider: LLMProvider, config: Partial<LLMConfig>): void {
    const current = this.providers.get(provider);
    if (current) {
      this.providers.set(provider, { ...current, ...config });
    }
  }

  /**
   * Check if offline
   */
  isOffline(): boolean {
    return this.offlineMode;
  }
}

// Singleton instance
export const kernelRouter = new KernelRouter();
