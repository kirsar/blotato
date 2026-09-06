import { describe, expect, it } from 'vitest';
import { CommentStatus, type Comment } from '@domain/comment';
import { PlatformId } from '@platforms/platform-id';
import { InMemoryCommentRepository } from '@storage/in-memory/comment.repository';
import { InMemoryPostScheduleRepository } from '@storage/in-memory/post-schedule.repository';
import { UniqueConstraintViolationError } from '@storage/in-memory/in-memory-repository';

let counter = 0;
function makeComment(overrides: Partial<Comment> = {}): Comment {
  counter += 1;
  return {
    id: `comment_${counter}`,
    userId: 'user_1',
    accountId: 'account_1',
    platform: PlatformId.INSTAGRAM,
    postId: 'post_1',
    compositionId: 'composition_1',
    parentCommentId: null,
    platformPostId: 'ig_post_1',
    platformCommentId: null,
    platformParentCommentId: null,
    platformAccountId: 'ig_author_1',
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

describe('InMemoryCommentRepository — idempotency uniqueness', () => {
  it('rejects a second insert with the same (userId, idempotencyKey) but a different id', async () => {
    const repo = new InMemoryCommentRepository();
    await repo.create(makeComment({ idempotencyKey: 'key-1', isAuthor: true }));

    await expect(
      repo.create(makeComment({ idempotencyKey: 'key-1', isAuthor: true })),
    ).rejects.toBeInstanceOf(UniqueConstraintViolationError);
  });

  it('allows the same idempotencyKey across different users', async () => {
    const repo = new InMemoryCommentRepository();
    await repo.create(makeComment({ userId: 'user_1', idempotencyKey: 'key-1' }));
    await expect(
      repo.create(makeComment({ userId: 'user_2', idempotencyKey: 'key-1' })),
    ).resolves.toBeTruthy();
  });

  it('never enforces the constraint when idempotencyKey is null (the partial-index analog)', async () => {
    const repo = new InMemoryCommentRepository();
    await repo.create(makeComment({ idempotencyKey: null }));
    await expect(repo.create(makeComment({ idempotencyKey: null }))).resolves.toBeTruthy();
  });
});

describe('InMemoryCommentRepository — platform-comment uniqueness (re-ingest is an upsert)', () => {
  it('upsertInbound updates the existing row instead of duplicating it', async () => {
    const repo = new InMemoryCommentRepository();
    const first = await repo.create(
      makeComment({ platformCommentId: 'ig_c_1', text: 'first pass' }),
    );

    const second = await repo.upsertInbound({ ...first, text: 'second pass' });

    expect(second.id).toBe(first.id);
    expect(second.text).toBe('second pass');
    expect((await repo.findByPlatformCommentId('user_1', PlatformId.INSTAGRAM, 'ig_c_1'))?.id).toBe(
      first.id,
    );
  });

  it('a direct create() with a conflicting (userId, platform, platformCommentId) is rejected', async () => {
    const repo = new InMemoryCommentRepository();
    await repo.create(makeComment({ platformCommentId: 'ig_c_1' }));
    await expect(repo.create(makeComment({ platformCommentId: 'ig_c_1' }))).rejects.toBeInstanceOf(
      UniqueConstraintViolationError,
    );
  });
});

describe('InMemoryCommentRepository — claim queries', () => {
  it('findAwaitingReply excludes comments that already have a reply', async () => {
    const repo = new InMemoryCommentRepository();
    const inbound = await repo.create(makeComment({ isAuthor: false, status: CommentStatus.POSTED }));
    await repo.create(makeComment({ isAuthor: false, status: CommentStatus.POSTED })); // still owed

    await repo.create(
      makeComment({ isAuthor: true, status: CommentStatus.QUEUED, parentCommentId: inbound.id }),
    );

    const awaiting = await repo.findAwaitingReply('post_1');
    expect(awaiting).toHaveLength(1);
    expect(awaiting[0].id).not.toBe(inbound.id);
  });

  it('findQueuedReplies returns only outbound rows still at QUEUED', async () => {
    const repo = new InMemoryCommentRepository();
    await repo.create(makeComment({ isAuthor: true, status: CommentStatus.QUEUED }));
    await repo.create(makeComment({ isAuthor: true, status: CommentStatus.POSTED }));
    await repo.create(makeComment({ isAuthor: false, status: CommentStatus.POSTED }));

    const queued = await repo.findQueuedReplies('post_1');
    expect(queued).toHaveLength(1);
    expect(queued[0].isAuthor).toBe(true);
    expect(queued[0].status).toBe(CommentStatus.QUEUED);
  });
});

describe('InMemoryPostScheduleRepository — claimDue', () => {
  it('claims only rows that are due and not retired, oldest first', async () => {
    const repo = new InMemoryPostScheduleRepository();
    const base = {
      commentAutomationLevel: null,
      pollIntervalSec: 60,
      emptyPollCount: 0,
      commentVelocity: null,
      cursor: null,
      lastSyncedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    await repo.upsert({
      ...base,
      postId: 'due_later',
      nextPollAfter: new Date('2026-01-01T00:02:00.000Z'),
      retiredAt: null,
    });
    await repo.upsert({
      ...base,
      postId: 'due_earlier',
      nextPollAfter: new Date('2026-01-01T00:01:00.000Z'),
      retiredAt: null,
    });
    await repo.upsert({
      ...base,
      postId: 'retired',
      nextPollAfter: new Date('2026-01-01T00:00:30.000Z'),
      retiredAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await repo.upsert({
      ...base,
      postId: 'not_due_yet',
      nextPollAfter: new Date('2026-01-01T00:10:00.000Z'),
      retiredAt: null,
    });

    const claimed = await repo.claimDue(new Date('2026-01-01T00:05:00.000Z'), 10);

    expect(claimed.map((s) => s.postId)).toEqual(['due_earlier', 'due_later']);
  });
});
