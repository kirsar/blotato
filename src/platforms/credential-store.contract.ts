export interface Credential {
  token: string;
}

// purpose is what makes YouTube expressible — a project-level key for reads plus
// per-account OAuth for writes — without every provider method needing its own
// signature (3.social-media-integration.md, "Credentials are resolved by purpose").
export interface ICredentialStore {
  resolve(accountId: string, purpose: 'read' | 'write'): Promise<Credential>;
}

export const CREDENTIAL_STORE = 'CREDENTIAL_STORE';
