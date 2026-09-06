import type { Composition } from './composition';
import type { PostSchedule } from './post';
import type { User } from './user';

// Ordered — each level switches on one more worker down the pipeline.
export enum AutomationLevel {
  OFF = 'OFF',
  COLLECT = 'COLLECT',
  DRAFT = 'DRAFT',
  REPLY = 'REPLY',
}

// can't use int values for DB compat
const RANK: Record<AutomationLevel, number> = {
  [AutomationLevel.OFF]: 0,
  [AutomationLevel.COLLECT]: 1,
  [AutomationLevel.DRAFT]: 2,
  [AutomationLevel.REPLY]: 3,
};

export function rank(level: AutomationLevel): number {
  return RANK[level];
}

function lowest(levels: AutomationLevel[]): AutomationLevel {
  return levels.reduce((min, level) => (rank(level) < rank(min) ? level : min));
}

/**
 * effective = min(user.max, composition ?? REPLY, schedule ?? REPLY).
 * A null rung must be min's identity (REPLY), not OFF, or an unset override would
 * silently disable a post. Every rung can only lower — nothing can promote past the
 * account's own ceiling, which is what makes lowering it a working kill switch: the
 * effective value is derived here, never stored, so dropping the ceiling stops
 * everything on the next poll rather than requiring a sweep across every row.
 */
export function effective(
  user: Pick<User, 'maxCommentAutomationLevel'>,
  composition: Pick<Composition, 'commentAutomationLevel'>,
  schedule: Pick<PostSchedule, 'commentAutomationLevel'> | null,
): AutomationLevel {
  return lowest([
    user.maxCommentAutomationLevel,
    composition.commentAutomationLevel ?? AutomationLevel.REPLY,
    schedule?.commentAutomationLevel ?? AutomationLevel.REPLY,
  ]);
}
