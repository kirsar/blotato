import { createHash } from 'node:crypto';
import { AutomationLevel } from '@domain/automation';
import type { SocialAccount } from '@domain/social-account';
import type { User } from '@domain/user';
import { PlatformId } from '@domain/platform-id';
import type { AccountRepository } from '@repository/account.repository.contract';

// SHA-256, not bcrypt — API keys are high-entropy random tokens, not low-entropy
// human passwords, so they don't need a deliberately slow adaptive hash.
export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

// The only plaintext API key this demo ever issues — the README documents it so a
// reviewer can authenticate against Swagger UI with no setup.
export const SEED_API_KEY = 'demo-api-key';

const SEED_CREATED_AT = new Date('2026-01-01T00:00:00.000Z');

// User is schema-only for this take-home, not wired to real auth
// (5.storage.md, Scope guardrail) — so there is no UserRepository. This constant is
// the demo's single tenant; ApiKeyGuard validates against it directly.
export const SEED_USER: User = {
  id: 'user_demo',
  displayName: 'Demo User',
  hashedApiKey: hashApiKey(SEED_API_KEY),
  maxCommentAutomationLevel: AutomationLevel.REPLY,
  createdAt: SEED_CREATED_AT,
};

export async function seedAccounts(accounts: AccountRepository): Promise<SocialAccount[]> {
  const seeded: SocialAccount[] = [
    {
      // Fixed, not createId() — same reasoning as SEED_USER.id above: a demo seed
      // account has nothing to hide, and a stable id means a Swagger example can
      // reference a real accountId that's actually correct on every boot.
      id: 'account_ig_demo',
      userId: SEED_USER.id,
      platform: PlatformId.INSTAGRAM,
      platformAccountId: 'ig_demo_account',
      displayName: 'Demo Instagram',
      credentialRef: 'secret_ref_ig_demo',
      createdAt: SEED_CREATED_AT,
    },
    {
      id: 'account_ig_demo_2',
      userId: SEED_USER.id,
      platform: PlatformId.INSTAGRAM,
      platformAccountId: 'ig_demo_account_2',
      displayName: 'Demo Instagram (Studio)',
      credentialRef: 'secret_ref_ig_demo_2',
      createdAt: SEED_CREATED_AT,
    },
    {
      id: 'account_yt_demo',
      userId: SEED_USER.id,
      platform: PlatformId.YOUTUBE,
      platformAccountId: 'yt_demo_channel',
      displayName: 'Demo YouTube',
      credentialRef: 'secret_ref_yt_demo',
      createdAt: SEED_CREATED_AT,
    },
    {
      id: 'account_yt_demo_2',
      userId: SEED_USER.id,
      platform: PlatformId.YOUTUBE,
      platformAccountId: 'yt_demo_channel_2',
      displayName: 'Demo YouTube (Vlogs)',
      credentialRef: 'secret_ref_yt_demo_2',
      createdAt: SEED_CREATED_AT,
    },
  ];

  for (const account of seeded) {
    await accounts.create(account);
  }
  return seeded;
}
