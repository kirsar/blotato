import type { PlatformId } from './platform-id';

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
  // Nullable, not just optional: right-to-erasure (5.storage.md §6.3) scrubs a
  // comment by nulling this and `text` on the row in place, rather than deleting it
  // outright — deleting would dangle any reply whose parentCommentId points here.
  // A non-null declaration here would make that operation impossible to persist.
  platformAccountId: string | null;
  platformPostId: string;
  platformCommentId: string | null;
  platformParentCommentId: string | null;
  platformCreatedAt: Date;
  isAuthor: boolean;
  text: string | null;
  status: CommentStatus;
  errorCode: string | null;
  errorMessage: string | null;
  idempotencyKey: string | null;
  requestHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}
