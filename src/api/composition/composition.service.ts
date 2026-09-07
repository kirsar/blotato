import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AutomationLevel, effective, rank } from '@domain/automation';
import type { Composition } from '@domain/composition';
import type { Post } from '@domain/post';
import { PLATFORMS } from '@platforms/registry';
import type { CreatePostBaseDto, PostResponseBaseDto } from '@platforms/dto/post.dto';
import { PostDtoConverterRegistry } from '@platforms/dto/post-dto-converter.registry';
import type { AccountRepository } from '@repository/account.repository.contract';
import type { CompositionRepository } from '@repository/composition.repository.contract';
import { SEED_USER } from '@repository/in-memory/seed';
import type { PostRepository } from '@repository/post.repository.contract';
import type { PostScheduleRepository } from '@repository/post-schedule.repository.contract';
import {
  ACCOUNT_REPOSITORY,
  COMPOSITION_REPOSITORY,
  POST_REPOSITORY,
  POST_SCHEDULE_REPOSITORY,
} from '@repository/tokens';
import { createId } from '@repository/create-id';
import { type AutomationResponseDto, type PutAutomationDto } from './automation.dto';
import { type CompositionResponseDto, type CreateCompositionDto, toCompositionResponse } from './composition.dto';

@Injectable()
export class CompositionService {
  constructor(
    @Inject(COMPOSITION_REPOSITORY) private readonly compositions: CompositionRepository,
    @Inject(POST_REPOSITORY) private readonly posts: PostRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(POST_SCHEDULE_REPOSITORY) private readonly postSchedules: PostScheduleRepository,
    private readonly postDtoConverters: PostDtoConverterRegistry,
  ) {}

  async create(userId: string, dto: CreateCompositionDto): Promise<CompositionResponseDto> {
    // Validate everything before writing anything — a composition with only some of
    // its posts created is exactly the unlinked-ids problem Composition exists to
    // prevent (2.api-surface.md).
    const accounts = await Promise.all(dto.posts.map((post) => this.accounts.findById(post.accountId)));
    dto.posts.forEach((post, i) => {
      const account = accounts[i];
      if (!account || account.userId !== userId) {
        throw new BadRequestException(`Unknown accountId: ${post.accountId}`);
      }
      if (account.platform !== post.platform) {
        throw new UnprocessableEntityException(
          `accountId ${post.accountId} is a ${account.platform} account, not ${post.platform}`,
        );
      }
    });

    const composition = await this.compositions.create({
      id: createId(),
      userId,
      content: dto.content,
      commentAutomationLevel: null,
      createdAt: new Date(),
    });

    const createdPosts: PostResponseBaseDto[] = [];
    for (const postDto of dto.posts) {
      createdPosts.push(await this.createPost(userId, composition.id, postDto));
    }

    return toCompositionResponse(composition, createdPosts);
  }

  // No platform branching here at all — PostDtoConverterRegistry finds the converter
  // that knows postDto's/post's own field names (mediaProductType, privacyStatus,
  // ...); this method never needs to.
  private async createPost(
    userId: string,
    compositionId: string,
    postDto: CreatePostBaseDto,
  ): Promise<PostResponseBaseDto> {
    const now = new Date();
    const post = await this.posts.create({
      id: createId(),
      compositionId,
      userId,
      accountId: postDto.accountId,
      platform: postDto.platform,
      // Authoring is out of scope end to end — creation stands in for publication,
      // so both are set immediately rather than left null (2.api-surface.md,
      // "the response simply adding the server-assigned id, platformPostId and publishedAt").
      platformPostId: createId(),
      content: postDto.content ?? null,
      publishedAt: now,
      createdAt: now,
    });

    return this.postDtoConverters.get(post.platform).createPostExtension(post, postDto);
  }

  async findById(userId: string, id: string): Promise<CompositionResponseDto> {
    const composition = await this.findOwnedComposition(userId, id);

    const posts = await this.posts.listByCompositionId(id);
    const postDtos = await Promise.all(
      posts.map((post: Post) => this.postDtoConverters.get(post.platform).attachPostExtension(post)),
    );
    return toCompositionResponse(composition, postDtos);
  }

  // Turns automation on (fan-out): materializes a PostSchedule row for every post
  // under this composition, or un-retires one that already exists. Never raises past
  // the account ceiling — a caller who believes replies are going out when they
  // aren't is the worse failure by a wide margin (2.api-surface.md).
  async putAutomation(userId: string, compositionId: string, automationDto: PutAutomationDto): Promise<AutomationResponseDto> {
    await this.findOwnedComposition(userId, compositionId);
    const ceiling = SEED_USER.maxCommentAutomationLevel;

    if (ceiling === AutomationLevel.OFF) {
      throw new UnprocessableEntityException('Automation is disabled for this account');
    }
    if (automationDto.level && rank(automationDto.level) > rank(ceiling)) {
      throw new UnprocessableEntityException(
        `Requested level ${automationDto.level} exceeds this account's ceiling of ${ceiling}`,
      );
    }

    const updated = await this.compositions.update(compositionId, { commentAutomationLevel: automationDto.level ?? null });
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
        await this.postSchedules.update(post.id, { retiredAt: null });
      } else {
        const { poll } = PLATFORMS[post.platform];
        await this.postSchedules.upsert({
          postId: post.id,
          // The composition-level cap already covers every post under it; a
          // per-post override is only settable through the 501 per-post endpoint.
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

    return this.buildAutomationResponse(updated, ceiling, posts.map((post) => post.id));
  }

  // Turns automation off (fan-out). Clearing Composition.commentAutomationLevel
  // alone would not do it — effective()'s null-is-identity rule means a cleared
  // composition level falls back to the ceiling, not to OFF. OFF has exactly one
  // representation: no active schedule row (5.storage.md), so this retires every
  // post's row directly rather than relying on the effective-level computation.
  async deleteAutomation(userId: string, compositionId: string): Promise<void> {
    await this.findOwnedComposition(userId, compositionId);
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
    const composition = await this.findOwnedComposition(userId, compositionId);
    const ceiling = SEED_USER.maxCommentAutomationLevel;
    const posts = await this.posts.listByCompositionId(compositionId);
    return this.buildAutomationResponse(composition, ceiling, posts.map((post) => post.id));
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
      // per-post override isn't settable through this endpoint (that's the 501
      // per-post automation route), so there's nothing to pass for it.
      effective: effective({ maxCommentAutomationLevel: ceiling }, composition, null),
      posts,
    };
  }

  private async findOwnedComposition(userId: string, id: string): Promise<Composition> {
    const composition = await this.compositions.findById(id);
    if (!composition || composition.userId !== userId) {
      throw new NotFoundException(`Composition not found: ${id}`);
    }
    return composition;
  }
}
