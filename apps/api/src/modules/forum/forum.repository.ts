import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { Inject, Injectable } from '@nestjs/common';
import type { ForumDocument, ForumPost, ForumPostSummary, ForumPage, ForumTopic } from '@messages/contracts';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from '../../database/database.service.js';
import { ForumAccess } from './forum-access.service.js';
import { postVotes } from './forum-discussion.repository.js';
import type { AuthContext, SqlClient } from '../auth/auth.types.js';
import { HttpError } from '../../common/errors/http-error.js';
import type { ForumFilters, ValidatedPost, ValidatedPostUpdate } from './forum-validation.js';
import { CommunityRepository } from '../communities/community.repository.js';
import { MediaRepository } from '../media/media.repository.js';
import { publicPost, readablePost } from '../communities/community-access.js';
import { TaxonomyRepository } from './taxonomy.repository.js';
import { encodePostCursor } from './forum-cursor.js';

interface PostSummaryRow extends QueryResultRow {
  id: string; title: string; body: string; topic_id: string; topic_name: string; topic_description: string;
  category_id: string | null; category_slug: string; category_name: string; category_description: string;
  category_parent_id: string | null; category_root_id: string; category_depth: number; category_path: string[]; category_position: number;
  author_id: string; display_name: string; reply_count: number; created_at: Date; last_activity_at: Date;
  community_id: string | null; community_name: string | null;
  author_avatar_id: string | null;
  author_following?: boolean;
}
interface PostRow extends PostSummaryRow {
  request_id: string; media_request_ids: string[]; tag_request_names: string[];
  content: ForumDocument | null; revision: number; updated_at: Date | null;
}
const POST_CONTEXT = `COALESCE(t.slug,g.slug) AS topic_id,COALESCE(t.name,g.name) AS topic_name,
  COALESCE(t.description,g.description) AS topic_description,u.display_name,author_avatar.id AS author_avatar_id,c.name AS community_name,
  k.slug AS category_slug,k.name AS category_name,k.description AS category_description,
  k.parent_id AS category_parent_id,k.root_id AS category_root_id,k.depth AS category_depth,k.path AS category_path,k.position AS category_position
  FROM forum_posts p JOIN users u ON u.id=p.author_id
  LEFT JOIN media author_avatar ON author_avatar.avatar_user_id=u.id AND author_avatar.state='READY'
  JOIN forum_categories g ON g.parent_id IS NULL AND g.slug='general'
  LEFT JOIN forum_categories k ON k.id=p.category_id LEFT JOIN forum_categories t ON t.id=k.root_id
  LEFT JOIN communities c ON c.id=p.community_id`;
const POSTS = 'SELECT p.*,' + POST_CONTEXT;
const POST_SUMMARIES = 'SELECT p.id,p.title,p.body,p.category_id,p.author_id,p.reply_count,p.created_at,p.last_activity_at,p.community_id,EXISTS(SELECT 1 FROM author_follows af WHERE af.follower_id=$1 AND af.author_id=p.author_id) AS author_following,' + POST_CONTEXT;
function summary(row: PostSummaryRow): ForumPostSummary {
  return {
    id: String(row.id), title: row.title, excerpt: row.body.replace(/\s+/gu, ' ').slice(0, 420),
    topic: { id: row.topic_id, name: row.topic_name, description: row.topic_description },
    category: row.category_id ? { id: row.category_id, slug: row.category_slug, name: row.category_name, description: row.category_description,
      parentId: row.category_parent_id, rootId: row.category_root_id, depth: row.category_depth, path: row.category_path, position: row.category_position } : null,
    tags: [],
    author: { id: row.author_id, displayName: row.display_name, ...(row.author_avatar_id ? { avatarId: row.author_avatar_id } : {}), ...(row.author_following === undefined ? {} : { isFollowing: row.author_following }) }, replyCount: row.reply_count,
    community: row.community_id ? { id: String(row.community_id), name: row.community_name! } : null, images: [],
    createdAt: new Date(row.created_at).toISOString(), lastActivityAt: new Date(row.last_activity_at).toISOString(),
  };
}
function detail(row: PostRow): Omit<ForumPost, 'votes'> {
  return { ...summary(row), body: row.body, content: row.content, revision: row.revision, updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null };
}
@Injectable()
export class ForumRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService, @Inject(ForumAccess) private readonly access: ForumAccess,
    @Inject(CommunityRepository) private readonly communities: CommunityRepository,
    @Inject(MediaRepository) private readonly media: MediaRepository,
    @Inject(TaxonomyRepository) private readonly taxonomy: TaxonomyRepository) {}

  async topics(): Promise<ForumTopic[]> {
    return this.taxonomy.topics();
  }
  async list(filters: ForumFilters, userId: string | null = null): Promise<ForumPage<ForumPostSummary>> {
    if (filters.feed === 'following' && !userId) throw new HttpError(401, 'SESSION_REQUIRED', 'Entra para ver a quienes sigues.');
    const where: string[] = [readablePost('$1')];
    if (filters.publicOnly) where.push(publicPost());
    const values: unknown[] = [userId];
    if (filters.feed === 'following') where.push('(EXISTS(SELECT 1 FROM author_follows af WHERE af.follower_id=$1 AND af.author_id=p.author_id) OR EXISTS(SELECT 1 FROM community_memberships fm WHERE fm.user_id=$1 AND fm.community_id=p.community_id))');
    if (filters.community) {
      await this.communities.get(filters.community, userId);
      values.push(filters.community); where.push('p.community_id=$' + values.length);
    }
    if (filters.topic) {
      const topic = await this.taxonomy.root(filters.topic);
      values.push(topic.id);
      where.push('(k.root_id=$' + values.length + (filters.topic === 'general' ? ' OR p.category_id IS NULL)' : ')'));
    }
    if (filters.category) {
      await this.taxonomy.get(filters.category);
      values.push(filters.category); where.push('$' + values.length + '::uuid=ANY(k.path)');
    }
    for (const tag of filters.tags) {
      values.push(tag);
      where.push('EXISTS(SELECT 1 FROM forum_post_tags pt WHERE pt.post_id=p.id AND pt.tag_id=$' + values.length + ')');
    }
    if (filters.author) { values.push(filters.author); where.push('p.author_id=$' + values.length); }
    if (filters.before) {
      values.push(filters.before.createdAt, filters.before.id);
      where.push('(p.created_at,p.id)<($' + (values.length - 1) + '::timestamptz,$' + values.length + '::uuid)');
    }
    if (filters.search) {
      values.push('%' + filters.search.replace(/[\\%_]/gu, '\\$&') + '%');
      where.push('(p.title ILIKE $' + values.length + ' OR p.body ILIKE $' + values.length + ')');
    }
    values.push(filters.limit + 1);
    const result = await this.database.query<PostSummaryRow>(POST_SUMMARIES + ' WHERE ' + where.join(' AND ') + ' ORDER BY p.created_at DESC,p.id DESC LIMIT $' + values.length, values);
    const items = result.rows.slice(0, filters.limit).map(summary);
    const hasMore = result.rows.length > filters.limit;
    const selected = { items, hasMore, nextCursor: hasMore ? encodePostCursor(items.at(-1)!) : null };
    const images = await this.media.images(selected.items.map(item => item.id));
    const tags = await this.taxonomy.postTags(selected.items.map(item => item.id));
    return { ...selected, items: selected.items.map(item => ({ ...item, images: images.get(item.id) ?? [], tags: tags.get(item.id) ?? [] })) };
  }
  async getPost(id: string, client: SqlClient = this.database, userId: string | null = null): Promise<ForumPost> {
    const row = (await client.query<PostRow>(POSTS + ' WHERE p.id=$1 AND ' + readablePost('$2'), [id, userId])).rows[0];
    if (!row) throw new HttpError(404, 'POST_NOT_FOUND', 'Esta publicación no existe.');
    const images = await this.media.images([id], client);
    const tags = await this.taxonomy.postTags([id], client);
    const followed = userId ? (await client.query('SELECT 1 FROM author_follows WHERE follower_id=$1 AND author_id=$2', [userId, row.author_id])).rows.length > 0 : false;
    const post = detail(row);
    return { ...post, author: { ...post.author, isFollowing: followed }, votes: await postVotes(client, id, userId), images: images.get(id) ?? [], tags: tags.get(id) ?? [] };
  }
  private async rate(client: SqlClient, userId: string, type: 'posts' | 'replies', maximum: number): Promise<void> {
    const table = type === 'posts' ? 'forum_posts' : 'forum_replies';
    const result = await client.query<{ total: string }>('SELECT COUNT(*)::text AS total FROM ' + table + ` WHERE author_id=$1 AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'`, [userId]);
    if (Number(result.rows[0].total) >= maximum) throw new HttpError(429, 'FORUM_RATE_LIMIT', 'Has participado varias veces. Espera un poco antes de publicar de nuevo.');
  }
  async createPost(input: ValidatedPost, actor: AuthContext): Promise<{ post: ForumPost; created: boolean }> {
    return this.database.transaction(async client => {
      await this.access.member(client, actor);
      const categoryId = await this.taxonomy.resolve(input, client);
      const existing = (await client.query<PostRow>(POSTS + ' WHERE p.author_id=$1 AND p.request_id=$2', [actor.user.id, input.requestId])).rows[0];
      if (existing) {
        if (existing.title !== input.title || existing.body !== input.body || existing.category_id !== categoryId || String(existing.community_id ?? '') !== (input.communityId ?? '')
          || JSON.stringify(existing.media_request_ids) !== JSON.stringify(input.mediaIds ?? [])
          || JSON.stringify(existing.tag_request_names) !== JSON.stringify(input.tags ?? [])
          || !isDeepStrictEqual(existing.content, input.content)) throw new HttpError(409, 'REQUEST_CONFLICT', 'Esta solicitud ya corresponde a otra publicación.');
        return { post: await this.getPost(String(existing.id), client, actor.user.id), created: false };
      }
      if (input.communityId) await this.communities.authorizePublication(client, input.communityId, actor.user.id);
      await this.rate(client, actor.user.id, 'posts', 10);
      const id = randomUUID();
      await client.query(`INSERT INTO forum_posts(id,category_id,author_id,title,body,request_id,community_id,media_request_ids,tag_request_names,content)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [id, categoryId, actor.user.id, input.title, input.body, input.requestId, input.communityId ?? null, input.mediaIds, input.tags ?? [], input.content ? JSON.stringify(input.content) : null]);
      await this.taxonomy.attachTags(client, id, input.tags ?? []);
      await this.media.attach(client, input.mediaIds ?? [], actor.user.id, id);
      if (input.communityId) await this.communities.published(client, input.communityId, id, actor.user.id);
      return { post: await this.getPost(id, client, actor.user.id), created: true };
    });
  }
  async updatePost(id: string, input: ValidatedPostUpdate, actor: AuthContext): Promise<{ post: ForumPost; updated: boolean }> {
    return this.database.transaction(async client => {
      await this.access.member(client, actor);
      const parent = (await client.query<{ community_id: string | null }>('SELECT community_id FROM forum_posts WHERE id=$1 AND author_id=$2', [id, actor.user.id])).rows[0];
      if (!parent) throw new HttpError(404, 'POST_NOT_FOUND', 'Esta publicación no existe o no puedes editarla.');
      // Mismo orden de bloqueos que las respuestas: usuario, comunidad, publicación y medios.
      if (parent.community_id) await this.communities.authorizePublication(client, String(parent.community_id), actor.user.id);
      const current = (await client.query<PostRow>('SELECT * FROM forum_posts WHERE id=$1 AND author_id=$2 FOR UPDATE', [id, actor.user.id])).rows[0];
      if (!current) throw new HttpError(404, 'POST_NOT_FOUND', 'Esta publicación no existe o no puedes editarla.');
      const categoryId = await this.taxonomy.resolve(input, client);
      const hash = createHash('sha256').update(JSON.stringify({ title: input.title, content: input.content, categoryId, tags: input.tags ?? [], revision: input.revision })).digest('hex');
      const previous = (await client.query<{ post_id: string; request_hash: string }>('SELECT post_id,request_hash FROM forum_post_edits WHERE author_id=$1 AND request_id=$2', [actor.user.id, input.requestId])).rows[0];
      if (previous) {
        if (previous.post_id !== id || previous.request_hash !== hash) throw new HttpError(409, 'REQUEST_CONFLICT', 'Esta solicitud ya corresponde a otra edición.');
        return { post: await this.getPost(id, client, actor.user.id), updated: false };
      }
      if (current.revision !== input.revision) throw new HttpError(409, 'POST_VERSION_CONFLICT', 'La publicación cambió en otra pestaña. Tu borrador sigue aquí; revisa la versión publicada antes de continuar.');
      const recent = await client.query<{ total: string }>("SELECT COUNT(*)::text AS total FROM forum_post_edits WHERE author_id=$1 AND created_at>CURRENT_TIMESTAMP-INTERVAL '1 hour'", [actor.user.id]);
      if (Number(recent.rows[0]!.total) >= 20) throw new HttpError(429, 'FORUM_RATE_LIMIT', 'Has editado varias publicaciones. Espera un poco antes de guardar de nuevo.');
      await this.media.replacePostImages(client, input.mediaIds, actor.user.id, id);
      await client.query('DELETE FROM forum_post_tags WHERE post_id=$1', [id]);
      await this.taxonomy.attachTags(client, id, input.tags ?? []);
      await client.query(`UPDATE forum_posts SET title=$2,body=$3,content=$4,category_id=$5,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
        [id, input.title, input.body, JSON.stringify(input.content), categoryId]);
      await client.query('INSERT INTO forum_post_edits(post_id,author_id,request_id,request_hash,base_revision,revision) VALUES($1,$2,$3,$4,$5,$6)', [id, actor.user.id, input.requestId, hash, input.revision, input.revision + 1]);
      return { post: await this.getPost(id, client, actor.user.id), updated: true };
    });
  }
}
