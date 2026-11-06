import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { CreateForumPost, ForumCategory, ForumTag, ForumTopic } from '@messages/contracts';
import type { QueryResultRow } from 'pg';
import { DatabaseService } from '../../database/database.service.js';
import { HttpError } from '../../common/errors/http-error.js';
import type { SqlClient } from '../auth/auth.types.js';
import { readablePost } from '../communities/community-access.js';

export interface CategoryRow extends QueryResultRow {
  id: string; slug: string; name: string; description: string;
  parent_id: string | null; root_id: string; depth: number; path: string[]; position: number;
}
export function category(row: CategoryRow): ForumCategory {
  return { id: row.id, slug: row.slug, name: row.name, description: row.description,
    parentId: row.parent_id, rootId: row.root_id, depth: row.depth, path: row.path, position: row.position };
}
@Injectable()
export class TaxonomyRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async categories(): Promise<ForumCategory[]> {
    const result = await this.database.query<CategoryRow>('SELECT * FROM forum_categories ORDER BY depth,parent_id,position,id');
    return result.rows.map(category);
  }
  async topics(): Promise<ForumTopic[]> {
    return (await this.database.query<ForumTopic & QueryResultRow>('SELECT slug AS id,name,description FROM forum_categories WHERE parent_id IS NULL ORDER BY position,id')).rows;
  }
  async root(slug: string, client: SqlClient = this.database): Promise<CategoryRow> {
    const row = (await client.query<CategoryRow>('SELECT * FROM forum_categories WHERE parent_id IS NULL AND slug=$1', [slug])).rows[0];
    if (!row) throw new HttpError(404, 'TOPIC_NOT_FOUND', 'Este tópico no existe.');
    return row;
  }
  async get(id: string, client: SqlClient = this.database): Promise<CategoryRow> {
    const row = (await client.query<CategoryRow>('SELECT * FROM forum_categories WHERE id=$1', [id])).rows[0];
    if (!row) throw new HttpError(404, 'CATEGORY_NOT_FOUND', 'Esta temática no existe.');
    return row;
  }
  async resolve(input: CreateForumPost, client: SqlClient): Promise<string | null> {
    const selected = input.categoryId ? await this.get(input.categoryId, client) : null;
    const root = input.topicId ? await this.root(input.topicId, client) : null;
    if (root && (input.categoryId === null || (selected && selected.root_id !== root.id))) {
      throw new HttpError(400, 'CATEGORY_CONFLICT', 'La temática y el tópico no corresponden a la misma rama.');
    }
    return selected?.id ?? root?.id ?? null;
  }
  async tags(search: string, limit: number, userId: string | null, ids: string[] = []): Promise<ForumTag[]> {
    const pattern = '%' + search.replace(/[\\%_]/gu, '\\$&') + '%';
    // Una etiqueta privada no se convierte en una sugerencia pública por existir en el vocabulario.
    const result = await this.database.query<ForumTag & QueryResultRow>(`
      SELECT t.id,t.name FROM forum_tags t WHERE t.name ILIKE $2 ${ids.length ? 'AND t.id=ANY($4::uuid[])' : ''} AND
      (t.is_seeded OR EXISTS(SELECT 1 FROM forum_post_tags pt JOIN forum_posts p ON p.id=pt.post_id
        WHERE pt.tag_id=t.id AND ${readablePost('$1')}))
      ORDER BY t.is_seeded DESC,t.name,t.id LIMIT $3`, ids.length ? [userId, pattern, limit, ids] : [userId, pattern, limit]);
    return result.rows;
  }
  async attachTags(client: SqlClient, postId: string, names: string[]): Promise<void> {
    // El orden canónico de los nombres evita invertir bloqueos entre publicaciones concurrentes.
    for (const [position, name] of names.entries()) {
      await client.query('INSERT INTO forum_tags(id,name) VALUES($1,$2) ON CONFLICT(name) DO NOTHING', [randomUUID(), name]);
      await client.query(`INSERT INTO forum_post_tags(post_id,tag_id,position)
        SELECT $1,id,$3 FROM forum_tags WHERE name=$2`, [postId, name, position]);
    }
  }
  async postTags(postIds: string[], client: SqlClient = this.database): Promise<Map<string, ForumTag[]>> {
    const tags = new Map<string, ForumTag[]>();
    if (!postIds.length) return tags;
    const result = await client.query<ForumTag & { post_id: string } & QueryResultRow>(`
      SELECT pt.post_id,t.id,t.name FROM forum_post_tags pt JOIN forum_tags t ON t.id=pt.tag_id
      WHERE pt.post_id=ANY($1::uuid[]) ORDER BY pt.post_id,pt.position`, [postIds]);
    for (const row of result.rows) {
      const items = tags.get(row.post_id) ?? [];
      items.push({ id: row.id, name: row.name });
      tags.set(row.post_id, items);
    }
    return tags;
  }
}
