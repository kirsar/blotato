import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PlatformId } from '@domain/platform-id';
import type { Post } from '@domain/post';

// Lives here, not in /api — CreateInstagramPostDto/CreateYouTubePostDto and their
// response counterparts (in the sibling platform folders) need it as a real base
// class, and /platforms can't import up into /api without creating a cycle. /api
// still imports these going the existing, correct direction (down into /platforms)
// for its own Swagger wiring (@ApiExtraModels, the discriminator's subTypes).

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

// Not generic, no abstract fromPost: TypeScript has no `abstract static`, so a base
// class can't force subclasses to implement a static factory the way it can with an
// instance method. Each subclass's own static fromPost is convention, not enforced —
// the tradeoff for not needing a throwaway `new Subclass()` just to call it.
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
