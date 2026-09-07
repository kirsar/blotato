export class UniqueConstraintViolationError extends Error {
  constructor(public readonly keyName: string) {
    super(`Unique constraint violated: ${keyName}`);
    this.name = 'UniqueConstraintViolationError';
  }
}

export interface UniqueKeySpec<T> {
  name: string;
  // Returning null means the constraint does not apply to this row — the analog of
  // a partial unique index (e.g. Comment's idempotencyKey uniqueness only applies
  // when a key was actually supplied).
  keyOf: (entity: T) => string | null;
}

/**
 * The one substantial class in /storage: a primary Map plus declared unique keys
 * backed by secondary maps, and clone-on-read/write so a caller mutating a returned
 * object cannot silently mutate the store (1.overall-architecture.md). Each concrete
 * repository adds only its own query methods on top of this.
 */
export class InMemoryRepository<T> {
  private readonly rows = new Map<string, T>();
  private readonly uniqueIndexes = new Map<string, Map<string, string>>();

  constructor(
    private readonly idOf: (entity: T) => string,
    private readonly uniqueKeys: UniqueKeySpec<T>[] = [],
  ) {
    for (const spec of uniqueKeys) {
      this.uniqueIndexes.set(spec.name, new Map());
    }
  }

  private clone(entity: T): T {
    return { ...entity };
  }

  protected async insert(entity: T): Promise<T> {
    const id = this.idOf(entity);
    if (this.rows.has(id)) {
      throw new UniqueConstraintViolationError('id');
    }
    this.assertUnique(entity);
    const stored = this.clone(entity);
    this.rows.set(id, stored);
    this.indexUnique(stored);
    return this.clone(stored);
  }

  protected async update(id: string, patch: Partial<T>): Promise<T> {
    const existing = this.rows.get(id);
    if (!existing) {
      throw new Error(`Not found: ${id}`);
    }
    const updated = { ...existing, ...patch } as T;
    this.deindexUnique(existing);
    try {
      this.assertUnique(updated, id);
    } catch (err) {
      this.indexUnique(existing); // roll back the deindex on a rejected update
      throw err;
    }
    this.rows.set(id, updated);
    this.indexUnique(updated);
    return this.clone(updated);
  }

  protected async findById(id: string): Promise<T | null> {
    const found = this.rows.get(id);
    return found ? this.clone(found) : null;
  }

  protected async delete(id: string): Promise<void> {
    const existing = this.rows.get(id);
    if (!existing) {
      return;
    }
    this.deindexUnique(existing);
    this.rows.delete(id);
  }

  protected all(): T[] {
    return [...this.rows.values()].map((v) => this.clone(v));
  }

  protected findByUniqueKey(name: string, value: string): T | null {
    const index = this.uniqueIndexes.get(name);
    const id = index?.get(value);
    if (!id) {
      return null;
    }
    const found = this.rows.get(id);
    return found ? this.clone(found) : null;
  }

  private assertUnique(entity: T, excludingId?: string): void {
    for (const spec of this.uniqueKeys) {
      const key = spec.keyOf(entity);
      if (key === null) {
        continue;
      }
      const index = this.uniqueIndexes.get(spec.name)!;
      const existingId = index.get(key);
      if (existingId && existingId !== excludingId) {
        throw new UniqueConstraintViolationError(spec.name);
      }
    }
  }

  private indexUnique(entity: T): void {
    for (const spec of this.uniqueKeys) {
      const key = spec.keyOf(entity);
      if (key === null) {
        continue;
      }
      this.uniqueIndexes.get(spec.name)!.set(key, this.idOf(entity));
    }
  }

  private deindexUnique(entity: T): void {
    for (const spec of this.uniqueKeys) {
      const key = spec.keyOf(entity);
      if (key === null) {
        continue;
      }
      this.uniqueIndexes.get(spec.name)!.delete(key);
    }
  }
}
