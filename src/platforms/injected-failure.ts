import { CredentialInvalidError, PlatformApiError, PlatformRejectedError, ThrottledError } from '@domain/errors';

// A deterministic seam so every error in the taxonomy is reachable from Swagger UI
// on demand, with no credentials and no network (3.social-media-integration.md,
// "so ThrottledError, PostUnavailableError and a retry are all reachable... against
// the same two registry entries a reviewer can read"). Bracketed markers embedded
// in caller-controlled text (a post's content, a reply's own text) trigger the
// matching failure; anything else passes through untouched.
//
// PostUnavailableError and CommentGoneError are deliberately not here — they're
// reachable through real, structural conditions instead (a Story/private post, and
// deleting the same reply twice), which is a better demonstration than a magic string.
export function checkInjectedFailure(content: string | null | undefined): void {
  if (!content) return;
  if (content.includes('[[THROTTLE]]')) {
    throw new ThrottledError('Injected failure: throttled', undefined, 30);
  }
  if (content.includes('[[5XX]]')) {
    throw new PlatformApiError('Injected failure: upstream 5xx', 503);
  }
  if (content.includes('[[REJECTED]]')) {
    throw new PlatformRejectedError('Injected failure: rejected by platform', 'INJECTED_REJECTION');
  }
  if (content.includes('[[CREDENTIAL_INVALID]]')) {
    throw new CredentialInvalidError('Injected failure: credential invalid');
  }
}
