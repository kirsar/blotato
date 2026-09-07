import { describe, expect, it } from 'vitest';
import {
  backoffIntervalSec,
  decayVelocity,
  nextIntervalSec,
  shouldRetire,
  targetYieldIntervalSec,
  withJitter,
  type PollPolicy,
} from './scheduling';

const POLICY: PollPolicy = { minIntervalSec: 60, maxIntervalSec: 21_600, backoffFactor: 2, targetYield: 10 };

describe('targetYieldIntervalSec', () => {
  it('divides targetYield by observed velocity', () => {
    // 10 comments/hour observed -> target 10 comments per poll -> ~1 hour interval.
    const velocityPerSec = 10 / 3600;
    expect(targetYieldIntervalSec(POLICY, velocityPerSec)).toBeCloseTo(3600, 0);
  });

  it('clamps to minIntervalSec for very high velocity', () => {
    expect(targetYieldIntervalSec(POLICY, 1000)).toBe(POLICY.minIntervalSec);
  });

  it('clamps to maxIntervalSec for very low velocity', () => {
    expect(targetYieldIntervalSec(POLICY, 0.0000001)).toBe(POLICY.maxIntervalSec);
  });

  it('treats zero or negative velocity as maxIntervalSec rather than dividing by zero', () => {
    expect(targetYieldIntervalSec(POLICY, 0)).toBe(POLICY.maxIntervalSec);
    expect(targetYieldIntervalSec(POLICY, -1)).toBe(POLICY.maxIntervalSec);
  });
});

describe('backoffIntervalSec', () => {
  it('doubles the current interval', () => {
    expect(backoffIntervalSec(POLICY, 100)).toBe(200);
  });

  it('caps at maxIntervalSec', () => {
    expect(backoffIntervalSec(POLICY, POLICY.maxIntervalSec)).toBe(POLICY.maxIntervalSec);
    expect(backoffIntervalSec(POLICY, POLICY.maxIntervalSec * 0.9)).toBe(POLICY.maxIntervalSec);
  });
});

describe('nextIntervalSec', () => {
  it('recomputes from velocity when the poll returned new comments', () => {
    const velocityPerSec = 10 / 3600;
    const result = nextIntervalSec(POLICY, 60, velocityPerSec, true);
    expect(result).toBeCloseTo(targetYieldIntervalSec(POLICY, velocityPerSec), 5);
  });

  it('backs off instead of snapping to the floor when the poll was empty', () => {
    // The regression this guards: an empty poll must not reset toward minIntervalSec.
    const result = nextIntervalSec(POLICY, 1000, 0, false);
    expect(result).toBe(backoffIntervalSec(POLICY, 1000));
    expect(result).toBeGreaterThan(1000);
  });
});

describe('withJitter', () => {
  it('applies +/-20% around the input using an injected random source', () => {
    expect(withJitter(1000, () => 0)).toBeCloseTo(800, 5); // random()=0 -> factor 0.8
    expect(withJitter(1000, () => 1)).toBeCloseTo(1200, 5); // random()=1 -> factor 1.2
    expect(withJitter(1000, () => 0.5)).toBeCloseTo(1000, 5); // random()=0.5 -> factor 1.0
  });

  it('stays within +/-20% for the real Math.random source', () => {
    for (let i = 0; i < 20; i++) {
      const result = withJitter(1000);
      expect(result).toBeGreaterThanOrEqual(800);
      expect(result).toBeLessThanOrEqual(1200);
    }
  });
});

describe('decayVelocity', () => {
  it('returns the observed rate outright on the first poll (previous is null)', () => {
    expect(decayVelocity(null, 36, 3600)).toBeCloseTo(0.01, 5);
  });

  it('blends previous and observed for subsequent polls', () => {
    const previous = 0.01;
    const observed = 36 / 3600; // 0.01 as well, so blended stays 0.01
    expect(decayVelocity(previous, 36, 3600)).toBeCloseTo(0.01, 5);
  });

  it('weighs the previous value more heavily than one new observation', () => {
    const result = decayVelocity(0.02, 0, 3600); // sudden drop to zero this poll
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(0.02);
  });

  it('treats zero elapsed time as zero observed rate rather than dividing by zero', () => {
    expect(() => decayVelocity(null, 5, 0)).not.toThrow();
    expect(decayVelocity(null, 5, 0)).toBe(0);
  });
});

describe('shouldRetire', () => {
  const created = new Date('2026-01-01T00:00:00.000Z');
  const pollWindowMs = 14 * 24 * 60 * 60 * 1000; // 14 days

  it('is false before the poll window elapses', () => {
    const now = new Date(created.getTime() + pollWindowMs - 1000);
    expect(shouldRetire(created, now, pollWindowMs)).toBe(false);
  });

  it('is true once the poll window has elapsed', () => {
    const now = new Date(created.getTime() + pollWindowMs + 1000);
    expect(shouldRetire(created, now, pollWindowMs)).toBe(true);
  });
});
