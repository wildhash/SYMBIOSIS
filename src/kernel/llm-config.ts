import { LLMProvider, LLMConfig, LLMCapability } from './types';

// Default LLM configurations based on their known capabilities
export const LLM_CONFIGS: Record<LLMProvider, LLMConfig> = {
  claude: {
    provider: 'claude',
    model: 'claude-3-5-sonnet-20241022',
    capabilities: {
      reasoning: 0.95,
      coding: 0.98,
      analysis: 0.95,
      speed: 0.85,
      costEfficiency: 0.70,
      safety: 0.98
    },
    costPerToken: 0.000003
  },
  gpt: {
    provider: 'gpt',
    model: 'gpt-4-turbo',
    capabilities: {
      reasoning: 0.90,
      coding: 0.92,
      analysis: 0.90,
      speed: 0.88,
      costEfficiency: 0.75,
      safety: 0.95
    },
    costPerToken: 0.00001
  },
  gemini: {
    provider: 'gemini',
    model: 'gemini-pro',
    capabilities: {
      reasoning: 0.88,
      coding: 0.85,
      analysis: 0.92,
      speed: 0.92,
      costEfficiency: 0.90,
      safety: 0.93
    },
    costPerToken: 0.00000025
  },
  deepseek: {
    provider: 'deepseek',
    model: 'deepseek-coder',
    capabilities: {
      reasoning: 0.85,
      coding: 0.95,
      analysis: 0.82,
      speed: 0.90,
      costEfficiency: 0.95,
      safety: 0.88
    },
    costPerToken: 0.00000014
  }
};

export function getLLMConfig(provider: LLMProvider): LLMConfig {
  return LLM_CONFIGS[provider];
}
