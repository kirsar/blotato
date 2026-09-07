import { InternalServerErrorException } from '@nestjs/common';
import type { Post } from '@domain/post';
import type { ExtensionRepository } from '@repository/extension-repository.contract';
import type { PostDtoConverter } from './post-dto-converter.contract';
import type { CreatePostBaseDto, PostResponseBaseDto } from './post.dto';

export abstract class PostDtoConverterBase<
  TPost extends Post,
  TCreatePostDto extends CreatePostBaseDto,
  TResponseDto extends PostResponseBaseDto,
> implements PostDtoConverter
{
  protected abstract readonly repository: ExtensionRepository<Post, TPost>;

  // Can't be generalized further like createPostExtension/attachPostExtension below
  // — this is the one place TypeScript's lack of `abstract static` bites (see the
  // comment on PostResponseBaseDto): each concrete ResponseDto's own static fromPost
  // has to be reached through an instance method instead.
  protected abstract fromPost(post: TPost): TResponseDto;

  // Explicit per-platform mapping from the incoming create DTO to the merged TPost
  // shape the repository stores — no hidden field-filtering; each subclass names its
  // own field directly (mediaProductType, privacyStatus, ...).
  protected abstract fromDto(post: Post, dto: TCreatePostDto): TPost;

  async createPostExtension(post: Post, dto: CreatePostBaseDto): Promise<TResponseDto> {
    const row = this.fromDto(post, dto as TCreatePostDto);
    const extension = await this.repository.create(row);
    // repository.create() only ever echoes back the sparse row it actually stores
    // (ExtensionRow<Post, TPost>), not the full TPost handed to it — same merge
    // attachPostExtension needs below, and the same cast for the same reason:
    // TypeScript can't verify that spreading a wide Post into a still-generic,
    // sparse row reconstitutes TPost.
    return this.fromPost({ ...post, ...extension } as TPost);
  }

  async attachPostExtension(post: Post): Promise<TResponseDto> {
    const extension = await this.repository.findById(post.id);
    if (!extension) {
      throw new InternalServerErrorException(`Extension row not found for post ${post.id}`);
    }
    return this.fromPost({ ...post, ...extension } as TPost);
  }
}
