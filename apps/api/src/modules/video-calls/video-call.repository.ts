import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import type { VideoCallPeer, VideoCallSync, VideoSignal } from '@messages/contracts';
import { DatabaseService } from '../../database/database.service.js';
import { SessionService } from '../auth/session.service.js';
import type { AuthContext, SqlClient } from '../auth/auth.types.js';
import { HttpError } from '../../common/errors/http-error.js';
import type { SignalInput } from './video-call-validation.js';
import { authorizeConversation, authorizeStoredConversation, type ConversationScope } from '../conversations/conversation-access.js';

export const CALL_CAPACITY = 4;
export function callCapacity(scope?: ConversationScope) { return scope?.kind === 'direct' ? 2 : CALL_CAPACITY; }
interface MemberRow extends QueryResultRow { id: string; user_id: string; session_id: string; request_id: string; room_key: string; hard_expires_at: Date }
interface SignalRow extends QueryResultRow { id: string; sender_id: string; recipient_id: string; request_id: string; kind: 'offer' | 'answer'; sdp: string }
@Injectable()
export class VideoCallRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService, @Inject(SessionService) private readonly sessions: SessionService) {}
  private async lock(client: SqlClient) {
    await client.query("SELECT id FROM video_call_room WHERE id='global' FOR UPDATE");
    await client.query(`DELETE FROM video_call_members WHERE expires_at<=CURRENT_TIMESTAMP OR hard_expires_at<=CURRENT_TIMESTAMP
      OR session_id IN (SELECT id FROM auth_sessions WHERE expires_at<=CURRENT_TIMESTAMP)`);
    await client.query("DELETE FROM video_call_signals WHERE created_at<CURRENT_TIMESTAMP-INTERVAL '2 minutes'");
  }
  private transaction<T>(actor: AuthContext, work: (client: SqlClient) => Promise<T>) {
    return this.database.transaction(async client => {
      const user = await client.query('SELECT id FROM users WHERE id=$1 AND email_verified_at IS NOT NULL FOR NO KEY UPDATE', [actor.user.id]);
      if (!user.rows[0]) throw new HttpError(401, 'SESSION_REQUIRED', 'Inicia sesión para entrar a la videollamada.');
      await this.sessions.assertCurrent(client, actor);
      await this.lock(client);
      return work(client);
    });
  }
  private async own(client: SqlClient, id: string, actor: AuthContext) {
    const member = (await client.query<MemberRow>('SELECT * FROM video_call_members WHERE id=$1 AND user_id=$2 AND session_id=$3', [id, actor.user.id, actor.sessionId])).rows[0];
    if (!member) throw new HttpError(404, 'CALL_ENDED', 'Tu participación terminó. Puedes volver a entrar.');
    await authorizeStoredConversation(client, actor.user.id, member.room_key);
    return member;
  }
  private async snapshot(client: SqlClient, member: MemberRow, after: string): Promise<VideoCallSync> {
    const peers = await client.query<VideoCallPeer & QueryResultRow>('SELECT m.id,u.display_name AS "displayName" FROM video_call_members m JOIN users u ON u.id=m.user_id WHERE m.id<>$1 AND m.room_key=$2 ORDER BY m.id', [member.id, member.room_key]);
    const result = await client.query<SignalRow>('SELECT * FROM video_call_signals WHERE recipient_id=$1 AND id>$2 ORDER BY id LIMIT 21', [member.id, after]);
    const signals: VideoSignal[] = result.rows.slice(0, 20).map(row => ({ id: String(row.id), from: row.sender_id, description: { type: row.kind, sdp: row.sdp } }));
    return { peers: peers.rows, signals, nextCursor: signals.at(-1)?.id ?? after, hasMore: result.rows.length > 20, expiresAt: new Date(member.hard_expires_at).toISOString() };
  }
  checkAccess(actor: AuthContext, scope: ConversationScope) {
    return this.database.transaction(client => authorizeConversation(client, actor.user.id, scope));
  }
  private async roomCount(client: SqlClient, room: string) {
    return Number((await client.query<{ total: string }>('SELECT COUNT(*)::text AS total FROM video_call_members WHERE room_key=$1', [room])).rows[0].total);
  }
  count(actor: AuthContext, scope?: ConversationScope) {
    return this.transaction(actor, async client => this.roomCount(client, scope ? await authorizeConversation(client, actor.user.id, scope) : 'global'));
  }
  join(actor: AuthContext, requestId: string, scope?: ConversationScope) {
    return this.transaction(actor, async client => {
      const room = scope ? await authorizeConversation(client, actor.user.id, scope) : 'global';
      const existing = (await client.query<MemberRow>('SELECT * FROM video_call_members WHERE user_id=$1', [actor.user.id])).rows[0];
      if (existing) {
        if (existing.session_id !== actor.sessionId || existing.request_id !== requestId || existing.room_key !== room) throw new HttpError(409, 'CALL_ALREADY_JOINED', 'Ya estás en una videollamada. Sal de ella antes de entrar en otra.');
        return { memberId: existing.id, ...await this.snapshot(client, existing, '0') };
      }
      if (await this.roomCount(client, room) >= callCapacity(scope)) throw new HttpError(409, 'CALL_FULL', 'La videollamada está llena.');
      const member = (await client.query<MemberRow>(`INSERT INTO video_call_members(id,user_id,session_id,request_id,room_key,expires_at,hard_expires_at)
        VALUES($1,$2,$3,$4,$5,CURRENT_TIMESTAMP+INTERVAL '90 seconds',CURRENT_TIMESTAMP+INTERVAL '30 minutes') RETURNING *`, [randomUUID(), actor.user.id, actor.sessionId, requestId, room])).rows[0];
      return { memberId: member.id, ...await this.snapshot(client, member, '0') };
    });
  }
  sync(id: string, after: string, actor: AuthContext) {
    return this.transaction(actor, async client => {
      const member = await this.own(client, id, actor);
      await client.query("UPDATE video_call_members SET expires_at=LEAST(hard_expires_at,CURRENT_TIMESTAMP+INTERVAL '90 seconds') WHERE id=$1", [id]);
      return this.snapshot(client, member, after);
    });
  }
  signal(id: string, input: SignalInput, actor: AuthContext) {
    return this.transaction(actor, async client => {
      const member = await this.own(client, id, actor);
      const target = (await client.query<{ user_id: string }>('SELECT user_id FROM video_call_members WHERE id=$1 AND room_key=$2', [input.to, member.room_key])).rows[0];
      if (!target || id === input.to) throw new HttpError(404, 'CALL_PEER_LEFT', 'Esta persona ya salió de la llamada.');
      await authorizeStoredConversation(client, target.user_id, member.room_key);
      // Un solo iniciador por pareja, sin renegociación ni colisiones de ofertas.
      if ((id < input.to) !== (input.description.type === 'offer')) throw new HttpError(400, 'CALL_INVALID_SIGNAL', 'Esta señal no corresponde al participante.');
      const existing = (await client.query<SignalRow>('SELECT * FROM video_call_signals WHERE sender_id=$1 AND (request_id=$2 OR recipient_id=$3)', [id, input.requestId, input.to])).rows;
      if (existing.length) {
        if (existing.length === 1 && existing[0].request_id === input.requestId && existing[0].recipient_id === input.to && existing[0].kind === input.description.type && existing[0].sdp === input.description.sdp) return { ok: true };
        throw new HttpError(409, 'CALL_SIGNAL_CONFLICT', 'Esta conexión ya se está negociando. Sal y vuelve a entrar si no conecta.');
      }
      await client.query('INSERT INTO video_call_signals(sender_id,recipient_id,request_id,kind,sdp) VALUES($1,$2,$3,$4,$5)', [id, input.to, input.requestId, input.description.type, input.description.sdp]);
      return { ok: true };
    });
  }
  leave(id: string, actor: AuthContext) {
    return this.transaction(actor, async client => {
      await client.query('DELETE FROM video_call_members WHERE id=$1 AND user_id=$2 AND session_id=$3', [id, actor.user.id, actor.sessionId]);
      return { ok: true };
    });
  }
  sweep() { return this.database.transaction(client => this.lock(client)); }
}
