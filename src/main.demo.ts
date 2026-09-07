import 'reflect-metadata';
import { Logger, Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NestFactory } from '@nestjs/core';
import { AgentModule } from '@agent/agent.module';
import { PlatformsModule } from '@platforms/platforms.module';
import { RepositoryModule } from '@repository/repository.module';
import { AccountController } from './api/account/account.controller';
import { ApiKeyGuard } from './api/api-key.guard';
import { setupOpenApi } from './api/openapi';
import { CommentController } from './api/comment/comment.controller';
import { CommentService } from './api/comment/comment.service';
import { CommentAutomationService } from './api/composition/comment-automation.service';
import { CompositionController } from './api/composition/composition.controller';
import { CompositionService } from './api/composition/composition.service';
import { PlatformController } from './api/platform/platform.controller';
import { SubscriptionController } from './api/subscription/subscription.controller';
import { HealthModule } from './health/health.module';
import { CommentPipelineService } from './jobs/comment-pipeline.service';

const POLL_LOOP_MS = 5000;

// Demo-only. main.web.ts and main.worker.ts stay separate — that split is what a
// real deployment with a shared database wants — but two separate processes here
// would mean two separate in-memory RepositoryModule instances with no way to see
// each other's writes. This module is ApiRootModule's exact shape plus AgentModule
// and CommentPipelineService added at the same level, so the HTTP surface and the
// pipeline resolve against one shared set of repository instances in one process,
// which is what makes an external HTTP client (src/demo/emulate-agent.ts) watching
// the worker's effects show up on its next GET actually possible.
@Module({
  imports: [RepositoryModule, HealthModule, PlatformsModule, AgentModule],
  controllers: [
    PlatformController,
    AccountController,
    CompositionController,
    CommentController,
    SubscriptionController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    CompositionService,
    CommentAutomationService,
    CommentService,
    CommentPipelineService,
  ],
})
class DemoModule {}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(DemoModule);
  app.setGlobalPrefix('v1', { exclude: ['health'] });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  setupOpenApi(app);
  await app.listen(process.env.PORT ?? 3000);

  const pipeline = app.get(CommentPipelineService);
  const logger = new Logger('Worker');
  logger.log(`Comment pipeline worker started (combined demo process), polling every ${POLL_LOOP_MS}ms`);

  const tick = async (): Promise<void> => {
    try {
      await pipeline.runOnce();
    } catch (err) {
      logger.error(`Pipeline pass failed: ${(err as Error).message}`);
    } finally {
      setTimeout(tick, POLL_LOOP_MS);
    }
  };
  void tick();
}

bootstrap();
