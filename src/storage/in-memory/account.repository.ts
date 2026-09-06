import { Injectable } from '@nestjs/common';
import type { SocialAccount } from '@domain/social-account';
import type { AccountRepository } from '@storage/account.repository.contract';
import { InMemoryRepository, type UniqueKeySpec } from './in-memory-repository';

const uniqueAccount: UniqueKeySpec<SocialAccount> = {
  name: 'userId_platform_platformAccountId',
  keyOf: (a) => `${a.userId}::${a.platform}::${a.platformAccountId}`,
};

@Injectable()
export class InMemoryAccountRepository
  extends InMemoryRepository<SocialAccount>
  implements AccountRepository
{
  constructor() {
    super((a) => a.id, [uniqueAccount]);
  }

  async create(account: SocialAccount): Promise<SocialAccount> {
    return this.insert(account);
  }

  async findById(id: string): Promise<SocialAccount | null> {
    return super.findById(id);
  }

  async listByUserId(userId: string): Promise<SocialAccount[]> {
    return this.all().filter((a) => a.userId === userId);
  }
}
