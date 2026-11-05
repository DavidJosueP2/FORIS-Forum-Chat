import type { CreateForumPost, CreateForumReply } from '@messages/contracts';
import { HttpError } from '../../common/errors/http-error.js';
import { imageIds } from '../media/media-validation.js';

const UUID = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu;
function invalid(message: string): never { throw new HttpError(400, 'INVALID_INPUT', message); }
function record(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !fields.includes(key))) invalid('Los datos de la publicación no son válidos.');
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, maximum: number, multiline = false): string {
  if (typeof value !== 'string') invalid(label + ' debe ser texto.');
  const result = value.replaceAll('\r\n', '\n').trim();
  if (!result || result.length > maximum || [...result].some(character => {
    const point = character.codePointAt(0) ?? 0;
    return (point < 32 && !(multiline && (point === 10 || point === 9))) || point === 127;
  })) invalid(label + ' debe contener entre 1 y ' + maximum + ' caracteres válidos.');
  return result;
}
function uuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) invalid('El identificador de la solicitud no es válido.');
  return value.toLowerCase();
}
export function forumId(value: unknown): string {
  if (typeof value !== 'string' || !/^[1-9]\d{0,18}$/u.test(value) || BigInt(value) > 9223372036854775807n) invalid('La publicación no es válida.');
  return value;
}
export function createPostInput(value: unknown): CreateForumPost {
  const fields = record(value, ['title','body','topicId','requestId','communityId','mediaIds']);
  const topicId = text(fields.topicId, 'El tópico', 32);
  if (!/^[a-z][a-z0-9-]*$/u.test(topicId)) invalid('El tópico no es válido.');
  return { title: text(fields.title, 'El título', 160), body: text(fields.body, 'La publicación', 10000, true), topicId, requestId: uuid(fields.requestId),
    communityId: fields.communityId === undefined ? undefined : forumId(fields.communityId), mediaIds: imageIds(fields.mediaIds) };
}
export function createReplyInput(value: unknown): CreateForumReply {
  const fields = record(value, ['body','requestId']);
  return { body: text(fields.body, 'La respuesta', 5000, true), requestId: uuid(fields.requestId) };
}
export interface ForumFilters { topic?: string; author?: string; search?: string; before?: string; community?: string; limit: number }
export function forumFilters(query: Record<string, unknown>): ForumFilters {
  const before = query.before === undefined ? undefined : forumId(query.before);
  const rawLimit = query.limit ?? '20';
  if (typeof rawLimit !== 'string' || !/^\d{1,2}$/u.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 50) invalid('El límite debe estar entre 1 y 50.');
  let topic: string | undefined;
  if (query.topic !== undefined) {
    if (typeof query.topic !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/u.test(query.topic)) invalid('El tópico no es válido.');
    topic = query.topic;
  }
  const author = query.author === undefined ? undefined : uuid(query.author);
  const search = query.search === undefined || query.search === '' ? undefined : text(query.search, 'La búsqueda', 120);
  const community = query.community === undefined ? undefined : forumId(query.community);
  return { topic, author, search, before, community, limit: Number(rawLimit) };
}
