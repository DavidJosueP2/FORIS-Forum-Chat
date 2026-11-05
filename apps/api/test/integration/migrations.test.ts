import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../src/database/database.service.js';
import { createMessages } from '../../src/database/migrations/001-create-messages.js';
import { runMigrations } from '../../src/database/migrations/run-migrations.js';
import { MessagesRepository } from '../../src/modules/messages/messages.repository.js';
import { testDatabase } from '../support/database.js';

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
  assert.deepEqual(versions.rows, [{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }, { version: 5 }]);
  assert.equal((await pool.query('SELECT id FROM forum_topics')).rows.length, 5);
  assert.equal((await pool.query('SELECT id FROM forum_posts')).rows.length, 0);
});
