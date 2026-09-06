import type { PlatformId } from '@platforms/platform-id';
import type { Comment } from '@domain/comment';

export interface CommentListFilter {
  parentCommentId?: string | null;
  since?: Date;
  until?: Date;
  cursor?: string | null;
  limit?: number;
}

export interface CommentListResult {
  items: Comment[];
  cursor: string | null;
}

export interface CommentRepository {
  create(comment: Comment): Promise<Comment>;
  findById(id: string): Promise<Comment | null>;
  update(id: string, patch: Partial<Comment>): Promise<Comment>;
  findByIdempotencyKey(userId: string, key: string): Promise<Comment | null>;
  findByPlatformCommentId(
    userId: string,
    platform: PlatformId,
    platformCommentId: string,
  ): Promise<Comment | null>;
  // Upsert keyed by (userId, platform, platformCommentId) — makes re-ingesting our
  // own reply idempotent (3.social-media-integration.md, "Known gap: platform writes
  // are not idempotent").
  upsertInbound(comment: Comment): Promise<Comment>;
  listByPostId(postId: string, filter: CommentListFilter): Promise<CommentListResult>;
  listByCompositionId(compositionId: string, filter: CommentListFilter): Promise<CommentListResult>;
  // The generator's claim query: inbound comments on this post still owing a reply.
  findAwaitingReply(postId: string): Promise<Comment[]>;
  // The publisher's claim query: outbound replies on this post ready to deliver.
  findQueuedReplies(postId: string): Promise<Comment[]>;
}
