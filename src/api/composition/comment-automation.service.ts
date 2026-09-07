import { Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { AutomationLevel, effective, rank } from '@domain/automation';
import type { Composition } from '@domain/composition';
import { PLATFORMS } from '@platforms/registry';
import type { CompositionRepository } from '@repository/composition.repository.contract';
import { SEED_USER } from '@repository/in-memory/seed';
import type { PostRepository } from '@repository/post.repository.contract';
import type { PostScheduleRepository } from '@repository/post-schedule.repository.contract';
import { COMPOSITION_REPOSITORY, POST_REPOSITORY, POST_SCHEDULE_REPOSITORY } from '@repository/tokens';
import { type AutomationResponseDto, type PutAutomationDto } from './automation.dto';
import { findOwnedComposition } from './find-owned-composition';

@Injectable()
export class CommentAutomationService {
  constructor(
    @Inject(COMPOSITION_REPOSITORY) private readonly compositions: CompositionRepository,
    @Inject(POST_REPOSITORY) private readonly posts: PostRepository,
    @Inject(POST_SCHEDULE_REPOSITORY) private readonly postSchedules: PostScheduleRepository,
  ) {}

  // Turns automation on (fan-out): materializes a PostSchedule row for every post
  // under this composition, or un-retires one that already exists. Never raises past
  // the account ceiling — a caller who believes replies are going out when they
  // aren't is the worse failure by a wide margin (2.api-surface.md).
  async putAutomation(
    userId: string,
    compositionId: string,
    automationDto: PutAutomationDto,
  ): Promise<AutomationResponseDto> {
    await findOwnedComposition(this.compositions, userId, compositionId);
    const ceiling = SEED_USER.maxCommentAutomationLevel;

    if (ceiling === AutomationLevel.OFF) {
      throw new UnprocessableEntityException('Automation is disabled for this account');
    }
    if (automationDto.level && rank(automationDto.level) > rank(ceiling)) {
      throw new UnprocessableEntityException(
        `Requested level ${automationDto.level} exceeds this account's ceiling of ${ceiling}`,
      );
    }

    const updated = await this.compositions.update(compositionId, {
      commentAutomationLevel: automationDto.level ?? null,
    });
    const posts = await this.posts.listByCompositionId(compositionId);
    const now = new Date();

    // Not just for immediate effect — it's the only way the worker ever learns to
    // poll this post at all. claimDue() filters retiredAt === null and only iterates
    // rows that already exist; it never consults Composition. So a post with no
    // schedule row, or a retired one, stays invisible to the worker forever no
    // matter what commentAutomationLevel says, until this loop touches its row
    // directly.
    for (const post of posts) {
      const schedule = await this.postSchedules.findByPostId(post.id);
      if (schedule) {
        // createdAt means "when the post was subscribed" (1.overall-architecture.md),
        // and shouldRetire's 14-day poll window is measured from it — so reactivating
        // a retired schedule without resetting it would let it re-retire itself on
        // the very next pass, since createdAt would still be past the window. A
        // resubscribe is a new subscription for this purpose.
        // Also reset the polling state: a backed-off schedule would otherwise not
        // poll for hours after a resubscribe.
        await this.postSchedules.update(post.id, {
          retiredAt: null,
          createdAt: now,
          nextPollAfter: now,
          pollIntervalSec: PLATFORMS[post.platform].poll.minIntervalSec,
          emptyPollCount: 0,
        });
      } else {
        const { poll } = PLATFORMS[post.platform];
        await this.postSchedules.upsert({
          postId: post.id,
          // The composition-level cap already covers every post under it; a
          // per-post override is only settable through the designed-only per-post
          // endpoint (2.api-surface.md).
          commentAutomationLevel: null,
          nextPollAfter: now,
          pollIntervalSec: poll.minIntervalSec,
          emptyPollCount: 0,
          commentVelocity: null,
          cursor: null,
          lastSyncedAt: null,
          retiredAt: null,
          createdAt: now,
        });
      }
    }

    return this.buildAutomationResponse(
      updated,
      ceiling,
      posts.map((post) => post.id),
    );
  }

  // Turns automation off (fan-out). Clearing Composition.commentAutomationLevel
  // alone would not do it — effective()'s null-is-identity rule means a cleared
  // composition level falls back to the ceiling, not to OFF. OFF has exactly one
  // representation: no active schedule row (5.storage.md), so this retires every
  // post's row directly rather than relying on the effective-level computation.
  async deleteAutomation(userId: string, compositionId: string): Promise<void> {
    await findOwnedComposition(this.compositions, userId, compositionId);
    await this.compositions.update(compositionId, { commentAutomationLevel: null });

    const posts = await this.posts.listByCompositionId(compositionId);
    const now = new Date();
    for (const post of posts) {
      const schedule = await this.postSchedules.findByPostId(post.id);
      if (schedule) {
        await this.postSchedules.update(post.id, { retiredAt: now });
      }
    }
  }

  async getAutomation(userId: string, compositionId: string): Promise<AutomationResponseDto> {
    const composition = await findOwnedComposition(this.compositions, userId, compositionId);
    const ceiling = SEED_USER.maxCommentAutomationLevel;
    const posts = await this.posts.listByCompositionId(compositionId);
    return this.buildAutomationResponse(
      composition,
      ceiling,
      posts.map((post) => post.id),
    );
  }

  private async buildAutomationResponse(
    composition: Composition,
    ceiling: AutomationLevel,
    postIds: string[],
  ): Promise<AutomationResponseDto> {
    const posts = await Promise.all(
      postIds.map(async (postId) => {
        const schedule = await this.postSchedules.findByPostId(postId);
        return {
          postId,
          lastSyncedAt: schedule?.lastSyncedAt ?? null,
          nextPollAfter: schedule?.nextPollAfter ?? null,
          retiredAt: schedule?.retiredAt ?? null,
        };
      }),
    );

    return {
      requested: composition.commentAutomationLevel,
      ceiling,
      // No schedule argument here — this is the composition-level triple; a
      // per-post override isn't settable through this endpoint (that's the
      // designed-only per-post automation route), so there's nothing to pass for it.
      effective: effective({ maxCommentAutomationLevel: ceiling }, composition, null),
      posts,
    };
  }
}
