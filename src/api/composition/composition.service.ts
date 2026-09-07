import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Post } from '@domain/post';
import type { CreatePostBaseDto, PostResponseBaseDto } from '@platforms/dto/post.dto';
import { PostDtoConverterRegistry } from '@platforms/dto/post-dto-converter.registry';
import type { AccountRepository } from '@repository/account.repository.contract';
import type { CompositionRepository } from '@repository/composition.repository.contract';
import type { PostRepository } from '@repository/post.repository.contract';
import { ACCOUNT_REPOSITORY, COMPOSITION_REPOSITORY, POST_REPOSITORY } from '@repository/tokens';
import { createId } from '@repository/create-id';
import { type CompositionResponseDto, type CreateCompositionDto, toCompositionResponse } from './composition.dto';

@Injectable()
export class CompositionService {
  constructor(
    @Inject(COMPOSITION_REPOSITORY) private readonly compositions: CompositionRepository,
    @Inject(POST_REPOSITORY) private readonly posts: PostRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    private readonly postDtoConverters: PostDtoConverterRegistry,
  ) {}

  async create(userId: string, dto: CreateCompositionDto): Promise<CompositionResponseDto> {
    // Validate everything before writing anything — a composition with only some of
    // its posts created is exactly the unlinked-ids problem Composition exists to
    // prevent (2.api-surface.md).
    const accounts = await Promise.all(dto.posts.map((post) => this.accounts.findById(post.accountId)));
    dto.posts.forEach((post, i) => {
      const account = accounts[i];
      if (!account || account.userId !== userId) {
        throw new BadRequestException(`Unknown accountId: ${post.accountId}`);
      }
      if (account.platform !== post.platform) {
        throw new UnprocessableEntityException(
          `accountId ${post.accountId} is a ${account.platform} account, not ${post.platform}`,
        );
      }
    });

    const composition = await this.compositions.create({
      id: createId(),
      userId,
      content: dto.content,
      commentAutomationLevel: null,
      createdAt: new Date(),
    });

    const createdPosts: PostResponseBaseDto[] = [];
    for (const postDto of dto.posts) {
      createdPosts.push(await this.createPost(userId, composition.id, postDto));
    }

    return toCompositionResponse(composition, createdPosts);
  }

  // No platform branching here at all — PostDtoConverterRegistry finds the converter
  // that knows postDto's/post's own field names (mediaProductType, privacyStatus,
  // ...); this method never needs to.
  private async createPost(
    userId: string,
    compositionId: string,
    postDto: CreatePostBaseDto,
  ): Promise<PostResponseBaseDto> {
    const now = new Date();
    const post = await this.posts.create({
      id: createId(),
      compositionId,
      userId,
      accountId: postDto.accountId,
      platform: postDto.platform,
      // Authoring is out of scope end to end — creation stands in for publication,
      // so both are set immediately rather than left null (2.api-surface.md,
      // "the response simply adding the server-assigned id, platformPostId and publishedAt").
      platformPostId: createId(),
      content: postDto.content ?? null,
      publishedAt: now,
      createdAt: now,
    });

    return this.postDtoConverters.get(post.platform).createFromDto(post, postDto);
  }

  async findById(userId: string, id: string): Promise<CompositionResponseDto> {
    const composition = await this.compositions.findById(id);
    if (!composition || composition.userId !== userId) {
      throw new NotFoundException(`Composition not found: ${id}`);
    }

    const posts = await this.posts.listByCompositionId(id);
    const postDtos = await Promise.all(
      posts.map((post: Post) => this.postDtoConverters.get(post.platform).attachToResponse(post)),
    );
    return toCompositionResponse(composition, postDtos);
  }
}
