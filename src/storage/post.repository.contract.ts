import type { Post } from '@domain/post';

export interface PostRepository {
  create(post: Post): Promise<Post>;
  findById(id: string): Promise<Post | null>;
  listByCompositionId(compositionId: string): Promise<Post[]>;
}
