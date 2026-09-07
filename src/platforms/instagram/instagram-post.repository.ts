import { Injectable } from '@nestjs/common';
import type { Post } from '@domain/post';
import { InMemoryExtensionRepository } from '@repository/in-memory/in-memory-extension-repository';
import type { InstagramPost } from './instagram-post';
import type { InstagramPostRepository } from './instagram-post.repository.contract';

@Injectable()
export class InMemoryInstagramPostRepository
  extends InMemoryExtensionRepository<Post, InstagramPost>
  implements InstagramPostRepository
{
}
