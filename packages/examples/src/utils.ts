/**
 * Utility functions and helpers.
 *
 * @module utils
 */

/**
 * Debounce a function to prevent rapid successive calls.
 *
 * @template T - Function type
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 *
 * @example
 * ```typescript
 * const debouncedSearch = debounce((query: string) => search(query), 300);
 * input.addEventListener('input', (e) => debouncedSearch(e.target.value));
 * ```
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle a function to limit call frequency.
 *
 * @template T - Function type
 * @param fn - Function to throttle
 * @param interval - Minimum interval in milliseconds between calls
 * @returns Throttled function
 *
 * @example
 * ```typescript
 * const throttledResize = throttle(() => layout(), 100);
 * window.addEventListener('resize', throttledResize);
 * ```
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  interval: number,
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= interval) {
      fn(...args);
      lastCall = now;
    }
  };
}

/**
 * Retry an async operation with exponential backoff.
 *
 * @template T - The return type of the operation
 * @param operation - Async function to retry
 * @param maxAttempts - Maximum number of attempts
 * @param backoffMs - Initial backoff delay in milliseconds
 * @returns Promise resolving to the operation result
 *
 * @example
 * ```typescript
 * const data = await retry(
 *   () => fetch('/api/data'),
 *   3,
 *   100
 * );
 * ```
 */
export async function retry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  backoffMs: number = 100,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

/**
 * Deep merge two objects recursively.
 *
 * @template T - The object type
 * @param target - Target object
 * @param source - Source object to merge in
 * @returns Merged object
 *
 * @example
 * ```typescript
 * const config = deepMerge(defaults, userConfig);
 * ```
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (
      sourceValue !== null &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === "object" &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(targetValue, sourceValue);
    } else {
      result[key] = sourceValue as any;
    }
  }

  return result;
}

/**
 * Pick specific properties from an object.
 *
 * @template T - Object type
 * @template K - Keys to pick
 * @param obj - Source object
 * @param keys - Property names to include
 * @returns New object with only the picked properties
 *
 * @example
 * ```typescript
 * const user = { id: "1", name: "John", email: "john@example.com", password: "secret" };
 * const safe = pick(user, "id", "name", "email"); // password excluded
 * ```
 */
export function pick<T, K extends keyof T>(obj: T, ...keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    result[key] = obj[key];
  }
  return result;
}

/**
 * Omit specific properties from an object.
 *
 * @template T - Object type
 * @template K - Keys to omit
 * @param obj - Source object
 * @param keys - Property names to exclude
 * @returns New object without the omitted properties
 *
 * @example
 * ```typescript
 * const user = { id: "1", name: "John", password: "secret" };
 * const safe = omit(user, "password");
 * ```
 */
export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  ...keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

/**
 * Group array items by a property or function.
 *
 * @template T - Array item type
 * @template K - Grouping key type
 * @param items - Array to group
 * @param key - Property name or function to determine group
 * @returns Object with grouped items
 *
 * @example
 * ```typescript
 * const users = [
 *   { id: "1", role: "admin" },
 *   { id: "2", role: "user" },
 *   { id: "3", role: "admin" },
 * ];
 * const byRole = groupBy(users, (u) => u.role);
 * // { admin: [user1, user3], user: [user2] }
 * ```
 */
export function groupBy<T, K extends string | number>(
  items: T[],
  key: keyof T | ((item: T) => K),
): Record<K, T[]> {
  const result: Record<K, T[]> = {} as any;

  for (const item of items) {
    const groupKey = typeof key === "function" ? key(item) : (item[key as keyof T] as unknown as K);

    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
  }

  return result;
}

/**
 * Chain multiple async operations in sequence.
 *
 * @template T - Pipeline operation type
 * @param initial - Initial value
 * @param operations - Array of async transformation functions
 * @returns Promise resolving to the final value
 *
 * @example
 * ```typescript
 * const result = await pipe(
 *   user,
 *   [(u) => fetchRelations(u), (u) => enrichUser(u)]
 * );
 * ```
 */
export async function pipe<T>(initial: T, operations: Array<(value: T) => Promise<T>>): Promise<T> {
  let result = initial;
  for (const operation of operations) {
    result = await operation(result);
  }
  return result;
}

/**
 * Create a memoized version of a function.
 *
 * @template T - Function type
 * @param fn - Function to memoize
 * @param keyResolver - Function to generate cache key from arguments
 * @returns Memoized function
 *
 * @example
 * ```typescript
 * const memoizedFib = memoize(
 *   (n: number): number => n <= 1 ? n : memoizedFib(n - 1) + memoizedFib(n - 2)
 * );
 * ```
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyResolver: (...args: Parameters<T>) => string = (...args) => JSON.stringify(args),
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>) => {
    const key = keyResolver(...args);
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Compose multiple functions together.
 *
 * @param fns - Functions to compose (right-to-left)
 * @returns Composed function
 *
 * @example
 * ```typescript
 * const process = compose(
 *   (s: string) => s.toUpperCase(),
 *   (s: string) => s.trim()
 * );
 * process("  hello  ") // "HELLO"
 * ```
 */
export function compose(...fns: Array<(x: any) => any>): (x: any) => any {
  return (input: any) => {
    return fns.reduceRight((acc, fn) => fn(acc), input);
  };
}

/**
 * Assert that a condition is true, throwing an error if not.
 *
 * @param condition - The condition to check
 * @param message - Error message if condition is false
 * @throws Error if condition is falsy
 *
 * @example
 * ```typescript
 * assert(user !== null, "User not found");
 * // TypeScript will narrow user to non-null here
 * ```
 */
export function assert(condition: any, message: string = "Assertion failed"): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Check if a value is a Promise.
 *
 * @param value - Value to check
 * @returns true if the value is a Promise
 */
export function isPromise(value: any): value is Promise<any> {
  return value && typeof value.then === "function";
}

/**
 * Type guard for checking if a value is defined (not null or undefined).
 *
 * @param value - Value to check
 * @returns true if value is defined
 *
 * @example
 * ```typescript
 * const items = [1, null, 3, undefined, 5];
 * const defined = items.filter(isDefined); // [1, 3, 5]
 * ```
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
