import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { InstagramMediaProductType, InstagramPost } from './instagram-post';
import { CreatePostBaseDto, PostResponseBaseDto } from '../dto/post.dto';

export class CreateInstagramPostDto extends CreatePostBaseDto {
  @ApiProperty({ enum: ['FEED', 'REELS', 'STORY', 'AD'] })
  @IsIn(['FEED', 'REELS', 'STORY', 'AD'])
  mediaProductType!: InstagramMediaProductType;
}

export class InstagramPostResponseDto extends PostResponseBaseDto {
  @ApiProperty({ enum: ['FEED', 'REELS', 'STORY', 'AD'] })
  mediaProductType!: InstagramMediaProductType;

  // Static, not instance — see the comment on PostResponseBaseDto. Takes the single
  // merged InstagramPost (Post fields + mediaProductType) that InstagramPostExtension
  // Handler already assembles from its own Post and repository row.
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
