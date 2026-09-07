import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { Comment } from '@domain/comment';
import { PlatformId } from '@domain/platform-id';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  postId!: string;

  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsOptional()
  @IsString()
  parentCommentId?: string;
}

// idempotencyKey/requestHash have no slot here — same enforcement pattern as
// AccountResponseDto (1.overall-architecture.md, "Enforcing a security boundary
// in the type system").
export class CommentResponseDto implements Omit<Comment, 'idempotencyKey' | 'requestHash'> {
  id!: string;
  userId!: string;
  accountId!: string;
  platform!: PlatformId;
  postId!: string;
  compositionId!: string;
  parentCommentId!: string | null;
  platformPostId!: string;
  platformCommentId!: string | null;
  platformParentCommentId!: string | null;
  platformAccountId!: string;
  isAuthor!: boolean;
  text!: string;
  platformCreatedAt!: Date;
  status!: Comment['status'];
  errorCode!: string | null;
  errorMessage!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export function toCommentResponse(comment: Comment): CommentResponseDto {
  return {
    id: comment.id,
    userId: comment.userId,
    accountId: comment.accountId,
    platform: comment.platform,
    postId: comment.postId,
    compositionId: comment.compositionId,
    parentCommentId: comment.parentCommentId,
    platformPostId: comment.platformPostId,
    platformCommentId: comment.platformCommentId,
    platformParentCommentId: comment.platformParentCommentId,
    platformAccountId: comment.platformAccountId,
    isAuthor: comment.isAuthor,
    text: comment.text,
    platformCreatedAt: comment.platformCreatedAt,
    status: comment.status,
    errorCode: comment.errorCode,
    errorMessage: comment.errorMessage,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}
