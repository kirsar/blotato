import { PlatformId } from '@domain/platform-id';

export type SyncMode = 'cursor' | 'since';
export type BudgetUnit = 'calls' | 'units';
export type BudgetScope = 'app' | 'project';

export interface PlatformPollPolicy {
  minIntervalSec: number;
  maxIntervalSec: number;
  backoffFactor: number;
  targetYield: number;
}

export interface PlatformBudget {
  unit: BudgetUnit;
  scope: BudgetScope;
  costPerRead: number;
  costPerWrite: number;
}

export interface Platform {
  name: string;
  enabled: boolean;
  supportsComments: boolean;
  supportsDelete: boolean;
  maxReplyDepth: number;
  maxCommentLength: number;
  syncMode: SyncMode;
  poll: PlatformPollPolicy;
  budget: PlatformBudget;
}

// Capability, scheduling constants and the quota model as a compile-time registry,
// not a database table (5.storage.md, "Platform is code, not a table") — a row can't
// call an API, so a new platform needs a provider class either way.
export const PLATFORMS: Record<PlatformId, Platform> = {
  [PlatformId.INSTAGRAM]: {
    name: 'Instagram',
    enabled: true,
    supportsComments: true,
    supportsDelete: true,
    maxReplyDepth: 1,
    maxCommentLength: 2200,
    syncMode: 'cursor',
    poll: { minIntervalSec: 60, maxIntervalSec: 21_600, backoffFactor: 2, targetYield: 10 },
    budget: { unit: 'calls', scope: 'app', costPerRead: 1, costPerWrite: 1 },
  },
  [PlatformId.YOUTUBE]: {
    name: 'YouTube',
    enabled: true,
    supportsComments: true,
    supportsDelete: true,
    maxReplyDepth: 5,
    maxCommentLength: 10_000,
    syncMode: 'since',
    poll: { minIntervalSec: 300, maxIntervalSec: 43_200, backoffFactor: 2, targetYield: 20 },
    budget: { unit: 'units', scope: 'project', costPerRead: 1, costPerWrite: 50 },
  },
};
