import { Inject, Injectable } from '@nestjs/common';
import { PlatformId } from '@domain/platform-id';
import type { Post } from '@domain/post';
import { PostDtoConverterBase } from '../dto/post-dto.converter';
import { PostDtoConverterProvider } from '../dto/post-dto-converter.decorator';
import { InstagramPostResponseDto } from './instagram-post.dto';
import { INSTAGRAM_POST_REPOSITORY } from './instagram-post.repository.contract';
import type { InstagramPostRepository, InstagramPostRow } from './instagram-post.repository.contract';

@Injectable()
@PostDtoConverterProvider(PlatformId.INSTAGRAM)
export class InstagramPostDtoConverter extends PostDtoConverterBase<InstagramPostRow, InstagramPostResponseDto> {
  constructor(@Inject(INSTAGRAM_POST_REPOSITORY) protected readonly repository: InstagramPostRepository) {
    super();
  }

  protected fromPost(merged: InstagramPostRow & Post): InstagramPostResponseDto {
    return InstagramPostResponseDto.fromPost(merged);
  }
}
