/**
 * Data structures and utilities for working with structured information.
 *
 * @module data
 */

/**
 * Pagination metadata for list responses.
 */
export interface PaginationInfo {
  /** Current page number (1-indexed) */
  page: number;
  /** Total number of pages */
  pageCount: number;
  /** Total number of items */
  total: number;
}

/**
 * A paginated list response.
 *
 * @template T - The type of items in the list
 */
export interface PaginatedResponse<T> {
  /** Array of items */
  items: T[];
  /** Pagination metadata */
  pagination: PaginationInfo;
}

/**
 * Generic repository for CRUD operations.
 *
 * @template T - The entity type
 * @template ID - The identifier type (string or number)
 */
export abstract class Repository<T extends { id: ID }, ID extends string | number> {
  /**
   * Find an entity by ID.
   *
   * @param id - The entity ID
   * @returns The entity, or null if not found
   */
  abstract find(id: ID): Promise<T | null>;

  /**
   * Find all entities.
   *
   * @returns Array of all entities
   *
   * @deprecated Use {@link findPaginated} for large datasets
   */
  abstract findAll(): Promise<T[]>;

  /**
   * Find entities with pagination.
   *
   * @param page - Page number (1-indexed)
   * @param pageSize - Number of items per page
   * @returns Paginated response
   */
  abstract findPaginated(page: number, pageSize: number): Promise<PaginatedResponse<T>>;

  /**
   * Create a new entity.
   *
   * @param data - Entity data (without ID)
   * @returns The created entity
   */
  abstract create(data: Omit<T, "id">): Promise<T>;

  /**
   * Update an entity.
   *
   * @param id - Entity ID
   * @param updates - Partial entity data to update
   * @returns The updated entity, or null if not found
   */
  abstract update(id: ID, updates: Partial<Omit<T, "id">>): Promise<T | null>;

  /**
   * Delete an entity.
   *
   * @param id - Entity ID
   * @returns true if deleted, false if not found
   */
  abstract delete(id: ID): Promise<boolean>;
}

/**
 * User entity.
 */
export interface User {
  id: string;
  /** User's display name */
  name: string;
  /** User's email address */
  email: string;
  /** Account creation timestamp */
  createdAt: Date;
  /** Whether the account is active */
  isActive: boolean;
  /** Optional profile metadata */
  metadata?: Record<string, unknown>;
}

/**
 * User repository implementation.
 */
export class UserRepository extends Repository<User, string> {
  async find(_id: string): Promise<User | null> {
    return null;
  }

  async findAll(): Promise<User[]> {
    return [];
  }

  async findPaginated(page: number, _pageSize: number): Promise<PaginatedResponse<User>> {
    return {
      items: [],
      pagination: { page, pageCount: 0, total: 0 },
    };
  }

  async create(data: Omit<User, "id">): Promise<User> {
    return { id: "1", ...data };
  }

  async update(_id: string, _updates: Partial<Omit<User, "id">>): Promise<User | null> {
    return null;
  }

  async delete(_id: string): Promise<boolean> {
    return false;
  }
}

/**
 * Options for filtering data.
 *
 * @template T - The type being filtered
 */
export interface FilterOptions<T> {
  /** Fields to filter on */
  where?: Partial<T>;
  /** Fields to sort by */
  orderBy?: keyof T | (keyof T)[];
  /** Sort direction */
  order?: "asc" | "desc";
  /** Number of results to skip */
  skip?: number;
  /** Maximum number of results */
  take?: number;
}

/**
 * Database query builder with fluent interface.
 *
 * @template T - The entity type
 */
export class QueryBuilder<T> {
  private filters: Partial<FilterOptions<T>> = {};

  /**
   * Add a WHERE clause filter.
   *
   * @param condition - Partial object with filter conditions
   * @returns This builder for chaining
   */
  where(condition: Partial<T>): this {
    this.filters.where = condition;
    return this;
  }

  /**
   * Specify ORDER BY with direction.
   *
   * @param field - Single field to order by
   * @param direction - Sort direction
   * @returns This builder for chaining
   */
  orderBy(field: keyof T, direction?: "asc" | "desc"): this;

  /**
   * Specify ORDER BY with multiple fields.
   *
   * @param fields - Array of fields to order by
   * @param direction - Sort direction
   * @returns This builder for chaining
   */
  orderBy(fields: (keyof T)[], direction?: "asc" | "desc"): this;

  orderBy(field: keyof T | (keyof T)[], direction: "asc" | "desc" = "asc"): this {
    this.filters.orderBy = field;
    this.filters.order = direction;
    return this;
  }

  /**
   * Pagination: skip N results.
   *
   * @param count - Number of results to skip
   * @returns This builder for chaining
   */
  skip(count: number): this {
    this.filters.skip = count;
    return this;
  }

  /**
   * Pagination: limit to N results.
   *
   * @param count - Maximum results to return
   * @returns This builder for chaining
   */
  take(count: number): this {
    this.filters.take = count;
    return this;
  }

  /**
   * Execute the query.
   *
   * @returns Promise resolving to matching entities
   */
  async execute(): Promise<T[]> {
    return [];
  }
}

/**
 * Event emitter base class with generic type support.
 *
 * @template Events - Object with event names as keys and payload types as values
 *
 * @example
 * ```typescript
 * interface MyEvents {
 *   'user:created': User;
 *   'user:deleted': { id: string };
 * }
 *
 * const emitter = new EventEmitter<MyEvents>();
 * emitter.on('user:created', (user) => console.log(user.name));
 * emitter.emit('user:created', newUser);
 * ```
 */
export class EventEmitter<Events extends Record<string, any>> {
  private listeners = new Map<string, Set<(payload: any) => void>>();

  /**
   * Register an event listener.
   *
   * @param event - Event name
   * @param listener - Callback function
   * @returns Unsubscribe function
   */
  on<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): () => void {
    if (!this.listeners.has(String(event))) {
      this.listeners.set(String(event), new Set());
    }
    this.listeners.get(String(event))!.add(listener);

    return () => this.off(event, listener);
  }

  /**
   * Register a one-time event listener.
   *
   * @param event - Event name
   * @param listener - Callback function
   * @returns Unsubscribe function
   */
  once<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): () => void {
    const wrapper = (payload: Events[K]) => {
      listener(payload);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  /**
   * Unregister an event listener.
   *
   * @param event - Event name
   * @param listener - Callback to remove
   */
  off<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): void {
    this.listeners.get(String(event))?.delete(listener);
  }

  /**
   * Emit an event to all listeners.
   *
   * @param event - Event name
   * @param payload - Event payload
   */
  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    this.listeners.get(String(event))?.forEach((listener) => listener(payload));
  }
}
