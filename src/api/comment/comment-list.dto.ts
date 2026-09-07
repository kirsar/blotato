import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { PlatformId } from '@domain/platform-id';
import { CommentResponseDto } from './comment.dto';

export class CommentListQueryDto {
  @IsOptional()
  @IsString()
  postId?: string;

  @IsOptional()
  @IsString()
  compositionId?: string;

  @IsOptional()
  @IsString()
  parentCommentId?: string;

  // Only valid alongside compositionId — see CommentService.list.
  @IsOptional()
  @IsIn([PlatformId.INSTAGRAM, PlatformId.YOUTUBE])
  platform?: PlatformId;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsISO8601()
  since?: string;

  @IsOptional()
  @IsISO8601()
  until?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CommentListResponseDto {
  items!: CommentResponseDto[];
  cursor!: string | null;
}
