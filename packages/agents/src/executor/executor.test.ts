/**
 * @fileoverview Tests for executor agent code validation
 */

import { describe, it, expect } from 'vitest';

import { validateAndSanitizeCode } from './executor';

describe('validateAndSanitizeCode', () => {
  describe('type validation', () => {
    it('should reject null input', () => {
      const result = validateAndSanitizeCode(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Code input is required');
      expect(result.sanitizedCode).toBe('');
    });

    it('should reject undefined input', () => {
      const result = validateAndSanitizeCode(undefined);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Code input is required');
    });

    it('should reject non-string input (number)', () => {
      const result = validateAndSanitizeCode(123);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid code type');
      expect(result.errors[0]).toContain('got number');
    });

    it('should reject non-string input (object)', () => {
      const result = validateAndSanitizeCode({ code: 'const x = 1;' });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid code type');
      expect(result.errors[0]).toContain('got object');
    });

    it('should reject non-string input (array)', () => {
      const result = validateAndSanitizeCode(['const x = 1;']);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid code type');
    });
  });

  describe('empty code validation', () => {
    it('should reject empty string', () => {
      const result = validateAndSanitizeCode('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Code cannot be empty');
    });

    it('should reject whitespace-only string', () => {
      const result = validateAndSanitizeCode('   ');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Code cannot be empty');
    });

    it('should reject string with only newlines and tabs', () => {
      const result = validateAndSanitizeCode('\n\t\n');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Code cannot be empty');
    });
  });

  describe('length validation', () => {
    it('should reject code exceeding maximum length', () => {
      const longCode = 'x'.repeat(100_001);
      const result = validateAndSanitizeCode(longCode);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('exceeds maximum length');
      expect(result.errors[0]).toContain('100000');
    });

    it('should accept code at maximum length', () => {
      const maxCode = 'x'.repeat(100_000);
      const result = validateAndSanitizeCode(maxCode);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('blocked pattern detection', () => {
    it('should block eval patterns', () => {
      const result = validateAndSanitizeCode('eval("alert(1)")');
      expect(result.isValid).toBe(false);
      expect(result.blockedPatterns.length).toBeGreaterThan(0);
      expect(result.blockedPatterns.some((p) => p.includes('eval'))).toBe(true);
      expect(result.sanitizedCode).toContain('/* BLOCKED');
    });

    it('should block require patterns', () => {
      const result = validateAndSanitizeCode('const fs = require("fs")');
      expect(result.isValid).toBe(false);
      expect(result.blockedPatterns.some((p) => p.includes('require'))).toBe(true);
    });

    it('should block dynamic import patterns', () => {
      const result = validateAndSanitizeCode('const mod = await import("./evil")');
      expect(result.isValid).toBe(false);
      expect(result.blockedPatterns.some((p) => p.includes('import'))).toBe(true);
    });

    it('should block Function constructor patterns', () => {
      const result = validateAndSanitizeCode('new Function("return this")()');
      expect(result.isValid).toBe(false);
      expect(result.blockedPatterns.some((p) => p.includes('Function'))).toBe(true);
    });

    it('should block process access patterns', () => {
      const result = validateAndSanitizeCode('process.exit(1)');
      expect(result.isValid).toBe(false);
      expect(result.blockedPatterns.some((p) => p.includes('process.'))).toBe(true);
    });

    it('should block __proto__ patterns', () => {
      const result = validateAndSanitizeCode('obj.__proto__.polluted = true');
      expect(result.isValid).toBe(false);
      expect(result.blockedPatterns.some((p) => p.includes('__proto__'))).toBe(true);
    });

    it('should block child_process patterns', () => {
      const result = validateAndSanitizeCode('const { exec } = child_process');
      expect(result.isValid).toBe(false);
      expect(result.blockedPatterns.some((p) => p.includes('child_process'))).toBe(true);
    });

    it('should block fs access patterns', () => {
      const result = validateAndSanitizeCode('fs.readFileSync("/etc/passwd")');
      expect(result.isValid).toBe(false);
      expect(result.blockedPatterns.some((p) => p.includes('fs.'))).toBe(true);
    });

    it('should block exec patterns', () => {
      const result = validateAndSanitizeCode('exec("rm -rf /")');
      expect(result.isValid).toBe(false);
      expect(result.blockedPatterns.some((p) => p.includes('exec'))).toBe(true);
    });

    it('should block spawn patterns', () => {
      const result = validateAndSanitizeCode('spawn("sh", ["-c", "malicious"])');
      expect(result.isValid).toBe(false);
      expect(result.blockedPatterns.some((p) => p.includes('spawn'))).toBe(true);
    });

    it('should block constructor bracket access patterns', () => {
      const result = validateAndSanitizeCode('obj.constructor["prototype"]');
      expect(result.isValid).toBe(false);
      expect(result.blockedPatterns.some((p) => p.includes('constructor'))).toBe(true);
    });

    it('should detect multiple blocked patterns', () => {
      const result = validateAndSanitizeCode('eval(require("fs").readFileSync("x"))');
      expect(result.isValid).toBe(false);
      expect(result.blockedPatterns.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('valid code acceptance', () => {
    it('should pass valid simple code', () => {
      const result = validateAndSanitizeCode('const x = 1 + 2;');
      expect(result.isValid).toBe(true);
      expect(result.blockedPatterns).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedCode).toBe('const x = 1 + 2;');
    });

    it('should pass valid function declaration', () => {
      const result = validateAndSanitizeCode(`
function add(a, b) {
  return a + b;
}
      `);
      expect(result.isValid).toBe(true);
    });

    it('should pass valid class declaration', () => {
      const result = validateAndSanitizeCode(`
class MyClass {
  constructor(value) {
    this.value = value;
  }
  
  getValue() {
    return this.value;
  }
}
      `);
      expect(result.isValid).toBe(true);
    });

    it('should pass valid async code', () => {
      const result = validateAndSanitizeCode(`
async function fetchData() {
  const response = await fetch('/api/data');
  return response.json();
}
      `);
      expect(result.isValid).toBe(true);
    });

    it('should pass valid arrow functions', () => {
      const result = validateAndSanitizeCode('const add = (a, b) => a + b;');
      expect(result.isValid).toBe(true);
    });

    it('should pass code with console.log', () => {
      const result = validateAndSanitizeCode('console.log("Hello, World!");');
      expect(result.isValid).toBe(true);
    });

    it('should pass code with array methods', () => {
      const result = validateAndSanitizeCode(`
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
const sum = numbers.reduce((a, b) => a + b, 0);
      `);
      expect(result.isValid).toBe(true);
    });
  });

  describe('code trimming', () => {
    it('should trim leading whitespace', () => {
      const result = validateAndSanitizeCode('   const x = 1;');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedCode).toBe('const x = 1;');
    });

    it('should trim trailing whitespace', () => {
      const result = validateAndSanitizeCode('const x = 1;   ');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedCode).toBe('const x = 1;');
    });

    it('should preserve internal whitespace', () => {
      const code = 'const x = 1;\n\nconst y = 2;';
      const result = validateAndSanitizeCode(code);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedCode).toBe(code);
    });
  });
});
