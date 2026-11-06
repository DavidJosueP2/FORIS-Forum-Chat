import type { ImageMime, MediaUploadIntent } from '@messages/contracts';

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');
export class InvalidStorageObject extends Error {}
export interface StorageUpload { mediaId: string; key: string; mime: ImageMime; bytes: number; expiresAt: Date }
export interface ObjectStoragePort {
  readonly profile: string;
  createUpload(input: StorageUpload): Promise<MediaUploadIntent['upload']>;
  createRead(mediaId: string, key: string, mime: ImageMime, expiresAt: Date): Promise<string>;
  head(key: string): Promise<{ bytes: number; mime?: string } | null>;
  read(key: string, maximum: number): Promise<Buffer>;
  put(key: string, bytes: Buffer, mime: ImageMime): Promise<void>;
  remove(key: string): Promise<void>;
}
export function assertObjectKey(key: string): void {
  if (!/^foris\/(?:staging|images)\/[\da-f-]{36}\/[\da-f-]{36}\.(?:bin|jpg|png|webp)$/u.test(key)) throw new Error('Invalid managed object key');
}
