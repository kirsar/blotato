import { Injectable } from '@nestjs/common';
import type { PlatformId } from '@domain/platform-id';
import { type Comment, CommentStatus } from '@domain/comment';
import type {
  CommentListFilter,
  CommentListResult,
  CommentRepository,
} from '@repository/comment.repository.contract';
import { InMemoryRepository, type UniqueKeySpec } from './in-memory-repository';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

// Partial uniques — both keyOf functions return null when the constraint doesn't
// apply, which is the in-memory analog of Postgres's `WHERE x IS NOT NULL` partial
// index (5.storage.md).
const uniquePlatformComment: UniqueKeySpec<Comment> = {
  name: 'userId_platform_platformCommentId',
  keyOf: (c) => (c.platformCommentId ? `${c.userId}::${c.platform}::${c.platformCommentId}` : null),
};

const uniqueIdempotency: UniqueKeySpec<Comment> = {
  name: 'userId_idempotencyKey',
  keyOf: (c) => (c.idempotencyKey ? `${c.userId}::${c.idempotencyKey}` : null),
};

function encodeCursor(comment: Comment): string {
  const payload = JSON.stringify({ t: comment.platformCreatedAt.toISOString(), id: comment.id });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { t: string; id: string } {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
}

@Injectable()
export class InMemoryCommentRepository extends InMemoryRepository<Comment> implements CommentRepository {
  constructor() {
    super((c) => c.id, [uniquePlatformComment, uniqueIdempotency]);
  }

  async create(comment: Comment): Promise<Comment> {
    return this.insert(comment);
  }

  async findById(id: string): Promise<Comment | null> {
    return super.findById(id);
  }

  async update(id: string, patch: Partial<Comment>): Promise<Comment> {
    return super.update(id, patch);
  }

  async findByIdempotencyKey(userId: string, key: string): Promise<Comment | null> {
    return this.findByUniqueKey('userId_idempotencyKey', `${userId}::${key}`);
  }

  async findByPlatformCommentId(
    userId: string,
    platform: PlatformId,
    platformCommentId: string,
  ): Promise<Comment | null> {
    return this.findByUniqueKey(
      'userId_platform_platformCommentId',
      `${userId}::${platform}::${platformCommentId}`,
    );
  }

  async upsertInbound(comment: Comment): Promise<Comment> {
    if (!comment.platformCommentId) {
      throw new Error('upsertInbound requires platformCommentId');
    }
    const existing = await this.findByPlatformCommentId(
      comment.userId,
      comment.platform,
      comment.platformCommentId,
    );
    return existing ? this.update(existing.id, comment) : this.create(comment);
  }

  async listByPostId(postId: string, filter: CommentListFilter): Promise<CommentListResult> {
    return this.paginate(
      this.all().filter((c) => c.postId === postId),
      filter,
    );
  }

  async listByCompositionId(compositionId: string, filter: CommentListFilter): Promise<CommentListResult> {
    return this.paginate(
      this.all().filter((c) => c.compositionId === compositionId),
      filter,
    );
  }

  async findAwaitingReply(postId: string): Promise<Comment[]> {
    const onPost = this.all().filter((c) => c.postId === postId);
    const alreadyRepliedTo = new Set(
      onPost.filter((c) => c.isAuthor && c.parentCommentId).map((c) => c.parentCommentId),
    );
    return onPost.filter(
      (c) => !c.isAuthor && c.status === CommentStatus.POSTED && !alreadyRepliedTo.has(c.id),
    );
  }

  async findQueuedReplies(postId: string): Promise<Comment[]> {
    return this.all().filter((c) => c.postId === postId && c.isAuthor && c.status === CommentStatus.QUEUED);
  }

  private paginate(items: Comment[], filter: CommentListFilter): CommentListResult {
    let filtered = items;
    if (filter.parentCommentId !== undefined) {
      filtered = filtered.filter((c) => c.parentCommentId === filter.parentCommentId);
    }
    if (filter.since) {
      filtered = filtered.filter((c) => c.platformCreatedAt >= filter.since!);
    }
    if (filter.until) {
      filtered = filtered.filter((c) => c.platformCreatedAt <= filter.until!);
    }
    if (filter.platform) {
      filtered = filtered.filter((c) => c.platform === filter.platform);
    }
    if (filter.accountId) {
      filtered = filtered.filter((c) => c.accountId === filter.accountId);
    }

    filtered.sort(
      (a, b) => a.platformCreatedAt.getTime() - b.platformCreatedAt.getTime() || a.id.localeCompare(b.id),
    );

    if (filter.cursor) {
      const { t, id } = decodeCursor(filter.cursor);
      filtered = filtered.filter(
        (c) =>
          c.platformCreatedAt.getTime() > new Date(t).getTime() ||
          (c.platformCreatedAt.toISOString() === t && c.id > id),
      );
    }

    const limit = Math.min(filter.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const page = filtered.slice(0, limit);
    const cursor = filtered.length > limit ? encodeCursor(page[page.length - 1]) : null;
    return { items: page, cursor };
  }
}
