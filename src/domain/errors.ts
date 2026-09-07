// ── Platform error taxonomy (3.social-media-integration.md) ────────────────────
// Every ICommentProvider failure normalizes to one of these six. Workers switch on
// the error type, never on the platform — that's what keeps platform knowledge
// inside the platform module. The provider states a fact; the caller decides.
//
// HTTP-facing errors are Nest's own built-in exceptions (BadRequestException,
// NotFoundException, etc. from @nestjs/common) thrown directly — no custom
// AppError hierarchy. A provider error is translated into one of those at the
// boundary where an HTTP response actually needs to go out (e.g. the synchronous
// DELETE path) — see translateProviderError in comments.service.ts.

export class ThrottledError extends Error {
  constructor(
    message: string,
    readonly resetAt?: Date,
    readonly retryAfterSec?: number,
    readonly usagePct?: number,
  ) {
    super(message);
    this.name = 'ThrottledError';
  }
}

export class PostUnavailableError extends Error {
  constructor(
    message: string,
    readonly permanent: boolean,
  ) {
    super(message);
    this.name = 'PostUnavailableError';
  }
}

export class CommentGoneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommentGoneError';
  }
}

export class PlatformRejectedError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'PlatformRejectedError';
  }
}

export class PlatformApiError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
  ) {
    super(message);
    this.name = 'PlatformApiError';
  }
}

export class CredentialInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialInvalidError';
  }
}
