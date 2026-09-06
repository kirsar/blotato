import type { SocialAccount } from '@domain/social-account';

export interface AccountRepository {
  create(account: SocialAccount): Promise<SocialAccount>;
  findById(id: string): Promise<SocialAccount | null>;
  listByUserId(userId: string): Promise<SocialAccount[]>;
}
