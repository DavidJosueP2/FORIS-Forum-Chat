import type { CommunityRef } from './communities.js';

export interface ForumTopic { id: string; name: string; description: string }
export interface ForumAuthor { id: string; displayName: string }
export interface ForumPostSummary {
  id: string; title: string; excerpt: string; topic: ForumTopic; author: ForumAuthor;
  replyCount: number; createdAt: string; lastActivityAt: string; community: CommunityRef | null;
}
export interface ForumPost extends ForumPostSummary { body: string }
export interface ForumReply { id: string; postId: string; body: string; author: ForumAuthor; createdAt: string }
export interface ForumPage<T> { items: T[]; hasMore: boolean; nextCursor: string | null }
export interface CreateForumPost { title: string; body: string; topicId: string; requestId: string; communityId?: string }
export interface CreateForumReply { body: string; requestId: string }
export interface CreatedForumReply { reply: ForumReply; replyCount: number; created: boolean }
