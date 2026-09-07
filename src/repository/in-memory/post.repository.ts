import { Injectable } from '@nestjs/common';
import type { Post } from '@domain/post';
import type { PostRepository } from '@repository/post.repository.contract';
import { InMemoryRepository, type UniqueKeySpec } from './in-memory-repository';

const uniquePost: UniqueKeySpec<Post> = {
  name: 'userId_platform_platformPostId',
  keyOf: (p) => `${p.userId}::${p.platform}::${p.platformPostId}`,
};

@Injectable()
export class InMemoryPostRepository extends InMemoryRepository<Post> implements PostRepository {
  constructor() {
    super((p) => p.id, [uniquePost]);
  }

  async create(post: Post): Promise<Post> {
    return this.insert(post);
  }

  async findById(id: string): Promise<Post | null> {
    return super.findById(id);
  }

  async listByCompositionId(compositionId: string): Promise<Post[]> {
    return this.all().filter((p) => p.compositionId === compositionId);
  }
}
