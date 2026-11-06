import type { CreateForumPost, CreateForumReply } from '@messages/contracts';
import { inputRecord, inputText, invalidInput, requestId, resourceId, pageInput } from '../../common/validation/input.js';
import { imageIds } from '../media/media-validation.js';
import { decodePostCursor } from './forum-cursor.js';
import type { PostCursor } from './forum-cursor.js';
import { postTags, filterTagIds } from './taxonomy-validation.js';
import { postDocument } from './forum-content.js';
import type { ForumDocument } from '@messages/contracts';

export function forumId(value: unknown): string { return requestId(value); }
function topicSlug(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/u.test(value)) invalidInput('El tópico no es válido.');
  return value;
}
export type ValidatedPost = CreateForumPost & { body: string; content: ForumDocument | null; mediaIds: string[] };
export function createPostInput(value: unknown): ValidatedPost {
  const fields = inputRecord(value, ['title','body','content','topicId','categoryId','tags','requestId','communityId','mediaIds']);
  const rich = fields.content === undefined ? null : postDocument(fields.content);
  if (rich && (fields.body !== undefined || fields.mediaIds !== undefined)) invalidInput('Envía el documento o el texto anterior, sin mezclar sus campos.');
  return { title: inputText(fields.title, 'El título', 160), body: rich ? rich.body : inputText(fields.body, 'La publicación', 10000, true),
    content: rich?.document ?? null,
    topicId: fields.topicId === undefined ? undefined : topicSlug(fields.topicId),
    categoryId: fields.categoryId === undefined || fields.categoryId === null ? fields.categoryId : requestId(fields.categoryId),
    tags: postTags(fields.tags), requestId: requestId(fields.requestId),
    communityId: fields.communityId === undefined ? undefined : resourceId(fields.communityId), mediaIds: rich ? imageIds(rich.mediaIds) : imageIds(fields.mediaIds) };
}
export function createReplyInput(value: unknown): CreateForumReply {
  const fields = inputRecord(value, ['body','requestId','parentId']);
  return { body: inputText(fields.body, 'El comentario', 5000, true), requestId: requestId(fields.requestId), parentId: fields.parentId === undefined || fields.parentId === null ? null : resourceId(fields.parentId) };
}
export function replyRevision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value >= 2147483647) invalidInput('La versión del comentario no es válida.');
  return value;
}
export function updateReplyInput(value: unknown) {
  const fields = inputRecord(value, ['body', 'revision']);
  return { body: inputText(fields.body, 'El comentario', 5000, true), revision: replyRevision(fields.revision) };
}
export function deleteReplyInput(value: unknown) { return replyRevision(inputRecord(value, ['revision']).revision); }
export function voteInput(value: unknown): -1 | 0 | 1 {
  const vote = inputRecord(value, ['value']).value;
  if (vote !== -1 && vote !== 0 && vote !== 1) invalidInput('El voto no es válido.');
  return vote;
}
export function pinInput(value: unknown): boolean {
  const pinned = inputRecord(value, ['pinned']).pinned;
  if (typeof pinned !== 'boolean') invalidInput('La opción de anclado no es válida.');
  return pinned;
}
export type ValidatedPostUpdate = ValidatedPost & { revision: number };
export function updatePostInput(value: unknown): ValidatedPostUpdate {
  const fields = inputRecord(value, ['title', 'content', 'categoryId', 'tags', 'requestId', 'revision']);
  if (typeof fields.revision !== 'number' || !Number.isInteger(fields.revision) || fields.revision < 1 || fields.revision >= 2147483647) invalidInput('La versión de la publicación no es válida.');
  if (fields.content === undefined) invalidInput('El documento de la publicación es obligatorio.');
  const { revision, ...content } = fields;
  return { ...createPostInput(content), revision: revision as number };
}
export interface ForumFilters { topic?: string; category?: string; tags: string[]; author?: string; search?: string; before?: PostCursor; community?: string; limit: number }
export function forumFilters(query: Record<string, unknown>): ForumFilters {
  const before = query.before === undefined ? undefined : decodePostCursor(query.before);
  const { limit } = pageInput({ limit: query.limit });
  const topic = query.topic === undefined ? undefined : topicSlug(query.topic);
  const category = query.category === undefined ? undefined : requestId(query.category);
  const tags = [...new Set([...filterTagIds(query.tags), ...(query.tag === undefined ? [] : [requestId(query.tag)])])];
  if (tags.length > 8) invalidInput('Elige hasta ocho etiquetas.');
  const author = query.author === undefined ? undefined : requestId(query.author);
  const search = query.search === undefined || query.search === '' ? undefined : inputText(query.search, 'La búsqueda', 120);
  const community = query.community === undefined ? undefined : resourceId(query.community);
  return { topic, category, tags, author, search, before, community, limit };
}
