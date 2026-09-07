import type { PlatformId } from './platform-id';
import type { AutomationLevel } from './automation';

export interface Post {
  id: string;
  // Non-null only because every Post is currently authored via
  // POST /v1/compositions — there's no other way for one to exist. Once a
  // standalone per-platform post API is real (2.api-surface.md's `501`
  // `/v1/posts` authoring routes), a post won't necessarily belong to a
  // composition, and this will need to become nullable.
  compositionId: string;
  userId: string;
  accountId: string;
  platform: PlatformId;
  platformPostId: string;
  content: string | null;
  publishedAt: Date | null;
  createdAt: Date;
}

export interface PostSchedule {
  postId: string;
  commentAutomationLevel: AutomationLevel | null;
  nextPollAfter: Date;
  pollIntervalSec: number;
  emptyPollCount: number;
  commentVelocity: number | null;
  // TODO: that's where we can work more on platfroms extensions
  // some social platfroms uses cursors, some timestamps
  cursor: string | null;
  lastSyncedAt: Date | null;
  retiredAt: Date | null;
  createdAt: Date;
}
