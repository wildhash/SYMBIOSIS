/**
 * @fileoverview AST-based code validation for executor agent
 * @module @symbiosis/agents/executor/validator
 */

import { parse, type ParserOptions } from '@babel/parser';
import traverse, { type NodePath } from '@babel/traverse';
import type {
  CallExpression,
  MemberExpression,
  AssignmentExpression,
  Identifier,
  Node,
} from '@babel/types';

/**
 * Supported languages for code validation
 */
export const SUPPORTED_LANGUAGES = ['javascript', 'typescript', 'shell'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Type guard to check if a language is supported
 * @param lang - The language to check
 * @returns True if the language is supported
 */
export function isSupportedLanguage(lang: unknown): lang is SupportedLanguage {
  return typeof lang === 'string' && SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
}

/**
 * Violation types for security validation
 */
export enum ViolationType {
  DANGEROUS_EVAL = 'dangerous_eval',
  DYNAMIC_IMPORT = 'dynamic_import',
  PROCESS_ACCESS = 'process_access',
  REQUIRE_CALL = 'require_call',
  GLOBAL_MUTATION = 'global_mutation',
  PROTOTYPE_POLLUTION = 'prototype_pollution',
  DANGEROUS_MODULE = 'dangerous_module',
  PARSE_ERROR = 'parse_error',
}

/**
 * Location of a violation in the source code
 */
export interface ILocation {
  readonly line: number;
  readonly column: number;
}

/**
 * A security violation found in the code
 */
export interface IViolation {
  readonly type: ViolationType;
  readonly location: ILocation;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

/**
 * Result of code validation
 */
export interface IValidationResult {
  readonly isValid: boolean;
  readonly violations: readonly IViolation[];
  readonly sanitizedCode: string | null;
}

/**
 * Set of dangerous global identifiers
 */
const DANGEROUS_GLOBALS: ReadonlySet<string> = new Set([
  'eval',
  'Function',
  'process',
  'require',
  '__proto__',
  'constructor',
]);

/**
 * Set of dangerous Node.js module names
 */
const DANGEROUS_MODULES: ReadonlySet<string> = new Set([
  'child_process',
  'fs',
  'net',
  'http',
  'https',
  'dgram',
  'cluster',
  'worker_threads',
  'vm',
  'os',
  'path',
  'crypto',
]);

/**
 * Babel parser options for JavaScript/TypeScript parsing
 */
const PARSER_OPTIONS: ParserOptions = {
  sourceType: 'module',
  plugins: ['typescript', 'jsx'],
  errorRecovery: true,
};

/**
 * Validate JavaScript/TypeScript code using AST analysis
 * @param code - The code to validate
 * @returns Validation result with violations and sanitized code
 */
export function validateJavaScript(code: string): IValidationResult {
  const violations: IViolation[] = [];

  try {
    const ast = parse(code, PARSER_OPTIONS);

    traverse(ast, {
      // Check for eval() and Function() calls
      CallExpression(path: NodePath<CallExpression>) {
        const callee = path.node.callee;

        if (callee.type === 'Identifier') {
          checkIdentifierCall(callee, path, violations);
        }

        // Check for indirect eval: window.eval(), globalThis.eval()
        if (callee.type === 'MemberExpression') {
          checkMemberExpressionCall(callee, path, violations);
        }
      },

      // Check for dynamic imports
      Import(path: NodePath<Node>) {
        const parent = path.parent;
        if (parent.type === 'CallExpression') {
          const arg = parent.arguments[0];
          // Dynamic import with variable is suspicious
          if (arg?.type !== 'StringLiteral') {
            violations.push({
              type: ViolationType.DYNAMIC_IMPORT,
              location: getLocation(path.node),
              message: 'Dynamic imports with variables are not allowed',
              severity: 'warning',
            });
          } else if (DANGEROUS_MODULES.has(arg.value)) {
            violations.push({
              type: ViolationType.DANGEROUS_MODULE,
              location: getLocation(path.node),
              message: `Importing "${arg.value}" is not allowed`,
              severity: 'error',
            });
          }
        }
      },

      // Check for process access
      MemberExpression(path: NodePath<MemberExpression>) {
        const object = path.node.object;
        if (object.type === 'Identifier' && object.name === 'process') {
          // Allow process.env in certain contexts
          const property = path.node.property;
          if (property.type === 'Identifier' && property.name !== 'env') {
            violations.push({
              type: ViolationType.PROCESS_ACCESS,
              location: getLocation(object),
              message: `Access to process.${property.name} is not allowed`,
              severity: 'error',
            });
          }
        }

        // Check for __proto__ access
        if (path.node.property.type === 'Identifier') {
          if (path.node.property.name === '__proto__') {
            violations.push({
              type: ViolationType.PROTOTYPE_POLLUTION,
              location: getLocation(path.node),
              message: '__proto__ access is not allowed',
              severity: 'error',
            });
          }
        }

        // Check for constructor['prototype'] access (prototype pollution)
        if (path.node.property.type === 'StringLiteral') {
          if (path.node.property.value === '__proto__' || path.node.property.value === 'prototype') {
            if (path.node.object.type === 'Identifier' && path.node.object.name === 'constructor') {
              violations.push({
                type: ViolationType.PROTOTYPE_POLLUTION,
                location: getLocation(path.node),
                message: 'Prototype manipulation via constructor is not allowed',
                severity: 'error',
              });
            }
          }
        }
      },

      // Check for global mutations
      AssignmentExpression(path: NodePath<AssignmentExpression>) {
        const left = path.node.left;
        if (left.type === 'MemberExpression') {
          const object = left.object;
          if (object.type === 'Identifier') {
            if (DANGEROUS_GLOBALS.has(object.name)) {
              violations.push({
                type: ViolationType.GLOBAL_MUTATION,
                location: getLocation(object),
                message: `Mutating global "${object.name}" is not allowed`,
                severity: 'error',
              });
            }
          }
        }
      },
    });

    const hasErrors = violations.some((v) => v.severity === 'error');

    return {
      isValid: !hasErrors,
      violations,
      sanitizedCode: hasErrors ? null : code,
    };
  } catch (parseError) {
    return {
      isValid: false,
      violations: [
        {
          type: ViolationType.PARSE_ERROR,
          location: { line: 0, column: 0 },
          message: `Parse error: ${parseError instanceof Error ? parseError.message : 'Unknown'}`,
          severity: 'error',
        },
      ],
      sanitizedCode: null,
    };
  }
}

/**
 * Check identifier-based function calls for dangerous patterns
 */
function checkIdentifierCall(
  callee: Identifier,
  path: NodePath<CallExpression>,
  violations: IViolation[],
): void {
  if (callee.name === 'eval') {
    violations.push({
      type: ViolationType.DANGEROUS_EVAL,
      location: getLocation(callee),
      message: 'Direct eval() calls are not allowed',
      severity: 'error',
    });
  }

  if (callee.name === 'Function' && path.parent.type === 'NewExpression') {
    violations.push({
      type: ViolationType.DANGEROUS_EVAL,
      location: getLocation(callee),
      message: 'new Function() is not allowed',
      severity: 'error',
    });
  }

  // Also check for Function() call without new
  if (callee.name === 'Function') {
    violations.push({
      type: ViolationType.DANGEROUS_EVAL,
      location: getLocation(callee),
      message: 'Function() constructor is not allowed',
      severity: 'error',
    });
  }

  if (callee.name === 'require') {
    const arg = path.node.arguments[0];
    if (arg?.type === 'StringLiteral') {
      const moduleName = arg.value;
      if (DANGEROUS_MODULES.has(moduleName)) {
        violations.push({
          type: ViolationType.REQUIRE_CALL,
          location: getLocation(callee),
          message: `Requiring "${moduleName}" is not allowed`,
          severity: 'error',
        });
      }
    } else if (arg !== undefined) {
      // Dynamic require is suspicious
      violations.push({
        type: ViolationType.REQUIRE_CALL,
        location: getLocation(callee),
        message: 'Dynamic require() with variable is not allowed',
        severity: 'warning',
      });
    }
  }
}

/**
 * Check member expression calls for dangerous patterns
 */
function checkMemberExpressionCall(
  callee: MemberExpression,
  _path: NodePath<CallExpression>,
  violations: IViolation[],
): void {
  const property = callee.property;

  // Check for window.eval(), globalThis.eval(), etc.
  if (property.type === 'Identifier' && property.name === 'eval') {
    violations.push({
      type: ViolationType.DANGEROUS_EVAL,
      location: getLocation(callee),
      message: 'Indirect eval() calls are not allowed',
      severity: 'error',
    });
  }

  // Check for window.Function(), etc.
  if (property.type === 'Identifier' && property.name === 'Function') {
    violations.push({
      type: ViolationType.DANGEROUS_EVAL,
      location: getLocation(callee),
      message: 'Indirect Function() constructor is not allowed',
      severity: 'error',
    });
  }
}

/**
 * Get location from an AST node
 */
function getLocation(node: Node): ILocation {
  return {
    line: node.loc?.start.line ?? 0,
    column: node.loc?.start.column ?? 0,
  };
}

/**
 * Dangerous shell patterns with their descriptions
 */
const DANGEROUS_SHELL_PATTERNS: readonly { pattern: RegExp; message: string }[] = [
  { pattern: /rm\s+-rf\s+[/~]/, message: 'Recursive deletion of system paths not allowed' },
  { pattern: /rm\s+-rf\s+\$/, message: 'Recursive deletion with variables not allowed' },
  { pattern: />\s*\/dev\/sd/, message: 'Direct device writes not allowed' },
  { pattern: /mkfs/, message: 'Filesystem operations not allowed' },
  { pattern: /dd\s+if=/, message: 'Raw disk operations not allowed' },
  { pattern: /curl.*\|\s*sh/, message: 'Piping remote scripts to shell not allowed' },
  { pattern: /wget.*\|\s*sh/, message: 'Piping remote scripts to shell not allowed' },
  { pattern: /curl.*\|\s*bash/, message: 'Piping remote scripts to bash not allowed' },
  { pattern: /wget.*\|\s*bash/, message: 'Piping remote scripts to bash not allowed' },
  { pattern: /chmod\s+777/, message: 'World-writable permissions not allowed' },
  { pattern: /chmod\s+666/, message: 'World-writable file permissions not allowed' },
  { pattern: /\bsudo\b/, message: 'Elevated privileges not allowed' },
  { pattern: /\bsu\s+-/, message: 'User switching not allowed' },
  { pattern: /\bpasswd\b/, message: 'Password operations not allowed' },
  { pattern: /\/etc\/shadow/, message: 'Access to shadow file not allowed' },
  { pattern: /\/etc\/passwd/, message: 'Access to passwd file not allowed' },
  { pattern: /\bshutdown\b/, message: 'System shutdown commands not allowed' },
  { pattern: /\breboot\b/, message: 'System reboot commands not allowed' },
  { pattern: /\bhalt\b/, message: 'System halt commands not allowed' },
  { pattern: /\binit\s+[0-6]/, message: 'Init level changes not allowed' },
  { pattern: /:\(\)\s*\{\s*:\|:&\s*\}/, message: 'Fork bombs not allowed' },
  { pattern: /\$\(.*\)\s*>\s*\//, message: 'Command substitution to system paths not allowed' },
];

/**
 * Validate shell command for dangerous patterns
 * @param command - The shell command to validate
 * @returns Validation result with violations
 */
export function validateShellCommand(command: string): IValidationResult {
  const violations: IViolation[] = [];

  for (const { pattern, message } of DANGEROUS_SHELL_PATTERNS) {
    if (pattern.test(command)) {
      violations.push({
        type: ViolationType.DANGEROUS_EVAL,
        location: { line: 1, column: 0 },
        message,
        severity: 'error',
      });
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
    sanitizedCode: violations.length === 0 ? command : null,
  };
}

/**
 * Validate code based on language
 * @param code - The code to validate
 * @param language - The programming language
 * @returns Validation result
 */
export function validateCode(code: string, language: SupportedLanguage): IValidationResult {
  if (language === 'shell') {
    return validateShellCommand(code);
  }

  // JavaScript and TypeScript use the same validator
  return validateJavaScript(code);
}
