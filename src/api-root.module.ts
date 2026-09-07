import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PlatformsModule } from '@platforms/platforms.module';
import { RepositoryModule } from '@repository/repository.module';
import { AccountController } from './api/account/account.controller';
import { ApiKeyGuard } from './api/api-key.guard';
import { CommentController } from './api/comment/comment.controller';
import { CommentService } from './api/comment/comment.service';
import { CommentAutomationService } from './api/composition/comment-automation.service';
import { CompositionController } from './api/composition/composition.controller';
import { CompositionService } from './api/composition/composition.service';
import { PlatformController } from './api/platform/platform.controller';
import { HealthModule } from './health/health.module';

// No custom exception filter — every thrown error is now one of Nest's own
// HttpException subclasses, so Nest's built-in default filter already produces
// the right { statusCode, message, error } response with no wiring needed.
//
// Imports PlatformsModule now (not InstagramModule/YouTubeModule directly) — since
// CompositionService dispatches post DTO conversion through PostDtoConverterRegistry,
// the web process needs discovery too. See platforms.module.ts's comment for the
// tradeoff this brings along (ProviderRegistry riding in with it, for now unused).
@Module({
  imports: [RepositoryModule, HealthModule, PlatformsModule],
  controllers: [AccountController, PlatformController, CompositionController, CommentController],
  providers: [
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    CompositionService,
    CommentAutomationService,
    CommentService,
  ],
})
export class ApiRootModule {}
