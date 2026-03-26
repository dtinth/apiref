# @apiref-examples/core

Example package demonstrating apiref's documentation generation features.

This package showcases:

- **Multi-signature methods and functions** — Methods and functions with multiple overloads/call signatures
- **Generic types and constraints** — Generics with extends clauses, type parameters, and defaults
- **Classes with various member types** — Methods, properties, constructors, static members, abstract classes
- **Interfaces and type aliases** — Complex type definitions and unions
- **Enums and namespaces** — Categorized constants and module organization
- **Decorators and metadata** — JSDoc/TSDoc comments, tags, and examples
- **Fluent APIs** — Builder patterns and method chaining
- **Error handling** — Custom error types and exception handling
- **Async patterns** — Promises, async/await, and callback patterns

## Building

Generate TypeDoc JSON:

```bash
vp dlx typedoc
```

Render documentation:

```bash
vp run render
```

## Modules

### Core (`index.ts`)

Generic utilities and foundational types:
- `Cache<K, V>` — Multi-signature generic cache with fallback factory
- `DataProcessor<T, R>` — Generic data processor with sync/async overloads
- `Builder<T>` — Fluent builder pattern
- `parse()` / `parseAsync()` — Functions with multiple signatures
- `Result<T, E>` — Generic result type

### Data (`data.ts`)

Data access and repository patterns:
- `Repository<T, ID>` — Abstract repository with CRUD operations
- `QueryBuilder<T>` — Fluent database query builder with multiple `orderBy` signatures
- `EventEmitter<Events>` — Generic event system
- Pagination and filtering utilities

### Utils (`utils.ts`)

Functional utilities:
- `debounce<T>()` — Function debouncing
- `throttle<T>()` — Call throttling
- `retry<T>()` — Exponential backoff retry
- `deepMerge<T>()` — Recursive object merging
- `memoize<T>()` — Function memoization
- `groupBy<T, K>()` — Array grouping
- Type guards: `isDefined()`, `isPromise()`
- Assertion helpers: `assert()`

## Features Demonstrated

### Multi-Signature Methods

Methods like `Cache.get()` and `QueryBuilder.orderBy()` have multiple overloads:

```typescript
// Cache with two signatures
get(key: K): V | undefined;
get<F extends () => V>(key: K, factory: F): V;

// QueryBuilder with single or multiple fields
orderBy(field: keyof T, direction?: "asc" | "desc"): this;
orderBy(fields: (keyof T)[], direction?: "asc" | "desc"): this;
```

### Generic Types with Constraints

Classes and functions use generic constraints:

```typescript
class Cache<K extends string | number, V> { ... }
class Repository<T extends { id: ID }, ID extends string | number> { ... }
function createTuple<T extends readonly any[]>(items: T): T { ... }
```

### Complex Type Definitions

Result types, unions, and conditional types:

```typescript
type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

### Async/Await and Promises

Multiple async patterns:

```typescript
async function retry<T>(
  operation: () => Promise<T>,
  maxAttempts?: number
): Promise<T> { ... }

async function pipe<T>(
  initial: T,
  operations: Array<(value: T) => Promise<T>>
): Promise<T> { ... }
```
