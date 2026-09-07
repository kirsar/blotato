import type { Comment } from '@domain/comment';
import type { Post } from '@domain/post';

export const REPLY_GENERATOR = 'REPLY_GENERATOR';

// Each post paired with its own pending comments — the pipeline has already loaded
// these rows in its claim step, and grouping this way means a post's content is
// paid for once per group rather than once per comment (4.agentic-integration.md,
// "No new types, unlike the platform port").
export type PostComments = [Post, Comment[]];

// Swapping this for a real provider is a token rebinding, exactly like the platform
// repositories — no caller changes.
export interface IReplyGenerator {
  generate(commentsBatch: PostComments[]): Promise<Comment[]>;
}
