import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { PlatformId } from '@domain/platform-id';
import type { Composition } from '@domain/composition';
import { CreatePostBaseDto, type PostResponseBaseDto } from '@platforms/dto/post.dto';
import { CreateInstagramPostDto, InstagramPostResponseDto } from '@platforms/instagram/instagram-post.dto';
import { CreateYouTubePostDto, YouTubePostResponseDto } from '@platforms/youtube/youtube-post.dto';

@ApiExtraModels(CreateInstagramPostDto, CreateYouTubePostDto)
export class CreateCompositionDto {
  @ApiProperty({ example: 'Our new feature just shipped — check it out!' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiProperty({
    type: 'array',
    items: {
      oneOf: [{ $ref: getSchemaPath(CreateInstagramPostDto) }, { $ref: getSchemaPath(CreateYouTubePostDto) }],
      discriminator: { propertyName: 'platform' },
    },
    // Swagger UI's auto-generated example for a oneOf array doesn't know which
    // fields pair with which discriminator value — left to its own devices it
    // mixes them (e.g. platform: INSTAGRAM next to YouTube's privacyStatus), which
    // then fails real validation. An explicit, correctly-paired example avoids that.
    // account_ig_demo/account_yt_demo are the seeded accounts' real, fixed ids
    // (seed.ts) — this example works as-is against a freshly booted server, no
    // GET /v1/accounts round trip needed first.
    example: [
      { platform: PlatformId.INSTAGRAM, accountId: 'account_ig_demo', mediaProductType: 'FEED' },
      { platform: PlatformId.YOUTUBE, accountId: 'account_yt_demo', privacyStatus: 'unlisted' },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePostBaseDto, {
    discriminator: {
      property: 'platform',
      subTypes: [
        { value: CreateInstagramPostDto, name: PlatformId.INSTAGRAM },
        { value: CreateYouTubePostDto, name: PlatformId.YOUTUBE },
      ],
    },
    // Not optional — class-transformer strips the discriminator property by default,
    // so `platform` would silently disappear from the validated object and the
    // service's own platform switch would have nothing to read.
    keepDiscriminatorProperty: true,
  })
  posts!: (CreateInstagramPostDto | CreateYouTubePostDto)[];
}

// Derived from Composition via Omit (same pattern as AccountResponseDto/
// CommentResponseDto) — userId/commentAutomationLevel are dropped as internal, and
// posts is an addition, not part of Composition itself.
@ApiExtraModels(InstagramPostResponseDto, YouTubePostResponseDto)
export class CompositionResponseDto implements Omit<Composition, 'userId' | 'commentAutomationLevel'> {
  id!: string;
  content!: string;
  createdAt!: Date;

  // PostResponseBaseDto alone would document only the shared fields — Swagger's CLI
  // plugin infers schemas statically from declared types, so without this it has no
  // way to know posts are actually InstagramPostResponseDto | YouTubePostResponseDto
  // at runtime (same reasoning as CreateCompositionDto.posts above, response side).
  @ApiProperty({
    type: 'array',
    items: {
      oneOf: [
        { $ref: getSchemaPath(InstagramPostResponseDto) },
        { $ref: getSchemaPath(YouTubePostResponseDto) },
      ],
      discriminator: { propertyName: 'platform' },
    },
  })
  posts!: PostResponseBaseDto[];
}

export function toCompositionResponse(
  composition: Composition,
  posts: PostResponseBaseDto[],
): CompositionResponseDto {
  return {
    id: composition.id,
    content: composition.content,
    createdAt: composition.createdAt,
    posts,
  };
}
