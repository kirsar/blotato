import { Module } from '@nestjs/common';
import { RepositoryModule } from '@repository/repository.module';
import { REPLY_GENERATOR } from './reply-generator.contract';
import { StubReplyGenerator } from './stub-reply-generator';

@Module({
  imports: [RepositoryModule],
  providers: [{ provide: REPLY_GENERATOR, useClass: StubReplyGenerator }],
  exports: [REPLY_GENERATOR],
})
export class AgentModule {}
