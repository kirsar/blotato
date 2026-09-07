import { Inject, Injectable } from '@nestjs/common';
import { PlatformId } from '@domain/platform-id';
import type { Post } from '@domain/post';
import { PostDtoConverterBase } from '../dto/post-dto.converter';
import { PostDtoConverterProvider } from '../dto/post-dto-converter.decorator';
import { YouTubePostResponseDto } from './youtube-post.dto';
import { YOUTUBE_POST_REPOSITORY } from './youtube-post.repository.contract';
import type { YouTubePostRepository, YouTubePostRow } from './youtube-post.repository.contract';

@Injectable()
@PostDtoConverterProvider(PlatformId.YOUTUBE)
export class YouTubePostDtoConverter extends PostDtoConverterBase<YouTubePostRow, YouTubePostResponseDto> {
  constructor(@Inject(YOUTUBE_POST_REPOSITORY) protected readonly repository: YouTubePostRepository) {
    super();
  }

  protected fromPost(merged: YouTubePostRow & Post): YouTubePostResponseDto {
    return YouTubePostResponseDto.fromPost(merged);
  }
}
