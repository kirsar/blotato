import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './jobs/worker.module';
import { CommentPipelineService } from './jobs/comment-pipeline.service';

const POLL_LOOP_MS = 5000;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  const pipeline = app.get(CommentPipelineService);
  const logger = new Logger('Worker');

  logger.log(`Comment pipeline worker started, polling every ${POLL_LOOP_MS}ms`);

  // setTimeout, not setInterval — a pass can outrun the tick and the two would
  // overlap, running two claim rounds concurrently against the same due schedules.
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
