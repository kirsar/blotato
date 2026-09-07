import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PlatformId } from '@domain/platform-id';
import { CommentResponseDto } from './comment.dto';

export class CommentListQueryDto {
  // No example on postId/compositionId — both are ids generated at creation time
  // (no fixed seed value like accounts have), so a hardcoded example would 404. Get
  // one from a composition's response.
  @IsOptional()
  @IsString()
  postId?: string;

  @IsOptional()
  @IsString()
  compositionId?: string;

  @IsOptional()
  @IsString()
  parentCommentId?: string;

  // Only valid alongside compositionId, never postId (CommentService.list) — a
  // description, not an example: an example value here would sit prefilled in
  // Swagger UI's "Try it out" right next to postId's own prefilled example, and
  // running both together is exactly the 400 this field guards against.
  @ApiProperty({ required: false, description: 'Only valid alongside compositionId, not postId.' })
  @IsOptional()
  @IsIn([PlatformId.INSTAGRAM, PlatformId.YOUTUBE])
  platform?: PlatformId;

  @ApiProperty({ required: false, description: 'Only valid alongside compositionId, not postId.' })
  @IsOptional()
  @IsString()
  accountId?: string;

  // No example on since/until, for the same reason as platform above. Swagger UI
  // prefills examples into "Try it out", every seeded comment has
  // platformCreatedAt = now, and list() filters platformCreatedAt <= until — so any
  // fixed window would make the demo's flagship call return an empty page.
  @ApiProperty({
    required: false,
    description: 'ISO 8601. Filters on platformCreatedAt — the platform clock, not ingest time.',
  })
  @IsOptional()
  @IsISO8601()
  since?: string;

  @ApiProperty({
    required: false,
    description: 'ISO 8601. Filters on platformCreatedAt — the platform clock, not ingest time.',
  })
  @IsOptional()
  @IsISO8601()
  until?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiProperty({ required: false, example: 25 })
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
