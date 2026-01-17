import { LLMProvider, LLMConfig } from './types';

/**
 * LLM Model Configurations
 * 
 * IMPORTANT: Keep these models up to date with the latest releases!
 * 
 * Update this configuration immediately when new models are released:
 * - Claude: https://docs.anthropic.com/claude/docs/models-overview
 * - OpenAI: https://platform.openai.com/docs/models
 * - Google: https://ai.google.dev/models/gemini
 * - DeepSeek: https://platform.deepseek.com/docs
 * 
 * Last updated: 2026-01-17
 */

// Available model configurations for each provider
export const AVAILABLE_MODELS: Record<LLMProvider, string[]> = {
  claude: [
    'claude-opus-4.5',           // Latest: Best reasoning and coding (Jan 2026)
    'claude-3-5-sonnet-20241022', // Previous: Balanced performance
    'claude-3-opus-20240229'      // Legacy: High capability
  ],
  gpt: [
    'o3',                         // Latest: Advanced reasoning (Jan 2026)
    'chatgpt-5.2',               // Latest: Best general purpose (Jan 2026)
    'gpt-4-turbo',               // Previous: Fast and capable
    'gpt-4'                      // Legacy: Original GPT-4
  ],
  gemini: [
    'gemini-2.0-flash-exp',      // Latest: Fastest multimodal (Dec 2025)
    'gemini-pro-1.5',            // Previous: Enhanced capabilities
    'gemini-pro'                 // Legacy: Original
  ],
  deepseek: [
    'deepseek-v3',               // Latest: Best coding model (Jan 2026)
    'deepseek-coder-v2',         // Previous: Specialized coding
    'deepseek-coder'             // Legacy: Original coder
  ]
};

// Default LLM configurations - ALWAYS USE LATEST MODELS
export const LLM_CONFIGS: Record<LLMProvider, LLMConfig> = {
  claude: {
    provider: 'claude',
    model: 'claude-opus-4.5',    // Updated to latest Opus 4.5 (Jan 2026)
    capabilities: {
      reasoning: 0.99,             // Improved from 0.95
      coding: 0.99,                // Improved from 0.98
      analysis: 0.98,              // Improved from 0.95
      speed: 0.87,                 // Slightly improved
      costEfficiency: 0.65,        // Lower due to premium model
      safety: 0.99                 // Improved safety
    },
    costPerToken: 0.000015         // Higher cost for Opus 4.5
  },
  gpt: {
    provider: 'gpt',
    model: 'chatgpt-5.2',          // Updated to latest ChatGPT 5.2 (Jan 2026)
    capabilities: {
      reasoning: 0.96,             // Improved from 0.90
      coding: 0.95,                // Improved from 0.92
      analysis: 0.95,              // Improved from 0.90
      speed: 0.92,                 // Improved speed
      costEfficiency: 0.78,        // Slightly improved
      safety: 0.97                 // Improved safety
    },
    costPerToken: 0.000020         // Premium pricing for 5.2
  },
  gemini: {
    provider: 'gemini',
    model: 'gemini-2.0-flash-exp', // Updated to latest 2.0 Flash (Dec 2025)
    capabilities: {
      reasoning: 0.92,             // Improved from 0.88
      coding: 0.90,                // Improved from 0.85
      analysis: 0.95,              // Improved from 0.92
      speed: 0.96,                 // Significantly faster
      costEfficiency: 0.95,        // Excellent value
      safety: 0.95                 // Improved
    },
    costPerToken: 0.00000025       // Still most cost-efficient
  },
  deepseek: {
    provider: 'deepseek',
    model: 'deepseek-v3',          // Updated to latest V3 (Jan 2026)
    capabilities: {
      reasoning: 0.90,             // Improved from 0.85
      coding: 0.98,                // Improved from 0.95
      analysis: 0.88,              // Improved from 0.82
      speed: 0.93,                 // Improved speed
      costEfficiency: 0.97,        // Best value for coding
      safety: 0.92                 // Improved safety
    },
    costPerToken: 0.00000014       // Maintains excellent pricing
  }
};

/**
 * Get LLM configuration by provider
 */
export function getLLMConfig(provider: LLMProvider): LLMConfig {
  return LLM_CONFIGS[provider];
}

/**
 * Get available models for a provider
 */
export function getAvailableModels(provider: LLMProvider): string[] {
  return AVAILABLE_MODELS[provider];
}

/**
 * Update model for a specific provider
 * This allows runtime model switching without code changes
 */
export function setProviderModel(provider: LLMProvider, model: string): void {
  const availableModels = AVAILABLE_MODELS[provider];
  if (!availableModels.includes(model)) {
    console.warn(
      `Model ${model} not in available models for ${provider}. ` +
      `Available: ${availableModels.join(', ')}`
    );
  }
  LLM_CONFIGS[provider].model = model;
}

/**
 * Get model version information
 */
export function getModelInfo(provider: LLMProvider): {
  current: string;
  available: string[];
  latest: string;
} {
  return {
    current: LLM_CONFIGS[provider].model,
    available: AVAILABLE_MODELS[provider],
    latest: AVAILABLE_MODELS[provider][0]
  };
}

/**
 * Check if using latest model
 */
export function isUsingLatestModel(provider: LLMProvider): boolean {
  const latest = AVAILABLE_MODELS[provider][0];
  return LLM_CONFIGS[provider].model === latest;
}

/**
 * Upgrade all providers to latest models
 */
export function upgradeAllToLatest(): void {
  (Object.keys(AVAILABLE_MODELS) as LLMProvider[]).forEach(provider => {
    const latest = AVAILABLE_MODELS[provider][0];
    LLM_CONFIGS[provider].model = latest;
  });
}
