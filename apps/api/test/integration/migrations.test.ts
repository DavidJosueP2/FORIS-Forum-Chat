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
  const database = new DatabaseService(pool, { info() {}, error() {} });
  const repository = new MessagesRepository(database);
  const saved = await repository.save({ author: 'Ana', body: 'Historial anterior', senderId: randomUUID(), requestId: randomUUID() });
  await runMigrations(pool);
  await runMigrations(pool);
  const page = await repository.list({ limit: 50 });
  assert.deepEqual(page.messages, [saved.message]);
  const versions = await pool.query('SELECT version FROM app_schema_migrations');
  assert.deepEqual(versions.rows, [{ version: 1 }]);
});
