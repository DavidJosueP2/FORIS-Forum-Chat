import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { ForumPage, ForumPostSummary, ForumReply } from '@messages/contracts';
import { randomToken, tokenHash } from '../../src/modules/auth/auth-crypto.js';
import { createTestApplication } from '../support/application.js';

const origin = 'http://127.0.0.1:5173';
const postInput = (title = 'Una pregunta') => ({ title, body: 'Una idea para conversar.', topicId: 'general', requestId: randomUUID() });
async function fixture(t: TestContext) {
  const instance = await createTestApplication({ auth: true });
  t.after(() => instance.app.close());
  await instance.app.init();
  const api = request(instance.server);
  const member = async (verified = true) => {
    const id = randomUUID();
    const token = randomToken();
    await instance.database.query('INSERT INTO users(id,email,display_name,email_verified_at) VALUES($1,$2,$3,$4)', [id, id + '@example.test', 'Ana', verified ? new Date() : null]);
    await instance.database.query('INSERT INTO auth_sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,$4)', [randomUUID(), id, tokenHash(token), new Date(Date.now() + 3600000)]);
    return { id, cookie: 'foris_session=' + token };
  };
  return { ...instance, api, member };
}

test('invitados leen el foro y escriben en el chat global, pero no crean publicaciones ni respuestas', async t => {
  const { api, member } = await fixture(t);
  const user = await member();
  const created = await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie).send(postInput()).expect(201);
  const id = created.body.post.id as string;
  assert.equal((await api.get('/api/topics').expect(200)).body.length, 5);
  assert.equal((await api.get('/api/posts').expect(200)).body.items.length, 1);
  assert.equal((await api.get('/api/posts/' + id).expect(200)).body.author.id, user.id);
  assert.equal((await api.get('/api/posts/' + id + '/replies').expect(200)).body.items.length, 0);
  await api.post('/api/posts').set('Origin', origin).set('X-Foris-Identity', 'guest').send(postInput()).expect(401);
  await api.post('/api/posts/' + id + '/replies').set('Origin', origin).send({ body: 'Hola', requestId: randomUUID() }).expect(401);
  await api.post('/api/messages').set('Origin', origin).set('Host', '127.0.0.1:5173').set('X-Foris-Identity', 'guest')
    .send({ body: 'Hola desde el chat', author: 'Invitado', senderId: randomUUID(), requestId: randomUUID() }).expect(201);
});

test('solo una sesión vigente y verificada acredita autoría; el cliente no puede asignarla', async t => {
  const { api, member, database } = await fixture(t);
  const unverified = await member(false);
  await api.post('/api/posts').set('Origin', origin).set('Cookie', unverified.cookie).send(postInput()).expect(401);
  const user = await member();
  await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie).send({ ...postInput(), authorId: randomUUID() }).expect(400);
  const created = await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie).send(postInput()).expect(201);
  assert.deepEqual(created.body.post.author, { id: user.id, displayName: 'Ana' });
  await database.query('DELETE FROM auth_sessions WHERE user_id=$1', [user.id]);
  await api.post('/api/posts/' + created.body.post.id + '/replies').set('Origin', origin).set('Cookie', user.cookie).send({ body: 'Otra idea', requestId: randomUUID() }).expect(401);
});

test('reintentar publicaciones y respuestas no las duplica ni aumenta dos veces el contador', async t => {
  const { api, member } = await fixture(t);
  const user = await member();
  const input = postInput('<img src=x onerror=alert(1)>');
  const first = await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie).send(input).expect(201);
  const id = first.body.post.id as string;
  const retry = await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie).send(input).expect(200);
  assert.equal(retry.body.post.id, id);
  assert.equal(retry.body.post.title, input.title);
  await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie).send({ ...input, title: 'Distinta' }).expect(409);
  const reply = { body: "Texto literal <script>alert(1)</script> '); DROP TABLE users; --", requestId: randomUUID() };
  const saved = await api.post('/api/posts/' + id + '/replies').set('Origin', origin).set('Cookie', user.cookie).send(reply).expect(201);
  const again = await api.post('/api/posts/' + id + '/replies').set('Origin', origin).set('Cookie', user.cookie).send(reply).expect(200);
  assert.equal(again.body.reply.id, saved.body.reply.id);
  assert.equal(again.body.replyCount, 1);
  assert.equal(again.body.reply.body, reply.body);
  await api.post('/api/posts/' + id + '/replies').set('Origin', origin).set('Cookie', user.cookie).send({ ...reply, body: 'Otro texto' }).expect(409);
  assert.equal((await api.get('/api/posts/' + id)).body.replyCount, 1);
});

test('pagina publicaciones y respuestas sin repetir elementos y filtra por tópico, autor y búsqueda', async t => {
  const { api, member } = await fixture(t);
  const user = await member();
  const ids: string[] = [];
  for (let index = 0; index < 4; index++) {
    const result = await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie)
      .send({ ...postInput('Pregunta ' + index), topicId: index === 0 ? 'proyectos' : 'general' }).expect(201);
    ids.push(result.body.post.id as string);
  }
  const latest = (await api.get('/api/posts?limit=2').expect(200)).body as ForumPage<ForumPostSummary>;
  assert.deepEqual(latest.items.map(item => item.id), ids.slice(2).reverse());
  const older = (await api.get('/api/posts?limit=2&before=' + latest.nextCursor).expect(200)).body as ForumPage<ForumPostSummary>;
  assert.deepEqual(older.items.map(item => item.id), ids.slice(0, 2).reverse());
  assert.equal(older.hasMore, false);
  assert.equal((await api.get('/api/posts?topic=proyectos')).body.items.length, 1);
  assert.equal((await api.get('/api/posts?author=' + user.id)).body.items.length, 4);
  assert.equal((await api.get('/api/posts?search=Pregunta%202')).body.items.length, 1);
  const replies: string[] = [];
  for (let index = 0; index < 3; index++) {
    const result = await api.post('/api/posts/' + ids[0] + '/replies').set('Origin', origin).set('Cookie', user.cookie)
      .send({ body: 'Respuesta ' + index, requestId: randomUUID() }).expect(201);
    replies.push(result.body.reply.id as string);
  }
  const page = (await api.get('/api/posts/' + ids[0] + '/replies?limit=2')).body as ForumPage<ForumReply>;
  assert.deepEqual(page.items.map(item => item.id), replies.slice(1).reverse());
  const end = (await api.get('/api/posts/' + ids[0] + '/replies?limit=2&before=' + page.nextCursor)).body as ForumPage<ForumReply>;
  assert.deepEqual(end.items.map(item => item.id), replies.slice(0, 1));
});

test('rechaza orígenes ajenos, campos inválidos, tópicos inexistentes y publicaciones ausentes', async t => {
  const { api, member } = await fixture(t);
  const user = await member();
  await api.post('/api/posts').set('Origin', 'https://otro.example').set('Cookie', user.cookie).send(postInput()).expect(403);
  await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie).type('text').send('Hola').expect(415);
  for (const input of [{ ...postInput(), title: ' ' }, { ...postInput(), title: 'x'.repeat(161) }, { ...postInput(), requestId: 'no' }, { ...postInput(), body: 'x'.repeat(10001) }]) {
    await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie).send(input).expect(400);
  }
  await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie).send({ ...postInput(), topicId: 'inexistente' }).expect(404);
  await api.get('/api/posts/999999').expect(404);
  await api.get('/api/posts/0').expect(400);
  await api.get('/api/posts?limit=51').expect(400);
  await api.get('/api/posts?topic=general&topic=proyectos').expect(400);
  await api.post('/api/posts/999999/replies').set('Origin', origin).set('Cookie', user.cookie).send({ body: 'Respuesta', requestId: randomUUID() }).expect(404);
});

test('cancelar Google conserva el destino interno del flujo y rechaza destinos externos', async t => {
  const { api, database } = await fixture(t);
  for (const destination of ['/publicaciones/12#responder', 'https://otro.example']) {
    const state = randomToken();
    const binding = randomToken();
    await database.query('INSERT INTO auth_google_flows(state_hash,binding_hash,nonce,code_verifier,intent,return_to,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [tokenHash(state), tokenHash(binding), randomToken(), randomToken(), 'login', destination, new Date(Date.now() + 600000)]);
    const response = await api.get('/api/auth/google/callback').query({ state, error: 'access_denied' }).set('Cookie', 'foris_oauth=' + binding).expect(303);
    const redirect = new URL(response.headers.location as string, origin);
    assert.equal(redirect.pathname, '/login');
    assert.equal(redirect.searchParams.get('error'), 'GOOGLE_CANCELLED');
    assert.equal(redirect.searchParams.get('next'), destination.startsWith('/') ? destination : '/');
  }
});
