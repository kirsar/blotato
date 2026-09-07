import type { Post } from '@domain/post';
import type { ExtensionRow } from '@repository/extension-row';
import type { YouTubePost } from './youtube-post';

export const YOUTUBE_POST_REPOSITORY = 'YOUTUBE_POST_REPOSITORY';

export type YouTubePostRow = ExtensionRow<Post, YouTubePost>;

export interface YouTubePostRepository {
  create(row: YouTubePostRow): Promise<YouTubePostRow>;
  findById(postId: string): Promise<YouTubePostRow | null>;
}
