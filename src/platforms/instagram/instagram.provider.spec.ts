import { describe, expect, it } from 'vitest';
import { CommentStatus, type Comment } from '@domain/comment';
import {
  CredentialInvalidError,
  PlatformApiError,
  PlatformRejectedError,
  PostUnavailableError,
  ThrottledError,
} from '@domain/errors';
import type { Post, PostSchedule } from '@domain/post';
import { PlatformId } from '@domain/platform-id';
import type { Credential, ICredentialStore } from '../credential-store.contract';
import { InstagramProvider } from './instagram.provider';
import type { InstagramPostRepository } from './instagram-post.repository.contract';
import type { InstagramPost } from './instagram-post';

class FakeInstagramPostRepository implements InstagramPostRepository {
  private row: InstagramPost | null = null;
  set(row: InstagramPost | null): void {
    this.row = row;
  }
  async create(row: InstagramPost): Promise<InstagramPost> {
    this.row = row;
    return row;
  }
  async findById(): Promise<InstagramPost | null> {
    return this.row;
  }
}

class FakeCredentialStore implements ICredentialStore {
  async resolve(): Promise<Credential> {
    return { token: 'fake' };
  }
}

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

function makeSchedule(overrides: Partial<PostSchedule> = {}): PostSchedule {
  return {
    postId: 'post_1',
    commentAutomationLevel: null,
    nextPollAfter: new Date('2026-01-01T00:00:00.000Z'),
    pollIntervalSec: 60,
    emptyPollCount: 0,
    commentVelocity: null,
    cursor: null,
    lastSyncedAt: null,
    retiredAt: null,
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
    isAuthor: true,
    text: 'a reply',
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

describe('InstagramProvider — the error taxonomy is reachable on demand', () => {
  function makeProvider() {
    return new InstagramProvider(new FakeInstagramPostRepository(), new FakeCredentialStore());
  }

  it('listComments returns generated comments and a decrementing cursor until caught up', async () => {
    const provider = makeProvider();
    const post = makePost();
    const first = await provider.listComments(post, makeSchedule({ cursor: null }));
    expect(first.comments).toHaveLength(1);
    expect(first.nextCursor).toBe('1');

    const second = await provider.listComments(post, makeSchedule({ cursor: '1' }));
    expect(second.comments).toHaveLength(1);
    expect(second.nextCursor).toBe('0');

    const third = await provider.listComments(post, makeSchedule({ cursor: '0' }));
    expect(third.comments).toHaveLength(0);
    expect(third.nextCursor).toBeNull();
  });

  it('a Story is PostUnavailableError with permanent: true, without a credential call', async () => {
    const repo = new FakeInstagramPostRepository();
    repo.set({ postId: 'post_1', mediaProductType: 'STORY' });
    const provider = new InstagramProvider(repo, new FakeCredentialStore());

    await expect(provider.listComments(makePost(), makeSchedule())).rejects.toSatisfy(
      (err: unknown) => err instanceof PostUnavailableError && err.permanent === true,
    );
  });

  it('the throttle marker in post content throws ThrottledError', async () => {
    const provider = makeProvider();
    await expect(
      provider.listComments(makePost({ content: '[[THROTTLE]]' }), makeSchedule()),
    ).rejects.toBeInstanceOf(ThrottledError);
  });

  it('the 5xx marker in reply text throws PlatformApiError on createReply', async () => {
    const provider = makeProvider();
    await expect(provider.createReply(makeComment({ text: '[[5XX]]' }))).rejects.toBeInstanceOf(
      PlatformApiError,
    );
  });

  it('the rejected marker throws PlatformRejectedError on createReply', async () => {
    const provider = makeProvider();
    await expect(provider.createReply(makeComment({ text: '[[REJECTED]]' }))).rejects.toBeInstanceOf(
      PlatformRejectedError,
    );
  });

  it('the credential-invalid marker throws CredentialInvalidError on deleteComment', async () => {
    const provider = makeProvider();
    await expect(
      provider.deleteComment(makeComment({ text: '[[CREDENTIAL_INVALID]]' })),
    ).rejects.toBeInstanceOf(CredentialInvalidError);
  });

  it('deleting the same platform comment twice throws CommentGoneError the second time', async () => {
    const provider = makeProvider();
    const comment = makeComment({ platformCommentId: 'dup_1' });
    await expect(provider.deleteComment(comment)).resolves.toBeUndefined();
    await expect(provider.deleteComment(comment)).rejects.toThrow('no longer exists upstream');
  });
});
