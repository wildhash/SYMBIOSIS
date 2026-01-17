/**
 * @fileoverview Type-safe Result monad for error handling without exceptions.
 * Inspired by Rust's Result type.
 * @module @symbiosis/shared/utils/result
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result type - either Ok with a value or Err with an error
 */
export type Result<T, E> = Ok<T, E> | Err<T, E>;

/**
 * Ok variant of Result
 */
export interface Ok<T, E> {
  readonly ok: true;
  readonly value: T;
  readonly error?: never;
}

/**
 * Err variant of Result
 */
export interface Err<T, E> {
  readonly ok: false;
  readonly value?: never;
  readonly error: E;
}

// ============================================================================
// CONSTRUCTORS
// ============================================================================

/**
 * Create an Ok result
 * @param value - The success value
 * @returns An Ok result containing the value
 */
export function ok<T, E = never>(value: T): Result<T, E> {
  return { ok: true, value };
}

/**
 * Create an Err result
 * @param error - The error value
 * @returns An Err result containing the error
 */
export function err<T = never, E = unknown>(error: E): Result<T, E> {
  return { ok: false, error };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if a result is Ok
 * @param result - The result to check
 * @returns True if the result is Ok
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T, E> {
  return result.ok;
}

/**
 * Check if a result is Err
 * @param result - The result to check
 * @returns True if the result is Err
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<T, E> {
  return !result.ok;
}

// ============================================================================
// COMBINATORS
// ============================================================================

/**
 * Map over the value of an Ok result
 * @param result - The result to map over
 * @param fn - The mapping function
 * @returns A new result with the mapped value
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (result.ok) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * Map over the error of an Err result
 * @param result - The result to map over
 * @param fn - The mapping function
 * @returns A new result with the mapped error
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  if (!result.ok) {
    return err(fn(result.error));
  }
  return result;
}

/**
 * Chain operations that return Results
 * @param result - The result to chain from
 * @param fn - The function that returns a new Result
 * @returns The chained result
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  if (result.ok) {
    return fn(result.value);
  }
  return result;
}

/**
 * Unwrap the value from an Ok result, throwing if Err
 * @param result - The result to unwrap
 * @returns The value if Ok
 * @throws Error if the result is Err
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw new Error(`Called unwrap on Err: ${String(result.error)}`);
}

/**
 * Unwrap the value from a result with a default
 * @param result - The result to unwrap
 * @param defaultValue - The default value if Err
 * @returns The value if Ok, otherwise the default
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (result.ok) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Unwrap the value from a result with a default function
 * @param result - The result to unwrap
 * @param fn - Function to compute default from error
 * @returns The value if Ok, otherwise the computed default
 */
export function unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T {
  if (result.ok) {
    return result.value;
  }
  return fn(result.error);
}

// ============================================================================
// ASYNC UTILITIES
// ============================================================================

/**
 * Convert a Promise to a Result
 * @param promise - The promise to convert
 * @param errorMapper - Optional function to map errors
 * @returns A Promise of Result
 */
export async function fromPromise<T, E = Error>(
  promise: Promise<T>,
  errorMapper?: (error: unknown) => E,
): Promise<Result<T, E>> {
  try {
    const value = await promise;
    return ok(value);
  } catch (error) {
    if (errorMapper !== undefined) {
      return err(errorMapper(error));
    }
    return err(error as E);
  }
}

/**
 * Map over a Result with an async function
 * @param result - The result to map over
 * @param fn - The async mapping function
 * @returns A Promise of the mapped Result
 */
export async function mapAsync<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Promise<U>,
): Promise<Result<U, E>> {
  if (result.ok) {
    const mapped = await fn(result.value);
    return ok(mapped);
  }
  return result;
}

// ============================================================================
// COLLECTION UTILITIES
// ============================================================================

/**
 * Collect an array of Results into a Result of array
 * @param results - Array of results to collect
 * @returns A Result containing all values or the first error
 */
export function collect<T, E>(results: readonly Result<T, E>[]): Result<readonly T[], E> {
  const values: T[] = [];

  for (const result of results) {
    if (!result.ok) {
      return result;
    }
    values.push(result.value);
  }

  return ok(values);
}

/**
 * Partition an array of Results into Ok values and Err values
 * @param results - Array of results to partition
 * @returns Object with arrays of Ok values and Err values
 */
export function partition<T, E>(
  results: readonly Result<T, E>[],
): { readonly oks: readonly T[]; readonly errs: readonly E[] } {
  const oks: T[] = [];
  const errs: E[] = [];

  for (const result of results) {
    if (result.ok) {
      oks.push(result.value);
    } else {
      errs.push(result.error);
    }
  }

  return { oks, errs };
}

/**
 * Match on a Result, providing handlers for both cases
 * @param result - The result to match on
 * @param handlers - Object with ok and err handlers
 * @returns The return value of the matched handler
 */
export function match<T, E, U>(
  result: Result<T, E>,
  handlers: {
    readonly ok: (value: T) => U;
    readonly err: (error: E) => U;
  },
): U {
  if (result.ok) {
    return handlers.ok(result.value);
  }
  return handlers.err(result.error);
}
