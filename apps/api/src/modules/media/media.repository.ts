import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import type { ImageMime, MediaImage, MediaMetadata, MediaState, MediaUsage } from '@messages/contracts';
import { APP_CONFIG } from '../../config/app-config.js';
import type { AppConfig } from '../../config/app-config.js';
import { DatabaseService } from '../../database/database.service.js';
import { HttpError } from '../../common/errors/http-error.js';
import { SessionService } from '../auth/session.service.js';
import type { AuthContext, SqlClient } from '../auth/auth.types.js';
import type { UploadInput } from './media-validation.js';
import { EXTENSION } from './media-validation.js';
import { readableCommunity, readablePost } from '../communities/community-access.js';

export interface MediaRow extends QueryResultRow {
  id: string; owner_id: string; storage_profile: string; provider: string; staging_key: string; object_key: string;
  request_id: string; original_name: string; declared_mime: ImageMime; declared_bytes: string;
  validated_mime: ImageMime | null; actual_bytes: string; accounted_bytes: string; reserved_bytes: string;
  width: number | null; height: number | null; state: MediaState; checksum: string | null;
  upload_expires_at: Date; cleanup_after: Date; lease_token: string | null; lease_until: Date | null;
  staging_deleted_at: Date | null; created_at: Date; confirmed_at: Date | null; deleted_at: Date | null;
  post_id: string | null; position: number | null;
  purpose: 'post' | 'community' | 'avatar'; community_id: string | null; avatar_user_id: string | null;
}
export function mediaImage(row: MediaRow): MediaImage {
  return { id: row.id, originalName: row.original_name, mime: row.validated_mime!,
    bytes: Number(row.actual_bytes), width: row.width!, height: row.height!, createdAt: new Date(row.created_at).toISOString() };
}
export function mediaMetadata(row: MediaRow): MediaMetadata {
  return { id: row.id, originalName: row.original_name, state: row.state, image: row.state === 'READY' ? mediaImage(row) : null,
    uploadExpiresAt: new Date(row.upload_expires_at).toISOString(), postId: row.post_id ? String(row.post_id) : null };
}
@Injectable()
export class MediaRepository {
  private readonly config;
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService, @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(APP_CONFIG) config: AppConfig) { this.config = config.media; }
  private async actor(client: SqlClient, actor: AuthContext) {
    const user = await client.query('SELECT id FROM users WHERE id=$1 AND email_verified_at IS NOT NULL FOR NO KEY UPDATE', [actor.user.id]);
    if (!user.rows[0]) throw new HttpError(401, 'SESSION_REQUIRED', 'Inicia sesión para adjuntar imágenes.');
    await this.sessions.assertCurrent(client, actor);
  }
  async get(id: string, client: SqlClient = this.database, lock = false): Promise<MediaRow> {
    const row = (await client.query<MediaRow>('SELECT * FROM media WHERE id=$1' + (lock ? ' FOR UPDATE' : ''), [id])).rows[0];
    if (!row) throw new HttpError(404, 'MEDIA_NOT_FOUND', 'Esta imagen no existe.');
    return row;
  }
  private owned(row: MediaRow, userId: string) {
    if (row.owner_id !== userId) throw new HttpError(404, 'MEDIA_NOT_FOUND', 'Esta imagen no existe.');
    this.profile(row);
  }
  profile(row: MediaRow) {
    if (row.storage_profile !== this.config.profile) throw new HttpError(503, 'MEDIA_STORAGE_CHANGED', 'Esta imagen pertenece a otra configuración de almacenamiento.');
  }
  async view(id: string, userId: string | null): Promise<MediaRow> {
    const row = await this.get(id);
    const linked = Boolean(row.post_id || row.community_id || row.avatar_user_id);
    let allowed = !linked && row.owner_id === userId;
    if (row.state === 'READY') {
      if (row.avatar_user_id) allowed = true;
      else if (row.community_id) allowed = Boolean((await this.database.query('SELECT c.id FROM communities c WHERE c.id=$1 AND ' + readableCommunity('c', '$2'), [row.community_id, userId])).rows[0]);
      else if (row.post_id) allowed = Boolean((await this.database.query('SELECT p.id FROM forum_posts p WHERE p.id=$1 AND ' + readablePost('$2'), [row.post_id, userId])).rows[0]);
    }
    if (!allowed) throw new HttpError(404, 'MEDIA_NOT_FOUND', 'Esta imagen no existe.');
    this.profile(row);
    return row;
  }
  private async quota(client: SqlClient, userId: string) {
    const global = (await client.query<{ used_bytes: string; reserved_bytes: string }>("SELECT used_bytes,reserved_bytes FROM media_quotas WHERE scope='global' FOR UPDATE")).rows[0];
    await client.query('INSERT INTO media_quotas(scope) VALUES($1) ON CONFLICT DO NOTHING', ['user:' + userId]);
    const user = (await client.query<{ used_bytes: string; reserved_bytes: string }>('SELECT used_bytes,reserved_bytes FROM media_quotas WHERE scope=$1 FOR UPDATE', ['user:' + userId])).rows[0];
    return { global, user };
  }
  private async adjust(client: SqlClient, row: MediaRow, used: number, reserved: number) {
    const usedDelta = used - Number(row.accounted_bytes);
    const reservedDelta = reserved - Number(row.reserved_bytes);
    await client.query("UPDATE media_quotas SET used_bytes=used_bytes+$2,reserved_bytes=reserved_bytes+$3 WHERE scope IN ('global',$1)", ['user:' + row.owner_id, usedDelta, reservedDelta]);
    await client.query('UPDATE media SET accounted_bytes=$2,reserved_bytes=$3 WHERE id=$1', [row.id, used, reserved]);
  }
  async metric(operation: string, client: SqlClient = this.database) {
    await client.query('INSERT INTO media_metrics(operation,total) VALUES($1,1) ON CONFLICT(day,operation) DO UPDATE SET total=media_metrics.total+1', [operation]);
  }
  private async event(client: SqlClient, id: string, operation: string) {
    await client.query('INSERT INTO media_events(media_id,operation) VALUES($1,$2)', [id, operation]);
    await this.metric(operation, client);
  }
  async authorize(input: UploadInput, actor: AuthContext): Promise<MediaRow> {
    return this.database.transaction(async client => {
      await this.actor(client, actor);
      const quota = await this.quota(client, actor.user.id);
      const existing = (await client.query<MediaRow>('SELECT * FROM media WHERE owner_id=$1 AND request_id=$2', [actor.user.id, input.requestId])).rows[0];
      if (existing) {
        this.profile(existing);
        if (existing.original_name !== input.originalName || existing.declared_mime !== input.mime || Number(existing.declared_bytes) !== input.bytes || existing.purpose !== input.purpose) throw new HttpError(409, 'REQUEST_CONFLICT', 'Esta solicitud corresponde a otro archivo.');
        return existing;
      }
      const rate = await client.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM media WHERE owner_id=$1 AND created_at>CURRENT_TIMESTAMP-INTERVAL '1 hour'`, [actor.user.id]);
      if (Number(rate.rows[0].total) >= this.config.uploadsPerHour) throw new HttpError(429, 'MEDIA_RATE_LIMIT', 'Has solicitado varias subidas. Espera antes de adjuntar más imágenes.');
      // Reserva temporal para el original y su versión validada, sin depender del tamaño declarado.
      const reservation = this.config.maxBytes * 2;
      if (Number(quota.global.used_bytes) + Number(quota.global.reserved_bytes) + reservation > this.config.globalBytes) throw new HttpError(409, 'MEDIA_GLOBAL_QUOTA', 'Se alcanzó el espacio disponible para nuevas imágenes.');
      if (Number(quota.user.used_bytes) + Number(quota.user.reserved_bytes) + reservation > this.config.userBytes) throw new HttpError(409, 'MEDIA_USER_QUOTA', 'No tienes espacio disponible para otra imagen. Elimina imágenes o espera a que caduquen las subidas pendientes.');
      const id = randomUUID();
      const expires = new Date(Date.now() + this.config.uploadSeconds * 1000);
      const result = await client.query<MediaRow>(`INSERT INTO media(id,owner_id,request_id,storage_profile,provider,staging_key,object_key,original_name,declared_mime,declared_bytes,reserved_bytes,upload_expires_at,cleanup_after,purpose)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [id, actor.user.id, input.requestId, this.config.profile, this.config.provider,
        'foris/staging/' + id + '/' + randomUUID() + '.bin', 'foris/images/' + id + '/' + randomUUID() + '.' + EXTENSION[input.mime],
        input.originalName, input.mime, input.bytes, reservation, expires, new Date(expires.getTime() + 60000), input.purpose]);
      await client.query("UPDATE media_quotas SET reserved_bytes=reserved_bytes+$2 WHERE scope IN ('global',$1)", ['user:' + actor.user.id, reservation]);
      await this.event(client, id, 'authorized');
      return result.rows[0];
    });
  }
  async claimVerification(id: string, actor: AuthContext): Promise<MediaRow> {
    return this.database.transaction(async client => {
      await this.actor(client, actor);
      const row = await this.get(id, client, true);
      this.owned(row, actor.user.id);
      if (row.state === 'READY') return row;
      if (row.state === 'VERIFYING') throw new HttpError(409, 'MEDIA_PROCESSING', 'La imagen todavía se está verificando. Inténtalo de nuevo en unos segundos.');
      if (row.state !== 'PENDING' || new Date(row.upload_expires_at).getTime() <= Date.now()) throw new HttpError(409, 'MEDIA_UPLOAD_EXPIRED', 'La subida caducó. Vuelve a seleccionar la imagen.');
      const result = await client.query<MediaRow>(`UPDATE media SET state='VERIFYING',lease_token=$2,lease_until=CURRENT_TIMESTAMP+INTERVAL '2 minutes' WHERE id=$1 RETURNING *`, [id, randomUUID()]);
      return result.rows[0];
    });
  }
  async renewLease(row: MediaRow): Promise<void> {
    const result = await this.database.query(`UPDATE media SET lease_until=CURRENT_TIMESTAMP+INTERVAL '2 minutes' WHERE id=$1 AND lease_token=$2 RETURNING id`, [row.id, row.lease_token]);
    if (!result.rows[0]) throw new HttpError(409, 'MEDIA_PROCESSING', 'La operación cambió de estado. Vuelve a consultar la imagen.');
  }
  async confirmed(row: MediaRow, image: { bytes: Buffer; mime: ImageMime; width: number; height: number; checksum: string }, actor: AuthContext): Promise<MediaRow> {
    return this.database.transaction(async client => {
      await this.actor(client, actor);
      await this.quota(client, actor.user.id);
      const current = await this.get(row.id, client, true);
      this.owned(current, actor.user.id);
      if (current.state === 'READY') return current;
      if (current.lease_token !== row.lease_token || current.state !== 'VERIFYING') throw new HttpError(409, 'MEDIA_PROCESSING', 'La imagen cambió de estado.');
      await this.adjust(client, current, image.bytes.length, this.config.maxBytes);
      const result = await client.query<MediaRow>(`UPDATE media SET state='READY',validated_mime=$2,actual_bytes=$3,width=$4,height=$5,checksum=$6,
        confirmed_at=CURRENT_TIMESTAMP,lease_token=NULL,lease_until=NULL WHERE id=$1 RETURNING *`,
      [row.id, image.mime, image.bytes.length, image.width, image.height, image.checksum]);
      await this.event(client, row.id, 'confirmed');
      return result.rows[0];
    });
  }
  async verificationFailed(row: MediaRow, invalid: boolean): Promise<void> {
    await this.database.transaction(async client => {
      const current = await this.get(row.id, client, true);
      if (current.state !== 'VERIFYING' || current.lease_token !== row.lease_token) return;
      await client.query('UPDATE media SET state=$2,lease_token=NULL,lease_until=NULL WHERE id=$1', [row.id, invalid ? 'REJECTED' : 'PENDING']);
      await this.event(client, row.id, invalid ? 'rejected' : 'verification_retry');
    });
  }
  async beginDelete(id: string, actor: AuthContext): Promise<MediaRow> {
    return this.database.transaction(async client => {
      await this.actor(client, actor);
      const row = await this.get(id, client, true);
      this.owned(row, actor.user.id);
      if (row.state === 'VERIFYING' || (row.lease_until && new Date(row.lease_until).getTime() > Date.now())) throw new HttpError(409, 'MEDIA_PROCESSING', 'La imagen está en proceso. Inténtalo de nuevo en unos segundos.');
      if (row.state === 'DELETED') return row;
      const result = await client.query<MediaRow>(`UPDATE media SET state='DELETING',lease_token=$2,lease_until=CURRENT_TIMESTAMP+INTERVAL '2 minutes' WHERE id=$1 RETURNING *`, [id, randomUUID()]);
      await this.event(client, id, 'delete_requested');
      return result.rows[0];
    });
  }
  async finishCleanup(row: MediaRow, all: boolean): Promise<void> {
    await this.database.transaction(async client => {
      await this.quota(client, row.owner_id);
      const current = await this.get(row.id, client, true);
      if (current.lease_token !== row.lease_token) return;
      const stageExpired = new Date(current.upload_expires_at).getTime() + 60000 <= Date.now();
      await this.adjust(client, current, all ? 0 : Number(current.accounted_bytes), stageExpired ? 0 : Number(current.reserved_bytes));
      await client.query(`UPDATE media SET state=$2,lease_token=NULL,lease_until=NULL,
        deleted_at=CASE WHEN $3 THEN CURRENT_TIMESTAMP ELSE deleted_at END,
        staging_deleted_at=CASE WHEN $4 THEN CURRENT_TIMESTAMP ELSE staging_deleted_at END,
        cleanup_after=$5 WHERE id=$1`,
      [row.id, all ? (current.state === 'PENDING' || current.state === 'VERIFYING' ? 'EXPIRED' : 'DELETED') : current.state,
        all, stageExpired, stageExpired ? new Date(Date.now() + 3600000) : new Date(new Date(current.upload_expires_at).getTime() + 60000)]);
      await this.event(client, row.id, all ? 'deleted' : 'staging_cleaned');
    });
  }
  async cleanupFailed(row: MediaRow) {
    await this.database.query(`UPDATE media SET lease_token=NULL,lease_until=NULL,cleanup_after=CURRENT_TIMESTAMP+INTERVAL '1 minute'
      WHERE id=$1 AND lease_token=$2`, [row.id, row.lease_token]);
    await this.metric('cleanup_error');
  }
  async claimCleanup(): Promise<MediaRow[]> {
    return this.database.transaction(async client => {
      const rows = await client.query<MediaRow>(`SELECT * FROM media WHERE storage_profile=$1
        AND (lease_until IS NULL OR lease_until<CURRENT_TIMESTAMP) AND (
          (reserved_bytes>0 AND cleanup_after<=CURRENT_TIMESTAMP)
          OR (state='READY' AND post_id IS NULL AND community_id IS NULL AND avatar_user_id IS NULL AND confirmed_at<$2)
          OR (state='DELETING' AND cleanup_after<=CURRENT_TIMESTAMP)
          OR (staging_deleted_at IS NOT NULL AND upload_expires_at>CURRENT_TIMESTAMP-INTERVAL '1 day' AND cleanup_after<=CURRENT_TIMESTAMP))
        ORDER BY cleanup_after,id LIMIT 10 FOR UPDATE SKIP LOCKED`,
      [this.config.profile, new Date(Date.now() - this.config.orphanHours * 3600000)]);
      const claimed: MediaRow[] = [];
      for (const row of rows.rows) {
        const orphan = row.state === 'READY' && !row.post_id && !row.community_id && !row.avatar_user_id && new Date(row.confirmed_at!).getTime() < Date.now() - this.config.orphanHours * 3600000;
        const state = row.state === 'READY' && !orphan ? 'READY' : 'DELETING';
        const result = await client.query<MediaRow>(`UPDATE media SET state=$2,lease_token=$3,lease_until=CURRENT_TIMESTAMP+INTERVAL '2 minutes' WHERE id=$1 RETURNING *`, [row.id, state, randomUUID()]);
        claimed.push(result.rows[0]);
      }
      return claimed;
    });
  }
  async usage(ownerId: string): Promise<MediaUsage> {
    const result = await this.database.query<{ used_bytes: string; reserved_bytes: string }>('SELECT used_bytes,reserved_bytes FROM media_quotas WHERE scope=$1', ['user:' + ownerId]);
    return { usedBytes: Number(result.rows[0]?.used_bytes ?? 0), reservedBytes: Number(result.rows[0]?.reserved_bytes ?? 0), limitBytes: this.config.userBytes };
  }
  private validatePostImages(rows: MediaRow[], ids: string[], ownerId: string, postId: string): void {
    if (ids.length > this.config.maxPerPost) throw new HttpError(400, 'MEDIA_TOO_MANY', 'Esta publicación tiene demasiadas imágenes.');
    if (rows.length !== ids.length) throw new HttpError(400, 'MEDIA_NOT_READY', 'Una de las imágenes no está disponible.');
    for (const row of rows) {
      this.owned(row, ownerId);
      if (row.purpose !== 'post' || row.community_id || row.avatar_user_id || row.state !== 'READY' || (row.post_id && String(row.post_id) !== postId)) throw new HttpError(409, 'MEDIA_NOT_READY', 'La imagen no está lista o ya pertenece a otro recurso.');
    }
  }
  async attach(client: SqlClient, ids: string[], ownerId: string, postId: string): Promise<void> {
    if (!ids.length) return;
    const rows = await client.query<MediaRow>('SELECT * FROM media WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE', [ids]);
    this.validatePostImages(rows.rows, ids, ownerId, postId);
    for (const [position, id] of ids.entries()) await client.query('UPDATE media SET post_id=$2,position=$3 WHERE id=$1', [id, postId, position]);
  }
  /** Reordena, adjunta y retira en la misma transacción del documento; nunca cambia de propietario. */
  async replacePostImages(client: SqlClient, ids: string[], ownerId: string, postId: string): Promise<void> {
    const rows = await client.query<MediaRow>('SELECT * FROM media WHERE post_id=$1 OR id=ANY($2::uuid[]) ORDER BY id FOR UPDATE', [postId, ids]);
    this.validatePostImages(rows.rows.filter(row => ids.includes(row.id)), ids, ownerId, postId);
    // Libera primero los ordinales: intercambiar 0 y 1 no debe chocar con UNIQUE(post_id,position).
    await client.query('UPDATE media SET position=NULL WHERE post_id=$1', [postId]);
    await client.query(`UPDATE media SET post_id=NULL,position=NULL,state='DELETING',cleanup_after=CURRENT_TIMESTAMP
      WHERE post_id=$1 AND NOT(id=ANY($2::uuid[])) AND state='READY'`, [postId, ids]);
    for (const [position, id] of ids.entries()) await client.query('UPDATE media SET post_id=$2,position=$3 WHERE id=$1', [id, postId, position]);
  }
  async images(postIds: string[], client: SqlClient = this.database): Promise<Map<string, MediaImage[]>> {
    const images = new Map<string, MediaImage[]>();
    if (!postIds.length) return images;
    const rows = await client.query<MediaRow>("SELECT * FROM media WHERE post_id=ANY($1::uuid[]) AND state='READY' ORDER BY post_id,position", [postIds]);
    for (const row of rows.rows) images.set(String(row.post_id), [...(images.get(String(row.post_id)) ?? []), mediaImage(row)]);
    return images;
  }
  /** El llamador mantiene el bloqueo del usuario y, al editar una comunidad, el de esa comunidad. */
  async portrait(client: SqlClient, purpose: 'avatar' | 'community', targetId: string, ownerId: string, mediaId: string | null): Promise<void> {
    const column = purpose === 'avatar' ? 'avatar_user_id' : 'community_id';
    const rows = await client.query<MediaRow>('SELECT * FROM media WHERE ' + column + '=$1 OR id=$2 ORDER BY id FOR UPDATE', [targetId, mediaId]);
    if (mediaId) {
      const image = rows.rows.find(row => row.id === mediaId);
      if (!image) throw new HttpError(404, 'MEDIA_NOT_FOUND', 'La imagen no está disponible.');
      this.owned(image, ownerId);
      if (image.state !== 'READY' || image.purpose !== purpose || image.post_id
        || (image.community_id && (purpose !== 'community' || String(image.community_id) !== targetId))
        || (image.avatar_user_id && (purpose !== 'avatar' || image.avatar_user_id !== targetId))) throw new HttpError(409, 'MEDIA_NOT_READY', 'Elige una imagen propia preparada para este espacio.');
    }
    await client.query('UPDATE media SET ' + column + '=NULL WHERE ' + column + '=$1', [targetId]);
    if (mediaId) await client.query('UPDATE media SET ' + column + '=$2 WHERE id=$1', [mediaId, targetId]);
  }
  avatar(actor: AuthContext, mediaId: string | null) {
    return this.database.transaction(async client => {
      await this.actor(client, actor);
      await this.portrait(client, 'avatar', actor.user.id, actor.user.id, mediaId);
      return { avatarId: mediaId };
    });
  }
  async publicAvatar(userId: string) {
    const row = (await this.database.query<{ id: string }>("SELECT id FROM media WHERE avatar_user_id=$1 AND state='READY'", [userId])).rows[0];
    return { avatarId: row?.id ?? null };
  }
  async pruneAudit() {
    await this.database.query("DELETE FROM media_events WHERE created_at<CURRENT_TIMESTAMP-INTERVAL '30 days'");
    await this.database.query("DELETE FROM media_metrics WHERE day<CURRENT_DATE-INTERVAL '90 days'");
  }
}
