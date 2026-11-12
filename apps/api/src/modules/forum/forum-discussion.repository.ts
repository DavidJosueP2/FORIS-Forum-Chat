import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { ChangedForumReply, CreateForumReply, CreatedForumReply, ForumPage, ForumReply, ForumVotes, UpdateForumReply } from '@messages/contracts';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from '../../database/database.service.js';
import type { AuthContext, SqlClient } from '../auth/auth.types.js';
import { HttpError } from '../../common/errors/http-error.js';
import { readablePost } from '../communities/community-access.js';
import { ForumAccess } from './forum-access.service.js';

interface ReplyRow extends QueryResultRow {
  id: string; post_id: string; author_id: string; display_name: string; avatar_id: string | null;
  body: string; created_at: Date; parent_id: string | null; depth: number; revision: number;
  updated_at: Date | null; deleted_at: Date | null; pinned: boolean; reply_count: number;
  request_hash: string | null; score: number; vote: -1 | 0 | 1;
}
const REPLIES = `SELECT r.*,u.display_name,a.id AS avatar_id,
  (SELECT COUNT(*)::int FROM forum_replies children WHERE children.post_id=r.post_id AND children.parent_id=r.id) AS reply_count,
  COALESCE((SELECT SUM(v.value) FROM forum_reply_votes v WHERE v.reply_id=r.id),0)::int AS score,
  COALESCE((SELECT v.value FROM forum_reply_votes v WHERE v.reply_id=r.id AND v.user_id=$2),0)::int AS vote
  FROM forum_replies r JOIN users u ON u.id=r.author_id
  LEFT JOIN media a ON a.avatar_user_id=u.id AND a.state='READY'`;
function reply(row: ReplyRow): ForumReply {
  const deleted = row.deleted_at !== null;
  return { id: String(row.id), postId: row.post_id, body: deleted ? '' : row.body,
    author: deleted ? { id: '', displayName: 'Comentario eliminado' } : { id: row.author_id, displayName: row.display_name, ...(row.avatar_id ? { avatarId: row.avatar_id } : {}) },
    createdAt: new Date(row.created_at).toISOString(), parentId: row.parent_id ? String(row.parent_id) : null,
    depth: row.depth, revision: row.revision, updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    deleted, pinned: row.pinned, replyCount: row.reply_count, votes: deleted ? { score: 0, value: 0 } : { score: row.score, value: row.vote } };
}

export async function postVotesById(client: SqlClient, ids: string[], userId: string | null): Promise<Map<string, ForumVotes>> {
  if (!ids.length) return new Map();
  const { rows } = await client.query<ForumVotes & { post_id: string }>(`SELECT post_id,SUM(value)::int AS score,
    COALESCE(MAX(value) FILTER(WHERE user_id=$2),0)::int AS value FROM forum_post_votes
    WHERE post_id=ANY($1::uuid[]) GROUP BY post_id`, [ids, userId]);
  return new Map(rows.map(({ post_id, score, value }) => [post_id, { score, value }]));
}

export async function postVotes(client: SqlClient, id: string, userId: string | null): Promise<ForumVotes> {
  return (await postVotesById(client, [id], userId)).get(id.toLowerCase()) ?? { score: 0, value: 0 };
}

@Injectable()
export class ForumDiscussionRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService, @Inject(ForumAccess) private readonly access: ForumAccess) {}

  private async readable(postId: string, userId: string | null) {
    const found = await this.database.query('SELECT p.id FROM forum_posts p WHERE p.id=$1 AND ' + readablePost('$2'), [postId, userId]);
    if (!found.rows[0]) throw new HttpError(404, 'POST_NOT_FOUND', 'Esta publicación no existe.');
  }
  private async row(client: SqlClient, postId: string, id: string, userId: string | null): Promise<ReplyRow> {
    const found = (await client.query<ReplyRow>(REPLIES + ' WHERE r.post_id=$1 AND r.id=$3 AND EXISTS(SELECT 1 FROM forum_posts p WHERE p.id=r.post_id AND ' + readablePost('$2') + ')', [postId, userId, id])).rows[0];
    if (!found) throw new HttpError(404, 'REPLY_NOT_FOUND', 'Este comentario no existe.');
    return found;
  }
  async get(postId: string, id: string, userId: string | null): Promise<ForumReply> {
    await this.readable(postId, userId);
    return reply(await this.row(this.database, postId, id, userId));
  }
  async list(postId: string, parentId: string | null, before: string | undefined, limit: number, userId: string | null): Promise<ForumPage<ForumReply>> {
    await this.readable(postId, userId);
    if (parentId) await this.row(this.database, postId, parentId, userId);
    let cursorPinned = false;
    if (before) {
      const cursor = await this.row(this.database, postId, before, userId);
      if (String(cursor.parent_id ?? '') !== (parentId ?? '')) throw new HttpError(400, 'INVALID_CURSOR', 'Vuelve a cargar los comentarios.');
      cursorPinned = cursor.pinned;
    }
    const result = await this.database.query<ReplyRow>(REPLIES + ` WHERE r.post_id=$1 AND r.parent_id IS NOT DISTINCT FROM $3::bigint
      AND EXISTS(SELECT 1 FROM forum_posts p WHERE p.id=r.post_id AND ` + readablePost('$2') + `)
      AND ($4::bigint IS NULL OR (r.pinned,r.id)<($5::boolean,$4::bigint)) ORDER BY r.pinned DESC,r.id DESC LIMIT $6`,
    [postId, userId, parentId, before ?? null, cursorPinned, limit + 1]);
    const items = result.rows.slice(0, limit).map(reply);
    return { items, hasMore: result.rows.length > limit, nextCursor: result.rows.length > limit ? items.at(-1)!.id : null };
  }
  async create(postId: string, input: CreateForumReply, actor: AuthContext): Promise<CreatedForumReply> {
    return this.database.transaction(async client => {
      const post = await this.access.writablePost(client, actor, postId);
      const hash = createHash('sha256').update(JSON.stringify({ body: input.body, parentId: input.parentId ?? null })).digest('hex');
      const existing = (await client.query<{ id: string; post_id: string; body: string; parent_id: string | null; request_hash: string | null }>(
        'SELECT id,post_id,body,parent_id,request_hash FROM forum_replies WHERE author_id=$1 AND request_id=$2', [actor.user.id, input.requestId])).rows[0];
      if (existing) {
        if (existing.post_id !== postId || (existing.request_hash ? existing.request_hash !== hash : existing.body !== input.body || String(existing.parent_id ?? '') !== (input.parentId ?? '')))
          throw new HttpError(409, 'REQUEST_CONFLICT', 'Esta solicitud ya corresponde a otro comentario.');
        return { reply: reply(await this.row(client, postId, existing.id, actor.user.id)), replyCount: post.reply_count, created: false };
      }
      const parent = input.parentId ? await this.row(client, postId, input.parentId, actor.user.id) : null;
      if (parent?.deleted_at) throw new HttpError(409, 'REPLY_DELETED', 'Este comentario fue eliminado. Responde a otro comentario del hilo.');
      if (parent && parent.depth >= 5) throw new HttpError(400, 'THREAD_DEPTH_LIMIT', 'Este hilo llegó a su profundidad máxima. Responde al comentario anterior.');
      const recent = await client.query<{ total: string }>("SELECT COUNT(*)::text AS total FROM forum_replies WHERE author_id=$1 AND created_at>CURRENT_TIMESTAMP-INTERVAL '1 hour'", [actor.user.id]);
      if (Number(recent.rows[0]!.total) >= 60) throw new HttpError(429, 'FORUM_RATE_LIMIT', 'Espera un poco antes de comentar de nuevo.');
      const inserted = (await client.query<{ id: string }>(`INSERT INTO forum_replies(post_id,author_id,body,request_id,parent_id,depth,request_hash)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [postId, actor.user.id, input.body, input.requestId, input.parentId ?? null, parent ? parent.depth + 1 : 0, hash])).rows[0]!;
      await client.query('UPDATE forum_posts SET reply_count=reply_count+1,last_activity_at=CURRENT_TIMESTAMP WHERE id=$1', [postId]);
      return { reply: reply(await this.row(client, postId, inserted.id, actor.user.id)), replyCount: post.reply_count + 1, created: true };
    });
  }
  async update(postId: string, id: string, input: UpdateForumReply, actor: AuthContext): Promise<ChangedForumReply> {
    return this.database.transaction(async client => {
      const post = await this.access.writablePost(client, actor, postId);
      const current = await this.row(client, postId, id, actor.user.id);
      this.own(current, actor);
      if (current.deleted_at) throw new HttpError(409, 'REPLY_DELETED', 'Este comentario fue eliminado.');
      if (current.body !== input.body) {
        this.version(current, input.revision);
        await client.query('UPDATE forum_replies SET body=$2,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1', [id, input.body]);
      }
      return { reply: reply(await this.row(client, postId, id, actor.user.id)), replyCount: post.reply_count };
    });
  }
  async remove(postId: string, id: string, revision: number, actor: AuthContext): Promise<ChangedForumReply> {
    return this.database.transaction(async client => {
      const post = await this.access.writablePost(client, actor, postId);
      const current = await this.row(client, postId, id, actor.user.id);
      this.own(current, actor);
      if (!current.deleted_at) {
        this.version(current, revision);
        await client.query("UPDATE forum_replies SET body='',deleted_at=CURRENT_TIMESTAMP,pinned=FALSE,revision=revision+1 WHERE id=$1", [id]);
        await client.query('DELETE FROM forum_reply_votes WHERE reply_id=$1', [id]);
        await client.query('UPDATE forum_posts SET reply_count=reply_count-1 WHERE id=$1', [postId]);
      }
      return { reply: reply(await this.row(client, postId, id, actor.user.id)), replyCount: post.reply_count - (current.deleted_at ? 0 : 1) };
    });
  }
  async pin(postId: string, id: string, pinned: boolean, actor: AuthContext): Promise<ForumReply> {
    return this.database.transaction(async client => {
      const post = await this.access.writablePost(client, actor, postId);
      if (post.author_id !== actor.user.id) throw new HttpError(403, 'PIN_FORBIDDEN', 'Solo el autor de la publicación puede anclar comentarios.');
      const current = await this.row(client, postId, id, actor.user.id);
      if (current.deleted_at || current.parent_id) throw new HttpError(400, 'INVALID_PIN', 'Elige un comentario principal que siga publicado.');
      if (pinned) await client.query('UPDATE forum_replies SET pinned=FALSE WHERE post_id=$1 AND pinned', [postId]);
      await client.query('UPDATE forum_replies SET pinned=$2 WHERE id=$1', [id, pinned]);
      return reply(await this.row(client, postId, id, actor.user.id));
    });
  }
  async vote(postId: string, id: string | null, value: -1 | 0 | 1, actor: AuthContext): Promise<ForumVotes> {
    return this.database.transaction(async client => {
      await this.access.writablePost(client, actor, postId);
      if (id && (await this.row(client, postId, id, actor.user.id)).deleted_at) throw new HttpError(409, 'REPLY_DELETED', 'Este comentario fue eliminado.');
      const table = id ? 'forum_reply_votes' : 'forum_post_votes';
      const column = id ? 'reply_id' : 'post_id';
      if (value === 0) await client.query('DELETE FROM ' + table + ' WHERE ' + column + '=$1 AND user_id=$2', [id ?? postId, actor.user.id]);
      else await client.query('INSERT INTO ' + table + '(' + column + ',user_id,value) VALUES($1,$2,$3) ON CONFLICT(' + column + ',user_id) DO UPDATE SET value=EXCLUDED.value', [id ?? postId, actor.user.id, value]);
      if (!id) return postVotes(client, postId, actor.user.id);
      const current = await this.row(client, postId, id, actor.user.id);
      return { score: current.score, value: current.vote };
    });
  }
  private own(row: ReplyRow, actor: AuthContext) {
    if (row.author_id !== actor.user.id) throw new HttpError(403, 'REPLY_FORBIDDEN', 'Solo puedes editar o eliminar tus comentarios.');
  }
  private version(row: ReplyRow, revision: number) {
    if (row.revision !== revision) throw new HttpError(409, 'REPLY_VERSION_CONFLICT', 'El comentario cambió. Conserva tu texto y carga la versión publicada antes de reintentar.');
  }
}
