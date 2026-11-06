import type { ImageMime } from '@messages/contracts';
import { inputRecord, inputText, requestId, invalidInput } from '../../common/validation/input.js';
import type { MediaConfig } from '../../config/media-config.js';

export const IMAGE_TYPES: ImageMime[] = ['image/jpeg', 'image/png', 'image/webp'];
export const EXTENSION: Record<ImageMime, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export function mediaId(value: unknown): string { return requestId(value); }
export function uploadInput(value: unknown, config: MediaConfig) {
  const fields = inputRecord(value, ['originalName', 'mime', 'bytes', 'requestId', 'purpose']);
  const originalName = inputText(fields.originalName, 'El nombre del archivo', 180);
  if (/[\\/:]/u.test(originalName)) invalidInput('El nombre del archivo no es válido.');
  if (!IMAGE_TYPES.includes(fields.mime as ImageMime)) invalidInput('Solo se admiten imágenes JPEG, PNG y WebP.');
  if (!Number.isSafeInteger(fields.bytes) || Number(fields.bytes) < 1 || Number(fields.bytes) > config.maxBytes) invalidInput('La imagen supera el tamaño permitido.');
  const purpose = fields.purpose ?? 'post';
  if (purpose !== 'post' && purpose !== 'community' && purpose !== 'avatar') invalidInput('La finalidad de la imagen no es válida.');
  return { originalName, mime: fields.mime as ImageMime, bytes: Number(fields.bytes), requestId: requestId(fields.requestId), purpose };
}
export type UploadInput = ReturnType<typeof uploadInput>;
export function imageIds(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 12) invalidInput('La lista de imágenes no es válida.');
  const ids = value.map(mediaId);
  if (new Set(ids).size !== ids.length) invalidInput('No repitas una imagen.');
  return ids;
}
