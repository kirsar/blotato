import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { CommentStatus, type Comment } from '@domain/comment';
import { PLATFORMS } from '@platforms/registry';
import type { AccountRepository } from '@repository/account.repository.contract';
import { ACCOUNT_REPOSITORY } from '@repository/tokens';
import { createId } from '@repository/create-id';
import type { IReplyGenerator, PostComments } from './reply-generator.contract';

// No token accounting, no cost budget, no conversation context, no model selection —
// on purpose (4.agentic-integration.md, "The generator is a stub"). Every field of a
// reply is derivable from the parent it answers, except the text itself and the
// replying account's own platformAccountId — the latter needs one lookup, not one
// per comment, since assertSingleKey already guarantees a whole batch shares one
// accountId.
@Injectable()
export class StubReplyGenerator implements IReplyGenerator {
  constructor(@Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository) {}

  async generate(batch: PostComments[]): Promise<Comment[]> {
    if (batch.length === 0) {
      return [];
    }

    const [[firstPost]] = batch;
    const account = await this.accounts.findById(firstPost.accountId);
    if (!account) {
      throw new InternalServerErrorException(`Account not found: ${firstPost.accountId}`);
    }

    const now = new Date();
    const replies: Comment[] = [];
    for (const [post, comments] of batch) {
      const { maxCommentLength } = PLATFORMS[post.platform];
      for (const parent of comments) {
        if (parent.text === null) {
          continue;
        }
        replies.push({
          id: createId(),
          userId: parent.userId,
          accountId: parent.accountId,
          platform: parent.platform,
          postId: parent.postId,
          compositionId: parent.compositionId,
          parentCommentId: parent.id,
          platformPostId: parent.platformPostId,
          platformCommentId: null,
          platformParentCommentId: parent.platformCommentId,
          platformAccountId: account.platformAccountId,
          isAuthor: true,
          // The built implementation truncates rather than rejecting — a real
          // generator instead fails an over-length reply outright, since silently
          // cutting one changes what it says (4.agentic-integration.md, "Failures").
          text: `Reply to ${parent.text}`.slice(0, maxCommentLength),
          platformCreatedAt: now,
          status: CommentStatus.QUEUED,
          errorCode: null,
          errorMessage: null,
          idempotencyKey: null,
          requestHash: null,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    return replies;
  }
}
