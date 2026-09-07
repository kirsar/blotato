import { IsIn, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AutomationLevel } from '@domain/automation';

// Only COLLECT/REPLY are settable here — DRAFT is out of scope end to end
// (2.api-surface.md, "Only draft is out of scope"), and OFF isn't a valid
// `requested` value at all: turning automation off entirely is what DELETE does,
// not a level this body can carry.
const SETTABLE_LEVELS = [AutomationLevel.COLLECT, AutomationLevel.REPLY] as const;

// Empty body -> requested is absent -> effective falls back to the account ceiling.
// A present level may only lower the ceiling, never raise it (422 otherwise, in the
// service) — never a silent downgrade or a silent no-op raise.
export class PutAutomationDto {
  @ApiProperty({ enum: SETTABLE_LEVELS, required: false })
  @IsOptional()
  @IsIn(SETTABLE_LEVELS)
  level?: AutomationLevel;
}

// social Post, not http POST
export class PostAutomationStatusDto {
  postId!: string;
  lastSyncedAt!: Date | null;
  nextPollAfter!: Date | null;
  retiredAt!: Date | null;
}

// requested/ceiling/effective are three different things, not three settings of one
// thing (2.api-surface.md) — effective is derived and stored nowhere, so this is the
// only place a caller can see it. posts is per-post so "will this post actually be
// polled" is answerable without a second call.
export class AutomationResponseDto {
  requested!: AutomationLevel | null;
  ceiling!: AutomationLevel;
  effective!: AutomationLevel;
  posts!: PostAutomationStatusDto[];
}
