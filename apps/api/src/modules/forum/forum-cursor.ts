import { invalidInput, requestId } from '../../common/validation/input.js';

export interface PostCursor { createdAt: string; id: string }
export function encodePostCursor(row: { createdAt: string; id: string }): string {
  return Buffer.from(JSON.stringify({ v: 1, t: row.createdAt, id: row.id })).toString('base64url');
}
export function decodePostCursor(value: unknown): PostCursor {
  if (typeof value !== 'string' || value.length > 256 || !/^[A-Za-z0-9_-]+$/u.test(value)) invalidInput('El cursor no es válido.');
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.toString('base64url') !== value) invalidInput('El cursor no es válido.');
  let payload: unknown;
  try { payload = JSON.parse(bytes.toString('utf8')); } catch { invalidInput('El cursor no es válido.'); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) invalidInput('El cursor no es válido.');
  const item = payload as Record<string, unknown>;
  if (Object.keys(item).length !== 3 || item.v !== 1 || typeof item.t !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(item.t)
    || !Number.isFinite(Date.parse(item.t)) || new Date(item.t).toISOString() !== item.t) invalidInput('El cursor no es válido.');
  return { createdAt: item.t, id: requestId(item.id) };
}
