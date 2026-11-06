import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from '../../common/errors/http-error.js';

export function localSignature(secret: string, id: string, purpose: 'upload' | 'read', expires: string): string {
  if (secret.length < 32) throw new HttpError(503, 'MEDIA_UNAVAILABLE', 'Las imágenes no están disponibles en este momento.');
  return createHmac('sha256', secret).update(id + '.' + purpose + '.' + expires).digest('hex');
}
export function localTicket(secret: string, id: string, purpose: 'upload' | 'read', date: Date): string {
  const expires = String(Math.floor(date.getTime() / 1000));
  return new URLSearchParams({ expires, signature: localSignature(secret, id, purpose, expires) }).toString();
}
export function verifyLocalTicket(secret: string, id: string, purpose: 'upload' | 'read', query: Record<string, unknown>): void {
  const { expires, signature } = query;
  if (typeof expires !== 'string' || !/^\d{10}$/u.test(expires) || Number(expires) <= Date.now() / 1000
    || typeof signature !== 'string' || !/^[\da-f]{64}$/u.test(signature)
    || !timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(localSignature(secret, id, purpose, expires), 'hex'))) {
    throw new HttpError(403, 'MEDIA_URL_EXPIRED', 'El enlace de la imagen caducó. Vuelve a intentarlo.');
  }
}
