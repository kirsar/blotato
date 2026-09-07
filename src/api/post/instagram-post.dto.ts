import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { InstagramMediaProductType, InstagramPost } from '@platforms/instagram/instagram-post';
import { CreatePostBaseDto, PostResponseBaseDto } from './post.dto';

export class CreateInstagramPostDto extends CreatePostBaseDto {
  @ApiProperty({ enum: ['FEED', 'REELS', 'STORY', 'AD'] })
  @IsIn(['FEED', 'REELS', 'STORY', 'AD'])
  mediaProductType!: InstagramMediaProductType;
}

export class InstagramPostResponseDto extends PostResponseBaseDto {
  @ApiProperty({ enum: ['FEED', 'REELS', 'STORY', 'AD'] })
  mediaProductType!: InstagramMediaProductType;

  // Static, not instance — see the comment on PostResponseBaseDto. Takes the two
  // pieces exactly as compositions.service.ts has them on hand: the base Post row
  // from PostRepository, and the extension's own field from InstagramPostRepository.
  static fromPost(post: InstagramPost): InstagramPostResponseDto {
    return {
      id: post.id,
      userId: post.userId,
      accountId: post.accountId,
      compositionId: post.compositionId,
      platform: post.platform,
      platformPostId: post.platformPostId,
      content: post.content,
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
      mediaProductType: post.mediaProductType,
    };
  }
}
