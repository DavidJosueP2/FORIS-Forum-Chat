import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import type { CommunityInvitation, InvitationPreview } from '@messages/contracts';
import { DatabaseService } from '../../database/database.service.js';
import { HttpError } from '../../common/errors/http-error.js';
import { randomToken, tokenHash } from '../auth/auth-crypto.js';
import type { AuthContext, SqlClient } from '../auth/auth.types.js';
import { CommunityRepository } from './community.repository.js';

interface InvitationRow extends QueryResultRow {
  id: string; community_id: string; created_at: Date; expires_at: Date;
  used_at: Date | null; used_by: string | null; revoked_at: Date | null;
}
export function invitationToken(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/u.test(value)) throw new HttpError(404, 'INVITATION_UNAVAILABLE', 'Esta invitación no está disponible.');
  return value;
}
function unavailable(): never { throw new HttpError(410, 'INVITATION_UNAVAILABLE', 'La invitación caducó, ya se utilizó o fue revocada. Pide un enlace nuevo.'); }
function summary(row: InvitationRow): CommunityInvitation {
  return { id: row.id, createdAt: new Date(row.created_at).toISOString(), expiresAt: new Date(row.expires_at).toISOString(),
    usedAt: row.used_at ? new Date(row.used_at).toISOString() : null, revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null };
}
@Injectable()
export class CommunityInvitationsRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService, @Inject(CommunityRepository) private readonly communities: CommunityRepository) {}
  private async owner(client: SqlClient, id: string, actor: AuthContext) {
    await this.communities.actor(client, actor);
    const row = (await client.query<{ owner_id: string; visibility: string }>('SELECT owner_id,visibility FROM communities WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!row || row.owner_id !== actor.user.id) throw new HttpError(404, 'COMMUNITY_NOT_FOUND', 'Esta comunidad no existe.');
    if (row.visibility !== 'private') throw new HttpError(400, 'COMMUNITY_PUBLIC', 'Las comunidades públicas permiten unirse directamente.');
  }
  list(id: string, actor: AuthContext) {
    return this.database.transaction(async client => {
      await this.owner(client, id, actor);
      const activeCondition = 'used_at IS NULL AND revoked_at IS NULL AND expires_at>CURRENT_TIMESTAMP';
      const active = await client.query<InvitationRow>('SELECT * FROM community_invitations WHERE community_id=$1 AND ' + activeCondition + ' ORDER BY created_at DESC,id', [id]);
      const history = await client.query<InvitationRow>('SELECT * FROM community_invitations WHERE community_id=$1 AND NOT(' + activeCondition + ') ORDER BY created_at DESC,id LIMIT 20', [id]);
      return [...active.rows, ...history.rows].map(summary);
    });
  }
  create(id: string, actor: AuthContext) {
    return this.database.transaction(async client => {
      await this.owner(client, id, actor);
      await client.query("DELETE FROM community_invitations WHERE community_id=$1 AND expires_at<CURRENT_TIMESTAMP-INTERVAL '30 days'", [id]);
      const recent = (await client.query<{ total: string }>("SELECT COUNT(*)::text AS total FROM community_invitations WHERE community_id=$1 AND created_at>CURRENT_TIMESTAMP-INTERVAL '1 hour'", [id])).rows[0];
      const active = (await client.query<{ total: string }>('SELECT COUNT(*)::text AS total FROM community_invitations WHERE community_id=$1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at>CURRENT_TIMESTAMP', [id])).rows[0];
      if (Number(recent.total) >= 20 || Number(active.total) >= 10) throw new HttpError(429, 'INVITATION_LIMIT', 'Revoca una invitación activa o espera antes de crear más enlaces.');
      const token = randomToken();
      const row = (await client.query<InvitationRow>(`INSERT INTO community_invitations(id,community_id,created_by,token_hash,expires_at)
        VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP+INTERVAL '7 days') RETURNING *`, [randomUUID(), id, actor.user.id, tokenHash(token)])).rows[0];
      return { invitation: summary(row), token };
    });
  }
  revoke(id: string, invitationId: string, actor: AuthContext) {
    return this.database.transaction(async client => {
      await this.owner(client, id, actor);
      const row = (await client.query('UPDATE community_invitations SET revoked_at=COALESCE(revoked_at,CURRENT_TIMESTAMP) WHERE id=$1 AND community_id=$2 RETURNING id', [invitationId, id])).rows[0];
      if (!row) throw new HttpError(404, 'INVITATION_UNAVAILABLE', 'Esta invitación no está disponible.');
      return { ok: true };
    });
  }
  async preview(token: string, userId: string | null): Promise<InvitationPreview> {
    const row = (await this.database.query<InvitationRow & { name: string }>('SELECT i.*,c.name FROM community_invitations i JOIN communities c ON c.id=i.community_id WHERE i.token_hash=$1', [tokenHash(invitationToken(token))])).rows[0];
    if (!row || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now() || (row.used_at && row.used_by !== userId)) unavailable();
    const member = userId ? (await this.database.query('SELECT user_id FROM community_memberships WHERE community_id=$1 AND user_id=$2', [row.community_id, userId])).rows[0] : null;
    if (row.used_at && !member) unavailable();
    return { community: { id: String(row.community_id), name: row.name }, expiresAt: new Date(row.expires_at).toISOString(), isMember: Boolean(member) };
  }
  async accept(token: string, actor: AuthContext) {
    const hash = tokenHash(invitationToken(token));
    const peek = (await this.database.query<{ community_id: string }>('SELECT community_id FROM community_invitations WHERE token_hash=$1', [hash])).rows[0];
    if (!peek) unavailable();
    return this.database.transaction(async client => {
      await this.communities.actor(client, actor);
      const id = String(peek.community_id);
      await client.query('SELECT id FROM communities WHERE id=$1 FOR UPDATE', [id]);
      const row = (await client.query<InvitationRow>('SELECT * FROM community_invitations WHERE token_hash=$1 FOR UPDATE', [hash])).rows[0];
      if (!row || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()) unavailable();
      const member = (await client.query('SELECT user_id FROM community_memberships WHERE community_id=$1 AND user_id=$2', [id, actor.user.id])).rows[0];
      if (row.used_at && (row.used_by !== actor.user.id || !member)) unavailable();
      if (!member) {
        await client.query('INSERT INTO community_memberships(community_id,user_id) VALUES($1,$2)', [id, actor.user.id]);
        await client.query('UPDATE communities SET member_count=member_count+1 WHERE id=$1', [id]);
        await client.query('INSERT INTO community_preferences(community_id,user_id,notify_posts) VALUES($1,$2,TRUE) ON CONFLICT(community_id,user_id) DO UPDATE SET notify_posts=TRUE', [id, actor.user.id]);
        await client.query('UPDATE community_invitations SET used_by=$2,used_at=CURRENT_TIMESTAMP WHERE id=$1', [row.id, actor.user.id]);
      }
      return this.communities.get(id, actor.user.id, client);
    });
  }
}
