import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import pg from 'pg';
import request from 'supertest';
import { createTestApplication } from '../support/application.js';
import { randomToken, tokenHash } from '../../src/modules/auth/auth-crypto.js';
import { MediaService } from '../../src/modules/media/media.service.js';

// Opt-in: usa una base local dedicada. Nunca lee DATABASE_URL ni el .env privado.
const connectionString = process.env.FORIS_MEDIA_TEST_DATABASE_URL;
test('PostgreSQL real serializa reservas globales y varios recolectores limpian una sola vez', {
  skip: !connectionString,
}, async t => {
  const target = new URL(connectionString!);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname));
  assert.equal(target.pathname, '/foris_media_test');
  const schema = 'foris_media_test_' + randomUUID().replaceAll('-', '');
  assert.match(schema, /^foris_media_test_[a-f0-9]{32}$/u);
  const admin = new pg.Pool({ connectionString, max: 1 });
  const pool = new pg.Pool({ connectionString, max: 5, options: '-c search_path=' + schema });
  const prefix = resolve(tmpdir(), 'foris-media-postgres-');
  const root = await mkdtemp(prefix);
  const cleanup: { instance?: Awaited<ReturnType<typeof createTestApplication>> } = {};
  let created = false;
  t.after(async () => {
    try {
      if (cleanup.instance) await cleanup.instance.app.close();
      else await pool.end().catch(() => undefined);
      if (created) await admin.query('DROP SCHEMA "' + schema + '" CASCADE');
    } finally {
      await admin.end();
      assert.ok(resolve(root).startsWith(prefix));
      await rm(root, { recursive: true, force: true });
    }
  });
  await admin.query('CREATE SCHEMA "' + schema + '"');
  created = true;
  const instance = await createTestApplication({ pool, auth: true, media: {
    localRoot: root, maxBytes: 1024, globalBytes: 2048, userBytes: 2048,
  } });
  cleanup.instance = instance;
  await instance.app.init();
  const api = request(instance.server);
  const accounts: string[] = [];
  for (let index = 0; index < 2; index++) {
    const id = randomUUID(); const token = randomToken();
    await instance.database.query('INSERT INTO users(id,email,display_name,email_verified_at) VALUES($1,$2,$3,$4)', [id, id + '@example.test', 'Ana', new Date()]);
    await instance.database.query('INSERT INTO auth_sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,$4)', [randomUUID(), id, tokenHash(token), new Date(Date.now() + 3600000)]);
    accounts.push('foris_session=' + token);
  }
  const attempts = await Promise.all(accounts.map(cookie => api.post('/api/media/uploads')
    .set('Origin', 'http://127.0.0.1:5173').set('Cookie', cookie)
    .send({ originalName: 'foto.png', mime: 'image/png', bytes: 10, requestId: randomUUID() })));
  assert.deepEqual(attempts.map(result => result.status).sort(), [201, 409]);
  const accepted = attempts.findIndex(result => result.status === 201);
  const pending = attempts[accepted].body;
  await api.put(pending.upload.url as string).set('Origin', 'http://127.0.0.1:5173')
    .set('Cookie', accounts[accepted]).set('Content-Type', 'image/png').send(Buffer.alloc(10)).expect(200);
  await instance.database.query('UPDATE media SET upload_expires_at=$2,cleanup_after=$2 WHERE id=$1', [pending.media.id, new Date(Date.now() - 120000)]);
  const service = instance.app.get(MediaService);
  await Promise.all([service.cleanup(), service.cleanup()]);
  const record = await service.repository.get(pending.media.id as string);
  assert.equal(record.state, 'DELETED');
  assert.equal(Number(record.reserved_bytes), 0);
  const quota = await instance.database.query<{ used_bytes: string; reserved_bytes: string }>("SELECT used_bytes,reserved_bytes FROM media_quotas WHERE scope='global'");
  assert.equal(Number(quota.rows[0].used_bytes), 0);
  assert.equal(Number(quota.rows[0].reserved_bytes), 0);
  const events = await instance.database.query<{ total: string }>("SELECT COUNT(*)::text AS total FROM media_events WHERE media_id=$1 AND operation='deleted'", [pending.media.id]);
  assert.equal(Number(events.rows[0].total), 1);
});
