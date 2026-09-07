import type { User } from '@domain/user';

export interface UserRepository {
  create(user: User): Promise<User>;
  findById(id: string): Promise<User | null>;
  // ApiKeyGuard's lookup: the presented key is hashed, then matched against the
  // stored hash — the plaintext is never persisted or compared (7.security-multi-tenancy.md).
  findByHashedApiKey(hashedApiKey: string): Promise<User | null>;
}
