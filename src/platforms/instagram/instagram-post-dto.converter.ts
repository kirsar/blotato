import { Inject, Injectable } from '@nestjs/common';
import { PlatformId } from '@domain/platform-id';
import type { Post } from '@domain/post';
import { PostDtoConverterBase } from '../dto/post-dto.converter';
import { PostDtoConverterProvider } from '../dto/post-dto-converter.decorator';
import { CreateInstagramPostDto, InstagramPostResponseDto } from './instagram-post.dto';
import { INSTAGRAM_POST_REPOSITORY } from './instagram-post.repository.contract';
import type { InstagramPost } from './instagram-post';
import type { InstagramPostRepository } from './instagram-post.repository.contract';

@Injectable()
@PostDtoConverterProvider(PlatformId.INSTAGRAM)
export class InstagramPostDtoConverter extends PostDtoConverterBase<
  InstagramPost,
  CreateInstagramPostDto,
  InstagramPostResponseDto
> {
  constructor(@Inject(INSTAGRAM_POST_REPOSITORY) protected readonly repository: InstagramPostRepository) {
    super();
  }

  protected fromPost(post: InstagramPost): InstagramPostResponseDto {
    return InstagramPostResponseDto.convertEntityToDto(post);
  }

  protected fromDto(post: Post, dto: CreateInstagramPostDto): InstagramPost {
    return CreateInstagramPostDto.convertDtoToEntity(post, dto);
  }
}
