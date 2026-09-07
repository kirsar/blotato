import type { Post } from '@domain/post';
import type { ExtensionRepository } from '@repository/extension-repository.contract';
import type { ExtensionRow } from '@repository/extension-row';
import type { InstagramPost } from './instagram-post';

export const INSTAGRAM_POST_REPOSITORY = 'INSTAGRAM_POST_REPOSITORY';

export type InstagramPostRow = ExtensionRow<Post, InstagramPost>;

export type InstagramPostRepository = ExtensionRepository<Post, InstagramPost>;
