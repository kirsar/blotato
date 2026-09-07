import { describe, expect, it } from 'vitest';
import { InMemoryPostScheduleRepository } from './post-schedule.repository';

describe('InMemoryPostScheduleRepository — claimDue', () => {
  it('claims only rows that are due and not retired, oldest first', async () => {
    const repo = new InMemoryPostScheduleRepository();
    const base = {
      commentAutomationLevel: null,
      pollIntervalSec: 60,
      emptyPollCount: 0,
      commentVelocity: null,
      cursor: null,
      lastSyncedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    await repo.upsert({
      ...base,
      postId: 'due_later',
      nextPollAfter: new Date('2026-01-01T00:02:00.000Z'),
      retiredAt: null,
    });
    await repo.upsert({
      ...base,
      postId: 'due_earlier',
      nextPollAfter: new Date('2026-01-01T00:01:00.000Z'),
      retiredAt: null,
    });
    await repo.upsert({
      ...base,
      postId: 'retired',
      nextPollAfter: new Date('2026-01-01T00:00:30.000Z'),
      retiredAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await repo.upsert({
      ...base,
      postId: 'not_due_yet',
      nextPollAfter: new Date('2026-01-01T00:10:00.000Z'),
      retiredAt: null,
    });

    const claimed = await repo.claimDue(new Date('2026-01-01T00:05:00.000Z'), 10);

    expect(claimed.map((s) => s.postId)).toEqual(['due_earlier', 'due_later']);
  });
});
