import { PLATFORMS } from '@platforms/registry';
import type { PostComments } from './reply-generator.contract';

export class BatchIntegrityError extends Error {
  constructor(entityId: string) {
    super(`Batch integrity violated by entity: ${entityId}`);
    this.name = 'BatchIntegrityError';
  }
}

// The demo has no token cost to divide, so this stands in for the real formula
// (4.agentic-integration.md, "Maximizing the batch") — output budget is the only
// cap implemented; claim duration and retry blast radius are recorded there but not
// enforced here.
const OUTPUT_BUDGET_CHARS = 20_000;

// Groups claimed (post, pending-comments) pairs by (userId, accountId) — the batch
// key that cannot be relaxed (4.agentic-integration.md, "Batch partitioning"). Every
// pair in one group shares a tenant and a connected account, so one generation call
// never mixes brand voice or crosses a tenant boundary. postId deliberately does not
// partition — several posts share a call, each as its own tuple.
export function partitionByAccount(commentsBatch: PostComments[]): PostComments[][] {
  const groups = new Map<string, PostComments[]>();
  for (const postWithComments of commentsBatch) {
    const [post] = postWithComments;
    const key = `${post.userId}::${post.accountId}`;
    const group = groups.get(key);
    if (group) {
      group.push(postWithComments);
    } else {
      groups.set(key, [postWithComments]);
    }
  }
  return [...groups.values()];
}

// The worker bypasses RLS, so this is what actually stands between a claim batch and
// a cross-tenant prompt — an assertion, not a convention (4.agentic-integration.md).
// Checks comments as well as posts: Comment.userId/accountId are denormalized, and
// this is the one place a mismatch against the post's own values would matter.
// batching by account guarantees also being within same platfrom
export function assertSingleKey(commentsBatch: PostComments[]): void {
  if (commentsBatch.length === 0) {
    return;
  }
  const [[first]] = commentsBatch;
  for (const [post, comments] of commentsBatch) {
    if (post.userId !== first.userId || post.accountId !== first.accountId) {
      throw new BatchIntegrityError(post.id);
    }
    for (const comment of comments) {
      if (comment.userId !== first.userId || comment.accountId !== first.accountId) {
        throw new BatchIntegrityError(comment.id);
      }
    }
  }
}

// Caps one partition to what a single generation call may safely hold. Every reply
// may cost up to the platform's maxCommentLength, so that bounds how many comments
// one call can cover; comments beyond the cap are left for the next claim, not
// dropped. Assumes every pair in `pairs` already shares one platform (true once
// partitionByAccount has run, since accountId determines platform).
export function capBatch(commentsBatch: PostComments[]): PostComments[] {
  if (commentsBatch.length === 0) {
    return [];
  }
  const [[firstPost]] = commentsBatch;
  const { maxCommentLength } = PLATFORMS[firstPost.platform];
  let remaining = Math.max(1, Math.floor(OUTPUT_BUDGET_CHARS / maxCommentLength));

  const capped: PostComments[] = [];
  for (const [post, comments] of commentsBatch) {
    if (remaining <= 0) {
      break;
    }

    const take = comments.slice(0, remaining);

    if (take.length > 0) {
      capped.push([post, take]);
    }

    remaining -= take.length;
  }
  return capped;
}
