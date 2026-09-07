import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { InstagramModule } from '@platforms/instagram/instagram.module';
import { YouTubeModule } from '@platforms/youtube/youtube.module';
import { RepositoryModule } from '@repository/repository.module';
import { AccountController } from './api/account/account.controller';
import { ApiKeyGuard } from './api/api-key.guard';
import { CommentController } from './api/comment/comment.controller';
import { CommentService } from './api/comment/comment.service';
import { CompositionController } from './api/composition/composition.controller';
import { CompositionService } from './api/composition/composition.service';
import { PlatformController } from './api/platform/platform.controller';
import { HealthModule } from './health/health.module';

// No custom exception filter — every thrown error is now one of Nest's own
// HttpException subclasses, so Nest's built-in default filter already produces
// the right { statusCode, message, error } response with no wiring needed.
//
// Imports InstagramModule/YouTubeModule directly rather than PlatformsModule —
// the web process only needs their extension-repository tokens (for
// CompositionService); ProviderRegistry/DiscoveryModule are a worker-only
// concern now that nothing here calls a provider directly.
@Module({
  imports: [RepositoryModule, HealthModule, InstagramModule, YouTubeModule],
  controllers: [AccountController, PlatformController, CompositionController, CommentController],
  providers: [
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    CompositionService,
    CommentService,
  ],
})
export class ApiRootModule {}
