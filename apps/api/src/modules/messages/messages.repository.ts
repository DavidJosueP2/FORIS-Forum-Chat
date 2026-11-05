import { Inject, Injectable } from '@nestjs/common';
import { HttpError } from '../../common/errors/http-error.js';
import { DatabaseService } from '../../database/database.service.js';
import type { SqlDatabase } from '../../database/database.types.js';
import type { Message, MessagePage, Pagination } from '@messages/contracts';
import type { MessageRepositoryPort, MessageRow, SaveResult, StoredMessageInput } from './messages.types.js';

const COLUMNS = 'id, author, body, sender_id, request_id, created_at, user_id';

function toMessage(row: MessageRow): Message {
  return {
    id: String(row.id),
    author: row.author,
    body: row.body,
    senderId: row.sender_id,
    requestId: row.request_id,
    createdAt: new Date(row.created_at).toISOString(),
    ...(row.user_id ? { accountId: row.user_id } : {}),
  };
}

function reusedMessage(message: Message, input: StoredMessageInput): SaveResult {
  if (message.senderId !== input.senderId || message.body !== input.body || (!input.accountId && message.author !== input.author)
    || (message.accountId ?? null) !== (input.accountId ?? null)) {
    throw new HttpError(409, 'SEND_CONFLICT', 'Este identificador ya corresponde a otro envío.');
  }
  return { message, created: false };
}

@Injectable()
export class MessagesRepository implements MessageRepositoryPort {
  constructor(@Inject(DatabaseService) private readonly database: SqlDatabase) {}

  async list({ before, after, limit }: Pagination): Promise<MessagePage> {
    let result;
    if (before) {
      result = await this.database.query<MessageRow>(
        `SELECT ${COLUMNS} FROM messages WHERE id < $1 ORDER BY id DESC LIMIT $2`, [before, limit + 1],
      );
    } else if (after) {
      result = await this.database.query<MessageRow>(
        `SELECT ${COLUMNS} FROM messages WHERE id > $1 ORDER BY id ASC LIMIT $2`, [after, limit + 1],
      );
    } else {
      result = await this.database.query<MessageRow>(`SELECT ${COLUMNS} FROM messages ORDER BY id DESC LIMIT $1`, [limit + 1]);
    }
    const selected = result.rows.slice(0, limit);
    if (!after) selected.reverse();
    return { messages: selected.map(toMessage), hasMore: result.rows.length > limit };
  }

  async save(input: StoredMessageInput): Promise<SaveResult> {
    const { author, body, senderId, requestId } = input;
    const existing = await this.findRequest(requestId);
    if (existing) return reusedMessage(existing, input);
    const result = await this.database.query<MessageRow>(
      `INSERT INTO messages (author, body, sender_id, request_id, user_id)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (request_id) DO NOTHING RETURNING ${COLUMNS}`,
      [author, body, senderId, requestId, input.accountId ?? null],
    );
    if (result.rows.length) return { message: toMessage(result.rows[0]), created: true };
    const concurrent = await this.findRequest(requestId);
    if (!concurrent) throw new Error('No se pudo recuperar el envío concurrente.');
    return reusedMessage(concurrent, input);
  }

  async findRequest(requestId: string): Promise<Message | undefined> {
    const result = await this.database.query<MessageRow>(`SELECT ${COLUMNS} FROM messages WHERE request_id = $1`, [requestId]);
    return result.rows.length ? toMessage(result.rows[0]) : undefined;
  }
}
