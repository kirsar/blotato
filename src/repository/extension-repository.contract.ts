import { ExtensionRow } from './extension-row';

// BasePostDtoConverter's own `repository` field is typed against it directly.
export interface ExtensionRepository<TEntity extends { id: string }, TExtension extends TEntity> {
  create(row: ExtensionRow<TEntity, TExtension>): Promise<ExtensionRow<TEntity, TExtension>>;
  findById(id: string): Promise<ExtensionRow<TEntity, TExtension> | null>;
}
