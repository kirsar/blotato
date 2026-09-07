import { createHash } from 'node:crypto';
import {
  type CallHandler,
  ConflictException,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable, of, switchMap, tap } from 'rxjs';
import { CommentStatus } from '@domain/comment';
import type { CommentRepository } from '@repository/comment.repository.contract';
import { UniqueConstraintViolationError } from '@repository/in-memory/in-memory-repository';
import { COMMENT_REPOSITORY } from '@repository/tokens';
import { type CommentResponseDto, toCommentResponse } from './comment.dto';

interface RequestWithUserId {
  headers: Record<string, string | string[] | undefined>;
  userId?: string;
  body: unknown;
}

interface ResponseWithHeader {
  setHeader(name: string, value: string): void;
}

// Key order is not part of a JSON body's meaning, so canonicalize before hashing —
// otherwise an identical retry with reordered fields 409s.
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, canonicalize((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

function hashBody(body: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(body)))
    .digest('hex');
}

// The whole idempotency contract (2.api-surface.md) lives here, scoped to exactly
// one endpoint — POST /v1/comments, via @UseInterceptors(CommentIdempotencyInterceptor)
// on CommentController.create() — the controller/service stay completely unaware
// it exists. Comment-specific (not a generic idempotency interceptor other routes
// could reuse) because it reads CommentRepository directly.
//
// How it fits in Nest's pipeline: guard -> interceptor (before) -> handler ->
// interceptor (after). ApiKeyGuard runs first and attaches userId; this interceptor
// then runs BEFORE create()'s body ever executes, and decides whether create() runs
// at all:
//   - no Idempotency-Key header -> calls next.handle() immediately; create() runs
//     completely normally, uninvolved with any of this.
//   - key present, matching hash on file -> create() is never called — the existing
//     comment is returned directly (a replay).
//   - key present, different hash on file -> 409, create() is never called.
//   - key present, nothing on file -> next.handle() runs create() for real, then the
//     result is stamped with idempotencyKey/requestHash before being returned.
// Location is set here too, uniformly across all of the above paths, since this is
// the one place that sees a fresh create and a replay converge into the same shape.
@Injectable()
export class CommentIdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(COMMENT_REPOSITORY) private readonly comments: CommentRepository) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> | Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<RequestWithUserId>();
    const response = context.switchToHttp().getResponse<ResponseWithHeader>();
    const key = request.headers['idempotency-key'];

    const withLocation = (obs: Observable<CommentResponseDto>) =>
      obs.pipe(tap((comment) => response.setHeader('Location', `/v1/comments/${comment.id}`)));

    if (typeof key !== 'string' || key.length === 0) {
      return withLocation(next.handle() as Observable<CommentResponseDto>);
    }

    return this.handleWithKey(request, key, next).then(withLocation);
  }

  private async handleWithKey(
    request: RequestWithUserId,
    key: string,
    next: CallHandler,
  ): Promise<Observable<CommentResponseDto>> {
    const userId = request.userId!;
    const hash = hashBody(request.body);

    const existing = await this.comments.findByIdempotencyKey(userId, key);
    if (existing) {
      if (existing.requestHash !== hash) {
        throw new ConflictException('Idempotency-Key already used with a different request body');
      }
      // A replay is the same resource, not the same bytes — re-serialize current
      // state rather than a cached response, since status may have moved on.
      return of(toCommentResponse(existing));
    }

    return next.handle().pipe(
      switchMap(async (result: CommentResponseDto) => {
        try {
          const updated = await this.comments.update(result.id, { idempotencyKey: key, requestHash: hash });
          return toCommentResponse(updated);
        } catch (err) {
          if (!(err instanceof UniqueConstraintViolationError)) {
            throw err;
          }
          // A concurrent request with the same key won. Strand this duplicate so the
          // publisher never delivers it, and return the winner.
          await this.comments.update(result.id, {
            status: CommentStatus.FAILED,
            errorCode: 'IDEMPOTENCY_RACE',
            errorMessage: 'Superseded by a concurrent request with the same Idempotency-Key',
          });
          const winner = await this.comments.findByIdempotencyKey(userId, key);
          if (!winner) {
            throw err;
          }
          if (winner.requestHash !== hash) {
            throw new ConflictException('Idempotency-Key already used with a different request body');
          }
          return toCommentResponse(winner);
        }
      }),
    );
  }
}
