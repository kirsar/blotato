import { Post } from "@domain/post";

// Gates pollability; transient — privacy can flip back, so suspend rather than retire.
export type YouTubePrivacyStatus = 'public' | 'unlisted' | 'private';

export interface YouTubePost extends Post {
  privacyStatus: YouTubePrivacyStatus;
}
