import type { PlatformId } from '@platforms/platform-id';

export enum CommentStatus {
  DRAFT = 'DRAFT',
  QUEUED = 'QUEUED',
  POSTED = 'POSTED',
  FAILED = 'FAILED',
  DELETED = 'DELETED',
}

export interface Comment {
  id: string;
  userId: string;
  accountId: string;
  platform: PlatformId;
  postId: string;
  compositionId: string;
  parentCommentId: string | null;
  platformAccountId: string;
  platformPostId: string;
  platformCommentId: string | null;
  platformParentCommentId: string | null;
  platformCreatedAt: Date;
  isAuthor: boolean;
  text: string;
  status: CommentStatus;
  errorCode: string | null;
  errorMessage: string | null;
  idempotencyKey: string | null;
  requestHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}
