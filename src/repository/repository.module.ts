import { Inject, Module, type OnModuleInit } from '@nestjs/common';
import type { AccountRepository } from './account.repository.contract';
import { InMemoryAccountRepository } from './in-memory/account.repository';
import { InMemoryCommentRepository } from './in-memory/comment.repository';
import { InMemoryCompositionRepository } from './in-memory/composition.repository';
import { InMemoryPostRepository } from './in-memory/post.repository';
import { InMemoryPostScheduleRepository } from './in-memory/post-schedule.repository';
import { InMemoryUserRepository } from './in-memory/user.repository';
import { seedAccounts, seedUser } from './in-memory/seed';
import type { UserRepository } from './user.repository.contract';
import {
  ACCOUNT_REPOSITORY,
  COMMENT_REPOSITORY,
  COMPOSITION_REPOSITORY,
  POST_REPOSITORY,
  POST_SCHEDULE_REPOSITORY,
  USER_REPOSITORY,
} from './tokens';

@Module({
  providers: [
    { provide: ACCOUNT_REPOSITORY, useClass: InMemoryAccountRepository },
    { provide: COMMENT_REPOSITORY, useClass: InMemoryCommentRepository },
    { provide: COMPOSITION_REPOSITORY, useClass: InMemoryCompositionRepository },
    { provide: POST_REPOSITORY, useClass: InMemoryPostRepository },
    { provide: POST_SCHEDULE_REPOSITORY, useClass: InMemoryPostScheduleRepository },
    { provide: USER_REPOSITORY, useClass: InMemoryUserRepository },
  ],
  exports: [
    ACCOUNT_REPOSITORY,
    COMMENT_REPOSITORY,
    COMPOSITION_REPOSITORY,
    POST_REPOSITORY,
    POST_SCHEDULE_REPOSITORY,
    USER_REPOSITORY,
  ],
})
export class RepositoryModule implements OnModuleInit {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    await seedUser(this.users);
    await seedAccounts(this.accounts);
  }
}
