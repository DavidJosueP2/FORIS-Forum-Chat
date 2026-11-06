import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../src/database/database.service.js';
import { createMessages } from '../../src/database/migrations/001-create-messages.js';
import { runMigrations } from '../../src/database/migrations/run-migrations.js';
import { MessagesRepository } from '../../src/modules/messages/messages.repository.js';
import { testDatabase } from '../support/database.js';
import { forumCatalog, forumSeedTags } from '../../src/database/seeds/forum-catalog.js';

test('adopta la tabla anterior sin perder mensajes y registra cada migración una vez', async t => {
  const { pool } = await testDatabase();
  t.after(() => pool.end());
  await pool.query(createMessages.sql);
  const input = { author: 'Ana', body: 'Historial anterior', senderId: randomUUID(), requestId: randomUUID() };
  // Sembrar con el contrato SQL legado: user_id todavía no existe.
  const legacy = await pool.query<{ id: string | number; created_at: Date }>(
    'INSERT INTO messages(author,body,sender_id,request_id) VALUES($1,$2,$3,$4) RETURNING id,created_at',
    [input.author, input.body, input.senderId, input.requestId],
  );
  await runMigrations(pool);
  await runMigrations(pool);
  const database = new DatabaseService(pool, { info() {}, error() {} });
  const repository = new MessagesRepository(database);
  const page = await repository.list({ limit: 50 });
  assert.deepEqual(page.messages, [{ ...input, id: String(legacy.rows[0].id), createdAt: new Date(legacy.rows[0].created_at).toISOString() }]);
  const versions = await pool.query('SELECT version FROM app_schema_migrations ORDER BY version');
  assert.deepEqual(versions.rows, [{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }, { version: 5 }, { version: 6 }, { version: 7 }, { version: 8 }, { version: 9 }, { version: 10 }, { version: 11 }, { version: 12 }]);
  assert.equal((await pool.query('SELECT id FROM forum_categories WHERE parent_id IS NULL')).rows.length, 5);
  assert.equal((await pool.query('SELECT id FROM forum_categories')).rows.length, forumCatalog.length);
  assert.equal((await pool.query('SELECT id FROM forum_tags WHERE is_seeded=TRUE')).rows.length, forumSeedTags.length);
  assert.equal((await pool.query('SELECT id FROM forum_posts')).rows.length, 0);
});

test('retira los seguimientos de comunidades sin alterar membresías, preferencias ni autores seguidos', async t => {
  const { pool } = await testDatabase(); t.after(() => pool.end());
  await runMigrations(pool);
  const owner = randomUUID(); const outsider = randomUUID();
  for (const id of [owner, outsider]) await pool.query('INSERT INTO users(id,email,display_name) VALUES($1,$2,$3)', [id, id + '@example.test', 'Ana']);
  const community = (await pool.query<{ id: string }>('INSERT INTO communities(name,name_key,description,owner_id,request_id) VALUES($1,$2,$3,$4,$5) RETURNING id', ['Un espacio', 'un espacio', 'Lecturas compartidas.', owner, randomUUID()])).rows[0].id;
  await pool.query('INSERT INTO community_memberships(community_id,user_id) VALUES($1,$2)', [community, owner]);
  await pool.query('INSERT INTO community_preferences(community_id,user_id,favorite,notify_posts) VALUES($1,$2,TRUE,FALSE)', [community, owner]);
  await pool.query('INSERT INTO author_follows(follower_id,author_id) VALUES($1,$2)', [outsider, owner]);
  // Reconstruye únicamente la relación obsoleta para representar una instalación en versión 11.
  await pool.query('CREATE TABLE community_follows(user_id UUID NOT NULL REFERENCES users(id),community_id BIGINT NOT NULL REFERENCES communities(id),PRIMARY KEY(user_id,community_id))');
  await pool.query('INSERT INTO community_follows(user_id,community_id) VALUES($1,$2)', [outsider, community]);
  await pool.query('DELETE FROM app_schema_migrations WHERE version=12');
  await runMigrations(pool);
  assert.deepEqual((await pool.query('SELECT user_id FROM community_memberships WHERE community_id=$1', [community])).rows, [{ user_id: owner }]);
  assert.deepEqual((await pool.query('SELECT favorite,notify_posts FROM community_preferences WHERE community_id=$1 AND user_id=$2', [community, owner])).rows, [{ favorite: true, notify_posts: false }]);
  assert.deepEqual((await pool.query('SELECT author_id FROM author_follows WHERE follower_id=$1', [outsider])).rows, [{ author_id: owner }]);
  await assert.rejects(pool.query('SELECT user_id FROM community_follows'), /community_follows.*does not exist/u);
});
