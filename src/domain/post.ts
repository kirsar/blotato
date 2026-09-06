import type { PlatformId } from '@platforms/platform-id';
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
  cursor: string | null;
  lastSyncedAt: Date | null;
  retiredAt: Date | null;
  createdAt: Date;
}
