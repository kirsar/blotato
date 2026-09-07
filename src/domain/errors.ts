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

// Malformed ?cursor= is client input, not a server fault. Thrown by the repository,
// mapped to 400 by CommentService.list.
export class InvalidCursorError extends Error {
  constructor() {
    super('Malformed cursor');
    this.name = 'InvalidCursorError';
  }
}

// A platform in PLATFORMS has no @PlatformProvider class registered for it. This is
// a wiring fault in our own composition root, not something a platform did to us, so
// it sits outside the six-error taxonomy above — no caller should catch it and back
// off; it means a deploy is broken. Deliberately not a Nest HTTP exception: the only
// caller is the worker (CommentPipelineService), which has no HTTP response to send.
export class PlatformNotSupportedError extends Error {
  constructor(readonly platform: string) {
    super(`No provider registered for platform: ${platform}`);
    this.name = 'PlatformNotSupportedError';
  }
}
