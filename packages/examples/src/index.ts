/**
 * @packageDocumentation
 *
 * Example package demonstrating apiref's documentation generation features.
 *
 * This package showcases:
 * - Multi-signature methods and functions
 * - Generic types and constraints
 * - Mapped types with readonly and optional modifiers
 * - Classes with various member types
 * - Interfaces and type aliases
 * - Enums and deeply nested namespaces
 * - Re-exported modules as namespaces
 */

// Re-export modules as namespaces
export * as UI from "./namespaces";
export * as Auth from "./plugins";

/**
 * Generic result type that can hold either a success value or an error.
 *
 * @template T - The type of the successful value
 * @template E - The type of the error (defaults to string)
 */
export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

/**
 * Represents a cached value with metadata.
 *
 * @template T - The type of the cached data
 */
export interface CacheEntry<T> {
  /** The cached value */
  data: T;
  /** When this entry was cached (milliseconds since epoch) */
  timestamp: number;
  /** Optional time-to-live in milliseconds */
  ttl?: number;
}

/**
 * A simple in-memory cache with generic support and multiple access patterns.
 *
 * @template K - The type of cache keys
 * @template V - The type of cached values
 *
 * @example
 * ```typescript
 * const cache = new Cache<string, number>();
 * cache.set("answer", 42);
 * console.log(cache.get("answer")); // 42
 * ```
 */
export class Cache<K extends string | number, V> {
  private store = new Map<K, CacheEntry<V>>();

  /**
   * Get a value from the cache.
   *
   * @param key - The cache key
   * @returns The cached value, or undefined if not found or expired
   *
   * @example
   * ```typescript
   * const value = cache.get("myKey");
   * ```
   */
  get(key: K): V | undefined;

  /**
   * Get a value with a fallback factory function.
   *
   * @param key - The cache key
   * @param factory - Function to generate value if not cached
   * @returns The cached value, or generated value from factory
   *
   * @example
   * ```typescript
   * const value = cache.get("myKey", () => expensiveComputation());
   * ```
   */
  get<F extends () => V>(key: K, factory: F): V;

  get<F extends () => V>(key: K, factory?: F): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return factory?.();

    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      return factory?.();
    }

    return entry.data;
  }

  /**
   * Set a value in the cache.
   *
   * @param key - The cache key
   * @param value - The value to cache
   * @param ttl - Optional time-to-live in milliseconds
   */
  set(key: K, value: V, ttl?: number): void {
    this.store.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Clear all expired entries from the cache.
   *
   * @returns Number of entries removed
   */
  cleanup(): number {
    let removed = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
        this.store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  /**
   * @deprecated Use {@link cleanup} instead
   * Clear the entire cache.
   */
  clear(): void {
    this.store.clear();
  }
}

/**
 * Options for data processing.
 */
export interface ProcessOptions {
  /** Whether to cache intermediate results */
  cache?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Optional batch size for processing */
  batchSize?: number;
}

/**
 * A generic data processor with multiple execution modes.
 *
 * @template T - The input data type
 * @template R - The output/result type
 */
export class DataProcessor<T, R> {
  /**
   * Process data synchronously.
   *
   * @param data - The input data
   * @returns The processed result
   */
  process(data: T): R;

  /**
   * Process data asynchronously.
   *
   * @param data - The input data
   * @param options - Processing options
   * @returns Promise resolving to the processed result
   */
  process(data: T, options: ProcessOptions): Promise<R>;

  /**
   * Process multiple items in a batch.
   *
   * @param items - Array of items to process
   * @param options - Processing options with batch flag
   * @returns Promise resolving to array of results
   */
  process(items: T[], options: ProcessOptions & { batch: true }): Promise<R[]>;

  process(data: T | T[], options?: ProcessOptions & { batch?: boolean }): any {
    if (options && (options.timeout !== undefined || options.cache)) {
      if (Array.isArray(data)) {
        return Promise.resolve(data.map(() => ({}) as R));
      }
      return Promise.resolve({} as R);
    }

    if (!Array.isArray(data)) {
      return {} as R;
    }

    // Array case without async options - shouldn't reach here based on overloads
    return Promise.resolve(data.map(() => ({}) as R));
  }
}

/**
 * A builder pattern implementation with fluent interface.
 *
 * @template T - The type being built
 *
 * @example
 * ```typescript
 * const obj = new Builder<MyObject>()
 *   .with("name", "John")
 *   .with("age", 30)
 *   .build();
 * ```
 */
export class Builder<T extends Record<string, any>> {
  private data: Partial<T> = {};

  /**
   * Set a property value.
   *
   * @param key - The property name
   * @param value - The property value
   * @returns This builder instance for chaining
   */
  with<K extends keyof T>(key: K, value: T[K]): this {
    this.data[key] = value;
    return this;
  }

  /**
   * Build the final object.
   *
   * @returns The constructed object
   */
  build(): T {
    return this.data as T;
  }
}

/**
 * Type representing different error categories.
 */
export enum ErrorCategory {
  /** Validation or input error */
  Validation = "validation",
  /** Authentication or authorization failure */
  Auth = "auth",
  /** Network or connectivity issue */
  Network = "network",
  /** Internal server error */
  Internal = "internal",
}

/**
 * A custom error class with categorization.
 */
export class ApiError extends Error {
  /**
   * Create an API error.
   *
   * @param message - Error message
   * @param category - The error category
   * @param code - Optional error code for machine readability
   */
  constructor(
    message: string,
    readonly category: ErrorCategory,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Parse a value that could be a string, number, or object.
 *
 * A utility function with multiple signatures for flexible usage.
 *
 * @param value - Value to parse
 * @returns Parsed result
 *
 * @example
 * ```typescript
 * parse("123") // returns 123
 * parse(456) // returns 456
 * parse({ value: 789 }) // returns 789
 * ```
 */
export function parse(value: string): number;
export function parse(value: number): number;
export function parse(value: { value: number }): number;
export function parse(value: string | number | { value: number }): number {
  if (typeof value === "string") return parseInt(value, 10);
  if (typeof value === "number") return value;
  return (value as { value: number }).value;
}

/**
 * Async version of parse with result wrapper.
 *
 * @param value - Value to parse
 * @returns Promise resolving to result or error
 */
export async function parseAsync(value: string): Promise<Result<number>>;
export async function parseAsync(value: number): Promise<Result<number>>;
export async function parseAsync(value: string | number): Promise<Result<number>> {
  try {
    const num = parse(value as any);
    return { ok: true, value: num };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * Merge multiple objects with generic type support.
 *
 * @template T - The object type to merge
 * @param objects - Objects to merge
 * @returns Merged object
 */
export function merge<T extends Record<string, any>>(...objects: T[]): T {
  return Object.assign({}, ...objects);
}

/**
 * Create a tuple type constraint helper.
 *
 * @template T - Must be a tuple type
 */
export function createTuple<T extends readonly any[]>(items: T): T {
  return items;
}

// -----------------------------------------------------------------------
// Multi-natured exports
// -----------------------------------------------------------------------

/**
 * Default validation function.
 *
 * @param value - Value to validate
 * @returns true if valid
 */
function createValidator(pattern: RegExp): (/** Value to test */ value: string) => boolean {
  return (value) => pattern.test(value);
}

/**
 * Email validator function with configurable patterns namespace.
 *
 * Can be used as a function: `validator.isEmail("test@example.com")`
 * Or configured via namespace: `validator.patterns.strict`
 */
export namespace Validator {
  /** Common validation patterns */
  export namespace patterns {
    /** Strict email pattern */
    export const strictEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    /** Relaxed email pattern */
    export const relaxedEmail = /^.+@.+\..+$/;
    /** URL pattern */
    export const url = /^https?:\/\/.+/;
  }

  /** Default email validator */
  export const isEmail = createValidator(patterns.strictEmail);

  /** Default URL validator */
  export const isUrl = createValidator(patterns.url);
}

/**
 * Event emitter factory with associated namespace for event types.
 *
 * Can be used as a function: `createEmitter<MyEvents>()`
 * Or typed via namespace: `Emitter.EventMap`
 */
export function createEmitter<T extends Record<string, any>>(): {
  on<K extends keyof T>(event: K, listener: (data: T[K]) => void): void;
  emit<K extends keyof T>(event: K, data: T[K]): void;
} {
  const listeners = new Map<string, Set<(data: any) => void>>();

  return {
    on(event, listener) {
      if (!listeners.has(String(event))) {
        listeners.set(String(event), new Set());
      }
      listeners.get(String(event))!.add(listener);
    },
    emit(event, data) {
      listeners.get(String(event))?.forEach((fn) => fn(data));
    },
  };
}

/**
 * Namespace containing emitter-related types and utilities.
 */
export namespace createEmitter {
  /** Base event map interface for type-safe event emitters */
  export interface EventMap {
    [key: string]: any;
  }

  /** Options for creating an emitter */
  export interface Options {
    /** Maximum number of listeners before warning */
    maxListeners?: number;
  }
}

/**
 * Configuration object that also serves as a type template.
 *
 * Can be used as a value: `defaultConfig`
 * Or as a type template: `type Config = typeof defaultConfig`
 */
export const defaultConfig = {
  timeout: 5000,
  retries: 3,
  cache: true,
  debug: false,
} as const;

/** Type derived from the default config */
export type AppConfig = typeof defaultConfig;

/**
 * Makes every property readonly and required.
 *
 * @template T - Source object type
 */
export type StrictReadonly<T> = {
  +readonly [Key in keyof T]-?: T[Key];
};

/**
 * Maps each property to an optional change handler.
 *
 * @template T - Source object type
 */
export type ChangeHandlers<T> = {
  [Key in keyof T]?: (value: T[Key]) => void;
};

export const Something = 123;
export type Something = number;

// -----------------------------------------------------------------------
// Additional type variants for comprehensive documentation
// -----------------------------------------------------------------------

/**
 * Type predicate function that narrows a value to a specific type.
 *
 * @param value - Value to check
 * @returns true if value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Type predicate for checking if a value is a number.
 *
 * @param value - Value to check
 * @returns true if value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === "number";
}

/**
 * Template literal type for SQL queries.
 *
 * Represents SQL query strings with parameterized variables.
 */
export type SqlQuery = `SELECT ${string} FROM ${string}`;

/**
 * Template literal type for URL paths.
 *
 * Represents valid URL paths starting with a slash.
 */
export type UrlPath = `/${string}`;

/**
 * Tuple with named members - demonstrates tuple element naming.
 *
 * @example
 * ```typescript
 * const response: HttpResponse = [200, { ok: true }, "Success"];
 * ```
 */
export type HttpResponse = [statusCode: number, data: Record<string, any>, message: string];

/**
 * REST parameter tuple type - variable length parameter list.
 *
 * @param args - Variable number of arguments
 * @returns Combined string
 */
export function joinStrings(...args: string[]): string {
  return args.join(" ");
}

/**
 * Optional tuple member demonstrating partial tuple constraints.
 */
export type OptionalTuple = [required: string, optional?: number];

/**
 * Process a tuple with optional trailing elements.
 *
 * @param data - Tuple with required and optional elements
 * @returns Processed result
 */
export function processTuple(data: OptionalTuple): string {
  const [required, optional] = data;
  return optional ? `${required}: ${optional}` : required;
}

export default Cache;
