import type { CreateForumPost, CreateForumReply } from '@messages/contracts';
import { inputRecord, inputText, invalidInput, requestId, resourceId, pageInput } from '../../common/validation/input.js';
import { imageIds } from '../media/media-validation.js';
import { decodePostCursor } from './forum-cursor.js';
import type { PostCursor } from './forum-cursor.js';
import { postTags } from './taxonomy-validation.js';

export function forumId(value: unknown): string { return requestId(value); }
function topicSlug(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/u.test(value)) invalidInput('El tópico no es válido.');
  return value;
}
export function createPostInput(value: unknown): CreateForumPost {
  const fields = inputRecord(value, ['title','body','topicId','categoryId','tags','requestId','communityId','mediaIds']);
  return { title: inputText(fields.title, 'El título', 160), body: inputText(fields.body, 'La publicación', 10000, true),
    topicId: fields.topicId === undefined ? undefined : topicSlug(fields.topicId),
    categoryId: fields.categoryId === undefined || fields.categoryId === null ? fields.categoryId : requestId(fields.categoryId),
    tags: postTags(fields.tags), requestId: requestId(fields.requestId),
    communityId: fields.communityId === undefined ? undefined : resourceId(fields.communityId), mediaIds: imageIds(fields.mediaIds) };
}
export function createReplyInput(value: unknown): CreateForumReply {
  const fields = inputRecord(value, ['body','requestId']);
  return { body: inputText(fields.body, 'La respuesta', 5000, true), requestId: requestId(fields.requestId) };
}
export interface ForumFilters { topic?: string; category?: string; tag?: string; author?: string; search?: string; before?: PostCursor; community?: string; limit: number }
export function forumFilters(query: Record<string, unknown>): ForumFilters {
  const before = query.before === undefined ? undefined : decodePostCursor(query.before);
  const { limit } = pageInput({ limit: query.limit });
  const topic = query.topic === undefined ? undefined : topicSlug(query.topic);
  const category = query.category === undefined ? undefined : requestId(query.category);
  const tag = query.tag === undefined ? undefined : requestId(query.tag);
  const author = query.author === undefined ? undefined : requestId(query.author);
  const search = query.search === undefined || query.search === '' ? undefined : inputText(query.search, 'La búsqueda', 120);
  const community = query.community === undefined ? undefined : resourceId(query.community);
  return { topic, category, tag, author, search, before, community, limit };
}
