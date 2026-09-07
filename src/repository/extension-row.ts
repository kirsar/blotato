// The sparse row shape for a 1:1 "extension" table (5.storage.md, "Post extensions:
// sparse, shared PK"). TExtension carries the full merged entity for code/API
// convenience (e.g. InstagramPost extends Post), but only its own id plus whatever
// fields it adds over TEntity actually belong to the extension table — this computes
// that as a diff instead of hand-declaring it, so it can't silently drift if
// TExtension's shape changes.
// `id` is intersected back explicitly rather than relied on to survive the Omit —
// TypeScript can't resolve Omit/Exclude far enough over still-generic TEntity/
// TExtension to prove a specific key remains, but a concrete intersection like
// `{ id: string } & ...` is always provable regardless of what the generics resolve
// to. This is what lets consumers read `.id` off an ExtensionRow<TEntity, TExtension>
// with no cast, even inside another generic function.
export type ExtensionRow<TEntity extends { id: string }, TExtension extends TEntity> = { id: string } & Omit<
  TExtension,
  keyof TEntity
>;
