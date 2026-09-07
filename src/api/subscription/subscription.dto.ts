import { ApiProperty } from '@nestjs/swagger';

// Documents the designed shape (2.api-surface.md, "Subscriptions") for Swagger only —
// the controller never processes this body, it always answers 501. `scope` takes at
// most one key; that and the events/scope validity matrix are exactly the "half-built"
// work SSRF protection can't skip, which is why this stays a stub rather than a real
// handler (2.api-surface.md's own argument for why this was left out entirely, before
// being added back here as a documented placeholder).
export class CreateSubscriptionDto {
  @ApiProperty({ example: 'https://customer.example/hooks/comments' })
  url!: string;

  @ApiProperty({ example: ['comment.created', 'reply.posted'] })
  events!: string[];

  @ApiProperty({
    required: false,
    example: { compositionId: 'cmp_123' },
    description:
      'At most one key — accountId, compositionId, or postId. Omitted means everything this user owns.',
  })
  scope?: { accountId?: string; compositionId?: string; postId?: string };
}
