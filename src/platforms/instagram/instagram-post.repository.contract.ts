import type { Post } from '@domain/post';
import type { ExtensionRow } from '@repository/extension-row';
import type { InstagramPost } from './instagram-post';

export const INSTAGRAM_POST_REPOSITORY = 'INSTAGRAM_POST_REPOSITORY';

export type InstagramPostRow = ExtensionRow<Post, InstagramPost>;

export interface InstagramPostRepository {
  create(row: InstagramPostRow): Promise<InstagramPostRow>;
  findById(id: string): Promise<InstagramPostRow | null>;
}
