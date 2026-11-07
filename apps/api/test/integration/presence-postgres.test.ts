import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { DatabaseService } from '../../src/database/database.service.js';
import { runMigrations } from '../../src/database/migrations/run-migrations.js';
import { readConfig } from '../../src/config/app-config.js';
import { PresenceRepository } from '../../src/modules/messages/presence.repository.js';
import { PresenceIdentityService } from '../../src/modules/messages/presence-identity.service.js';
import type { PresenceIdentity } from '../../src/modules/messages/presence-identity.service.js';

// Nunca usa .env ni la base del usuario. Preparado, NO ejecutado durante la implementación.
const connectionString = process.env.FORIS_PRESENCE_TEST_DATABASE_URL;
test('PostgreSQL real coordina identidades, expiración y capacidad entre réplicas', { skip: !connectionString }, async t => {
  const target = new URL(connectionString!);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname));
  assert.equal(target.pathname, '/foris_presence_test');
  const schema = 'foris_presence_test_' + randomUUID().replaceAll('-', '');
  assert.match(schema, /^foris_presence_test_[a-f0-9]{32}$/u);
  const admin = new pg.Pool({ connectionString, max: 1 });
  const pools = [0, 1].map(() => new pg.Pool({ connectionString, max: 3, options: '-c search_path=' + schema }));
  let created = false;
  t.after(async () => {
    try {
      await Promise.all(pools.map(pool => pool.end()));
      if (created) await admin.query('DROP SCHEMA "' + schema + '" CASCADE');
    } finally { await admin.end(); }
  });
  await admin.query('CREATE SCHEMA "' + schema + '"'); created = true;
  await runMigrations(pools[0]);
  const config = readConfig({ NODE_ENV: 'test', PGPASSWORD: 'test-only', AUTH_SECRET: 'presence-test-secret-at-least-32-characters' });
  config.events.maxConnections = 3; config.events.maxPerIp = 3;
  const dbs = pools.map(pool => new DatabaseService(pool, { info() {}, error() {} }));
  const identities = new PresenceIdentityService(config, { async optional() { return null; }, hasCookie() { return false; } });
  const repos = dbs.map(db => new PresenceRepository(db, identities, config));
  const userId = randomUUID(); const sessionId = randomUUID(); const otherSessionId = randomUUID();
  await dbs[0].query('INSERT INTO users(id,email,display_name,email_verified_at) VALUES($1,$2,$3,CURRENT_TIMESTAMP)', [userId, userId + '@example.test', 'Ana']);
  await dbs[0].query("INSERT INTO auth_sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,CURRENT_TIMESTAMP+INTERVAL '1 hour')", [sessionId, userId, 'a'.repeat(64)]);
  await dbs[0].query("INSERT INTO auth_sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,CURRENT_TIMESTAMP+INTERVAL '1 hour')", [otherSessionId, userId, 'f'.repeat(64)]);
  const account: PresenceIdentity = { kind: 'account', browserKey: 'b'.repeat(64), ipKey: 'c'.repeat(64), userId, sessionId };
  const guest: PresenceIdentity = { kind: 'guest', browserKey: 'd'.repeat(64), ipKey: 'e'.repeat(64), userId: null, sessionId: null };

  const [a, b] = await Promise.all([repos[0].acquire(account), repos[1].acquire({ ...account, sessionId: otherSessionId, browserKey: 'f'.repeat(64) })]);
  assert.equal((await repos[1].snapshot()).accounts, 1, 'dos procesos y pestañas no duplican una cuenta');
  const last = await Promise.allSettled(repos.map(repo => repo.acquire(guest)));
  assert.equal(last.filter(result => result.status === 'fulfilled').length, 1, 'última plaza global atómica');
  assert.equal(last.filter(result => result.status === 'rejected').length, 1);
  await repos[0].release(a);
  assert.equal((await repos[1].snapshot()).accounts, 1, 'cerrar una pestaña no retira otra');
  await repos[1].release(b);
  assert.equal((await repos[0].snapshot()).accounts, 0);
  const otherGuest = await repos[0].acquire(guest);
  assert.equal((await repos[1].snapshot()).guestBrowsers, 1, 'mismo navegador invitado en dos réplicas');

  // Una cuenta y su navegador invitado anterior nunca suman dos identidades.
  const loggedIn = await repos[1].acquire({ ...account, browserKey: guest.browserKey });
  assert.equal((await repos[0].snapshot()).guestBrowsers, 0);
  await dbs[0].query('DELETE FROM auth_sessions WHERE id=$1', [sessionId]);
  const revoked = await repos[1].refresh([loggedIn]);
  assert.equal(revoked.renewed.has(loggedIn), false, 'no se renueva una sesión revocada');
  await dbs[0].query("UPDATE chat_presence_leases SET expires_at=CURRENT_TIMESTAMP-INTERVAL '1 second'");
  assert.equal((await repos[0].snapshot()).guestBrowsers, 0, 'sin necesitar temporizadores ni barrido');
  assert.equal((await repos[0].refresh([otherGuest])).renewed.has(otherGuest), false, 'no resucita una concesión vencida');

  const unknown = await repos[0].acquire({ ...guest, kind: 'unknown', browserKey: null });
  assert.equal((await repos[1].snapshot()).status, 'unavailable', 'no inventa cifra cuando falta identidad');
  await repos[0].release(unknown);
  const scopedConfig = { ...config, events: { ...config.events, presenceNamespace: 'otra-preview' } };
  const scoped = new PresenceRepository(dbs[0], new PresenceIdentityService(scopedConfig, { async optional() { return null; }, hasCookie() { return false; } }), scopedConfig);
  await scoped.acquire(guest);
  assert.equal((await repos[0].snapshot()).guestBrowsers, 0, 'una preview no contamina producción');
  assert.equal((await scoped.snapshot()).guestBrowsers, 1);
  await assert.rejects(repos[0].acquire({ ...account, sessionId: randomUUID() }), { status: 401 });

  const ipConfig = { ...config, events: { ...config.events, maxConnections: 20, maxPerIp: 1, presenceNamespace: 'ip-limits' } };
  const ipIdentity = new PresenceIdentityService(ipConfig, { async optional() { return null; }, hasCookie() { return false; } });
  const ipRepos = dbs.map(db => new PresenceRepository(db, ipIdentity, ipConfig));
  const sameIp = await Promise.allSettled(ipRepos.map((repo, index) => repo.acquire({ ...guest, browserKey: String(index).repeat(64) })));
  assert.equal(sameIp.filter(result => result.status === 'fulfilled').length, 1, 'el límite por IP también se comparte entre réplicas');
});
