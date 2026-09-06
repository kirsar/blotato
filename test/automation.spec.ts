import { describe, expect, it } from 'vitest';
import { AutomationLevel, effective, rank } from '@domain/automation';

const user = (maxCommentAutomationLevel: AutomationLevel) => ({ maxCommentAutomationLevel });
const composition = (commentAutomationLevel: AutomationLevel | null) => ({ commentAutomationLevel });
const schedule = (commentAutomationLevel: AutomationLevel | null) => ({ commentAutomationLevel });

describe('rank', () => {
  it('orders levels OFF < COLLECT < DRAFT < REPLY', () => {
    expect(rank(AutomationLevel.OFF)).toBeLessThan(rank(AutomationLevel.COLLECT));
    expect(rank(AutomationLevel.COLLECT)).toBeLessThan(rank(AutomationLevel.DRAFT));
    expect(rank(AutomationLevel.DRAFT)).toBeLessThan(rank(AutomationLevel.REPLY));
  });
});

describe('effective', () => {
  it('defaults to the account ceiling when nothing lowers it', () => {
    expect(effective(user(AutomationLevel.REPLY), composition(null), null)).toBe(AutomationLevel.REPLY);
  });

  it('treats a null composition rung as the identity, never as OFF', () => {
    // If ?? resolved to OFF instead of REPLY here, an unset override would
    // silently disable every post under it — this is the regression that matters.
    expect(effective(user(AutomationLevel.REPLY), composition(null), schedule(null))).toBe(
      AutomationLevel.REPLY,
    );
  });

  it('is a working kill switch: lowering the account ceiling lowers everything immediately', () => {
    // Worked example from 2.api-surface.md: ceiling REPLY -> effective REPLY, then the
    // account is downgraded to COLLECT -> effective silently becomes COLLECT, with no
    // write to the composition itself.
    expect(effective(user(AutomationLevel.COLLECT), composition(null), schedule(null))).toBe(
      AutomationLevel.COLLECT,
    );
  });

  it('lets the composition lower the ceiling', () => {
    expect(effective(user(AutomationLevel.REPLY), composition(AutomationLevel.COLLECT), null)).toBe(
      AutomationLevel.COLLECT,
    );
  });

  it('lets the post-level schedule lower further than the composition', () => {
    expect(
      effective(user(AutomationLevel.REPLY), composition(AutomationLevel.REPLY), schedule(AutomationLevel.COLLECT)),
    ).toBe(AutomationLevel.COLLECT);
  });

  it('never lets a lower rung promote past the account ceiling', () => {
    expect(
      effective(user(AutomationLevel.COLLECT), composition(AutomationLevel.REPLY), schedule(AutomationLevel.REPLY)),
    ).toBe(AutomationLevel.COLLECT);
  });

  it('OFF at any rung wins over every other rung', () => {
    expect(
      effective(user(AutomationLevel.OFF), composition(AutomationLevel.REPLY), schedule(AutomationLevel.REPLY)),
    ).toBe(AutomationLevel.OFF);

    expect(
      effective(user(AutomationLevel.REPLY), composition(AutomationLevel.OFF), schedule(AutomationLevel.REPLY)),
    ).toBe(AutomationLevel.OFF);

    expect(
      effective(user(AutomationLevel.REPLY), composition(AutomationLevel.REPLY), schedule(AutomationLevel.OFF)),
    ).toBe(AutomationLevel.OFF);
  });
});
