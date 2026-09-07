import { InternalServerErrorException } from '@nestjs/common';
import type { Post } from '@domain/post';
import type { ExtensionRepository } from '@repository/extension-repository.contract';
import type { PostDtoConverter } from './post-dto-converter.contract';
import type { CreatePostBaseDto, PostResponseBaseDto } from './post.dto';

// CreatePostBaseDto's own keys — fixed and known, so "the dto's platform-specific
// fields" can be computed generically as everything else, the same diff-by-omission
// principle as ExtensionRow<TEntity, TExtension> for the repository layer. No
// subclass has to name its own field (mediaProductType, privacyStatus, ...) anywhere.
const BASE_DTO_KEYS: ReadonlySet<string> = new Set<keyof CreatePostBaseDto>(['platform', 'accountId', 'content']);

export abstract class PostDtoConverterBase<TRow extends { id: string }, TResponseDto extends PostResponseBaseDto>
  implements PostDtoConverter
{
  protected abstract readonly repository: ExtensionRepository<TRow>;

  // Can't be generalized further like createFromDto/attachToResponse below — this is
  // the one place TypeScript's lack of `abstract static` bites (see the comment on
  // PostResponseBaseDto): each concrete ResponseDto's own static fromPost has to be
  // reached through an instance method instead.
  protected abstract fromPost(merged: TRow & Post): TResponseDto;

  async createFromDto(post: Post, dto: CreatePostBaseDto): Promise<TResponseDto> {
    const extraFields = Object.fromEntries(
      Object.entries(dto).filter(([key]) => !BASE_DTO_KEYS.has(key)),
    );
    // TypeScript can't verify a still-generic TRow from a runtime-filtered object —
    // same class of cast as ExtensionRow's `id` access, accepted for the same reason.
    const extension = await this.repository.create({ id: post.id, ...extraFields } as TRow);
    return this.fromPost({ ...post, ...extension } as TRow & Post);
  }

  async attachToResponse(post: Post): Promise<TResponseDto> {
    const extension = await this.repository.findById(post.id);
    if (!extension) {
      throw new InternalServerErrorException(`Extension row not found for post ${post.id}`);
    }
    return this.fromPost({ ...post, ...extension } as TRow & Post);
  }
}
