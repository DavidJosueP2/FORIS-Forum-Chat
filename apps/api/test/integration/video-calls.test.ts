import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApplication } from '../support/application.js';
import { randomToken, tokenHash } from '../../src/modules/auth/auth-crypto.js';

const origin = 'http://127.0.0.1:5173';
async function fixture(t: TestContext) {
  const instance = await createTestApplication({ auth: true });
  t.after(() => instance.app.close());
  await instance.app.init();
  const api = request(instance.server);
  const account = async () => {
    const id = randomUUID(); const token = randomToken();
    await instance.database.query('INSERT INTO users(id,email,display_name,email_verified_at) VALUES($1,$2,$3,$4)', [id, id + '@example.test', 'Ana', new Date()]);
    await instance.database.query('INSERT INTO auth_sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,$4)', [randomUUID(), id, tokenHash(token), new Date(Date.now() + 3600000)]);
    return 'foris_session=' + token;
  };
  const post = (path: string, cookie: string, body: unknown = {}) => api.post('/api/video-call/' + path).set('Origin', origin).set('Cookie', cookie).send(body);
  const join = (cookie: string, requestId = randomUUID()) => post('join', cookie, { requestId });
  return { ...instance, api, account, post, join };
}
test('videollamadas exigen sesión y origen; plazas, reintentos y una participación por cuenta', async t => {
  const { api, account, post, join } = await fixture(t);
  await api.get('/api/video-call').expect(401);
  const cookie = await account();
  await api.post('/api/video-call/join').set('Cookie', cookie).send({ requestId: randomUUID() }).expect(403);
  await api.post('/api/video-call/join').set('Origin', 'https://otro.example').set('Cookie', cookie).send({ requestId: randomUUID() }).expect(403);
  const requestId = randomUUID();
  const first = await join(cookie, requestId).expect(200);
  assert.equal((await join(cookie, requestId).expect(200)).body.memberId, first.body.memberId);
  await join(cookie).expect(409);
  for (let index = 0; index < 3; index++) await join(await account()).expect(200);
  const extra = await account();
  await join(extra).expect(409);
  await post(first.body.memberId + '/leave', cookie).expect(200);
  await post(first.body.memberId + '/leave', cookie).expect(200);
  await join(extra).expect(200);
});
test('solo los participantes de la sesión pueden enviar y leer sus señales', async t => {
  const { account, post, join } = await fixture(t);
  const a = { cookie: await account(), id: '' }; const b = { cookie: await account(), id: '' }; const outsider = await account();
  a.id = (await join(a.cookie).expect(200)).body.memberId as string;
  b.id = (await join(b.cookie).expect(200)).body.memberId as string;
  const [sender, recipient] = [a, b].sort((left, right) => left.id.localeCompare(right.id));
  const payload = { to: recipient.id, requestId: randomUUID(), description: { type: 'offer', sdp: 'v=0\r\n' } };
  await post(sender.id + '/signals', outsider, payload).expect(404);
  await post(sender.id + '/signals', sender.cookie, payload).expect(200);
  await post(sender.id + '/signals', sender.cookie, payload).expect(200);
  await post(sender.id + '/signals', sender.cookie, { ...payload, requestId: randomUUID() }).expect(409);
  await post(recipient.id + '/sync', outsider, { after: '0' }).expect(404);
  const incoming = await post(recipient.id + '/sync', recipient.cookie, { after: '0' }).expect(200);
  assert.equal(incoming.body.signals.length, 1);
  assert.equal(incoming.body.signals[0].from, sender.id);
  assert.equal((await post(sender.id + '/sync', sender.cookie, { after: '0' })).body.signals.length, 0);
  assert.equal((await post(recipient.id + '/sync', recipient.cookie, { after: incoming.body.nextCursor })).body.signals.length, 0);
  await post(sender.id + '/leave', recipient.cookie).expect(200);
  await post(sender.id + '/sync', sender.cookie, { after: '0' }).expect(200);
});
test('caducar la presencia elimina sus señales y permite recuperar una plaza', async t => {
  const { database, account, post, join } = await fixture(t);
  const cookie = await account();
  const first = await join(cookie).expect(200);
  await database.query('UPDATE video_call_members SET expires_at=$2 WHERE id=$1', [first.body.memberId, new Date(Date.now() - 1000)]);
  await post(first.body.memberId + '/sync', cookie, { after: '0' }).expect(404);
  const second = await join(cookie).expect(200);
  assert.notEqual(first.body.memberId, second.body.memberId);
});
