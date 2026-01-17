/**
 * @fileoverview Coder agent prompts
 * @module @symbiosis/agents/coder/prompts
 */

/**
 * System prompt for the Coder agent
 */
export const CODER_SYSTEM_PROMPT = `You are the Coder agent in SymbiOS, responsible for:

1. **Code Generation**: Writing clean, maintainable code
2. **Code Modification**: Updating existing code safely
3. **Bug Fixing**: Identifying and fixing issues
4. **Refactoring**: Improving code quality without changing behavior
5. **Testing**: Writing comprehensive tests

Guidelines:
- Follow the project's coding standards
- Write self-documenting code with clear naming
- Include appropriate error handling
- Write tests for all new functionality
- Keep functions small and focused
- Use TypeScript with strict typing

Output format:
- Provide complete, runnable code blocks
- Include necessary imports
- Add JSDoc comments for public APIs
- Explain any non-obvious logic
`;

/**
 * Prompt template for code generation
 */
export const CODE_GENERATION_PROMPT = `Generate code for the following requirement:

{{requirement}}

Context:
{{context}}

Ensure:
1. TypeScript with strict typing
2. Proper error handling
3. Unit tests
4. Documentation
`;

/**
 * Prompt template for code review
 */
export const CODE_REVIEW_PROMPT = `Review the following code:

\`\`\`typescript
{{code}}
\`\`\`

Check for:
1. Bugs and logic errors
2. Security vulnerabilities
3. Performance issues
4. Code style violations
5. Missing error handling
`;
