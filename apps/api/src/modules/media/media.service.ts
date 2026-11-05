import { Inject, Injectable } from '@nestjs/common';
import type { BeforeApplicationShutdown, OnModuleInit } from '@nestjs/common';
import type { MediaUploadIntent } from '@messages/contracts';
import { APP_CONFIG, APP_LOGGER } from '../../config/app-config.js';
import type { AppConfig, AppLogger } from '../../config/app-config.js';
import { HttpError } from '../../common/errors/http-error.js';
import type { AuthContext } from '../auth/auth.types.js';
import { OBJECT_STORAGE, InvalidStorageObject } from './storage.port.js';
import type { ObjectStoragePort } from './storage.port.js';
import { MediaRepository, mediaMetadata } from './media.repository.js';
import type { MediaRow } from './media.repository.js';
import { IMAGE_TYPES, uploadInput } from './media-validation.js';
import { normalizeImage } from './image-validator.js';
import { verifyLocalTicket } from './local-tickets.js';

@Injectable()
export class MediaService implements OnModuleInit, BeforeApplicationShutdown {
  private timer: ReturnType<typeof setInterval> | undefined;
  private cleanupWork: Promise<void> | undefined;
  private validating = false;
  constructor(@Inject(APP_CONFIG) readonly config: AppConfig, @Inject(APP_LOGGER) private readonly logger: AppLogger,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort, @Inject(MediaRepository) readonly repository: MediaRepository) {}
  options() { return { allowedTypes: IMAGE_TYPES, maxBytes: this.config.media.maxBytes, maxPerPost: this.config.media.maxPerPost }; }
  onModuleInit() {
    this.timer = setInterval(() => {
      if (this.cleanupWork) return;
      this.cleanupWork = this.cleanup().catch(() => { this.logger.error('media_cleanup_failed'); }).finally(() => { this.cleanupWork = undefined; });
    }, this.config.media.cleanupSeconds * 1000);
    this.timer.unref();
  }
  async beforeApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    await this.cleanupWork;
  }
  private async operation<T>(name: string, action: () => Promise<T>): Promise<T> {
    await this.repository.metric(name);
    return action();
  }
  async authorize(body: unknown, actor: AuthContext): Promise<MediaUploadIntent> {
    const row = await this.repository.authorize(uploadInput(body, this.config.media), actor);
    if (row.state !== 'PENDING' || new Date(row.upload_expires_at).getTime() <= Date.now()) {
      throw new HttpError(409, 'MEDIA_UPLOAD_EXPIRED', 'Esta autorización ya se utilizó o caducó. Vuelve a seleccionar la imagen.');
    }
    const upload = await this.operation('upload_url', () => this.storage.createUpload({
      mediaId: row.id, key: row.staging_key, mime: row.declared_mime, bytes: Number(row.declared_bytes), expiresAt: new Date(row.upload_expires_at),
    }));
    return { media: mediaMetadata(row), upload };
  }
  async complete(id: string, actor: AuthContext) {
    // Decodificar una imagen a la vez limita la memoria del proceso.
    if (this.validating) throw new HttpError(409, 'MEDIA_PROCESSING', 'Estamos verificando otra imagen. Inténtalo de nuevo en unos segundos.');
    this.validating = true;
    let row: MediaRow | undefined;
    try {
      row = await this.repository.claimVerification(id, actor);
      if (row.state === 'READY') return mediaMetadata(row);
      const current = row;
      const info = await this.operation('object_head', () => this.storage.head(current.staging_key));
      if (!info) throw new HttpError(409, 'MEDIA_NOT_UPLOADED', 'La imagen todavía no se ha subido. Vuelve a intentarlo.');
      if (info.bytes !== Number(row.declared_bytes) || info.bytes > this.config.media.maxBytes || (info.mime && info.mime !== row.declared_mime)) throw new HttpError(400, 'MEDIA_INVALID_CONTENT', 'El archivo subido no coincide con el autorizado.');
      const bytes = await this.operation('object_read', () => this.storage.read(current.staging_key, this.config.media.maxBytes));
      if (bytes.length !== Number(row.declared_bytes)) throw new HttpError(400, 'MEDIA_INVALID_CONTENT', 'El tamaño del archivo no coincide con el autorizado.');
      const normalized = await normalizeImage(bytes, row.declared_mime, this.config.media);
      await this.repository.renewLease(row);
      await this.operation('object_write', () => this.storage.put(current.object_key, normalized.bytes, normalized.mime));
      return mediaMetadata(await this.repository.confirmed(row, normalized, actor));
    } catch (cause) {
      if (row?.state === 'VERIFYING') await this.repository.verificationFailed(row, cause instanceof InvalidStorageObject || (cause instanceof HttpError && cause.code === 'MEDIA_INVALID_CONTENT')).catch(() => this.logger.error('media_state_update_failed'));
      if (cause instanceof InvalidStorageObject) throw new HttpError(400, 'MEDIA_INVALID_CONTENT', 'El archivo supera el tamaño permitido.');
      if (cause instanceof HttpError) throw cause;
      throw new HttpError(503, 'MEDIA_PROVIDER_UNAVAILABLE', 'No pudimos verificar la imagen. Puedes volver a intentarlo.');
    } finally { this.validating = false; }
  }
  async readUrl(id: string, userId: string | null) {
    const row = await this.repository.view(id, userId);
    if (row.state !== 'READY') throw new HttpError(409, 'MEDIA_NOT_READY', 'Esta imagen todavía no está disponible.');
    const expiresAt = new Date(Date.now() + this.config.media.readSeconds * 1000);
    const url = await this.operation('read_url', () => this.storage.createRead(row.id, row.object_key, row.validated_mime!, expiresAt));
    return { url, expiresAt: expiresAt.toISOString() };
  }
  async remove(id: string, actor: AuthContext) {
    const row = await this.repository.beginDelete(id, actor);
    if (row.state === 'DELETED') return { state: 'DELETED' as const };
    try {
      await this.repository.renewLease(row);
      await this.operation('object_delete', () => this.storage.remove(row.object_key));
      if (new Date(row.upload_expires_at).getTime() + 60000 <= Date.now()) await this.operation('object_delete', () => this.storage.remove(row.staging_key));
      await this.repository.finishCleanup(row, true);
      return { state: 'DELETED' as const };
    } catch {
      await this.repository.cleanupFailed(row).catch(() => this.logger.error('media_cleanup_schedule_failed'));
      return { state: 'DELETING' as const };
    }
  }
  async authorizeLocalUpload(id: string, query: Record<string, unknown>, actor: AuthContext, contentType: string | undefined) {
    if (this.config.media.driver !== 'local') throw new HttpError(404, 'NOT_FOUND', 'No encontramos esta dirección.');
    verifyLocalTicket(this.config.auth?.secret ?? '', id, 'upload', query);
    const row = await this.repository.view(id, actor.user.id);
    if (row.owner_id !== actor.user.id || row.state !== 'PENDING' || new Date(row.upload_expires_at).getTime() <= Date.now()) throw new HttpError(409, 'MEDIA_UPLOAD_EXPIRED', 'La autorización de subida ya no está disponible.');
    if (contentType !== row.declared_mime) throw new HttpError(415, 'MEDIA_INVALID_TYPE', 'El formato no coincide con la imagen autorizada.');
    return row;
  }
  async acceptLocal(id: string, query: Record<string, unknown>, actor: AuthContext, mime: string | undefined, bytes: unknown) {
    const row = await this.authorizeLocalUpload(id, query, actor, mime);
    if (!Buffer.isBuffer(bytes) || bytes.length !== Number(row.declared_bytes) || bytes.length > this.config.media.maxBytes) throw new HttpError(400, 'MEDIA_INVALID_CONTENT', 'El tamaño de la imagen no coincide con el autorizado.');
    await this.operation('local_upload', () => this.storage.put(row.staging_key, bytes, row.declared_mime));
    return { ok: true };
  }
  async localContent(id: string, query: Record<string, unknown>) {
    if (this.config.media.driver !== 'local') throw new HttpError(404, 'NOT_FOUND', 'No encontramos esta dirección.');
    verifyLocalTicket(this.config.auth?.secret ?? '', id, 'read', query);
    const row = await this.repository.get(id);
    this.repository.profile(row);
    if (row.state !== 'READY') throw new HttpError(404, 'MEDIA_NOT_FOUND', 'Esta imagen no está disponible.');
    const bytes = await this.operation('local_read', () => this.storage.read(row.object_key, this.config.media.maxBytes));
    return { bytes, mime: row.validated_mime! };
  }
  async cleanup() {
    for (const row of await this.repository.claimCleanup()) {
      try {
        await this.repository.renewLease(row);
        const all = row.state !== 'READY';
        if (all) await this.operation('object_delete', () => this.storage.remove(row.object_key));
        await this.operation('object_delete', () => this.storage.remove(row.staging_key));
        await this.repository.finishCleanup(row, all);
      } catch {
        await this.repository.cleanupFailed(row);
        this.logger.error('media_object_cleanup_failed', { mediaId: row.id });
      }
    }
    await this.repository.pruneAudit();
  }
}
