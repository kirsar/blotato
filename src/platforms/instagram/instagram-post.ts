import { Post } from "@domain/post";

// Gates pollability; terminal — a Story never becomes commentable (1.overall-architecture.md).
export type InstagramMediaProductType = 'FEED' | 'REELS' | 'STORY' | 'AD';

export interface InstagramPost extends Post {
  mediaProductType: InstagramMediaProductType;
}
