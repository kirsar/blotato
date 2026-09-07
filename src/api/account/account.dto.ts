import type { PlatformId } from '@domain/platform-id';
import type { SocialAccount } from '@domain/social-account';

// The field list here is what makes the exclusion real: credentialRef has no slot
// on this class, so accidentally assigning it in toAccountResponse below is a
// compile error (excess-property check), not a runtime mapper someone forgot to
// update (1.overall-architecture.md, "Enforcing a security boundary in the type system").
export class AccountResponseDto implements Omit<SocialAccount, 'credentialRef' | 'userId'> {
  id!: string;
  platform!: PlatformId;
  platformAccountId!: string;
  displayName!: string;
  createdAt!: Date;
}

export function toAccountResponse(account: SocialAccount): AccountResponseDto {
  return {
    id: account.id,
    platform: account.platform,
    platformAccountId: account.platformAccountId,
    displayName: account.displayName,
    createdAt: account.createdAt,
  };
}
