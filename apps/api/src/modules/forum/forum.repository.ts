import { Inject, Injectable } from '@nestjs/common';
import type { CreateForumPost, CreateForumReply, CreatedForumReply, ForumPost, ForumPostSummary, ForumReply, ForumPage, ForumTopic } from '@messages/contracts';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from '../../database/database.service.js';
import { SessionService } from '../auth/session.service.js';
import type { AuthContext, SqlClient } from '../auth/auth.types.js';
import { HttpError } from '../../common/errors/http-error.js';
import type { ForumFilters } from './forum-validation.js';
import { CommunityRepository } from '../communities/community.repository.js';
import { MediaRepository } from '../media/media.repository.js';
import { readablePost } from '../communities/community-access.js';

interface PostRow extends QueryResultRow {
  id: string; title: string; body: string; topic_id: string; topic_name: string; topic_description: string;
  author_id: string; display_name: string; reply_count: number; created_at: Date; last_activity_at: Date; request_id: string;
  community_id: string | null; community_name: string | null; media_request_ids: string[];
}
interface ReplyRow extends QueryResultRow {
  id: string; post_id: string; author_id: string; display_name: string; body: string; created_at: Date; request_id: string;
}
const POSTS = `SELECT p.*,t.name AS topic_name,t.description AS topic_description,u.display_name,c.name AS community_name
  FROM forum_posts p JOIN forum_topics t ON t.id=p.topic_id JOIN users u ON u.id=p.author_id
  LEFT JOIN communities c ON c.id=p.community_id`;
const REPLIES = 'SELECT r.*,u.display_name FROM forum_replies r JOIN users u ON u.id=r.author_id';
function summary(row: PostRow): ForumPostSummary {
  return {
    id: String(row.id), title: row.title, excerpt: row.body.replace(/\s+/gu, ' ').slice(0, 240),
    topic: { id: row.topic_id, name: row.topic_name, description: row.topic_description },
    author: { id: row.author_id, displayName: row.display_name }, replyCount: row.reply_count,
    community: row.community_id ? { id: String(row.community_id), name: row.community_name! } : null, images: [],
    createdAt: new Date(row.created_at).toISOString(), lastActivityAt: new Date(row.last_activity_at).toISOString(),
  };
}
function detail(row: PostRow): ForumPost { return { ...summary(row), body: row.body }; }
function reply(row: ReplyRow): ForumReply {
  return { id: String(row.id), postId: String(row.post_id), body: row.body,
    author: { id: row.author_id, displayName: row.display_name }, createdAt: new Date(row.created_at).toISOString() };
}
function page<T extends { id: string }>(items: T[], limit: number): ForumPage<T> {
  const selected = items.slice(0, limit);
  return { items: selected, hasMore: items.length > limit, nextCursor: items.length > limit ? selected.at(-1)!.id : null };
}
@Injectable()
export class ForumRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService, @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(CommunityRepository) private readonly communities: CommunityRepository,
    @Inject(MediaRepository) private readonly media: MediaRepository) {}

  async topics(): Promise<ForumTopic[]> {
    return (await this.database.query<ForumTopic & QueryResultRow>('SELECT id,name,description FROM forum_topics ORDER BY position,id')).rows;
  }
  async list(filters: ForumFilters, userId: string | null = null): Promise<ForumPage<ForumPostSummary>> {
    const where: string[] = [readablePost('$1')];
    const values: unknown[] = [userId];
    if (filters.community) {
      await this.communities.get(filters.community, userId);
      values.push(filters.community); where.push('p.community_id=$' + values.length);
    }
    if (filters.topic) {
      const topic = await this.database.query('SELECT id FROM forum_topics WHERE id=$1', [filters.topic]);
      if (!topic.rows[0]) throw new HttpError(404, 'TOPIC_NOT_FOUND', 'Este tópico no existe.');
      values.push(filters.topic); where.push('p.topic_id=$' + values.length);
    }
    if (filters.author) { values.push(filters.author); where.push('p.author_id=$' + values.length); }
    if (filters.before) { values.push(filters.before); where.push('p.id<$' + values.length); }
    if (filters.search) {
      values.push('%' + filters.search.replace(/[\\%_]/gu, '\\$&') + '%');
      where.push('(p.title ILIKE $' + values.length + ' OR p.body ILIKE $' + values.length + ')');
    }
    values.push(filters.limit + 1);
    const result = await this.database.query<PostRow>(POSTS + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY p.id DESC LIMIT $' + values.length, values);
    const selected = page(result.rows.map(summary), filters.limit);
    const images = await this.media.images(selected.items.map(item => item.id));
    return { ...selected, items: selected.items.map(item => ({ ...item, images: images.get(item.id) ?? [] })) };
  }
  async getPost(id: string, client: SqlClient = this.database, userId: string | null = null): Promise<ForumPost> {
    const row = (await client.query<PostRow>(POSTS + ' WHERE p.id=$1 AND ' + readablePost('$2'), [id, userId])).rows[0];
    if (!row) throw new HttpError(404, 'POST_NOT_FOUND', 'Esta publicación no existe.');
    const images = await this.media.images([id], client);
    return { ...detail(row), images: images.get(id) ?? [] };
  }
  async listReplies(postId: string, before: string | undefined, limit: number, userId: string | null = null): Promise<ForumPage<ForumReply>> {
    const exists = await this.database.query('SELECT p.id FROM forum_posts p WHERE p.id=$1 AND ' + readablePost('$2'), [postId, userId]);
    if (!exists.rows[0]) throw new HttpError(404, 'POST_NOT_FOUND', 'Esta publicación no existe.');
    const result = await this.database.query<ReplyRow>(
      REPLIES + ' WHERE r.post_id=$1' + (before ? ' AND r.id<$3' : '') + ' ORDER BY r.id DESC LIMIT $2',
      before ? [postId, limit + 1, before] : [postId, limit + 1],
    );
    return page(result.rows.map(reply), limit);
  }
  private async member(client: SqlClient, actor: AuthContext): Promise<void> {
    const user = await client.query('SELECT id FROM users WHERE id=$1 AND email_verified_at IS NOT NULL FOR NO KEY UPDATE', [actor.user.id]);
    if (!user.rows[0]) throw new HttpError(401, 'SESSION_REQUIRED', 'Inicia sesión para participar.');
    await this.sessions.assertCurrent(client, actor);
  }
  private async rate(client: SqlClient, userId: string, type: 'posts' | 'replies', maximum: number): Promise<void> {
    const table = type === 'posts' ? 'forum_posts' : 'forum_replies';
    const result = await client.query<{ total: string }>('SELECT COUNT(*)::text AS total FROM ' + table + ` WHERE author_id=$1 AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'`, [userId]);
    if (Number(result.rows[0].total) >= maximum) throw new HttpError(429, 'FORUM_RATE_LIMIT', 'Has participado varias veces. Espera un poco antes de publicar de nuevo.');
  }
  async createPost(input: CreateForumPost, actor: AuthContext): Promise<{ post: ForumPost; created: boolean }> {
    return this.database.transaction(async client => {
      await this.member(client, actor);
      const existing = (await client.query<PostRow>(POSTS + ' WHERE p.author_id=$1 AND p.request_id=$2', [actor.user.id, input.requestId])).rows[0];
      if (existing) {
        if (existing.title !== input.title || existing.body !== input.body || existing.topic_id !== input.topicId || String(existing.community_id ?? '') !== (input.communityId ?? '')
          || JSON.stringify(existing.media_request_ids) !== JSON.stringify(input.mediaIds ?? [])) throw new HttpError(409, 'REQUEST_CONFLICT', 'Esta solicitud ya corresponde a otra publicación.');
        return { post: await this.getPost(String(existing.id), client, actor.user.id), created: false };
      }
      const topic = await client.query('SELECT id FROM forum_topics WHERE id=$1', [input.topicId]);
      if (!topic.rows[0]) throw new HttpError(404, 'TOPIC_NOT_FOUND', 'Elige un tópico disponible.');
      if (input.communityId) await this.communities.authorizePublication(client, input.communityId, actor.user.id);
      await this.rate(client, actor.user.id, 'posts', 10);
      const inserted = await client.query<{ id: string }>('INSERT INTO forum_posts(topic_id,author_id,title,body,request_id,community_id,media_request_ids) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id', [input.topicId, actor.user.id, input.title, input.body, input.requestId, input.communityId ?? null, input.mediaIds ?? []]);
      await this.media.attach(client, input.mediaIds ?? [], actor.user.id, String(inserted.rows[0].id));
      if (input.communityId) await this.communities.published(client, input.communityId, String(inserted.rows[0].id), actor.user.id);
      return { post: await this.getPost(String(inserted.rows[0].id), client, actor.user.id), created: true };
    });
  }
  async createReply(postId: string, input: CreateForumReply, actor: AuthContext): Promise<CreatedForumReply> {
    return this.database.transaction(async client => {
      await this.member(client, actor);
      const parent = (await client.query<{ community_id: string | null }>('SELECT community_id FROM forum_posts WHERE id=$1', [postId])).rows[0];
      if (!parent) throw new HttpError(404, 'POST_NOT_FOUND', 'Esta publicación no existe.');
      if (parent.community_id) await this.communities.authorizePublication(client, String(parent.community_id), actor.user.id);
      const post = (await client.query<{ id: string; reply_count: number }>('SELECT id,reply_count FROM forum_posts WHERE id=$1 FOR UPDATE', [postId])).rows[0];
      if (!post) throw new HttpError(404, 'POST_NOT_FOUND', 'Esta publicación no existe.');
      const existing = (await client.query<ReplyRow>(REPLIES + ' WHERE r.author_id=$1 AND r.request_id=$2', [actor.user.id, input.requestId])).rows[0];
      if (existing) {
        if (String(existing.post_id) !== postId || existing.body !== input.body) throw new HttpError(409, 'REQUEST_CONFLICT', 'Esta solicitud ya corresponde a otra respuesta.');
        return { reply: reply(existing), replyCount: post.reply_count, created: false };
      }
      await this.rate(client, actor.user.id, 'replies', 60);
      const inserted = await client.query<{ id: string }>('INSERT INTO forum_replies(post_id,author_id,body,request_id) VALUES($1,$2,$3,$4) RETURNING id', [postId, actor.user.id, input.body, input.requestId]);
      const saved = (await client.query<ReplyRow>(REPLIES + ' WHERE r.id=$1', [inserted.rows[0].id])).rows[0];
      await client.query('UPDATE forum_posts SET reply_count=reply_count+1,last_activity_at=CURRENT_TIMESTAMP WHERE id=$1', [postId]);
      return { reply: reply(saved), replyCount: post.reply_count + 1, created: true };
    });
  }
}
