import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createTestApplication } from '../support/application.js';

const origin = 'http://127.0.0.1:5173';
test('solo el servidor emite una cookie HttpOnly firmada y el arranque es idempotente', async t => {
  const instance = await createTestApplication({ auth: true });
  t.after(() => instance.app.close()); await instance.app.init();
  const api = request(instance.server); const path = '/api/chat/presence/identity';
  await api.post(path).set('Origin', 'https://otro.example').send({}).expect(403);
  await api.post(path).set('Origin', origin).send({ userId: 'inventado' }).expect(400);
  const first = await api.post(path).set('Origin', origin).send({}).expect(201);
  assert.deepEqual(first.body, { ready: true });
  const cookie = first.headers['set-cookie'][0] as string;
  assert.match(cookie, /^foris_presence=\d{10}\.[\w-]{43}\.[a-f0-9]{64};/u);
  assert.match(cookie, /HttpOnly/u); assert.match(cookie, /SameSite=Strict/u);
  assert.match(first.headers['cache-control'], /no-store/u);
  const pair = cookie.split(';')[0];
  const repeated = await api.post(path).set('Origin', origin).set('Cookie', pair).send({}).expect(201);
  assert.equal(repeated.headers['set-cookie'], undefined, 'conserva identidad entre pestañas/reintentos');
  const tampered = await api.post(path).set('Origin', origin).set('Cookie', pair + 'a').send({}).expect(201);
  assert.ok(tampered.headers['set-cookie'], 'una firma alterada no se acepta');
  assert.doesNotMatch(JSON.stringify(first.body), /foris_presence|secret|signature/u);
});

test('sin secreto se comunica indisponibilidad sin inventar una identidad local', async t => {
  const instance = await createTestApplication(); t.after(() => instance.app.close()); await instance.app.init();
  const response = await request(instance.server).post('/api/chat/presence/identity').set('Origin', origin).send({}).expect(201);
  assert.deepEqual(response.body, { ready: false }); assert.equal(response.headers['set-cookie'], undefined);
});
