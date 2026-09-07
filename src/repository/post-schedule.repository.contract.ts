import type { PostSchedule } from '@domain/post';

export interface PostScheduleRepository {
  upsert(schedule: PostSchedule): Promise<PostSchedule>;
  findByPostId(postId: string): Promise<PostSchedule | null>;
  update(postId: string, patch: Partial<PostSchedule>): Promise<PostSchedule>;
  // OFF has exactly one representation: no row (5.storage.md). Distinct from a poll
  // window naturally aging out, which sets retiredAt via update() but keeps the row.
  delete(postId: string): Promise<void>;
  // Stands in for `SELECT ... FOR UPDATE SKIP LOCKED`, but does not implement it: this
  // is a plain read, with no lease and nothing marking a row as claimed. It is safe
  // here only because the demo runs exactly one worker, whose loop chains each pass
  // with setTimeout rather than setInterval (main.worker.ts) so two passes can never
  // overlap. A second worker process against this implementation would claim the same
  // rows and publish every reply twice — a real deployment needs the actual row lock,
  // or a lease column with an expiry (1.overall-architecture.md).
  claimDue(now: Date, limit: number): Promise<PostSchedule[]>;
}
