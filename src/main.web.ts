import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ApiRootModule } from './api-root.module';
import { setupOpenApi } from './api/openapi';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ApiRootModule);
  app.setGlobalPrefix('v1', { exclude: ['health'] });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  setupOpenApi(app);
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
