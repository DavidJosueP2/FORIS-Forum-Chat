import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { MessagesRepository } from '../../src/modules/messages/messages.repository.js';
import { createTestApplication } from '../support/application.js';
import type { FixtureOptions } from '../support/application.js';
import type { MessagePage } from '@messages/contracts';
import type { AddressInfo } from 'node:net';
import { randomToken, tokenHash } from '../../src/modules/auth/auth-crypto.js';
import { unavailablePresence } from '../../src/modules/messages/presence.repository.js';

const payload = (body: string) => ({ body, author: 'Ana', senderId: randomUUID(), requestId: randomUUID() });

async function fixture(t: TestContext, options: FixtureOptions = {}) {
  const instance = await createTestApplication(options);
  t.after(() => instance.app.close());
  await instance.app.init();
  return { ...instance, api: request(instance.server) };
}

test('sirve estado de la API, cabeceras de seguridad y errores consistentes', async t => {
  const { api } = await fixture(t);
  const health = await api.get('/api/health').expect(200);
  assert.match(health.headers['content-security-policy'], /script-src 'self'/u);
  assert.equal(health.headers['x-powered-by'], undefined);
  assert.equal(health.headers['x-content-type-options'], 'nosniff');
  assert.equal(health.body.status, 'ok');
  assert.equal((await api.get('/inexistente').expect(404)).body.error.code, 'NOT_FOUND');
  const empty = await api.get('/api/messages').expect(200);
  assert.deepEqual(empty.body, { messages: [], hasMore: false });
  assert.equal(empty.headers['cache-control'], 'no-store');
});

test('guarda una sola vez, conserva texto literal y permite recuperar el historial', async t => {
  const { api, database } = await fixture(t);
  const input = payload("Hola <img src=x onerror=alert(1)> '); DROP TABLE messages; --");
  const first = await api.post('/api/messages').send(input).expect(201);
  assert.equal(first.body.message.body, input.body);
  assert.ok(first.body.message.id);
  assert.ok(Number.isFinite(Date.parse(first.body.message.createdAt)));
  const retry = await api.post('/api/messages').send(input).expect(200);
  assert.deepEqual(retry.body, first.body);
  const restartedRepository = new MessagesRepository(database);
  const page = await restartedRepository.list({ limit: 50 });
  assert.equal(page.messages.length, 1);
  assert.equal(page.messages[0].body, input.body);
  await api.post('/api/messages').send({ ...input, body: 'Otro' }).expect(409);
  await api.post('/api/messages').send({ ...input, senderId: randomUUID() }).expect(409);
  await api.post('/api/messages').send({ ...input, author: 'Otro' }).expect(409);
});

test('pagina hacia atrás y recupera mensajes posteriores sin perder el orden', async t => {
  const { api } = await fixture(t);
  const saved: string[] = [];
  for (let index = 0; index < 5; index++) {
    const response = await api.post('/api/messages').send(payload(`Mensaje ${index}`)).expect(201);
    saved.push(response.body.message.id);
  }
  const latest = (await api.get('/api/messages?limit=2').expect(200)).body as MessagePage;
  assert.deepEqual(latest.messages.map(message => message.id), saved.slice(3));
  assert.equal(latest.hasMore, true);
  const older = (await api.get(`/api/messages?before=${saved[3]}&limit=2`).expect(200)).body as MessagePage;
  assert.deepEqual(older.messages.map(message => message.id), saved.slice(1, 3));
  const after = (await api.get(`/api/messages?after=${saved[0]}&limit=2`).expect(200)).body as MessagePage;
  assert.deepEqual(after.messages.map(message => message.id), saved.slice(1, 3));
  assert.equal(after.hasMore, true);
  assert.deepEqual((await api.get(`/api/messages?after=${saved[4]}`).expect(200)).body.messages, []);
  await api.get('/api/messages?before=0').expect(400);
});

test('rechaza adjuntos, orígenes ajenos, contenido inválido y exceso de tamaño', async t => {
  const { api } = await fixture(t);
  await api.post('/api/messages').send({ ...payload('Hola'), file: 'audio.mp3' }).expect(400);
  await api.post('/api/messages').type('text').send('Hola').expect(415);
  await api.post('/api/messages').set('Origin', 'https://otro.example').send(payload('Hola')).expect(403);
  await api.post('/api/messages').set('Host', '127.0.0.1:3000').set('Origin', 'http://127.0.0.1:5173').send(payload('Hola')).expect(201);
  await api.post('/api/messages').set('Host', 'mensajes.local').set('Origin', 'http://mensajes.local').send(payload('Hola')).expect(403);
  await api.post('/api/messages').set('Content-Type', 'application/json').send('{ mal JSON').expect(400);
  await api.post('/api/messages').send(payload('a'.repeat(20000))).expect(413);
  await api.post('/api/messages').send(payload('   ')).expect(400);
});

test('acepta el origen público HTTPS detrás del proxy para invitados y cuentas, sin confiar en Host', async t => {
  const origin = 'https://foris.example.test';
  const { api, database } = await fixture(t, { auth: true, appUrl: origin });
  const userId = randomUUID();
  const token = randomToken();
  await database.query('INSERT INTO users(id,email,display_name,email_verified_at) VALUES($1,$2,$3,$4)',
    [userId, userId + '@example.test', 'Cuenta de prueba', new Date()]);
  await database.query('INSERT INTO auth_sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,$4)',
    [randomUUID(), userId, tokenHash(token), new Date(Date.now() + 3600000)]);

  // La conexión de supertest es HTTP y su Host simula el destino interno del proxy.
  const send = (mode: 'guest' | 'account') => {
    const pending = api.post('/api/messages').set('Host', '127.0.0.1:3000').set('Origin', origin)
      .set('X-Forwarded-Host', 'foris.example.test').set('X-Forwarded-Proto', 'https').set('X-Foris-Identity', mode);
    return mode === 'account' ? pending.set('Cookie', '__Host-foris_session=' + token) : pending;
  };
  const guestInput = payload('Mensaje invitado detrás de HTTPS');
  const guest = await send('guest').send(guestInput).expect(201);
  assert.equal(guest.body.message.accountId, undefined);
  assert.equal(guest.body.message.body, guestInput.body);
  const accountInput = payload('Mensaje de cuenta detrás de HTTPS');
  const account = await send('account').send(accountInput).expect(201);
  assert.equal(account.body.message.accountId, userId);
  assert.equal(account.body.message.author, 'Cuenta de prueba');
  assert.equal(account.body.message.body, accountInput.body);
  const retried = await send('account').send(accountInput).expect(200);
  assert.equal(retried.body.message.id, account.body.message.id);

  for (const badOrigin of ['https://otro.example.test', 'http://foris.example.test', 'https://foris.example.test:444', 'https://foris.example.test.evil.test', 'null']) {
    const denied = await api.post('/api/messages').set('Origin', badOrigin)
      .set('Host', badOrigin === 'null' ? 'otro.example.test' : new URL(badOrigin).host)
      .set('X-Forwarded-Host', 'foris.example.test').set('X-Forwarded-Proto', 'https')
      .set('Cookie', '__Host-foris_session=' + token).set('X-Foris-Identity', 'account')
      .send(payload('No debe guardarse')).expect(403);
    assert.equal(denied.body.error.code, 'ORIGIN_REJECTED');
  }
  const history = await api.get('/api/messages').expect(200);
  assert.equal(history.body.messages.length, 2);
});

test('frena envíos repetidos con una respuesta recuperable', async t => {
  const { api } = await fixture(t, { sendLimit: 1 });
  await api.post('/api/messages').send(payload('Primero')).expect(201);
  const response = await api.post('/api/messages').send(payload('Segundo')).expect(429);
  assert.equal(response.body.error.code, 'RATE_LIMITED');
  assert.ok(response.headers['ratelimit']);
});

test('un fallo de base no filtra consultas ni credenciales', async t => {
  const failure = () => { throw new Error('password=privado; SELECT *'); };
  const { api } = await fixture(t, { repository: { list: failure, save: failure }, health: { check: failure } });
  for (const path of ['/api/messages', '/api/health']) {
    const response = await api.get(path).expect(503);
    assert.doesNotMatch(response.text, /privado|SELECT/u);
  }
  await api.post('/api/messages').send(payload('Hola')).expect(503);
});

test('entrega el mismo mensaje en vivo a dos navegadores conectados', { timeout: 10000 }, async t => {
  // Este caso comprueba el transporte SSE; bloqueos y recuentos globales se prueban
  // exclusivamente con PostgreSQL real en presence-postgres.test.ts.
  const { app, server, hub } = await fixture(t, { presence: {
    async acquire() { return randomUUID(); },
    async refresh(ids) { return { presence: unavailablePresence(), renewed: new Set(ids) }; },
    async release() {},
  } });
  await app.listen(0, '127.0.0.1');
  const abort = new AbortController();
  t.after(() => {
    abort.abort();
    hub.close();
    server.closeAllConnections();
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const [a, b] = await Promise.all([fetch(`${base}/api/events`, { signal: abort.signal }), fetch(`${base}/api/events`, { signal: abort.signal })]);
  assert.equal(a.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  const input = payload('En vivo en ambos navegadores');
  const sent = await fetch(`${base}/api/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  assert.equal(sent.status, 201);
  for (const response of [a, b]) {
    assert.ok(response.body);
    const reader = response.body.getReader();
    let buffer = '';
    while (!buffer.includes(input.body)) {
      const chunk = await reader.read();
      assert.equal(chunk.done, false);
      buffer += new TextDecoder().decode(chunk.value);
    }
    assert.match(buffer, /event: message/u);
    assert.match(buffer, /En vivo en ambos navegadores/u);
  }
});
