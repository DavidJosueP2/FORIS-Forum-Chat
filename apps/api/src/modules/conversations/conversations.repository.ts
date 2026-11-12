import { Inject, Injectable } from '@nestjs/common';
import type { Conversation, Message, MessagePage, Pagination } from '@messages/contracts';
import { DatabaseService } from '../../database/database.service.js';
import { HttpError } from '../../common/errors/http-error.js';
import type { AuthContext, SqlClient } from '../auth/auth.types.js';
import { SessionService } from '../auth/session.service.js';
import { authorizeConversation, type ConversationScope } from './conversation-access.js';

interface ChatRow { id: string; user_id: string; author: string; body: string; request_id: string; created_at: Date }

function message(row: ChatRow): Message {
  return { id: row.id, senderId: row.user_id, accountId: row.user_id, author: row.author, body: row.body, requestId: row.request_id, createdAt: row.created_at.toISOString() };
}

@Injectable()
export class ConversationsRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(SessionService) private readonly sessions: SessionService) {}

  async list(actor: AuthContext): Promise<Conversation[]> {
    const rooms = await this.database.query<Conversation>(`
      SELECT 'community' AS kind,c.id::text AS id,c.name,p.id AS "imageId"
      FROM community_memberships m JOIN communities c ON c.id=m.community_id
      LEFT JOIN media p ON p.community_id=c.id AND p.state='READY' WHERE m.user_id=$1
      UNION ALL
      SELECT 'direct',u.id::text,u.display_name,a.id
      FROM author_follows f JOIN author_follows r ON r.follower_id=f.author_id AND r.author_id=f.follower_id
      JOIN users u ON u.id=f.author_id AND u.email_verified_at IS NOT NULL
      LEFT JOIN media a ON a.avatar_user_id=u.id AND a.state='READY' WHERE f.follower_id=$1
      ORDER BY kind,name,id`, [actor.user.id]);
    return rooms.rows;
  }

  private authorized<T>(actor: AuthContext, scope: ConversationScope, work: (client: SqlClient, room: string) => Promise<T>) {
    return this.database.transaction(async client => {
      await this.sessions.assertCurrent(client, actor);
      return work(client, await authorizeConversation(client, actor.user.id, scope));
    });
  }

  history(actor: AuthContext, scope: ConversationScope, { before, after, limit }: Pagination): Promise<MessagePage> {
    return this.authorized(actor, scope, async (client, room) => {
      const cursor = after ?? before;
      const filter = cursor === undefined ? '' : after ? 'AND id>$3' : 'AND id<$3';
      const values = cursor === undefined ? [room, limit + 1] : [room, limit + 1, cursor];
      const result = await client.query<ChatRow>(`SELECT id::text,user_id,author,body,request_id,created_at
        FROM conversation_messages WHERE room_key=$1 ${filter} ORDER BY conversation_messages.id ${after ? 'ASC' : 'DESC'} LIMIT $2`, values);
      const page = result.rows.slice(0, limit);
      if (!after) page.reverse();
      return { messages: page.map(message), hasMore: result.rows.length > limit };
    });
  }

  send(actor: AuthContext, scope: ConversationScope, body: string, request: string): Promise<Message> {
    return this.authorized(actor, scope, async (client, room) => {
      // Asignar los IDs en el orden de confirmación evita saltos al consultar mensajes nuevos.
      await client.query('SELECT pg_advisory_xact_lock(1473501, hashtext($1))', [room]);
      const values = [room, actor.user.id, request];
      const existing = (await client.query<ChatRow>(`SELECT * FROM conversation_messages
        WHERE room_key=$1 AND user_id=$2 AND request_id=$3`, values)).rows[0];
      if (existing) {
        if (existing.body !== body) throw new HttpError(409, 'SEND_CONFLICT', 'Este identificador ya corresponde a otro envío.');
        return message(existing);
      }
      const inserted = await client.query<ChatRow>(`INSERT INTO conversation_messages(room_key,user_id,request_id,author,body)
        VALUES($1,$2,$3,$4,$5) RETURNING *`, [...values, actor.user.displayName, body]);
      return message(inserted.rows[0]);
    });
  }
}
