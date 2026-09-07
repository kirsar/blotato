import { Module } from '@nestjs/common';
import { AgentModule } from '@agent/agent.module';
import { PlatformsModule } from '@platforms/platforms.module';
import { RepositoryModule } from '@repository/repository.module';
import { CommentPipelineService } from './comment-pipeline.service';

@Module({
  imports: [RepositoryModule, PlatformsModule, AgentModule],
  providers: [CommentPipelineService],
  exports: [CommentPipelineService],
})
export class WorkerModule {}
