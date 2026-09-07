import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PlatformId } from '@domain/platform-id';
import type { Post } from '@domain/post';

// Lives in /api, not /platforms, even though InstagramPostDto/YouTubePostDto
// (in the sibling files here) validate platform-specific values. class-validator
// DTOs are an HTTP-request-validation concern, and /platforms has to stay usable by
// the worker process too — the worker never receives an HTTP body to validate, so a
// DTO living there would be dead weight for half its consumers.

// Base for the discriminated union used by CreateCompositionDto.posts. platform is
// redeclared on each concrete subtype as a literal so the discriminator has
// something to switch on.
export abstract class CreatePostBaseDto {
  // A class-validator decorator is required here, not just @ApiProperty — the
  // global ValidationPipe's whitelist:true strips any property with no validation
  // decorator, discriminator or not, before keepDiscriminatorProperty ever matters.
  @ApiProperty({ enum: PlatformId })
  @IsIn([PlatformId.INSTAGRAM, PlatformId.YOUTUBE])
  platform!: PlatformId;

  @IsString()
  @IsNotEmpty()
  accountId!: string;

  // Per-platform caption override; falls back to Composition.content when absent.
  @IsOptional()
  @IsString()
  content?: string;
}

export abstract class PostResponseBaseDto implements Post {
  id!: string;
  userId!: string;
  accountId!: string;
  compositionId!: string;
  platform!: PlatformId;
  platformPostId!: string;
  content!: string | null;
  publishedAt!: Date | null;
  createdAt!: Date;
}
