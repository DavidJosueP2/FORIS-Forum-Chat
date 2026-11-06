import type { CommunityRef } from './communities.js';
import type { MediaImage } from './media.js';
import type { ForumCategory, ForumTag } from './taxonomy.js';
import type { ForumDocument } from './forum-content.js';

export interface ForumTopic { id: string; name: string; description: string }
export interface ForumAuthor { id: string; displayName: string; avatarId?: string }
export interface ForumPostSummary {
  id: string; title: string; excerpt: string; topic: ForumTopic; author: ForumAuthor;
  replyCount: number; createdAt: string; lastActivityAt: string; community: CommunityRef | null; images: MediaImage[];
  category: ForumCategory | null; tags: ForumTag[];
}
export interface ForumPost extends ForumPostSummary { body: string; content: ForumDocument | null; revision: number; updatedAt: string | null }
export interface ForumReply { id: string; postId: string; body: string; author: ForumAuthor; createdAt: string }
export interface ForumPage<T> { items: T[]; hasMore: boolean; nextCursor: string | null }
export interface CreateForumPost {
  title: string; body?: string; content?: ForumDocument | null; requestId: string; communityId?: string; mediaIds?: string[];
  categoryId?: string | null; tags?: string[];
  /** Compatibilidad temporal con el formulario y los filtros actuales. */
  topicId?: string;
}
export interface CreateForumReply { body: string; requestId: string }
export interface UpdateForumPost {
  title: string; content: ForumDocument; categoryId?: string | null; tags?: string[]; requestId: string; revision: number;
}
export interface CreatedForumReply { reply: ForumReply; replyCount: number; created: boolean }
