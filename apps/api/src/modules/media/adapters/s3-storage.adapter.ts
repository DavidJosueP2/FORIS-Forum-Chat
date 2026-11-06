import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ImageMime } from '@messages/contracts';
import type { MediaConfig } from '../../../config/media-config.js';
import type { ObjectStoragePort, StorageUpload } from '../storage.port.js';
import { assertObjectKey, InvalidStorageObject } from '../storage.port.js';

function status(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('$metadata' in error)) return undefined;
  const metadata = error.$metadata;
  return metadata && typeof metadata === 'object' && 'httpStatusCode' in metadata && typeof metadata.httpStatusCode === 'number' ? metadata.httpStatusCode : undefined;
}
export class S3StorageAdapter implements ObjectStoragePort {
  readonly profile: string;
  private readonly client: S3Client;
  constructor(private readonly config: MediaConfig, client?: S3Client) {
    this.profile = config.profile;
    this.client = client ?? new S3Client({
      endpoint: config.s3.endpoint, region: config.s3.region, forcePathStyle: true, maxAttempts: 2,
      credentials: { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey },
      requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }
  async createUpload(input: StorageUpload) {
    assertObjectKey(input.key);
    const url = await getSignedUrl(this.client, new PutObjectCommand({
      Bucket: this.config.s3.bucket, Key: input.key, ContentType: input.mime,
      Metadata: { 'foris-media-id': input.mediaId },
    }), { expiresIn: Math.max(1, Math.min(300, Math.floor((input.expiresAt.getTime() - Date.now()) / 1000))),
      signableHeaders: new Set(['content-type']) });
    return { url, method: 'PUT' as const, headers: { 'Content-Type': input.mime }, expiresAt: input.expiresAt.toISOString() };
  }
  async createRead(_id: string, key: string, mime: ImageMime, expiresAt: Date): Promise<string> {
    assertObjectKey(key);
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.config.s3.bucket, Key: key,
      ResponseContentType: mime, ResponseContentDisposition: 'inline', ResponseCacheControl: 'private, no-store' }),
    { expiresIn: Math.max(1, Math.min(300, Math.floor((expiresAt.getTime() - Date.now()) / 1000))) });
  }
  async head(key: string) {
    assertObjectKey(key);
    try {
      const info = await this.client.send(new HeadObjectCommand({ Bucket: this.config.s3.bucket, Key: key }), { abortSignal: AbortSignal.timeout(15000) });
      return { bytes: info.ContentLength ?? -1, mime: info.ContentType };
    } catch (error) { if (status(error) === 404) return null; throw error; }
  }
  async read(key: string, maximum: number): Promise<Buffer> {
    assertObjectKey(key);
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.config.s3.bucket, Key: key }), { abortSignal: AbortSignal.timeout(20000) });
    if (!(result.Body instanceof Readable)) throw new Error('Invalid object stream');
    const chunks: Buffer[] = [];
    let bytes = 0;
    try {
      for await (const chunk of result.Body) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > maximum) throw new InvalidStorageObject('Invalid object size');
        chunks.push(buffer);
      }
      return Buffer.concat(chunks);
    } finally { result.Body.destroy(); }
  }
  async put(key: string, bytes: Buffer, mime: ImageMime): Promise<void> {
    assertObjectKey(key);
    try {
      await this.client.send(new PutObjectCommand({ Bucket: this.config.s3.bucket, Key: key, Body: bytes,
        ContentType: mime, ContentLength: bytes.length, CacheControl: 'private, no-store', IfNoneMatch: '*' }),
      { abortSignal: AbortSignal.timeout(20000) });
    } catch (error) {
      if (status(error) !== 412) throw error;
      const previous = await this.read(key, this.config.maxBytes);
      if (createHash('sha256').update(previous).digest('hex') !== createHash('sha256').update(bytes).digest('hex')) throw new Error('Object already exists with other content');
    }
  }
  async remove(key: string): Promise<void> {
    assertObjectKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.s3.bucket, Key: key }), { abortSignal: AbortSignal.timeout(15000) });
  }
}
