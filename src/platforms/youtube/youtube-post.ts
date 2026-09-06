// Gates pollability; transient — privacy can flip back, so suspend rather than retire.
export type YouTubePrivacyStatus = 'public' | 'unlisted' | 'private';

export interface YouTubePost {
  postId: string;
  privacyStatus: YouTubePrivacyStatus;
}
