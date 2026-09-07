import { describe, expect, it } from 'vitest';
import { CommentStatus, type Comment } from '@domain/comment';
import { PlatformId } from '@domain/platform-id';
import type { Post } from '@domain/post';
import { assertSingleKey, BatchIntegrityError, capBatch, partitionByAccount } from './batching';
import type { PostComments } from './reply-generator.contract';

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post_1',
    compositionId: 'composition_1',
    userId: 'user_1',
    accountId: 'account_1',
    platform: PlatformId.INSTAGRAM,
    platformPostId: 'platform_post_1',
    content: null,
    publishedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'comment_1',
    userId: 'user_1',
    accountId: 'account_1',
    platform: PlatformId.INSTAGRAM,
    postId: 'post_1',
    compositionId: 'composition_1',
    parentCommentId: null,
    platformPostId: 'platform_post_1',
    platformCommentId: 'platform_comment_1',
    platformParentCommentId: null,
    platformAccountId: 'ig_account_1',
    isAuthor: false,
    text: 'hello',
    platformCreatedAt: new Date('2026-01-01T00:00:00.000Z'),
    status: CommentStatus.POSTED,
    errorCode: null,
    errorMessage: null,
    idempotencyKey: null,
    requestHash: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('partitionByAccount', () => {
  it('groups pairs sharing (userId, accountId) into one partition', () => {
    const a1: PostComments = [makePost({ id: 'post_a1' }), [makeComment({ id: 'c1' })]];
    const a2: PostComments = [makePost({ id: 'post_a2' }), [makeComment({ id: 'c2' })]];
    const b1: PostComments = [
      makePost({ id: 'post_b1', accountId: 'account_2' }),
      [makeComment({ id: 'c3', accountId: 'account_2' })],
    ];

    const groups = partitionByAccount([a1, a2, b1]);

    expect(groups).toHaveLength(2);
    const accountOneGroup = groups.find((g) => g[0][0].accountId === 'account_1')!;
    expect(accountOneGroup.map(([post]) => post.id)).toEqual(['post_a1', 'post_a2']);
  });

  it('partitions the same accountId across different users separately', () => {
    const tenantA: PostComments = [makePost({ userId: 'user_1' }), [makeComment({ userId: 'user_1' })]];
    const tenantB: PostComments = [makePost({ userId: 'user_2' }), [makeComment({ userId: 'user_2' })]];

    const groups = partitionByAccount([tenantA, tenantB]);

    expect(groups).toHaveLength(2);
  });
});

describe('assertSingleKey — the cross-tenant guard', () => {
  it('passes when every post and comment shares one (userId, accountId)', () => {
    const batch: PostComments[] = [[makePost(), [makeComment(), makeComment({ id: 'c2' })]]];
    expect(() => assertSingleKey(batch)).not.toThrow();
  });

  it('throws BatchIntegrityError when a second post has a different accountId', () => {
    const batch: PostComments[] = [
      [makePost(), [makeComment()]],
      [
        makePost({ id: 'post_2', accountId: 'account_2' }),
        [makeComment({ id: 'c2', accountId: 'account_2' })],
      ],
    ];
    expect(() => assertSingleKey(batch)).toThrow(BatchIntegrityError);
  });

  it('throws when a comment disagrees with its own post — the denormalization check', () => {
    // Comment.userId/accountId are denormalized; this is the one place a mismatch
    // against the post's own values would matter (4.agentic-integration.md).
    const batch: PostComments[] = [[makePost(), [makeComment({ accountId: 'account_2' })]]];
    expect(() => assertSingleKey(batch)).toThrow(BatchIntegrityError);
  });

  it('throws when a different user shares the same accountId string', () => {
    const batch: PostComments[] = [
      [makePost({ userId: 'user_1' }), [makeComment({ userId: 'user_1' })]],
      [makePost({ id: 'post_2', userId: 'user_2' }), [makeComment({ id: 'c2', userId: 'user_2' })]],
    ];
    expect(() => assertSingleKey(batch)).toThrow(BatchIntegrityError);
  });

  it('does nothing on an empty batch', () => {
    expect(() => assertSingleKey([])).not.toThrow();
  });
});

describe('capBatch', () => {
  it('keeps every comment when well under the output budget', () => {
    const batch: PostComments[] = [[makePost(), [makeComment(), makeComment({ id: 'c2' })]]];
    const capped = capBatch(batch);
    expect(capped[0][1]).toHaveLength(2);
  });

  it('caps by platform maxCommentLength — Instagram (2200, smaller) fits more than YouTube (10000, larger)', () => {
    // The cap is floor(outputBudget / maxCommentLength) — a smaller maxCommentLength
    // means each comment "costs" less of the budget, so more of them fit.
    const manyComments = Array.from({ length: 50 }, (_, i) => makeComment({ id: `c${i}` }));
    const igBatch: PostComments[] = [[makePost({ platform: PlatformId.INSTAGRAM }), manyComments]];
    const ytBatch: PostComments[] = [
      [
        makePost({ platform: PlatformId.YOUTUBE }),
        manyComments.map((c) => ({ ...c, platform: PlatformId.YOUTUBE })),
      ],
    ];

    const igCapped = capBatch(igBatch);
    const ytCapped = capBatch(ytBatch);

    expect(igCapped[0][1].length).toBeGreaterThan(ytCapped[0][1].length);
  });

  it('spreads the cap across multiple posts, dropping later posts once exhausted', () => {
    const manyComments = Array.from({ length: 20 }, (_, i) => makeComment({ id: `p1_c${i}` }));
    const batch: PostComments[] = [
      [makePost({ id: 'post_1' }), manyComments],
      [makePost({ id: 'post_2' }), [makeComment({ id: 'p2_c0' })]],
    ];

    const capped = capBatch(batch);
    const totalKept = capped.reduce((sum, [, comments]) => sum + comments.length, 0);

    // Instagram's 2200-char cap over a 20000-char budget allows 9 comments total.
    expect(totalKept).toBe(9);
    expect(capped).toHaveLength(1);
  });

  it('returns nothing for an empty batch', () => {
    expect(capBatch([])).toEqual([]);
  });
});
