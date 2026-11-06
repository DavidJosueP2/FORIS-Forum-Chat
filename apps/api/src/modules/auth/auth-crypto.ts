import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { HttpError } from '../../common/errors/http-error.js';
export const randomToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
export function keyedHash(secret: string, ...parts: string[]): string {
  if (!secret) throw new HttpError(503, 'AUTH_UNAVAILABLE', 'El acceso a cuentas no está disponible ahora.');
  return createHmac('sha256', secret).update(JSON.stringify(parts)).digest('hex');
}
export function equalSecret(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
let runningHashes = 0;
async function derive(value: string, salt: string): Promise<Buffer> {
  if (runningHashes >= 2) throw new HttpError(429, 'AUTH_BUSY', 'Hay varios accesos en curso. Inténtalo en unos segundos.');
  runningHashes++;
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(value, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (error, result) => {
        if (error) reject(error); else resolve(result);
      });
    });
  } finally { runningHashes--; }
}
export async function hashPassword(value: string): Promise<string> {
  const salt = randomBytes(24).toString('base64url');
  return 'scrypt-v1$' + salt + '$' + (await derive(value, salt)).toString('hex');
}
export async function verifyPassword(value: string, hash: string | null): Promise<boolean> {
  const [version, salt, digest] = (hash || '').split('$');
  const valid = version === 'scrypt-v1' && typeof salt === 'string' && typeof digest === 'string' && /^[a-f0-9]{128}$/.test(digest);
  const calculated = await derive(value, valid ? salt : 'foris-dummy-password-salt');
  return valid && equalSecret(calculated.toString('hex'), digest);
}
export function seal(secret: string, data: unknown): string {
  const key = createHash('sha256').update(secret).update('foris-mail-v1').digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from('foris-mail-v1'));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url')).join('.');
}
export function unseal(secret: string, value: string): unknown {
  const [iv, tag, encrypted] = value.split('.').map(part => Buffer.from(part, 'base64url'));
  const key = createHash('sha256').update(secret).update('foris-mail-v1').digest();
  const cipher = createDecipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from('foris-mail-v1'));
  cipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([cipher.update(encrypted), cipher.final()]).toString('utf8'));
}
