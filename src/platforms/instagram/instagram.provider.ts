import { Inject, Injectable } from '@nestjs/common';
import type { Comment } from '@domain/comment';
import { CommentGoneError, PostUnavailableError } from '@domain/errors';
import type { Post, PostSchedule } from '@domain/post';
import { createId } from '@repository/create-id';
import type { FetchedComment, FetchedPage, ICommentReader, ICommentWriter } from '../provider/comment-provider.contract';
import { CREDENTIAL_STORE } from '../credential-store.contract';
import type { ICredentialStore } from '../credential-store.contract';
import { checkInjectedFailure } from '../injected-failure';
import { PlatformId } from '@domain/platform-id';
import { PlatformProvider } from '../provider/platform-provider.decorator';
import { simulateLatency } from '../simulated-latency';
import { INSTAGRAM_POST_REPOSITORY } from './instagram-post.repository.contract';
import type { InstagramPostRepository } from './instagram-post.repository.contract';

// A Story is checked locally, without spending a call — it never becomes
// commentable, so the schedule retires rather than re-polling
// (3.social-media-integration.md, "There are no post operations").
const GENERATED_POLLS_PER_POST = 2;

@Injectable()
@PlatformProvider(PlatformId.INSTAGRAM)
export class InstagramProvider implements ICommentReader, ICommentWriter {
  private readonly deletedPlatformCommentIds = new Set<string>();

  constructor(
    @Inject(INSTAGRAM_POST_REPOSITORY) private readonly instagramPosts: InstagramPostRepository,
    @Inject(CREDENTIAL_STORE) private readonly credentials: ICredentialStore,
  ) {}

  async listComments(post: Post, schedule: PostSchedule): Promise<FetchedPage> {
    const extension = await this.instagramPosts.findById(post.id);
    if (extension?.mediaProductType === 'STORY') {
      throw new PostUnavailableError('Stories have no comments', true);
    }

    await this.credentials.resolve(post.accountId, 'read');
    
    await simulateLatency();
    checkInjectedFailure(post.content);

    // cursor sync: the remaining poll count lives in the cursor itself, so no
    // extra state is needed to simulate "caught up" after a couple of polls.
    const remaining = schedule.cursor ? Number(schedule.cursor) : GENERATED_POLLS_PER_POST;
    if (remaining <= 0) {
      return { comments: [], nextCursor: null };
    }

    const comment: FetchedComment = {
      platformCommentId: createId(),
      platformAccountId: `ig_audience_${createId().slice(0, 8)}`,
      platformParentCommentId: null,
      text: `🔥🔥 obsessed with this!! 😍 (post ${post.platformPostId})`,
      platformCreatedAt: new Date(),
    };
    return { comments: [comment], nextCursor: String(remaining - 1) };
  }

  async createReply(comment: Comment): Promise<{ platformCommentId: string; platformCreatedAt: Date }> {
    await this.credentials.resolve(comment.accountId, 'write');
    
    await simulateLatency();
    checkInjectedFailure(comment.text);
    
    return { platformCommentId: createId(), platformCreatedAt: new Date() };
  }

  async deleteComment(comment: Comment): Promise<void> {
    await this.credentials.resolve(comment.accountId, 'write');
    
    await simulateLatency();
    checkInjectedFailure(comment.text);

    const platformCommentId = comment.platformCommentId;
    if (!platformCommentId || this.deletedPlatformCommentIds.has(platformCommentId)) {
      throw new CommentGoneError(`Comment no longer exists upstream: ${comment.id}`);
    }
    this.deletedPlatformCommentIds.add(platformCommentId);
  }
}
