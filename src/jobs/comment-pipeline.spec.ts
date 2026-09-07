import { describe, expect, it } from 'vitest';
import { AutomationLevel } from '@domain/automation';
import { CommentStatus } from '@domain/comment';
import type { Comment } from '@domain/comment';
import type { Post, PostSchedule } from '@domain/post';
import { PlatformId } from '@domain/platform-id';
import type { FetchedPage, ICommentReader, ICommentWriter } from '@platforms/provider/comment-provider.contract';
import { StubReplyGenerator } from '@agent/stub-reply-generator';
import { InMemoryAccountRepository } from '@repository/in-memory/account.repository';
import { InMemoryCommentRepository } from '@repository/in-memory/comment.repository';
import { InMemoryCompositionRepository } from '@repository/in-memory/composition.repository';
import { InMemoryPostRepository } from '@repository/in-memory/post.repository';
import { InMemoryPostScheduleRepository } from '@repository/in-memory/post-schedule.repository';
import { createId } from '@repository/create-id';
import { CommentPipelineService } from './comment-pipeline.service';

class FakeProvider implements ICommentReader, ICommentWriter {
  public writeCalls: Comment[] = [];

  constructor(private readonly page: FetchedPage) {}

  async listComments(): Promise<FetchedPage> {
    return this.page;
  }

  async createReply(comment: Comment): Promise<{ platformCommentId: string; platformCreatedAt: Date }> {
    this.writeCalls.push(comment);
    return { platformCommentId: `platform_reply_${this.writeCalls.length}`, platformCreatedAt: new Date() };
  }

  async deleteComment(): Promise<void> {
    // Not exercised by this pipeline test — DELETE is a 501 stub end to end.
  }
}

describe('CommentPipelineService — one pass end to end against the fakes', () => {
  it('claims a due schedule, ingests a comment, generates a reply, and publishes it', async () => {
    const accounts = new InMemoryAccountRepository();
    const compositions = new InMemoryCompositionRepository();
    const posts = new InMemoryPostRepository();
    const comments = new InMemoryCommentRepository();
    const postSchedules = new InMemoryPostScheduleRepository();

    const account = await accounts.create({
      id: createId(),
      userId: 'user_demo',
      platform: PlatformId.INSTAGRAM,
      platformAccountId: 'ig_demo_account',
      displayName: 'Demo Instagram',
      credentialRef: 'secret_ref',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const composition = await compositions.create({
      id: createId(),
      userId: 'user_demo',
      content: 'pipeline test composition',
      commentAutomationLevel: AutomationLevel.REPLY,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const post: Post = await posts.create({
      id: createId(),
      compositionId: composition.id,
      userId: 'user_demo',
      accountId: account.id,
      platform: PlatformId.INSTAGRAM,
      platformPostId: 'platform_post_1',
      content: null,
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const schedule: PostSchedule = await postSchedules.upsert({
      postId: post.id,
      commentAutomationLevel: null,
      nextPollAfter: new Date('2026-01-01T00:00:00.000Z'), // already due
      pollIntervalSec: 60,
      emptyPollCount: 0,
      commentVelocity: null,
      cursor: null,
      lastSyncedAt: null,
      retiredAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(schedule.postId).toBe(post.id);

    const fakeProvider = new FakeProvider({
      comments: [
        {
          platformCommentId: 'platform_comment_1',
          platformAccountId: 'ig_audience_1', // not our own account -> isAuthor false
          platformParentCommentId: null,
          text: 'great post!',
          platformCreatedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ],
      nextCursor: null,
    });

    const replyGenerator = new StubReplyGenerator(accounts);

    const pipeline = new CommentPipelineService(
      postSchedules,
      posts,
      compositions,
      accounts,
      comments,
      replyGenerator,
      { reader: () => fakeProvider, writer: () => fakeProvider },
    );

    const now = new Date('2026-01-02T00:00:01.000Z');
    await pipeline.runOnce(now);

    // Step 2 — the inbound comment was ingested.
    const allAwaiting = await comments.findAwaitingReply(post.id);
    expect(allAwaiting).toHaveLength(0); // it now has a reply, so no longer "awaiting"

    // Step 3+4 — a reply was generated and published.
    const queuedOrPosted = await comments.listByPostId(post.id, {});
    const reply = queuedOrPosted.items.find((c) => c.isAuthor);
    expect(reply).toBeDefined();
    expect(reply?.status).toBe(CommentStatus.POSTED);
    expect(reply?.platformCommentId).toBe('platform_reply_1');
    expect(reply?.parentCommentId).not.toBeNull();
    expect(fakeProvider.writeCalls).toHaveLength(1);

    // The schedule advanced past `now` rather than staying claimable forever.
    const updatedSchedule = await postSchedules.findByPostId(post.id);
    expect(updatedSchedule?.nextPollAfter.getTime()).toBeGreaterThan(now.getTime());
    expect(updatedSchedule?.lastSyncedAt).not.toBeNull();
  });

  it('does nothing when no schedule is due', async () => {
    const accounts = new InMemoryAccountRepository();
    const compositions = new InMemoryCompositionRepository();
    const posts = new InMemoryPostRepository();
    const comments = new InMemoryCommentRepository();
    const postSchedules = new InMemoryPostScheduleRepository();
    const replyGenerator = new StubReplyGenerator(accounts);

    const pipeline = new CommentPipelineService(
      postSchedules,
      posts,
      compositions,
      accounts,
      comments,
      replyGenerator,
      {
        reader: () => {
          throw new Error('should not be called');
        },
        writer: () => {
          throw new Error('should not be called');
        },
      },
    );

    await expect(pipeline.runOnce(new Date())).resolves.toBeUndefined();
  });
});
