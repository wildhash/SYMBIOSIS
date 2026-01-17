// Core types for the SymbiOS kernel
export type LLMProvider = 'claude' | 'gpt' | 'gemini' | 'deepseek';

export interface LLMCapability {
  reasoning: number;      // 0-1 score
  coding: number;         // 0-1 score
  analysis: number;       // 0-1 score
  speed: number;          // 0-1 score
  costEfficiency: number; // 0-1 score
  safety: number;         // 0-1 score
}

export interface TaskRequirements {
  requiresReasoning?: boolean;
  requiresCoding?: boolean;
  requiresAnalysis?: boolean;
  prioritySpeed?: boolean;
  priorityCost?: boolean;
  requiresSafety?: boolean;
  complexity?: 'low' | 'medium' | 'high';
}

export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
  endpoint?: string;
  model: string;
  capabilities: LLMCapability;
  costPerToken: number;
}

export interface KernelTask {
  id: string;
  type: string;
  payload: any;
  requirements: TaskRequirements;
  priority: number;
  timestamp: number;
}

export interface KernelResponse {
  taskId: string;
  provider: LLMProvider;
  result: any;
  executionTime: number;
  cost: number;
  success: boolean;
  error?: string;
}
