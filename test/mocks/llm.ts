/**
 * @fileoverview LLM mock for testing
 */

import type { IModelResponse, ITokenUsage } from '@symbiosis/shared';

/**
 * Create a mock LLM response
 * @param content - Response content
 * @param modelId - Model ID
 * @returns Mock model response
 */
export function createMockLLMResponse(
  content: string,
  modelId = 'mock-model',
): IModelResponse {
  const tokensUsed: ITokenUsage = {
    prompt: 100,
    completion: 50,
    total: 150,
  };

  return {
    content,
    tokensUsed,
    finishReason: 'stop',
    modelId,
  };
}

/**
 * Create a mock LLM that returns predefined responses
 */
export class MockLLM {
  private responses: Map<string, string>;

  constructor() {
    this.responses = new Map();
  }

  /**
   * Set a response for a given input pattern
   */
  public setResponse(pattern: string, response: string): void {
    this.responses.set(pattern, response);
  }

  /**
   * Get a response for the given input
   */
  public getResponse(input: string): IModelResponse {
    for (const [pattern, response] of this.responses) {
      if (input.includes(pattern)) {
        return createMockLLMResponse(response);
      }
    }
    return createMockLLMResponse(`Mock response for: ${input}`);
  }
}
