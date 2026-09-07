import type { PlatformId } from './platform-id';
import type { AutomationLevel } from './automation';

export interface Post {
  id: string;
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
