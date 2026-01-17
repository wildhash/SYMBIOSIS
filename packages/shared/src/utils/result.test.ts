/**
 * @fileoverview Tests for Result utility
 */

import { describe, it, expect } from 'vitest';

import {
  ok,
  err,
  isOk,
  isErr,
  map,
  mapErr,
  flatMap,
  unwrap,
  unwrapOr,
  unwrapOrElse,
  fromPromise,
  mapAsync,
  collect,
  partition,
  match,
} from './result';

describe('Result', () => {
  describe('constructors', () => {
    it('should create an Ok result', () => {
      const result = ok(42);
      expect(result.ok).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should create an Err result', () => {
      const result = err('error message');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('error message');
    });
  });

  describe('type guards', () => {
    it('should identify Ok results', () => {
      const result = ok(42);
      expect(isOk(result)).toBe(true);
      expect(isErr(result)).toBe(false);
    });

    it('should identify Err results', () => {
      const result = err('error');
      expect(isOk(result)).toBe(false);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('map', () => {
    it('should map over Ok values', () => {
      const result = ok(5);
      const mapped = map(result, (x) => x * 2);
      expect(mapped.ok).toBe(true);
      if (mapped.ok) {
        expect(mapped.value).toBe(10);
      }
    });

    it('should pass through Err unchanged', () => {
      const result = err<number, string>('error');
      const mapped = map(result, (x) => x * 2);
      expect(mapped.ok).toBe(false);
      if (!mapped.ok) {
        expect(mapped.error).toBe('error');
      }
    });
  });

  describe('mapErr', () => {
    it('should map over Err values', () => {
      const result = err<number, string>('error');
      const mapped = mapErr(result, (e) => e.toUpperCase());
      expect(mapped.ok).toBe(false);
      if (!mapped.ok) {
        expect(mapped.error).toBe('ERROR');
      }
    });

    it('should pass through Ok unchanged', () => {
      const result = ok<number, string>(42);
      const mapped = mapErr(result, (e) => e.toUpperCase());
      expect(mapped.ok).toBe(true);
      if (mapped.ok) {
        expect(mapped.value).toBe(42);
      }
    });
  });

  describe('flatMap', () => {
    it('should chain Ok results', () => {
      const result = ok(5);
      const chained = flatMap(result, (x) => ok(x * 2));
      expect(chained.ok).toBe(true);
      if (chained.ok) {
        expect(chained.value).toBe(10);
      }
    });

    it('should propagate Err from original', () => {
      const result = err<number, string>('first error');
      const chained = flatMap(result, (x) => ok(x * 2));
      expect(chained.ok).toBe(false);
      if (!chained.ok) {
        expect(chained.error).toBe('first error');
      }
    });

    it('should propagate Err from chained function', () => {
      const result = ok(5);
      const chained = flatMap(result, () => err<number, string>('second error'));
      expect(chained.ok).toBe(false);
      if (!chained.ok) {
        expect(chained.error).toBe('second error');
      }
    });
  });

  describe('unwrap', () => {
    it('should unwrap Ok values', () => {
      const result = ok(42);
      expect(unwrap(result)).toBe(42);
    });

    it('should throw on Err', () => {
      const result = err('error');
      expect(() => unwrap(result)).toThrow('Called unwrap on Err: error');
    });
  });

  describe('unwrapOr', () => {
    it('should return value for Ok', () => {
      const result = ok(42);
      expect(unwrapOr(result, 0)).toBe(42);
    });

    it('should return default for Err', () => {
      const result = err<number, string>('error');
      expect(unwrapOr(result, 0)).toBe(0);
    });
  });

  describe('unwrapOrElse', () => {
    it('should return value for Ok', () => {
      const result = ok(42);
      expect(unwrapOrElse(result, () => 0)).toBe(42);
    });

    it('should call function for Err', () => {
      const result = err<number, string>('error');
      expect(unwrapOrElse(result, (e) => e.length)).toBe(5);
    });
  });

  describe('fromPromise', () => {
    it('should convert resolved Promise to Ok', async () => {
      const result = await fromPromise(Promise.resolve(42));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    it('should convert rejected Promise to Err', async () => {
      const result = await fromPromise(Promise.reject(new Error('failed')));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
      }
    });

    it('should use error mapper when provided', async () => {
      const result = await fromPromise(
        Promise.reject(new Error('failed')),
        (e) => (e instanceof Error ? e.message : 'unknown'),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('failed');
      }
    });
  });

  describe('mapAsync', () => {
    it('should map async over Ok values', async () => {
      const result = ok(5);
      const mapped = await mapAsync(result, async (x) => x * 2);
      expect(mapped.ok).toBe(true);
      if (mapped.ok) {
        expect(mapped.value).toBe(10);
      }
    });

    it('should pass through Err unchanged', async () => {
      const result = err<number, string>('error');
      const mapped = await mapAsync(result, async (x) => x * 2);
      expect(mapped.ok).toBe(false);
      if (!mapped.ok) {
        expect(mapped.error).toBe('error');
      }
    });
  });

  describe('collect', () => {
    it('should collect all Ok values', () => {
      const results = [ok(1), ok(2), ok(3)];
      const collected = collect(results);
      expect(collected.ok).toBe(true);
      if (collected.ok) {
        expect(collected.value).toEqual([1, 2, 3]);
      }
    });

    it('should return first Err', () => {
      const results = [ok(1), err<number, string>('error'), ok(3)];
      const collected = collect(results);
      expect(collected.ok).toBe(false);
      if (!collected.ok) {
        expect(collected.error).toBe('error');
      }
    });
  });

  describe('partition', () => {
    it('should partition results into oks and errs', () => {
      const results = [
        ok<number, string>(1),
        err<number, string>('a'),
        ok<number, string>(2),
        err<number, string>('b'),
      ];
      const { oks, errs } = partition(results);
      expect(oks).toEqual([1, 2]);
      expect(errs).toEqual(['a', 'b']);
    });
  });

  describe('match', () => {
    it('should call ok handler for Ok', () => {
      const result = ok(42);
      const value = match(result, {
        ok: (v) => `value: ${String(v)}`,
        err: (e) => `error: ${String(e)}`,
      });
      expect(value).toBe('value: 42');
    });

    it('should call err handler for Err', () => {
      const result = err<number, string>('failed');
      const value = match(result, {
        ok: (v) => `value: ${String(v)}`,
        err: (e) => `error: ${e}`,
      });
      expect(value).toBe('error: failed');
    });
  });
});
