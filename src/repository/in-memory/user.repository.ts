import { Injectable } from '@nestjs/common';
import type { User } from '@domain/user';
import type { UserRepository } from '@repository/user.repository.contract';
import { InMemoryRepository, type UniqueKeySpec } from './in-memory-repository';

const uniqueApiKey: UniqueKeySpec<User> = {
  name: 'hashedApiKey',
  keyOf: (u) => u.hashedApiKey,
};

@Injectable()
export class InMemoryUserRepository extends InMemoryRepository<User> implements UserRepository {
  constructor() {
    super((u) => u.id, [uniqueApiKey]);
  }

  async create(user: User): Promise<User> {
    return this.insert(user);
  }

  async findById(id: string): Promise<User | null> {
    return super.findById(id);
  }

  async findByHashedApiKey(hashedApiKey: string): Promise<User | null> {
    return this.findByUniqueKey('hashedApiKey', hashedApiKey);
  }
}
