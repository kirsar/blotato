// Gates pollability; terminal — a Story never becomes commentable (1.overall-architecture.md).
export type InstagramMediaProductType = 'FEED' | 'REELS' | 'STORY' | 'AD';

export interface InstagramPost {
  postId: string;
  mediaProductType: InstagramMediaProductType;
}
