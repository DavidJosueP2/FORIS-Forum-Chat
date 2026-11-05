import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { ImageMime } from '@messages/contracts';
import type { MediaConfig } from '../../config/media-config.js';
import { HttpError } from '../../common/errors/http-error.js';

export function detectedImageType(bytes: Buffer): ImageMime | null {
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}
export async function normalizeImage(bytes: Buffer, declared: ImageMime, config: MediaConfig) {
  if (!bytes.length || bytes.length > config.maxBytes || detectedImageType(bytes) !== declared) throw new HttpError(400, 'MEDIA_INVALID_CONTENT', 'El contenido no corresponde a una imagen permitida.');
  try {
    const image = sharp(bytes, { failOn: 'warning', limitInputPixels: config.maxPixels }).timeout({ seconds: 15 });
    const info = await image.metadata();
    const formats = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };
    if (info.format !== formats[declared]) throw new Error('Unexpected decoded format');
    if (!info.width || !info.height || info.width > 8192 || info.height > 8192 || (info.pages ?? 1) > 1) throw new Error('Invalid image dimensions or animation');
    const rotated = image.rotate();
    const encoder = declared === 'image/jpeg' ? rotated.jpeg({ quality: 88 }) : declared === 'image/png' ? rotated.png() : rotated.webp({ quality: 88 });
    // La recodificación completa decodifica los píxeles y elimina metadatos y contenido añadido.
    const output = await encoder.toBuffer({ resolveWithObject: true });
    if (output.data.length > config.maxBytes) throw new Error('Normalized image too large');
    return { bytes: output.data, mime: declared, width: output.info.width, height: output.info.height,
      checksum: createHash('sha256').update(output.data).digest('hex') };
  } catch {
    throw new HttpError(400, 'MEDIA_INVALID_CONTENT', 'La imagen está dañada, es animada o supera las dimensiones permitidas.');
  }
}
