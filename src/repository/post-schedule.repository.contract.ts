import type { PostSchedule } from '@domain/post';

export interface PostScheduleRepository {
  upsert(schedule: PostSchedule): Promise<PostSchedule>;
  findByPostId(postId: string): Promise<PostSchedule | null>;
  update(postId: string, patch: Partial<PostSchedule>): Promise<PostSchedule>;
  // OFF has exactly one representation: no row (5.storage.md). Distinct from a poll
  // window naturally aging out, which sets retiredAt via update() but keeps the row.
  delete(postId: string): Promise<void>;
  // FOR UPDATE SKIP LOCKED stand-in — see in-memory-repository.ts for why this is safe
  // without real locking in a single in-memory process.
  claimDue(now: Date, limit: number): Promise<PostSchedule[]>;
}
