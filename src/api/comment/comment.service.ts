import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Comment } from '@domain/comment';
import { CommentStatus } from '@domain/comment';
import { PLATFORMS } from '@platforms/registry';
import type { AccountRepository } from '@repository/account.repository.contract';
import type { CommentListFilter } from '@repository/comment.repository.contract';
import type { CommentRepository } from '@repository/comment.repository.contract';
import type { CompositionRepository } from '@repository/composition.repository.contract';
import { createId } from '@repository/create-id';
import type { PostRepository } from '@repository/post.repository.contract';
import {
  ACCOUNT_REPOSITORY,
  COMMENT_REPOSITORY,
  COMPOSITION_REPOSITORY,
  POST_REPOSITORY,
} from '@repository/tokens';
import { type CommentListResponseDto, type CommentListQueryDto } from './comment-list.dto';
import { type CommentResponseDto, type CreateCommentDto, toCommentResponse } from './comment.dto';

@Injectable()
export class CommentService {
  constructor(
    @Inject(COMMENT_REPOSITORY) private readonly comments: CommentRepository,
    @Inject(POST_REPOSITORY) private readonly posts: PostRepository,
    @Inject(COMPOSITION_REPOSITORY) private readonly compositions: CompositionRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
  ) {}

  async list(userId: string, query: CommentListQueryDto): Promise<CommentListResponseDto> {
    const hasPostId = query.postId !== undefined;
    const hasCompositionId = query.compositionId !== undefined;

    if (hasPostId === hasCompositionId) {
      throw new BadRequestException('Exactly one of postId or compositionId is required');
    }
    if (hasPostId && (query.platform !== undefined || query.accountId !== undefined)) {
      const offending = [
        query.platform !== undefined && 'platform',
        query.accountId !== undefined && 'accountId',
      ].filter(Boolean);
      const verb = offending.length > 1 ? 'are' : 'is';
      throw new BadRequestException(
        `${offending.join(' and ')} ${verb} only valid alongside compositionId, not postId`,
      );
    }

    const filter: CommentListFilter = {
      parentCommentId: query.parentCommentId,
      since: query.since ? new Date(query.since) : undefined,
      until: query.until ? new Date(query.until) : undefined,
      cursor: query.cursor,
      limit: query.limit,
      platform: query.platform,
      accountId: query.accountId,
    };

    const result = hasPostId
      ? await this.listByPostId(userId, query.postId!, filter)
      : await this.listByCompositionId(userId, query.compositionId!, filter);

    return { items: result.items.map(toCommentResponse), cursor: result.cursor };
  }

  async findById(userId: string, id: string): Promise<CommentResponseDto> {
    const comment = await this.comments.findById(id);
    if (!comment || comment.userId !== userId) {
      throw new NotFoundException(`Comment not found: ${id}`);
    }
    return toCommentResponse(comment);
  }

  async create(userId: string, dto: CreateCommentDto): Promise<CommentResponseDto> {
    const post = await this.posts.findById(dto.postId);
    if (!post || post.userId !== userId) {
      throw new NotFoundException(`Post not found: ${dto.postId}`);
    }

    const platformSpec = PLATFORMS[post.platform];
    if (!platformSpec.supportsComments) {
      throw new UnprocessableEntityException(`${post.platform} does not support comments`);
    }
    if (dto.text.length > platformSpec.maxCommentLength) {
      throw new UnprocessableEntityException(
        `Reply exceeds ${post.platform}'s ${platformSpec.maxCommentLength}-character limit`,
      );
    }

    let platformParentCommentId: string | null = null;
    if (dto.parentCommentId) {
      const parent = await this.comments.findById(dto.parentCommentId);
      if (!parent || parent.userId !== userId || parent.postId !== post.id) {
        throw new NotFoundException(`Comment not found: ${dto.parentCommentId}`);
      }
      const parentDepth = await this.depthOf(parent);
      if (parentDepth + 1 > platformSpec.maxReplyDepth) {
        throw new UnprocessableEntityException(
          `Reply depth exceeds ${post.platform}'s max of ${platformSpec.maxReplyDepth}`,
        );
      }
      platformParentCommentId = parent.platformCommentId;
    }

    const account = await this.accounts.findById(post.accountId);
    if (!account) {
      throw new NotFoundException(`Account not found: ${post.accountId}`);
    }

    const now = new Date();
    const comment = await this.comments.create({
      id: createId(),
      userId,
      accountId: post.accountId,
      platform: post.platform,
      postId: post.id,
      compositionId: post.compositionId,
      parentCommentId: dto.parentCommentId ?? null,
      platformPostId: post.platformPostId,
      platformCommentId: null,
      platformParentCommentId,
      platformAccountId: account.platformAccountId,
      isAuthor: true,
      text: dto.text,
      // Real platform timestamp arrives once the pipeline actually delivers this
      // (§5.1) — until then this is a placeholder, overwritten on POSTED.
      platformCreatedAt: now,
      status: CommentStatus.QUEUED,
      errorCode: null,
      errorMessage: null,
      idempotencyKey: null,
      requestHash: null,
      createdAt: now,
      updatedAt: now,
    });

    return toCommentResponse(comment);
  }

  private async depthOf(comment: Comment): Promise<number> {
    let depth = 0;
    let current: Comment | null = comment;
    while (current?.parentCommentId) {
      depth += 1;
      current = await this.comments.findById(current.parentCommentId);
    }
    return depth;
  }

  private async listByPostId(userId: string, postId: string, filter: CommentListFilter) {
    const post = await this.posts.findById(postId);
    if (!post || post.userId !== userId) {
      throw new NotFoundException(`Post not found: ${postId}`);
    }
    return this.comments.listByPostId(postId, filter);
  }

  private async listByCompositionId(userId: string, compositionId: string, filter: CommentListFilter) {
    const composition = await this.compositions.findById(compositionId);
    if (!composition || composition.userId !== userId) {
      throw new NotFoundException(`Composition not found: ${compositionId}`);
    }
    return this.comments.listByCompositionId(compositionId, filter);
  }
}
