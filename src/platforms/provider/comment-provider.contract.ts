import type { Comment } from '@domain/comment';
import type { Post, PostSchedule } from '@domain/post';

// platformCommentId isn't picked from Comment — there it's `string | null` (null
// until our own outbound reply gets confirmed by the platform). A FetchedComment is
// something a provider just read off the platform, so it always has a real id; the
// intersection overrides the field instead of inheriting the nullable version.
export type FetchedComment = Pick<
  Comment,
  'platformAccountId' | 'platformParentCommentId' | 'text' | 'platformCreatedAt'
> & {
  platformCommentId: string;
};

export type FetchedPage = {
  comments: FetchedComment[];
  // null = caught up; only meaningful when the platform's syncMode is 'cursor'.
  nextCursor: string | null;
};

export interface ICommentReader {
  listComments(post: Post, schedule: PostSchedule): Promise<FetchedPage>;
}

export interface ICommentWriter {
  createReply(comment: Comment): Promise<{ platformCommentId: string; platformCreatedAt: Date }>;
  // TODO: isn't wired anywhere since it's dedicated feature to queue comment for deletion
  // and we don't want to have direct access to platforms from API, to be focused on quotas context
  deleteComment(comment: Comment): Promise<void>;
}
