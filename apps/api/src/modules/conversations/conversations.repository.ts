import { Inject, Injectable } from '@nestjs/common';
import type { Conversation, ConversationHistory, ConversationSend, ConversationState, Message, Pagination } from '@messages/contracts';
import { DatabaseService } from '../../database/database.service.js';
import { HttpError } from '../../common/errors/http-error.js';
import type { AuthContext, SqlClient } from '../auth/auth.types.js';
import { SessionService } from '../auth/session.service.js';
import { authorizeConversation, conversationNotFound, directRoomKey, type ConversationScope } from './conversation-access.js';
import { visibleAuthor } from '../forum/author-visibility.js';

interface ChatRow { id: string; user_id: string; author: string; body: string; request_id: string; created_at: Date }
const unrestricted: ConversationState = { permission: 'open', canCall: true };

function message(row: ChatRow): Message {
  return { id: row.id, senderId: row.user_id, accountId: row.user_id, author: row.author, body: row.body, requestId: row.request_id, createdAt: row.created_at.toISOString() };
}

@Injectable()
export class ConversationsRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(SessionService) private readonly sessions: SessionService) {}

  async list(actor: AuthContext): Promise<Conversation[]> {
    const rooms = await this.database.query<Conversation>(`
      WITH peers AS (
        SELECT second_id AS id FROM direct_conversations WHERE first_id=$1
        UNION SELECT first_id FROM direct_conversations WHERE second_id=$1
        UNION SELECT f.author_id FROM author_follows f
          JOIN author_follows r ON r.follower_id=f.author_id AND r.author_id=f.follower_id
          WHERE f.follower_id=$1
      )
      SELECT 'community' AS kind,c.id::text AS id,c.name,p.id AS "imageId"
      FROM community_memberships m JOIN communities c ON c.id=m.community_id
      LEFT JOIN media p ON p.community_id=c.id AND p.state='READY' WHERE m.user_id=$1
      UNION ALL
      SELECT 'direct',u.id::text,u.display_name,a.id
      FROM peers JOIN users u ON u.id=peers.id AND u.email_verified_at IS NOT NULL
      LEFT JOIN media a ON a.avatar_user_id=u.id AND a.state='READY'
      ORDER BY kind,name,id`, [actor.user.id]);
    return rooms.rows;
  }

  private async directPeer(client: SqlClient, user: string, peer: string): Promise<Conversation> {
    if (user === peer) conversationNotFound();
    const result = await client.query<Conversation>(`SELECT 'direct' AS kind,u.id,u.display_name AS name,a.id AS "imageId"
      FROM users u LEFT JOIN media a ON a.avatar_user_id=u.id AND a.state='READY'
      WHERE u.id=$2 AND u.email_verified_at IS NOT NULL AND (
        ${visibleAuthor('$1')} OR EXISTS(SELECT 1 FROM author_follows f
          JOIN author_follows r ON r.follower_id=f.author_id AND r.author_id=f.follower_id
          WHERE f.follower_id=$1 AND f.author_id=$2)
      ) FOR KEY SHARE OF u`, [user, peer]);
    return result.rows[0] ?? conversationNotFound();
  }

  async direct(actor: AuthContext, peer: string): Promise<Conversation> {
    return this.database.transaction(async client => {
      await this.sessions.assertCurrent(client, actor);
      return this.directPeer(client, actor.user.id, peer);
    });
  }

  private async state(client: SqlClient, room: string, user: string, scope: ConversationScope): Promise<ConversationState> {
    if (scope.kind === 'community') return unrestricted;
    const result = await client.query<{ outgoing: boolean; incoming: boolean; starter: string | null; replied: boolean }>(`
      WITH first_message AS (
        SELECT user_id FROM conversation_messages WHERE room_key=$1 ORDER BY id LIMIT 1
      )
      SELECT EXISTS(SELECT 1 FROM author_follows WHERE follower_id=$2 AND author_id=$3) AS outgoing,
        EXISTS(SELECT 1 FROM author_follows WHERE follower_id=$3 AND author_id=$2) AS incoming,
        (SELECT user_id FROM first_message) AS starter,
        EXISTS(SELECT 1 FROM conversation_messages m CROSS JOIN first_message f
          WHERE m.room_key=$1 AND m.user_id=CASE WHEN f.user_id=$2 THEN $3::uuid ELSE $2::uuid END) AS replied`,
    [room, user, scope.id]);
    const { outgoing, incoming, starter, replied } = result.rows[0];
    const canCall = outgoing && incoming;
    if (canCall || replied || (starter === scope.id ? outgoing : incoming)) return { permission: 'open', canCall };
    return { permission: !starter ? 'intro' : starter === user ? 'awaiting' : 'reply', canCall };
  }

  private authorized<T>(actor: AuthContext, scope: ConversationScope, work: (client: SqlClient, room: string) => Promise<T>) {
    return this.database.transaction(async client => {
      await this.sessions.assertCurrent(client, actor);
      if (scope.kind === 'community') return work(client, await authorizeConversation(client, actor.user.id, scope));
      await this.directPeer(client, actor.user.id, scope.id);
      return work(client, directRoomKey(actor.user.id, scope.id));
    });
  }

  history(actor: AuthContext, scope: ConversationScope, { before, after, limit }: Pagination): Promise<ConversationHistory> {
    return this.authorized(actor, scope, async (client, room) => {
      const cursor = after ?? before;
      const filter = cursor === undefined ? '' : after ? 'AND id>$3' : 'AND id<$3';
      const values = cursor === undefined ? [room, limit + 1] : [room, limit + 1, cursor];
      const result = await client.query<ChatRow>(`SELECT id::text,user_id,author,body,request_id,created_at
        FROM conversation_messages WHERE room_key=$1 ${filter} ORDER BY conversation_messages.id ${after ? 'ASC' : 'DESC'} LIMIT $2`, values);
      const page = result.rows.slice(0, limit);
      if (!after) page.reverse();
      return { messages: page.map(message), hasMore: result.rows.length > limit, state: await this.state(client, room, actor.user.id, scope) };
    });
  }

  send(actor: AuthContext, scope: ConversationScope, body: string, request: string): Promise<ConversationSend> {
    return this.authorized(actor, scope, async (client, room) => {
      // Asignar los IDs en el orden de confirmación evita saltos al consultar mensajes nuevos.
      await client.query('SELECT pg_advisory_xact_lock(1473501, hashtext($1))', [room]);
      const values = [room, actor.user.id, request];
      const existing = (await client.query<ChatRow>(`SELECT * FROM conversation_messages
        WHERE room_key=$1 AND user_id=$2 AND request_id=$3`, values)).rows[0];
      if (existing) {
        if (existing.body !== body) throw new HttpError(409, 'SEND_CONFLICT', 'Este identificador ya corresponde a otro envío.');
        return { message: message(existing), state: await this.state(client, room, actor.user.id, scope) };
      }
      const state = await this.state(client, room, actor.user.id, scope);
      if (state.permission === 'awaiting') throw new HttpError(409, 'DIRECT_INTRO_PENDING', 'Ya enviaste un primer mensaje. Podrás seguir cuando la otra persona te responda o te siga.');
      if (scope.kind === 'direct') {
        await client.query('INSERT INTO direct_conversations(first_id,second_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [actor.user.id, scope.id].sort());
      }
      const inserted = await client.query<ChatRow>(`INSERT INTO conversation_messages(room_key,user_id,request_id,author,body)
        VALUES($1,$2,$3,$4,$5) RETURNING *`, [...values, actor.user.displayName, body]);
      return { message: message(inserted.rows[0]), state: await this.state(client, room, actor.user.id, scope) };
    });
  }
}
