// The shape every extension-table repository has in common — keyed and stored by
// the same sparse row it accepts (ExtensionRow<TEntity, TExtension>, computed in
// extension-row.ts). InstagramPostRepository/YouTubePostRepository each extend this
// with their own TRow instead of redeclaring the same two methods, and
// BasePostDtoConverter's own `repository` field is typed against it directly.
export interface ExtensionRepository<TRow> {
  create(row: TRow): Promise<TRow>;
  findById(id: string): Promise<TRow | null>;
}
