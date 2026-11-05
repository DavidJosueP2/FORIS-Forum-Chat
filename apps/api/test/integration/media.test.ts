import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import request from 'supertest';
import sharp from 'sharp';
import { randomToken, tokenHash } from '../../src/modules/auth/auth-crypto.js';
import { createTestApplication } from '../support/application.js';

const origin = 'http://127.0.0.1:5173';
async function fixture(t: TestContext, globalBytes?: number) {
  const prefix = resolve(tmpdir(), 'foris-media-api-');
  const root = await mkdtemp(prefix);
  const instance = await createTestApplication({ auth: true, media: { localRoot: root,
    ...(globalBytes ? { maxBytes: 1024, globalBytes, userBytes: globalBytes } : {}) } });
  t.after(async () => { await instance.app.close(); assert.ok(root.startsWith(prefix)); await rm(root, { recursive: true, force: true }); });
  await instance.app.init();
  const api = request(instance.server);
  const user = async () => {
    const id = randomUUID(); const token = randomToken();
    await instance.database.query('INSERT INTO users(id,email,display_name,email_verified_at) VALUES($1,$2,$3,$4)', [id, id + '@example.test', 'Ana', new Date()]);
    await instance.database.query('INSERT INTO auth_sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,$4)', [randomUUID(), id, tokenHash(token), new Date(Date.now() + 3600000)]);
    return { id, cookie: 'foris_session=' + token };
  };
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#445544' } }).png().toBuffer();
  const authorize = (cookie: string, requestId = randomUUID(), size = bytes.length) => api.post('/api/media/uploads').set('Origin', origin).set('Cookie', cookie)
    .send({ originalName: 'imagen.png', mime: 'image/png', bytes: size, requestId });
  const upload = async (cookie: string) => {
    const intent = await authorize(cookie).expect(201);
    await api.put(intent.body.upload.url as string).set('Origin', origin).set('Cookie', cookie).set('Content-Type', 'image/png').send(bytes).expect(200);
    return api.post('/api/media/' + intent.body.media.id + '/complete').set('Origin', origin).set('Cookie', cookie).send({}).expect(200);
  };
  return { ...instance, api, user, bytes, authorize, upload };
}
test('flujo local completo: subida privada, asociación y lectura pública por permiso temporal', async t => {
  const { api, user, upload } = await fixture(t);
  const owner = await user();
  const confirmed = await upload(owner.cookie);
  const id = confirmed.body.id as string;
  assert.equal(confirmed.body.state, 'READY');
  await api.get('/api/media/' + id).expect(404);
  await api.get('/api/media/' + id + '/read-url').expect(404);
  const again = await api.post('/api/media/' + id + '/complete').set('Origin', origin).set('Cookie', owner.cookie).send({}).expect(200);
  assert.equal(again.body.image.id, id);
  const input = { title: 'Una imagen', body: 'Texto', topicId: 'general', requestId: randomUUID(), mediaIds: [id] };
  const post = await api.post('/api/posts').set('Origin', origin).set('Cookie', owner.cookie).send(input).expect(201);
  assert.equal(post.body.post.images.length, 1);
  assert.equal(post.body.post.images[0].id, id);
  assert.equal('url' in post.body.post.images[0], false);
  const read = await api.get('/api/media/' + id + '/read-url').expect(200);
  const image = await api.get(read.body.url as string).expect(200);
  assert.match(image.headers['content-type'], /image\/png/u);
  assert.equal(image.headers['cache-control'], 'private, no-store');
  await api.delete('/api/media/' + id).set('Origin', origin).set('Cookie', owner.cookie).send({}).expect(200);
  assert.equal((await api.get('/api/posts/' + post.body.post.id)).body.images.length, 0);
  // El reintento sigue identificando la publicación aunque su imagen haya sido retirada.
  const retry = await api.post('/api/posts').set('Origin', origin).set('Cookie', owner.cookie).send(input).expect(200);
  assert.equal(retry.body.post.id, post.body.post.id);
  await api.get(read.body.url as string).expect(404);
});
test('invitados y otros propietarios no pueden subir, confirmar, asociar ni borrar imágenes ajenas', async t => {
  const { api, user, authorize, upload, bytes } = await fixture(t);
  await api.post('/api/media/uploads').set('Origin', origin).send({}).expect(401);
  const owner = await user(); const stranger = await user();
  const intent = await authorize(owner.cookie).expect(201);
  await api.put(intent.body.upload.url as string).set('Origin', origin).set('Cookie', stranger.cookie).set('Content-Type', 'image/png').send(bytes).expect(404);
  const image = await upload(owner.cookie);
  const id = image.body.id as string;
  await api.post('/api/media/' + id + '/complete').set('Origin', origin).set('Cookie', stranger.cookie).send({}).expect(404);
  await api.delete('/api/media/' + id).set('Origin', origin).set('Cookie', stranger.cookie).send({}).expect(404);
  await api.post('/api/posts').set('Origin', origin).set('Cookie', stranger.cookie).send({ title: 'Otro', body: 'Texto', topicId: 'general', requestId: randomUUID(), mediaIds: [id] }).expect(404);
});
test('la reserva de cuota es idempotente y bloquea nuevas autorizaciones antes del PUT', async t => {
  const { api, user, authorize } = await fixture(t, 2048);
  const owner = await user();
  const key = randomUUID();
  const first = await authorize(owner.cookie, key).expect(201);
  const retry = await authorize(owner.cookie, key).expect(201);
  assert.equal(retry.body.media.id, first.body.media.id);
  const usage = await api.get('/api/media/usage').set('Cookie', owner.cookie).expect(200);
  assert.equal(usage.body.reservedBytes, 2048);
  await authorize(owner.cookie).expect(409);
  await api.delete('/api/media/' + first.body.media.id).set('Origin', origin).set('Cookie', owner.cookie).send({}).expect(200);
  // El ticket aún puede estar vigente; su reserva no se libera prematuramente.
  assert.equal((await api.get('/api/media/usage').set('Cookie', owner.cookie)).body.reservedBytes, 2048);
});
test('no basta con declarar un MIME permitido: se rechaza el contenido inválido', async t => {
  const { api, user, authorize } = await fixture(t);
  const owner = await user();
  const bytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
  const intent = await authorize(owner.cookie, randomUUID(), bytes.length).expect(201);
  await api.put(intent.body.upload.url as string).set('Origin', origin).set('Cookie', owner.cookie).set('Content-Type', 'image/png').send(bytes).expect(200);
  await api.post('/api/media/' + intent.body.media.id + '/complete').set('Origin', origin).set('Cookie', owner.cookie).send({}).expect(400);
  assert.equal((await api.get('/api/media/' + intent.body.media.id).set('Cookie', owner.cookie)).body.state, 'REJECTED');
  await api.get('/api/media/' + intent.body.media.id + '/read-url').set('Cookie', owner.cookie).expect(409);
});
