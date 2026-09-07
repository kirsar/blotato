import { Inject, Injectable } from '@nestjs/common';
import type { Comment } from '@domain/comment';
import { CommentGoneError, PostUnavailableError } from '@domain/errors';
import type { Post, PostSchedule } from '@domain/post';
import { createId } from '@repository/create-id';
import type {
  FetchedComment,
  FetchedPage,
  ICommentReader,
  ICommentWriter,
} from '../provider/comment-provider.contract';
import { CREDENTIAL_STORE } from '../credential-store.contract';
import type { ICredentialStore } from '../credential-store.contract';
import { checkInjectedFailure } from '../injected-failure';
import { PlatformId } from '@domain/platform-id';
import { PlatformProvider } from '../provider/platform-provider.decorator';
import { simulateLatency } from '../simulated-latency';
import { YOUTUBE_POST_REPOSITORY } from './youtube-post.repository.contract';
import type { YouTubePostRepository } from './youtube-post.repository.contract';

@Injectable()
@PlatformProvider(PlatformId.YOUTUBE)
export class YouTubeProvider implements ICommentReader, ICommentWriter {
  private readonly deletedPlatformCommentIds = new Set<string>();

  constructor(
    @Inject(YOUTUBE_POST_REPOSITORY) private readonly youtubePosts: YouTubePostRepository,
    @Inject(CREDENTIAL_STORE) private readonly credentials: ICredentialStore,
  ) {}

  async listComments(post: Post, _schedule: PostSchedule): Promise<FetchedPage> {
    const extension = await this.youtubePosts.findById(post.id);
    if (extension?.privacyStatus === 'private') {
      // Transient — privacy can flip back, so suspend rather than retire.
      throw new PostUnavailableError('Private video comments are inaccessible', false);
    }

    await this.credentials.resolve(post.accountId, 'read');

    await simulateLatency();
    checkInjectedFailure(post.content);

    // since sync: no cursor is persisted, the provider just reports what's new
    // since PostSchedule.lastSyncedAt (the scheduler owns that comparison).
    const comment: FetchedComment = {
      platformCommentId: createId(),
      platformAccountId: `yt_viewer_${createId().slice(0, 8)}`,
      platformParentCommentId: null,
      text: `Great video, learned a lot from this one! 👍 (video ${post.platformPostId})`,
      platformCreatedAt: new Date(),
    };
    return { comments: [comment], nextCursor: null };
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
