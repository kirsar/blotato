import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { Post } from '@domain/post';
import type { YouTubePost, YouTubePrivacyStatus } from '@platforms/youtube/youtube-post';
import { CreatePostBaseDto, PostResponseBaseDto } from './post.dto';

export class CreateYouTubePostDto extends CreatePostBaseDto {
  @ApiProperty({ enum: ['public', 'unlisted', 'private'] })
  @IsIn(['public', 'unlisted', 'private'])
  privacyStatus!: YouTubePrivacyStatus;
}

export class YouTubePostResponseDto extends PostResponseBaseDto {
  @ApiProperty({ enum: ['public', 'unlisted', 'private'] })
  privacyStatus!: YouTubePrivacyStatus;

  static fromPost(post: YouTubePost): YouTubePostResponseDto {
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
      privacyStatus: post.privacyStatus,
    };
  }
}
