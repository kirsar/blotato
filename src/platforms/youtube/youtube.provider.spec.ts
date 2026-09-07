import { describe, expect, it } from 'vitest';
import { PostUnavailableError } from '@domain/errors';
import type { Post, PostSchedule } from '@domain/post';
import { PlatformId } from '@domain/platform-id';
import type { Credential, ICredentialStore } from '../credential-store.contract';
import { YouTubeProvider } from './youtube.provider';
import type { YouTubePostRepository } from './youtube-post.repository.contract';
import type { YouTubePost } from './youtube-post';

class FakeYouTubePostRepository implements YouTubePostRepository {
  private row: YouTubePost | null = null;
  set(row: YouTubePost | null): void {
    this.row = row;
  }
  async create(row: YouTubePost): Promise<YouTubePost> {
    this.row = row;
    return row;
  }
  async findById(): Promise<YouTubePost | null> {
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

describe('YouTubeProvider — the same taxonomy, the platform-specific gate', () => {
  it('a private video is PostUnavailableError with permanent: false', async () => {
    const repo = new FakeYouTubePostRepository();
    repo.set({ postId: 'post_1', privacyStatus: 'private' });
    const provider = new YouTubeProvider(repo, new FakeCredentialStore());

    await expect(
      provider.listComments(makePost({ platform: PlatformId.YOUTUBE }), makeSchedule()),
    ).rejects.toSatisfy((err: unknown) => err instanceof PostUnavailableError && err.permanent === false);
  });

  it('since-mode listComments never returns a cursor', async () => {
    const provider = new YouTubeProvider(new FakeYouTubePostRepository(), new FakeCredentialStore());
    const result = await provider.listComments(
      makePost({ platform: PlatformId.YOUTUBE }),
      makeSchedule(),
    );
    expect(result.comments).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });
});
