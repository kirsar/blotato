// Adaptive polling interval — target-yield while active, geometric backoff when
// quiet, jitter to decorrelate a fleet scheduled at the same moment, and a poll
// window decoupled from retention so the fleet stops paying for a post that will
// never receive another comment (0.capacity-planning.md, "Mechanism 1"/"Mechanism 2").
// Every export here is a pure function over plain numbers — no I/O, no Date.now()
// baked in — so the caller supplies "now" and this stays trivially testable.

export interface PollPolicy {
  minIntervalSec: number;
  maxIntervalSec: number;
  backoffFactor: number;
  targetYield: number;
}

const JITTER_FRACTION = 0.2;

// Decaying average so recent polls weigh more than older ones without keeping a
// window of raw samples — a straggler comment eight polls ago should matter less
// than one from the last poll.
const VELOCITY_DECAY = 0.7;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// One API call costs the same whether it returns 50 comments or zero, so the
// interval targets comments-per-call rather than a fixed clock tick. A post
// receiving policy.targetYield comments every `interval` seconds gets polled about
// that often; zero observed velocity means "not active," handled by the caller
// falling back to backoffIntervalSec instead of dividing by zero here.
export function targetYieldIntervalSec(policy: PollPolicy, observedVelocityPerSec: number): number {
  if (observedVelocityPerSec <= 0) {
    return policy.maxIntervalSec;
  }
  const raw = policy.targetYield / observedVelocityPerSec;
  return clamp(raw, policy.minIntervalSec, policy.maxIntervalSec);
}

// Doubles the interval on an empty poll, capped at maxIntervalSec. Deliberately does
// not snap back to the floor on its own — that's nextIntervalSec's job when a poll
// returns something — since snapping to the floor on every non-empty poll makes a
// post receiving one straggler comment per day oscillate between the floor and the
// cap forever, quietly eating the budget (0.capacity-planning.md, "Mechanism 1").
export function backoffIntervalSec(policy: PollPolicy, currentIntervalSec: number): number {
  return Math.min(currentIntervalSec * policy.backoffFactor, policy.maxIntervalSec);
}

// The interval a schedule should move to after one poll: recomputed from velocity
// whenever the poll returned anything, backed off otherwise. This is the one
// function a caller actually needs per poll; the two above exist separately because
// each is independently testable and independently named in the design.
export function nextIntervalSec(
  policy: PollPolicy,
  currentIntervalSec: number,
  observedVelocityPerSec: number,
  gotNewComments: boolean,
): number {
  return gotNewComments
    ? targetYieldIntervalSec(policy, observedVelocityPerSec)
    : backoffIntervalSec(policy, currentIntervalSec);
}

// +/-20% randomization so a fleet scheduled at the same minute doesn't stay
// phase-aligned through every doubling step, turning steady load into synchronized
// spikes (0.capacity-planning.md, "Jitter is not optional here"). `random` is
// injectable so tests can pin it instead of asserting on a range.
export function withJitter(intervalSec: number, random: () => number = Math.random): number {
  const jitterFactor = 1 + (random() * 2 - 1) * JITTER_FRACTION;
  return intervalSec * jitterFactor;
}

// Recomputes the decaying comment-velocity average after a poll. `previous` is
// PostSchedule.commentVelocity — null the first time a post is ever polled, in which
// case the freshly observed rate is the whole answer.
export function decayVelocity(
  previousVelocityPerSec: number | null,
  newCommentsCount: number,
  elapsedSec: number,
): number {
  const observed = elapsedSec > 0 ? newCommentsCount / elapsedSec : 0;
  if (previousVelocityPerSec === null) {
    return observed;
  }
  return VELOCITY_DECAY * previousVelocityPerSec + (1 - VELOCITY_DECAY) * observed;
}

// Polling and retention are different windows (0.capacity-planning.md, "Mechanism
// 2") — a post can still be 45-day-retained and queryable while no longer worth
// spending platform quota on. Retiring only sets PostSchedule.retiredAt, so
// re-awakening (a webhook, a UI open, an explicit re-subscribe) can resume it at any
// time; nothing here deletes a row.
export function shouldRetire(scheduleCreatedAt: Date, now: Date, pollWindowMs: number): boolean {
  return now.getTime() - scheduleCreatedAt.getTime() > pollWindowMs;
}
