import type { PoolClient } from 'pg';
import { forumCatalog, forumSeedTagRows } from '../../apps/api/src/database/seeds/forum-catalog.js';

export async function seedCatalogs(client: PoolClient): Promise<void> {
  for (const item of forumCatalog) {
    await client.query(`INSERT INTO public.forum_categories(id,slug,name,description,parent_id,root_id,depth,path,position)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING`,
    [item.id, item.slug, item.name, item.description, item.parentId, item.rootId, item.depth, item.path, item.position]);
  }
  for (const { id, name } of forumSeedTagRows) {
    await client.query(`INSERT INTO public.forum_tags(id,name,is_seeded) VALUES($1,$2,TRUE)
      ON CONFLICT(name) DO UPDATE SET is_seeded=TRUE WHERE NOT forum_tags.is_seeded`, [id, name]);
  }
}
