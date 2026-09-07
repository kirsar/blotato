import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { Post } from '@domain/post';
import type { YouTubePost, YouTubePrivacyStatus } from './youtube-post';
import { CreatePostBaseDto, PostResponseBaseDto } from '../dto/post.dto';

export class CreateYouTubePostDto extends CreatePostBaseDto {
  @ApiProperty({ enum: ['public', 'unlisted', 'private'] })
  @IsIn(['public', 'unlisted', 'private'])
  privacyStatus!: YouTubePrivacyStatus;

  // Static, not instance — symmetric with YouTubePostResponseDto.fromPost below:
  // each DTO owns both directions of its own mapping instead of the converter
  // knowing every DTO's fields.
  static convertDtoToEntity(post: Post, dto: CreateYouTubePostDto): YouTubePost {
    return { ...post, privacyStatus: dto.privacyStatus };
  }
}

export class YouTubePostResponseDto extends PostResponseBaseDto {
  @ApiProperty({ enum: ['public', 'unlisted', 'private'] })
  privacyStatus!: YouTubePrivacyStatus;

  static convertEntityToDto(post: YouTubePost): YouTubePostResponseDto {
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
