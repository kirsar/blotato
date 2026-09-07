import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Post } from '@domain/post';
import { PlatformId } from '@domain/platform-id';
import { INSTAGRAM_POST_REPOSITORY } from '@platforms/instagram/instagram-post.repository.contract';
import type { InstagramPostRepository, InstagramPostRow } from '@platforms/instagram/instagram-post.repository.contract';
import { YOUTUBE_POST_REPOSITORY } from '@platforms/youtube/youtube-post.repository.contract';
import type { YouTubePostRepository, YouTubePostRow } from '@platforms/youtube/youtube-post.repository.contract';
import type { AccountRepository } from '@repository/account.repository.contract';
import type { CompositionRepository } from '@repository/composition.repository.contract';
import type { PostRepository } from '@repository/post.repository.contract';
import { ACCOUNT_REPOSITORY, COMPOSITION_REPOSITORY, POST_REPOSITORY } from '@repository/tokens';
import { createId } from '@repository/create-id';
import { type CompositionResponseDto, type CreateCompositionDto, toCompositionResponse } from './composition.dto';
import { CreatePostBaseDto, type PostResponseBaseDto } from '../post/post.dto';
import { CreateInstagramPostDto, InstagramPostResponseDto } from '../post/instagram-post.dto';
import { CreateYouTubePostDto, YouTubePostResponseDto } from '../post/youtube-post.dto';
import { InstagramPost } from '@platforms/instagram/instagram-post';

@Injectable()
export class CompositionService {
  constructor(
    @Inject(COMPOSITION_REPOSITORY) private readonly compositions: CompositionRepository,
    @Inject(POST_REPOSITORY) private readonly posts: PostRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(INSTAGRAM_POST_REPOSITORY) private readonly instagramPosts: InstagramPostRepository,
    @Inject(YOUTUBE_POST_REPOSITORY) private readonly youtubePosts: YouTubePostRepository,
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

    return this.createPostExtension(post, postDto);
  }

  private async createPostExtension(post: Post, postDto: CreatePostBaseDto): Promise<PostResponseBaseDto> {
    return this.dispatchByPlatform<PostResponseBaseDto>(post.platform, {
      [PlatformId.INSTAGRAM]: async () => {
        const postExtension = await this.instagramPosts.create({
          id: post.id,
          mediaProductType: (postDto as CreateInstagramPostDto).mediaProductType,
        });
        return InstagramPostResponseDto.fromPost({ ...post, ...postExtension });
      },
      [PlatformId.YOUTUBE]: async () => {
        const postExtension = await this.youtubePosts.create({
          id: post.id,
          privacyStatus: (postDto as CreateYouTubePostDto).privacyStatus,
        });
        return YouTubePostResponseDto.fromPost({ ...post, ...postExtension });
      },
    });
  }

  async findById(userId: string, id: string): Promise<CompositionResponseDto> {
    const composition = await this.compositions.findById(id);
    if (!composition || composition.userId !== userId) {
      throw new NotFoundException(`Composition not found: ${id}`);
    }

    const posts = await this.posts.listByCompositionId(id);
    const postDtos = await Promise.all(posts.map((post: Post) => this.findPostExtension(post)));
    return toCompositionResponse(composition, postDtos);
  }

  private async findPostExtension(post: Post): Promise<PostResponseBaseDto> {
    return this.dispatchByPlatform<PostResponseBaseDto>(post.platform, {
      [PlatformId.INSTAGRAM]: async () => {
        const extension = await this.instagramPosts.findByPostId(post.id);
        if (!extension) {
          throw new InternalServerErrorException(`Instagram extension row not found for post ${post.id}`);
        }
        return InstagramPostResponseDto.fromPost({ ...post, ...extension });
      },
      [PlatformId.YOUTUBE]: async () => {
        const extension = await this.youtubePosts.findByPostId(post.id);
        if (!extension) {
          throw new InternalServerErrorException(`YouTube extension row not found for post ${post.id}`);
        }
        return YouTubePostResponseDto.fromPost({ ...post, ...extension });
      },
    });
  }

  // Generic over T and the number of "args" each branch needs: a handler is a
  // zero-arg closure, so it captures whatever it needs (post, postDto, repositories)
  // from the enclosing method's scope instead of the dispatcher declaring params for
  // them. Record<PlatformId, ...> also makes this exhaustive at compile time — adding
  // a PlatformId without a matching entry here fails to compile.
  private async dispatchByPlatform<T>(
    platform: PlatformId,
    handlers: Record<PlatformId, () => Promise<T>>,
  ): Promise<T> {
    const handler = handlers[platform];
    if (!handler) {
      throw new InternalServerErrorException(`Unsupported platform: ${platform}`);
    }
    return handler();
  }
}
