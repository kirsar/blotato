import type { PlatformId } from '@platforms/platform-id';

export interface SocialAccount {
  id: string;
  userId: string;
  platform: PlatformId;
  platformAccountId: string;
  displayName: string;
  credentialRef: string;
  createdAt: Date;
}
