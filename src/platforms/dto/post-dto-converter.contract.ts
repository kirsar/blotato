import type { Post } from '@domain/post';
import type { CreatePostBaseDto, PostResponseBaseDto } from './post.dto';

// One unified action per platform, instead of the API layer branching on platform
// and knowing each one's own field names (mediaProductType, privacyStatus, ...).
// CompositionService only ever calls these two methods; everything platform-specific
// lives in the implementation, next to that platform's own repository and DTOs.
export interface PostDtoConverter {
  createFromDto(post: Post, dto: CreatePostBaseDto): Promise<PostResponseBaseDto>;
  attachToResponse(post: Post): Promise<PostResponseBaseDto>;
}
