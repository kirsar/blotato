import { Inject, Injectable } from '@nestjs/common';
import { PlatformId } from '@domain/platform-id';
import type { Post } from '@domain/post';
import { PostDtoConverterBase } from '../dto/post-dto.converter';
import { PostDtoConverterProvider } from '../dto/post-dto-converter.decorator';
import { CreateYouTubePostDto, YouTubePostResponseDto } from './youtube-post.dto';
import { YOUTUBE_POST_REPOSITORY } from './youtube-post.repository.contract';
import type { YouTubePost } from './youtube-post';
import type { YouTubePostRepository } from './youtube-post.repository.contract';

@Injectable()
@PostDtoConverterProvider(PlatformId.YOUTUBE)
export class YouTubePostDtoConverter extends PostDtoConverterBase<
  YouTubePost,
  CreateYouTubePostDto,
  YouTubePostResponseDto
> {
  constructor(@Inject(YOUTUBE_POST_REPOSITORY) protected readonly repository: YouTubePostRepository) {
    super();
  }

  protected fromPost(post: YouTubePost): YouTubePostResponseDto {
    return YouTubePostResponseDto.convertEntityToDto(post);
  }

  protected fromDto(post: Post, dto: CreateYouTubePostDto): YouTubePost {
    return CreateYouTubePostDto.convertDtoToEntity(post, dto);
  }
}
