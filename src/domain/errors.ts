// ── AppError hierarchy — HTTP-facing (2.api-surface.md's error envelope) ───────
// Caught by AppErrorFilter and mapped to { error: { code, message, details? } }.
// Never thrown by a platform provider directly — see the platform taxonomy below;
// a provider error is translated into one of these at the boundary where an HTTP
// response actually needs to go out (e.g. the synchronous DELETE path).

export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

export class BadRequestError extends AppError {
  readonly code = 'BAD_REQUEST';
  readonly statusCode = 400;
}

export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;
}

export class CompositionNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Composition not found: ${id}`);
  }
}

export class PostNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Post not found: ${id}`);
  }
}

export class CommentNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Comment not found: ${id}`);
  }
}

export class PlatformUnsupportedError extends AppError {
  readonly code = 'PLATFORM_UNSUPPORTED';
  readonly statusCode = 422;
}

export class MaxDepthExceededError extends AppError {
  readonly code = 'MAX_DEPTH_EXCEEDED';
  readonly statusCode = 422;
}

export class TextTooLongError extends AppError {
  readonly code = 'TEXT_TOO_LONG';
  readonly statusCode = 422;
}

export class AutonomyNotPermittedError extends AppError {
  readonly code = 'AUTONOMY_NOT_PERMITTED';
  readonly statusCode = 422;
}

export class RateLimitedError extends AppError {
  readonly code = 'RATE_LIMITED';
  readonly statusCode = 429;
}

export class UnauthorizedError extends AppError {
  readonly code = 'UNAUTHORIZED';
  readonly statusCode = 401;
}

// Translation target when a provider's PlatformApiError/CredentialInvalidError
// (below) surfaces synchronously through the web process, e.g. DELETE /v1/comments/:id.
export class UpstreamPlatformError extends AppError {
  readonly code = 'PLATFORM_API_ERROR';
  readonly statusCode = 502;
}

export class NotImplementedError extends AppError {
  readonly code = 'NOT_IMPLEMENTED';
  readonly statusCode = 501;
}

export class IdempotencyKeyConflictError extends AppError {
  readonly code = 'IDEMPOTENCY_KEY_CONFLICT';
  readonly statusCode = 409;
}

// ── Platform error taxonomy (3.social-media-integration.md) ────────────────────
// Every ICommentProvider failure normalizes to one of these six. Workers switch on
// the error type, never on the platform — that's what keeps platform knowledge
// inside the platform module. The provider states a fact; the caller decides.

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
