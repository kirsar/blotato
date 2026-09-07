import { Inject, Module, type OnModuleInit } from '@nestjs/common';
import type { AccountRepository } from './account.repository.contract';
import { InMemoryAccountRepository } from './in-memory/account.repository';
import { InMemoryCommentRepository } from './in-memory/comment.repository';
import { InMemoryCompositionRepository } from './in-memory/composition.repository';
import { InMemoryPostRepository } from './in-memory/post.repository';
import { InMemoryPostScheduleRepository } from './in-memory/post-schedule.repository';
import { seedAccounts } from './in-memory/seed';
import {
  ACCOUNT_REPOSITORY,
  COMMENT_REPOSITORY,
  COMPOSITION_REPOSITORY,
  POST_REPOSITORY,
  POST_SCHEDULE_REPOSITORY,
} from './tokens';

@Module({
  providers: [
    { provide: ACCOUNT_REPOSITORY, useClass: InMemoryAccountRepository },
    { provide: COMMENT_REPOSITORY, useClass: InMemoryCommentRepository },
    { provide: COMPOSITION_REPOSITORY, useClass: InMemoryCompositionRepository },
    { provide: POST_REPOSITORY, useClass: InMemoryPostRepository },
    { provide: POST_SCHEDULE_REPOSITORY, useClass: InMemoryPostScheduleRepository },
  ],
  exports: [
    ACCOUNT_REPOSITORY,
    COMMENT_REPOSITORY,
    COMPOSITION_REPOSITORY,
    POST_REPOSITORY,
    POST_SCHEDULE_REPOSITORY,
  ],
})
export class RepositoryModule implements OnModuleInit {
  constructor(@Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository) {}

  async onModuleInit(): Promise<void> {
    await seedAccounts(this.accounts);
  }
}
