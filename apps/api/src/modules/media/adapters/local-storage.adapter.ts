import { mkdir, stat, readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import type { ImageMime } from '@messages/contracts';
import type { MediaConfig } from '../../../config/media-config.js';
import type { ObjectStoragePort, StorageUpload } from '../storage.port.js';
import { assertObjectKey, InvalidStorageObject } from '../storage.port.js';
import { localTicket } from '../local-tickets.js';

export class LocalStorageAdapter implements ObjectStoragePort {
  readonly profile: string;
  constructor(private readonly config: MediaConfig, private readonly secret: string) { this.profile = config.profile; }
  private path(key: string): string {
    assertObjectKey(key);
    const path = resolve(this.config.localRoot, key);
    const child = relative(this.config.localRoot, path);
    if (child.startsWith('..') || isAbsolute(child)) throw new Error('Invalid local object path');
    return path;
  }
  async createUpload(input: StorageUpload) {
    return { url: '/api/media/' + input.mediaId + '/local-upload?' + localTicket(this.secret, input.mediaId, 'upload', input.expiresAt),
      method: 'PUT' as const, headers: { 'Content-Type': input.mime }, expiresAt: input.expiresAt.toISOString() };
  }
  async createRead(mediaId: string, _key: string, _mime: ImageMime, expiresAt: Date): Promise<string> {
    return '/api/media/' + mediaId + '/local-content?' + localTicket(this.secret, mediaId, 'read', expiresAt);
  }
  async head(key: string): Promise<{ bytes: number } | null> {
    try { const info = await stat(this.path(key)); return info.isFile() ? { bytes: info.size } : null; }
    catch (error) { if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null; throw error; }
  }
  async read(key: string, maximum: number): Promise<Buffer> {
    const info = await this.head(key);
    if (!info || info.bytes > maximum) throw new InvalidStorageObject('Invalid object size');
    const bytes = await readFile(this.path(key));
    if (bytes.length > maximum) throw new InvalidStorageObject('Invalid object size');
    return bytes;
  }
  async put(key: string, bytes: Buffer, _mime: ImageMime): Promise<void> {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    try { await writeFile(path, bytes, { flag: 'wx', mode: 0o600 }); }
    catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) throw error;
      const previous = await this.read(key, this.config.maxBytes);
      if (createHash('sha256').update(previous).digest('hex') !== createHash('sha256').update(bytes).digest('hex')) throw new Error('Object already exists with other content');
    }
  }
  async remove(key: string): Promise<void> {
    try { await unlink(this.path(key)); }
    catch (error) { if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error; }
  }
}
