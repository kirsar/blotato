// NB: mainly wibe-coded, just to have some running job
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AutomationLevel, effective, rank } from '@domain/automation';
import { CommentStatus } from '@domain/comment';
import type { PostSchedule } from '@domain/post';
import {
  CredentialInvalidError,
  PlatformApiError,
  ThrottledError,
} from '@domain/errors';
import { PLATFORMS } from '@platforms/registry';
import { ProviderRegistry } from '@platforms/provider/provider-registry';
import { assertSingleKey, capBatch, partitionByAccount } from '@agent/batching';
import { REPLY_GENERATOR } from '@agent/reply-generator.contract';
import type { IReplyGenerator, PostComments } from '@agent/reply-generator.contract';
import type { AccountRepository } from '@repository/account.repository.contract';
import type { CommentRepository } from '@repository/comment.repository.contract';
import type { CompositionRepository } from '@repository/composition.repository.contract';
import { createId } from '@repository/create-id';
import { SEED_USER } from '@repository/in-memory/seed';
import type { PostRepository } from '@repository/post.repository.contract';
import type { PostScheduleRepository } from '@repository/post-schedule.repository.contract';
import {
  ACCOUNT_REPOSITORY,
  COMMENT_REPOSITORY,
  COMPOSITION_REPOSITORY,
  POST_REPOSITORY,
  POST_SCHEDULE_REPOSITORY,
} from '@repository/tokens';
import { backoffIntervalSec, decayVelocity, nextIntervalSec, shouldRetire, withJitter } from './scheduling';

const CLAIM_LIMIT = 50;
// Decoupled from the 45-day retention window on purpose (0.capacity-planning.md,
// "Mechanism 2") — a post can stay queryable well after it stops being worth
// spending platform quota on.
// for comment older then 14 days we need a dedicated low frequency queue
const POLL_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

// Only a subset of a provider's own reader/writer surface is needed here, so this
// takes that rather than the concrete class — a fake in tests only needs to supply
// two methods, not stand up real discovery.
type ProviderLookup = Pick<ProviderRegistry, 'reader' | 'writer'>;

@Injectable()
export class CommentPipelineService {
  private readonly logger = new Logger(CommentPipelineService.name);

  constructor(
    @Inject(POST_SCHEDULE_REPOSITORY) private readonly postSchedules: PostScheduleRepository,
    @Inject(POST_REPOSITORY) private readonly posts: PostRepository,
    @Inject(COMPOSITION_REPOSITORY) private readonly compositions: CompositionRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(COMMENT_REPOSITORY) private readonly comments: CommentRepository,
    @Inject(REPLY_GENERATOR) private readonly replyGenerator: IReplyGenerator,
    // Explicit token even though ProviderRegistry is a class Nest could infer from
    // the parameter type — the parameter is typed as the narrower ProviderLookup so
    // tests can pass a plain fake, and that type alias leaves no runtime trace for
    // Nest's reflection to resolve on its own.
    @Inject(ProviderRegistry) private readonly providers: ProviderLookup,
  ) {}

  // claim -> read -> generate -> write (0.implementation-order.md, phase 13). Step 4
  // re-queries each claimed post's queued replies rather than consuming step 3's
  // return value directly — a crash between generate and write loses nothing, since
  // what gets published is whatever's actually persisted as QUEUED.
  async runOnce(now: Date = new Date()): Promise<void> {
    const dueSchedules = await this.postSchedules.claimDue(now, CLAIM_LIMIT);
    if (dueSchedules.length === 0) return;

    for (const schedule of dueSchedules) {
      await this.pollOne(schedule, now);
    }

    await this.generateReplies(dueSchedules);

    for (const schedule of dueSchedules) {
      await this.publishQueuedReplies(schedule.postId);
    }
  }

  // Step 2: read. Ingests whatever the provider returns and recomputes the
  // schedule's own polling state — scheduling.ts's whole reason to exist.
  private async pollOne(schedule: PostSchedule, now: Date): Promise<void> {
    const post = await this.posts.findById(schedule.postId);
    if (!post) return;

    const composition = await this.compositions.findById(post.compositionId);
    const account = await this.accounts.findById(post.accountId);
    if (!composition || !account) return;

    // effective() can only have gone down since PUT materialized this row — nothing
    // here can raise it — so a drop below COLLECT means retire rather than poll
    // (5.storage.md, "row existence is a consequence of the effective level").
    if (rank(effective(SEED_USER, composition, schedule)) < rank(AutomationLevel.COLLECT)) {
      await this.postSchedules.update(schedule.postId, { retiredAt: now });
      return;
    }

    const policy = PLATFORMS[post.platform].poll;
    let page;
    try {
      page = await this.providers.reader(post.platform).listComments(post, schedule);
    } catch (err) {
      // Provider-wide failure: nothing was written, so backing off and retrying
      // next pass is idempotent by construction (4.agentic-integration.md,
      // "Failures").
      this.logger.warn(`listComments failed for post ${post.id}: ${(err as Error).message}`);
      const interval = withJitter(backoffIntervalSec(policy, schedule.pollIntervalSec));
      await this.postSchedules.update(schedule.postId, {
        pollIntervalSec: interval,
        nextPollAfter: new Date(now.getTime() + interval * 1000),
        emptyPollCount: schedule.emptyPollCount + 1,
      });
      return;
    }

    for (const fetched of page.comments) {
      const parent = fetched.platformParentCommentId
        ? await this.comments.findByPlatformCommentId(post.userId, post.platform, fetched.platformParentCommentId)
        : null;

      await this.comments.upsertInbound({
        id: createId(),
        userId: post.userId,
        accountId: post.accountId,
        platform: post.platform,
        postId: post.id,
        compositionId: post.compositionId,
        parentCommentId: parent?.id ?? null,
        platformPostId: post.platformPostId,
        platformCommentId: fetched.platformCommentId,
        platformParentCommentId: fetched.platformParentCommentId,
        platformAccountId: fetched.platformAccountId,
        isAuthor: fetched.platformAccountId === account.platformAccountId,
        text: fetched.text,
        platformCreatedAt: fetched.platformCreatedAt,
        status: CommentStatus.POSTED,
        errorCode: null,
        errorMessage: null,
        idempotencyKey: null,
        requestHash: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    const gotNew = page.comments.length > 0;
    const elapsedSec = schedule.lastSyncedAt
      ? Math.max(1, (now.getTime() - schedule.lastSyncedAt.getTime()) / 1000)
      : schedule.pollIntervalSec;
    const velocity = decayVelocity(schedule.commentVelocity, page.comments.length, elapsedSec);
    const interval = withJitter(nextIntervalSec(policy, schedule.pollIntervalSec, velocity, gotNew));

    await this.postSchedules.update(schedule.postId, {
      lastSyncedAt: now,
      pollIntervalSec: interval,
      nextPollAfter: new Date(now.getTime() + interval * 1000),
      commentVelocity: velocity,
      emptyPollCount: gotNew ? 0 : schedule.emptyPollCount + 1,
      cursor: page.nextCursor,
      retiredAt: shouldRetire(schedule.createdAt, now, POLL_WINDOW_MS) ? now : null,
    });
  }

  // Step 3: generate. Only posts whose effective level actually reaches REPLY
  // generate anything — COLLECT ingests and stops here (2.api-surface.md).
  private async generateReplies(schedules: PostSchedule[]): Promise<void> {
    const pairs: PostComments[] = [];
    for (const schedule of schedules) {
      const post = await this.posts.findById(schedule.postId);
      const composition = post ? await this.compositions.findById(post.compositionId) : null;
      if (!post || !composition) continue;
      if (rank(effective(SEED_USER, composition, schedule)) < rank(AutomationLevel.REPLY)) continue;

      const awaiting = await this.comments.findAwaitingReply(post.id);
      if (awaiting.length > 0) pairs.push([post, awaiting]);
    }

    for (const partition of partitionByAccount(pairs)) {
      const capped = capBatch(partition);
      assertSingleKey(capped);
      if (capped.length === 0) continue;
      const replies = await this.replyGenerator.generate(capped);
      for (const reply of replies) {
        await this.comments.create(reply);
      }
    }
  }

  // Step 4: write. Publishes whatever is actually QUEUED for this post.
  private async publishQueuedReplies(postId: string): Promise<void> {
    const queued = await this.comments.findQueuedReplies(postId);
    for (const reply of queued) {
      try {
        const result = await this.providers.writer(reply.platform).createReply(reply);
        await this.comments.update(reply.id, {
          status: CommentStatus.POSTED,
          platformCommentId: result.platformCommentId,
          platformCreatedAt: result.platformCreatedAt,
        });
      } catch (err) {
        if (this.isProviderWideFailure(err)) {
          // Nothing was written, so leaving this QUEUED is correct — it comes back
          // unchanged next pass. An outage would fail every remaining reply in this
          // loop too, so stop rather than retry each one only to fail again
          // (4.agentic-integration.md, "Failures are per item").
          this.logger.warn(`createReply provider-wide failure for post ${postId}: ${(err as Error).message}`);
          return;
        }
        await this.comments.update(reply.id, {
          status: CommentStatus.FAILED,
          errorCode: err instanceof Error ? err.name : 'UNKNOWN',
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  private isProviderWideFailure(err: unknown): boolean {
    return (
      err instanceof ThrottledError || err instanceof PlatformApiError || err instanceof CredentialInvalidError
    );
  }
}
