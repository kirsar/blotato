import { Injectable } from '@nestjs/common';
import type { Post } from '@domain/post';
import { InMemoryExtensionRepository } from '@repository/in-memory/in-memory-extension-repository';
import type { YouTubePost } from './youtube-post';
import type { YouTubePostRepository } from './youtube-post.repository.contract';

@Injectable()
export class InMemoryYouTubePostRepository
  extends InMemoryExtensionRepository<Post, YouTubePost>
  implements YouTubePostRepository {}
