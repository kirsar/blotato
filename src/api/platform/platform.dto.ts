import type { PlatformId } from '@domain/platform-id';
import type { Platform } from '@platforms/registry';

// Capability discovery only (2.api-surface.md) — poll/budget internals stay out,
// those are our own scheduling policy, not something a caller needs to see. Derived
// from Platform via Omit, same drift-safety pattern as AccountResponseDto/
// CommentResponseDto: removing/renaming a Platform field fails this build, rather
// than the response silently drifting from the registry's real shape. `id` is
// added rather than picked, since it's the enum key in PLATFORMS, not a field on
// Platform itself.
export class PlatformResponseDto implements Omit<Platform, 'syncMode' | 'poll' | 'budget'> {
  id!: PlatformId;
  name!: string;
  enabled!: boolean;
  supportsComments!: boolean;
  supportsDelete!: boolean;
  maxReplyDepth!: number;
  maxCommentLength!: number;
}

export function toPlatformResponse(id: PlatformId, spec: Platform): PlatformResponseDto {
  return {
    id,
    name: spec.name,
    enabled: spec.enabled,
    supportsComments: spec.supportsComments,
    supportsDelete: spec.supportsDelete,
    maxReplyDepth: spec.maxReplyDepth,
    maxCommentLength: spec.maxCommentLength,
  };
}
