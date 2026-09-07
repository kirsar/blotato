import { InMemoryRepository } from './in-memory-repository';
import type { ExtensionRow } from '@repository/extension-row';

// Base for a 1:1 "extension" table repository (e.g. InstagramPost, YouTubePost) —
// keyed by the same id as the entity it extends, storing only the sparse row
// (ExtensionRow) rather than the full merged type.
export class InMemoryExtensionRepository<
  TEntity extends { id: string },
  TExtension extends TEntity,
> extends InMemoryRepository<ExtensionRow<TEntity, TExtension>> {
  constructor() {
    super((row) => row.id);
  }

  async create(row: ExtensionRow<TEntity, TExtension>): Promise<ExtensionRow<TEntity, TExtension>> {
    return this.insert(row);
  }

  async findById(id: string): Promise<ExtensionRow<TEntity, TExtension> | null> {
    return super.findById(id);
  }
}
