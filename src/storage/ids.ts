import { createId } from '@paralleldrive/cuid2';

// Re-exported rather than imported directly at call sites, so swapping the id
// library later is a one-line change here, not a call-site change.
export { createId };
