import { Injectable } from '@nestjs/common';
import type { PostSchedule } from '@domain/post';
import type { PostScheduleRepository } from '@storage/post-schedule.repository.contract';
import { InMemoryRepository } from './in-memory-repository';

@Injectable()
export class InMemoryPostScheduleRepository
  extends InMemoryRepository<PostSchedule>
  implements PostScheduleRepository
{
  constructor() {
    super((s) => s.postId);
  }

  async upsert(schedule: PostSchedule): Promise<PostSchedule> {
    const existing = await super.findById(schedule.postId);
    return existing ? super.update(schedule.postId, schedule) : this.insert(schedule);
  }

  async findByPostId(postId: string): Promise<PostSchedule | null> {
    return super.findById(postId);
  }

  async update(postId: string, patch: Partial<PostSchedule>): Promise<PostSchedule> {
    return super.update(postId, patch);
  }

  async delete(postId: string): Promise<void> {
    return super.delete(postId);
  }

  // Single in-memory process, single worker loop: there is no second claimant to
  // race against, so this filters and returns rather than needing a real lock. The
  // method exists anyway so the seam matches where `FOR UPDATE SKIP LOCKED` would
  // go on a live Postgres-backed repository (1.overall-architecture.md).
  async claimDue(now: Date, limit: number): Promise<PostSchedule[]> {
    return this.all()
      .filter((s) => s.retiredAt === null && s.nextPollAfter <= now)
      .sort((a, b) => a.nextPollAfter.getTime() - b.nextPollAfter.getTime())
      .slice(0, limit);
  }
}
