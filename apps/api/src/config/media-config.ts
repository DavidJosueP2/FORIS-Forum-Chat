import { createHash } from 'node:crypto';
import { resolve, isAbsolute } from 'node:path';

export interface MediaConfig {
  driver: 'local' | 's3'; provider: string; profile: string; localRoot: string;
  s3: { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string };
  maxBytes: number; maxPerPost: number; maxPixels: number; globalBytes: number; userBytes: number;
  uploadSeconds: number; readSeconds: number; orphanHours: number; cleanupSeconds: number; uploadsPerHour: number;
}
function integer(env: NodeJS.ProcessEnv, key: string, fallback: number, min: number, max: number): number {
  const text = env[key] ?? String(fallback);
  if (!/^\d+$/u.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) < min || Number(text) > max) throw new Error(key + ' no es válido.');
  return Number(text);
}
export function readMediaConfig(env: NodeJS.ProcessEnv, root: string): MediaConfig {
  const driver = env.STORAGE_DRIVER ?? (env.NODE_ENV === 'production' ? 's3' : 'local');
  if (driver !== 'local' && driver !== 's3') throw new Error('STORAGE_DRIVER debe ser local o s3.');
  if (driver === 'local' && env.NODE_ENV === 'production') throw new Error('Producción requiere STORAGE_DRIVER=s3.');
  const provider = driver === 'local' ? 'local' : env.S3_PROVIDER || 'r2';
  if (!/^[a-z][a-z0-9-]{0,31}$/u.test(provider)) throw new Error('S3_PROVIDER no es válido.');
  const region = env.S3_REGION || (provider === 'r2' ? 'auto' : 'us-east-1');
  const bucket = env.S3_BUCKET || '';
  const endpoint = env.S3_ENDPOINT || (provider === 'r2' ? '' : 'https://s3.' + region + '.amazonaws.com');
  const accessKeyId = env.S3_ACCESS_KEY_ID || '';
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY || '';
  if (driver === 's3') {
    if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) throw new Error('Completa S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID y S3_SECRET_ACCESS_KEY en el entorno privado.');
    if (provider === 'r2') {
      if (!/^[a-f0-9]{32}$/iu.test(accessKeyId)) {
        throw new Error('S3_ACCESS_KEY_ID no tiene formato de R2: copia el Access Key ID de 32 caracteres hexadecimales desde R2 > Manage API tokens.');
      }
      if (!/^[a-f0-9]{64}$/iu.test(secretAccessKey)) {
        throw new Error('S3_SECRET_ACCESS_KEY no tiene formato de R2: copia el Secret Access Key de 64 caracteres hexadecimales generado para la API S3.');
      }
    }
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u.test(bucket) || !/^[a-z0-9-]{1,40}$/u.test(region)) throw new Error('El bucket o la región S3 no son válidos.');
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('S3_ENDPOINT debe ser un origen HTTPS.');
  }
  const localRoot = isAbsolute(env.STORAGE_LOCAL_ROOT || '') ? resolve(env.STORAGE_LOCAL_ROOT!) : resolve(root, env.STORAGE_LOCAL_ROOT || '.data/uploads');
  const maxBytes = integer(env, 'MEDIA_MAX_IMAGE_BYTES', 5 * 1024 * 1024, 1024, 20 * 1024 * 1024);
  const globalBytes = integer(env, 'MEDIA_GLOBAL_STORAGE_BYTES', 8 * 1024 ** 3, 2 * maxBytes, 1024 ** 4);
  const userBytes = integer(env, 'MEDIA_USER_STORAGE_BYTES', 100 * 1024 ** 2, 2 * maxBytes, globalBytes);
  const identity = driver === 'local' ? localRoot : [provider, endpoint, region, bucket].join('|');
  return {
    driver, provider, profile: driver + ':' + createHash('sha256').update(identity).digest('hex').slice(0, 32), localRoot,
    s3: { endpoint, region, bucket, accessKeyId, secretAccessKey }, maxBytes,
    maxPerPost: integer(env, 'MEDIA_MAX_IMAGES_PER_POST', 3, 1, 12),
    maxPixels: integer(env, 'MEDIA_MAX_IMAGE_PIXELS', 16000000, 1000000, 40000000),
    globalBytes, userBytes,
    uploadSeconds: integer(env, 'MEDIA_UPLOAD_TTL_SECONDS', 300, 30, 300),
    readSeconds: integer(env, 'MEDIA_READ_TTL_SECONDS', 300, 30, 300),
    orphanHours: integer(env, 'MEDIA_ORPHAN_TTL_HOURS', 24, 1, 168),
    cleanupSeconds: integer(env, 'MEDIA_CLEANUP_INTERVAL_SECONDS', 60, 10, 3600),
    uploadsPerHour: integer(env, 'MEDIA_UPLOADS_PER_HOUR', 30, 1, 1000),
  };
}
