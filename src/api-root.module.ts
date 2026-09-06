import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { StorageModule } from '@storage/storage.module';
import { ApiKeyGuard } from './api/api-key.guard';
import { AppErrorFilter } from './api/app-error.filter';
import { HealthModule } from './health/health.module';

@Module({
  imports: [StorageModule, HealthModule],
  providers: [
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_FILTER, useClass: AppErrorFilter },
  ],
})
export class ApiRootModule {}
