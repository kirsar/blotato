import { Inject, Injectable } from '@nestjs/common';
import { CredentialInvalidError } from '@domain/errors';
import type { AccountRepository } from '@repository/account.repository.contract';
import { ACCOUNT_REPOSITORY } from '@repository/tokens';
import type { Credential, ICredentialStore } from './credential-store.contract';

// Resolves credentialRef through a fake secrets lookup rather than reading a
// credential column directly — the security boundary is structurally real even
// though the secret behind it isn't (3.social-media-integration.md).
@Injectable()
export class FakeCredentialStore implements ICredentialStore {
  constructor(@Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository) {}

  async resolve(accountId: string, purpose: 'read' | 'write'): Promise<Credential> {
    const account = await this.accounts.findById(accountId);
    if (!account) {
      throw new CredentialInvalidError(`No credential for account: ${accountId}`);
    }
    return { token: `fake:${account.credentialRef}:${purpose}` };
  }
}
