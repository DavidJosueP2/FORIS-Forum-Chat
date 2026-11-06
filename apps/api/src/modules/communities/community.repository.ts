import { Inject, Injectable } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import type { Community, CreateCommunity, CommunityPreferences, ForumPage } from '@messages/contracts';
import { DatabaseService } from '../../database/database.service.js';
import { HttpError } from '../../common/errors/http-error.js';
import { resultPage } from '../../common/validation/input.js';
import { SessionService } from '../auth/session.service.js';
import type { AuthContext, SqlClient } from '../auth/auth.types.js';
import type { CommunityFilters } from './community-validation.js';
import { MediaRepository } from '../media/media.repository.js';
import { readableCommunity } from './community-access.js';

interface CommunityRow extends QueryResultRow {
  id: string; name: string; description: string; owner_id: string; display_name: string;
  member_count: number; post_count: number; created_at: Date; request_id: string;
  member_id: string | null; favorite: boolean | null; notify_posts: boolean | null;
  visibility: 'public' | 'private'; image_id: string | null; image_request_id: string | null;
  following: boolean;
}
const SELECT = `SELECT c.*,u.display_name,m.user_id AS member_id,s.favorite,s.notify_posts,photo.id AS image_id,
  EXISTS(SELECT 1 FROM community_follows cf WHERE cf.community_id=c.id AND cf.user_id=$1) AS following
  FROM communities c JOIN users u ON u.id=c.owner_id
  LEFT JOIN community_memberships m ON m.community_id=c.id AND m.user_id=$1::uuid
  LEFT JOIN community_preferences s ON s.community_id=c.id AND s.user_id=$1::uuid
  LEFT JOIN media photo ON photo.community_id=c.id AND photo.state='READY'`;
function community(row: CommunityRow): Community {
  return { id: String(row.id), name: row.name, description: row.description, visibility: row.visibility, imageId: row.image_id,
    owner: { id: row.owner_id, displayName: row.display_name }, memberCount: row.member_count, postCount: row.post_count,
    createdAt: new Date(row.created_at).toISOString(), isFavorite: row.favorite ?? false, isFollowing: row.following,
    membership: row.member_id ? { role: row.owner_id === row.member_id ? 'owner' : 'member', notifyPosts: row.notify_posts ?? true } : null };
}
@Injectable()
export class CommunityRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService, @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(MediaRepository) private readonly media: MediaRepository) {}
  async actor(client: SqlClient, actor: AuthContext): Promise<void> {
    // NO KEY UPDATE mantiene la exclusión con cambios de credenciales y permite las FK del fanout.
    const user = await client.query('SELECT id FROM users WHERE id=$1 AND email_verified_at IS NOT NULL FOR NO KEY UPDATE', [actor.user.id]);
    if (!user.rows[0]) throw new HttpError(401, 'SESSION_REQUIRED', 'Inicia sesión para continuar.');
    await this.sessions.assertCurrent(client, actor);
  }
  private async lock(client: SqlClient, id: string) {
    const row = (await client.query<{ owner_id: string; visibility: 'public' | 'private' }>('SELECT owner_id,visibility FROM communities WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!row) throw new HttpError(404, 'COMMUNITY_NOT_FOUND', 'Esta comunidad no existe.');
    return row;
  }
  async get(id: string, userId: string | null, client: SqlClient = this.database): Promise<Community> {
    const row = (await client.query<CommunityRow>(SELECT + ' WHERE c.id=$2 AND ' + readableCommunity('c', '$1'), [userId, id])).rows[0];
    if (!row) throw new HttpError(404, 'COMMUNITY_NOT_FOUND', 'Esta comunidad no existe.');
    return community(row);
  }
  async list(filters: CommunityFilters, userId: string | null): Promise<ForumPage<Community>> {
    if (filters.scope !== 'all' && !userId) throw new HttpError(401, 'SESSION_REQUIRED', 'Entra para ver tus comunidades.');
    const values: unknown[] = [userId];
    const where: string[] = [readableCommunity('c', '$1')];
    if (filters.publicMemberId) {
      values.push(filters.publicMemberId);
      where.push("c.visibility='public' AND EXISTS(SELECT 1 FROM community_memberships public_member WHERE public_member.community_id=c.id AND public_member.user_id=$" + values.length + ')');
    }
    if (filters.scope === 'mine') where.push('m.user_id IS NOT NULL');
    if (filters.scope === 'favorites') where.push('s.favorite=TRUE');
    if (filters.scope === 'following') where.push('EXISTS(SELECT 1 FROM community_follows cf WHERE cf.user_id=$1 AND cf.community_id=c.id)');
    if (filters.before) { values.push(filters.before); where.push('c.id<$' + values.length); }
    if (filters.search) {
      values.push('%' + filters.search.replace(/[\\%_]/gu, '\\$&') + '%');
      where.push('(c.name ILIKE $' + values.length + ' OR c.description ILIKE $' + values.length + ')');
    }
    values.push(filters.limit + 1);
    const rows = await this.database.query<CommunityRow>(SELECT + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY c.id DESC LIMIT $' + values.length, values);
    return resultPage(rows.rows.map(community), filters.limit);
  }
  async create(input: CreateCommunity, actor: AuthContext): Promise<{ community: Community; created: boolean }> {
    return this.database.transaction(async client => {
      await this.actor(client, actor);
      const existing = (await client.query<CommunityRow>('SELECT * FROM communities WHERE owner_id=$1 AND request_id=$2', [actor.user.id, input.requestId])).rows[0];
      if (existing) {
        if (existing.name !== input.name || existing.description !== input.description || existing.visibility !== (input.visibility ?? 'public') || existing.image_request_id !== (input.imageId ?? null)) throw new HttpError(409, 'REQUEST_CONFLICT', 'La solicitud ya corresponde a otra comunidad.');
        return { community: await this.get(String(existing.id), actor.user.id, client), created: false };
      }
      const count = await client.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM communities WHERE owner_id=$1 AND created_at>CURRENT_TIMESTAMP-INTERVAL '1 day'`, [actor.user.id]);
      if (Number(count.rows[0].total) >= 3) throw new HttpError(429, 'COMMUNITY_RATE_LIMIT', 'Puedes crear hasta tres comunidades al día. Vuelve a intentarlo más tarde.');
      const inserted = (await client.query<{ id: string }>('INSERT INTO communities(name,name_key,description,owner_id,request_id,visibility,image_request_id) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(name_key) DO NOTHING RETURNING id',
        [input.name, input.name.toLocaleLowerCase('es'), input.description, actor.user.id, input.requestId, input.visibility ?? 'public', input.imageId ?? null])).rows[0];
      if (!inserted) throw new HttpError(409, 'COMMUNITY_NAME_TAKEN', 'Ya existe una comunidad con ese nombre. Elige otro.');
      const id = String(inserted.id);
      await client.query('INSERT INTO community_memberships(community_id,user_id) VALUES($1,$2)', [id, actor.user.id]);
      await client.query('INSERT INTO community_follows(user_id,community_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [actor.user.id, id]);
      await client.query('INSERT INTO community_preferences(community_id,user_id,favorite) VALUES($1,$2,TRUE)', [id, actor.user.id]);
      await this.media.portrait(client, 'community', id, actor.user.id, input.imageId ?? null);
      return { community: await this.get(id, actor.user.id, client), created: true };
    });
  }
  async join(id: string, actor: AuthContext): Promise<Community> {
    return this.database.transaction(async client => {
      await this.actor(client, actor);
      const current = await this.lock(client, id);
      if (current.visibility === 'private') {
        const member = await client.query('SELECT user_id FROM community_memberships WHERE community_id=$1 AND user_id=$2', [id, actor.user.id]);
        if (!member.rows[0]) throw new HttpError(404, 'COMMUNITY_NOT_FOUND', 'Esta comunidad no existe o necesitas una invitación.');
      }
      const added = await client.query('INSERT INTO community_memberships(community_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING user_id', [id, actor.user.id]);
      if (added.rows.length) {
        await client.query('INSERT INTO community_follows(user_id,community_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [actor.user.id, id]);
        await client.query('UPDATE communities SET member_count=member_count+1 WHERE id=$1', [id]);
        await client.query('INSERT INTO community_preferences(community_id,user_id,notify_posts) VALUES($1,$2,TRUE) ON CONFLICT(community_id,user_id) DO UPDATE SET notify_posts=TRUE', [id, actor.user.id]);
      }
      return this.get(id, actor.user.id, client);
    });
  }
  async leave(id: string, actor: AuthContext): Promise<{ left: true }> {
    return this.database.transaction(async client => {
      await this.actor(client, actor);
      const row = await this.lock(client, id);
      if (row.owner_id === actor.user.id) throw new HttpError(409, 'COMMUNITY_OWNER_REQUIRED', 'Como creador sigues formando parte de esta comunidad.');
      const removed = await client.query('DELETE FROM community_memberships WHERE community_id=$1 AND user_id=$2 RETURNING user_id', [id, actor.user.id]);
      if (removed.rows.length) await client.query('UPDATE communities SET member_count=member_count-1 WHERE id=$1', [id]);
      await client.query('UPDATE community_preferences SET notify_posts=FALSE WHERE community_id=$1 AND user_id=$2', [id, actor.user.id]);
      await client.query('DELETE FROM community_follows WHERE user_id=$1 AND community_id=$2', [actor.user.id, id]);
      if (row.visibility === 'private') await client.query('DELETE FROM community_notifications WHERE community_id=$1 AND recipient_id=$2', [id, actor.user.id]);
      return { left: true as const };
    });
  }
  async preferences(id: string, input: CommunityPreferences, actor: AuthContext): Promise<Community> {
    return this.database.transaction(async client => {
      await this.actor(client, actor);
      await this.lock(client, id);
      const current = await this.get(id, actor.user.id, client);
      if (input.notifyPosts === true && !current.membership) throw new HttpError(403, 'COMMUNITY_MEMBERSHIP_REQUIRED', 'Únete para recibir avisos de esta comunidad.');
      await client.query('INSERT INTO community_preferences(community_id,user_id,favorite,notify_posts) VALUES($1,$2,$3,$4) ON CONFLICT(community_id,user_id) DO UPDATE SET favorite=EXCLUDED.favorite,notify_posts=EXCLUDED.notify_posts',
        [id, actor.user.id, input.favorite ?? current.isFavorite, input.notifyPosts ?? current.membership?.notifyPosts ?? false]);
      return this.get(id, actor.user.id, client);
    });
  }
  async authorizePublication(client: SqlClient, id: string, userId: string): Promise<void> {
    await this.lock(client, id);
    const membership = await client.query('SELECT user_id FROM community_memberships WHERE community_id=$1 AND user_id=$2', [id, userId]);
    if (!membership.rows[0]) throw new HttpError(403, 'COMMUNITY_MEMBERSHIP_REQUIRED', 'Únete a la comunidad para publicar aquí.');
  }
  async updateImage(id: string, imageId: string | null, actor: AuthContext): Promise<Community> {
    return this.database.transaction(async client => {
      await this.actor(client, actor);
      const row = await this.lock(client, id);
      if (row.owner_id !== actor.user.id) throw new HttpError(404, 'COMMUNITY_NOT_FOUND', 'Esta comunidad no existe.');
      await this.media.portrait(client, 'community', id, actor.user.id, imageId);
      return this.get(id, actor.user.id, client);
    });
  }
  /** El llamador mantiene bloqueada la comunidad; todo se confirma junto con la publicación. */
  async published(client: SqlClient, communityId: string, postId: string, authorId: string): Promise<void> {
    await client.query('UPDATE communities SET post_count=post_count+1 WHERE id=$1', [communityId]);
    await client.query(`INSERT INTO community_notifications(recipient_id,community_id,post_id)
      SELECT m.user_id,m.community_id,$2 FROM community_memberships m
      LEFT JOIN community_preferences s ON s.community_id=m.community_id AND s.user_id=m.user_id
      WHERE m.community_id=$1 AND m.user_id<>$3 AND COALESCE(s.notify_posts,TRUE)=TRUE
      ON CONFLICT(recipient_id,post_id) DO NOTHING`, [communityId, postId, authorId]);
  }
}
