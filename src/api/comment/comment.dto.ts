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
  // Nullable, not string: right-to-erasure nulls both fields in place (5.storage.md
  // §6.3, @domain/comment.ts) — a non-null type here would misdescribe what an
  // erased comment actually looks like in the response.
  platformAccountId!: string | null;
  isAuthor!: boolean;
  text!: string | null;
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
