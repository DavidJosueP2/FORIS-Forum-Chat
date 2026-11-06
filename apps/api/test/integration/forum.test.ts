import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Community, ForumAuthorProfile, ForumCategory, ForumPage, ForumPostSummary, ForumReply } from '@messages/contracts';
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

test('una base nueva permite listar el foro vacío sin exigir usuarios ni fotos de perfil', async t => {
  const { api } = await fixture(t);
  const page = await api.get('/api/posts').expect(200);
  assert.deepEqual(page.body, { items: [], hasMore: false, nextCursor: null });
});

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
  assert.deepEqual(created.body.post.author, { id: user.id, displayName: 'Ana', isFollowing: false });
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
  const { api, member, database } = await fixture(t);
  const user = await member();
  const ids: string[] = [];
  for (let index = 0; index < 4; index++) {
    const result = await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie)
      .send({ ...postInput('Pregunta ' + index), topicId: index === 0 ? 'proyectos' : 'general' }).expect(201);
    ids.push(result.body.post.id as string);
    await database.query('UPDATE forum_posts SET created_at=$2 WHERE id=$1', [result.body.post.id, new Date(Date.now() - 10000 + index * 1000)]);
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
  await api.get('/api/posts/' + randomUUID()).expect(404);
  await api.get('/api/posts/999999').expect(400);
  await api.get('/api/posts/0').expect(400);
  await api.get('/api/posts?limit=51').expect(400);
  await api.get('/api/posts?topic=general&topic=proyectos').expect(400);
  await api.post('/api/posts/' + randomUUID() + '/replies').set('Origin', origin).set('Cookie', user.cookie).send({ body: 'Respuesta', requestId: randomUUID() }).expect(404);
});

test('cancelar Google conserva el destino interno del flujo y rechaza destinos externos', async t => {
  const { api, database } = await fixture(t);
  for (const destination of ['/publicaciones/' + randomUUID() + '#responder', 'https://otro.example']) {
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

test('publica con UUID, temática descendiente y varias etiquetas sin exigir clasificación inicial', async t => {
  const { api, member } = await fixture(t);
  const user = await member();
  const catalog = (await api.get('/api/taxonomy/categories').expect(200)).body as ForumCategory[];
  const frontend = catalog.find(item => item.slug === 'frontend')!;
  const web = catalog.find(item => item.id === frontend.parentId)!;
  assert.equal(frontend.depth, 3);
  assert.equal(frontend.path.length, 4);
  assert.deepEqual((await api.get('/api/taxonomy/categories/' + frontend.id).expect(200)).body, frontend);
  const input = { title: 'Mi interfaz', body: 'Lo que estoy construyendo.', requestId: randomUUID(), categoryId: frontend.id, tags: [' TypeScript ', 'GUÍA', 'typescript'] };
  const saved = (await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie).send(input).expect(201)).body.post as ForumPostSummary;
  assert.match(saved.id, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u);
  assert.notEqual(saved.id, input.requestId);
  assert.equal(saved.category?.id, frontend.id);
  assert.equal(saved.topic.id, 'tecnologia');
  assert.deepEqual(saved.tags.map(tag => tag.name), ['guía', 'typescript']);
  assert.equal((await api.get('/api/posts?category=' + web.id).expect(200)).body.items[0].id, saved.id);
  assert.equal((await api.get('/api/posts?topic=tecnologia').expect(200)).body.items.length, 1);
  assert.equal((await api.get('/api/posts?tag=' + saved.tags[1]!.id).expect(200)).body.items.length, 1);
  assert.equal((await api.get('/api/taxonomy/tags?search=typescript').expect(200)).body[0].id, saved.tags[1]!.id);
  const retry = await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie).send({ ...input, tags: ['guía', 'typescript'] }).expect(200);
  assert.equal(retry.body.post.id, saved.id);
  await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie).send({ ...input, tags: ['otra'] }).expect(409);
  const unclassified = await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie)
    .send({ title: 'Una idea', body: 'Sin clasificar todavía.', requestId: randomUUID() }).expect(201);
  assert.equal(unclassified.body.post.category, null);
  assert.deepEqual(unclassified.body.post.tags, []);
  const general = (await api.get('/api/posts?topic=general').expect(200)).body.items as ForumPostSummary[];
  assert.deepEqual(general.map(post => post.id), [unclassified.body.post.id]);
  await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie).send({ ...input, requestId: randomUUID(), topicId: 'proyectos' }).expect(400);
  await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie).send({ ...input, requestId: randomUUID(), categoryId: randomUUID() }).expect(404);
  await api.get('/api/taxonomy/categories/12').expect(400);
  await api.get('/api/taxonomy/tags?limit=31').expect(400);
});

test('paginación con fechas iguales usa el UUID como desempate sin omitir ni duplicar publicaciones', async t => {
  const { api, member, database } = await fixture(t);
  const user = await member();
  const ids: string[] = [];
  for (let index = 0; index < 4; index++) {
    const result = await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie).send(postInput('Empate ' + index)).expect(201);
    ids.push(result.body.post.id as string);
  }
  await database.query('UPDATE forum_posts SET created_at=$1 WHERE author_id=$2', ['2026-01-01T12:00:00.123Z', user.id]);
  const first = (await api.get('/api/posts?limit=2').expect(200)).body as ForumPage<ForumPostSummary>;
  const second = (await api.get('/api/posts?limit=2&before=' + first.nextCursor).expect(200)).body as ForumPage<ForumPostSummary>;
  assert.deepEqual([...first.items, ...second.items].map(item => item.id), ids.sort().reverse());
  assert.equal(second.hasMore, false);
  assert.equal(second.nextCursor, null);
  await api.get('/api/posts?before=' + ids[0]).expect(400);
});

test('publica y recupera documentos con formato; el texto y los medios los deriva el servidor', async t => {
  const { api, member } = await fixture(t);
  const user = await member();
  const input = { title: 'Un proceso creativo', requestId: randomUUID(), content: { version: 1, content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Una idea con formato', marks: [{ type: 'bold' }] }] },
    { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Publicar' }] }] }] },
  ] } };
  const first = await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie).send(input).expect(201);
  const id = first.body.post.id as string;
  assert.equal(first.body.post.body, 'Una idea con formato\nPublicar');
  assert.equal((await api.get('/api/posts/' + id).expect(200)).body.content.version, 1);
  const retry = await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie).send(input).expect(200);
  assert.equal(retry.body.post.id, id);
  await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie).send({ ...input, content: { version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Una idea con formato', marks: [{ type: 'italic' }] }] }] } }).expect(409);
  await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie).send({ ...input, body: 'Texto manipulado' }).expect(400);
});

test('solo el autor edita; versiones y solicitudes impiden sobrescrituras y reintentos duplicados', async t => {
  const { api, member, database } = await fixture(t);
  const author = await member(); const other = await member();
  const created = (await api.post('/api/posts').set('Origin', origin).set('Cookie', author.cookie).send(postInput()).expect(201)).body.post as ForumPostSummary & { revision: number };
  const path = '/api/posts/' + created.id;
  const input = { title: 'Una idea revisada', revision: created.revision, requestId: randomUUID(), tags: ['feedback'], content: { version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Mi revisión' }] }] } };
  await api.patch(path).set('Origin', origin).send(input).expect(401);
  await api.patch(path).set('Origin', origin).set('Cookie', other.cookie).send(input).expect(404);
  await api.patch(path).set('Origin', 'https://otro.example').set('Cookie', author.cookie).send(input).expect(403);
  await api.patch(path).set('Origin', origin).set('Cookie', author.cookie).send({ ...input, communityId: '1' }).expect(400);
  const saved = await api.patch(path).set('Origin', origin).set('Cookie', author.cookie).send(input).expect(200);
  assert.equal(saved.body.post.id, created.id);
  assert.equal(saved.body.post.revision, 2);
  assert.equal(saved.body.post.createdAt, created.createdAt);
  assert.equal(saved.body.post.replyCount, 0);
  assert.ok(saved.body.post.updatedAt);
  assert.deepEqual(saved.body.post.tags.map((tag: { name: string }) => tag.name), ['feedback']);
  const retry = await api.patch(path).set('Origin', origin).set('Cookie', author.cookie).send(input).expect(200);
  assert.equal(retry.body.updated, false);
  assert.equal(retry.body.post.revision, 2);
  await api.patch(path).set('Origin', origin).set('Cookie', author.cookie).send({ ...input, title: 'Otra intención' }).expect(409);
  const stale = await api.patch(path).set('Origin', origin).set('Cookie', author.cookie).send({ ...input, requestId: randomUUID() }).expect(409);
  assert.equal(stale.body.error.code, 'POST_VERSION_CONFLICT');
  const newer = await api.patch(path).set('Origin', origin).set('Cookie', author.cookie).send({ ...input, revision: 2, requestId: randomUUID(), title: 'Versión nueva' }).expect(200);
  assert.equal(newer.body.post.revision, 3);
  const oldRetry = await api.patch(path).set('Origin', origin).set('Cookie', author.cookie).send(input).expect(200);
  assert.equal(oldRetry.body.post.title, 'Versión nueva');
  assert.equal((await database.query('SELECT id FROM forum_post_edits WHERE post_id=$1', [created.id])).rows.length, 2);
});

test('editar una publicación de comunidad no duplica avisos ni permite editar después de salir', async t => {
  const { api, member } = await fixture(t);
  const owner = await member(); const author = await member();
  const community = await api.post('/api/communities').set('Origin', origin).set('Cookie', owner.cookie).send({ name: 'Taller abierto', description: 'Compartimos ideas.', requestId: randomUUID() }).expect(201);
  const id = community.body.community.id as string;
  await api.post('/api/communities/' + id + '/membership').set('Origin', origin).set('Cookie', author.cookie).send({}).expect(200);
  const post = await api.post('/api/posts').set('Origin', origin).set('Cookie', author.cookie).send({ ...postInput(), communityId: id }).expect(201);
  const input = { title: 'Una revisión', revision: 1, requestId: randomUUID(), content: { version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Más contexto' }] }] } };
  await api.patch('/api/posts/' + post.body.post.id).set('Origin', origin).set('Cookie', author.cookie).send(input).expect(200);
  assert.equal((await api.get('/api/communities/' + id).set('Cookie', owner.cookie)).body.postCount, 1);
  assert.equal((await api.get('/api/notifications/count').set('Cookie', owner.cookie)).body.unreadCount, 1);
  await api.delete('/api/communities/' + id + '/membership').set('Origin', origin).set('Cookie', author.cookie).send({}).expect(200);
  await api.patch('/api/posts/' + post.body.post.id).set('Origin', origin).set('Cookie', author.cookie).send({ ...input, revision: 2, requestId: randomUUID() }).expect(403);
});

test('el inicio combina búsqueda, rama temática y todas las etiquetas sin perder compatibilidad', async t => {
  const { api, member } = await fixture(t);
  const user = await member();
  const catalog = (await api.get('/api/taxonomy/categories').expect(200)).body as ForumCategory[];
  const leaf = catalog.find(item => item.slug === 'frontend')!;
  const parent = catalog.find(item => item.id === leaf.parentId)!;
  const first = await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie).send({ title: 'Proceso compartido', body: 'Un avance del proyecto.', categoryId: leaf.id, tags: ['proceso', 'feedback'], requestId: randomUUID() }).expect(201);
  await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie).send({ title: 'Otra idea', body: 'Otro proceso.', categoryId: leaf.id, tags: ['proceso'], requestId: randomUUID() }).expect(201);
  const tags = first.body.post.tags as { id: string; name: string }[];
  const ids = tags.map(tag => tag.id).join(',');
  const result = await api.get('/api/posts').query({ search: 'compartido', category: parent.id, tags: ids, author: user.id }).expect(200);
  assert.deepEqual(result.body.items.map((post: { id: string }) => post.id), [first.body.post.id]);
  assert.equal((await api.get('/api/posts').query({ topic: 'tecnologia', tag: tags.find(tag => tag.name === 'proceso')!.id }).expect(200)).body.items.length, 2);
  assert.deepEqual((await api.get('/api/taxonomy/tags').query({ ids }).expect(200)).body.map((tag: { name: string }) => tag.name).sort(), ['feedback', 'proceso']);
  await api.get('/api/posts').query({ tags: Array.from({ length: 9 }, () => randomUUID()).join(',') }).expect(400);
});


test('los votos son privados por cuenta, idempotentes y reversibles', async t => {
  const { api, member } = await fixture(t);
  const author = await member(); const other = await member();
  const saved = await api.post('/api/posts').set('Origin', origin).set('Cookie', author.cookie).send(postInput()).expect(201);
  const path = '/api/posts/' + saved.body.post.id;
  await api.put(path + '/vote').set('Origin', origin).send({ value: 1 }).expect(401);
  await api.put(path + '/vote').set('Origin', 'https://other.test').set('Cookie', author.cookie).send({ value: 1 }).expect(403);
  await api.put(path + '/vote').set('Origin', origin).set('Cookie', author.cookie).send({ value: 2 }).expect(400);
  for (let retry = 0; retry < 2; retry++) {
    assert.deepEqual((await api.put(path + '/vote').set('Origin', origin).set('Cookie', author.cookie).send({ value: 1 }).expect(200)).body, { score: 1, value: 1 });
  }
  assert.deepEqual((await api.get(path).expect(200)).body.votes, { score: 1, value: 0 });
  assert.deepEqual((await api.put(path + '/vote').set('Origin', origin).set('Cookie', other.cookie).send({ value: -1 }).expect(200)).body, { score: 0, value: -1 });
  assert.deepEqual((await api.put(path + '/vote').set('Origin', origin).set('Cookie', author.cookie).send({ value: 0 }).expect(200)).body, { score: -1, value: 0 });
});

test('los comentarios forman hilos acotados, paginables y no admiten padres de otra publicación', async t => {
  const { api, member } = await fixture(t); const user = await member();
  const create = async () => (await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie).send(postInput()).expect(201)).body.post.id as string;
  const id = await create(); const otherId = await create(); const path = '/api/posts/' + id + '/replies';
  const root = (await api.post(path).set('Origin', origin).set('Cookie', user.cookie).send({ body: 'Raíz', requestId: randomUUID() }).expect(201)).body.reply as ForumReply;
  const input = { body: 'Respuesta', parentId: root.id, requestId: randomUUID() };
  const child = (await api.post(path).set('Origin', origin).set('Cookie', user.cookie).send(input).expect(201)).body.reply as ForumReply;
  await api.post(path).set('Origin', origin).set('Cookie', user.cookie).send(input).expect(200);
  assert.equal(child.parentId, root.id); assert.equal(child.depth, 1);
  assert.deepEqual((await api.get(path).expect(200)).body.items.map((item: ForumReply) => item.id), [root.id]);
  assert.deepEqual((await api.get(path + '?parentId=' + root.id).expect(200)).body.items.map((item: ForumReply) => item.id), [child.id]);
  await api.post('/api/posts/' + otherId + '/replies').set('Origin', origin).set('Cookie', user.cookie).send({ ...input, requestId: randomUUID() }).expect(404);
  await api.get('/api/posts/' + otherId + '/replies/' + child.id).expect(404);
  let parent = child;
  for (let depth = 2; depth <= 5; depth++) parent = (await api.post(path).set('Origin', origin).set('Cookie', user.cookie).send({ body: 'Nivel ' + depth, parentId: parent.id, requestId: randomUUID() }).expect(201)).body.reply as ForumReply;
  await api.post(path).set('Origin', origin).set('Cookie', user.cookie).send({ body: 'Demasiado profundo', parentId: parent.id, requestId: randomUUID() }).expect(400);
});

test('editar exige autoría y revisión; eliminar preserva respuestas y no repite descuentos', async t => {
  const { api, member } = await fixture(t); const user = await member(); const other = await member();
  const id = (await api.post('/api/posts').set('Origin', origin).set('Cookie', user.cookie).send(postInput()).expect(201)).body.post.id as string;
  const base = '/api/posts/' + id;
  const input = { body: 'Texto anterior', requestId: randomUUID() };
  const root = (await api.post(base + '/replies').set('Origin', origin).set('Cookie', user.cookie).send(input).expect(201)).body.reply as ForumReply;
  const path = base + '/replies/' + root.id;
  await api.post(base + '/replies').set('Origin', origin).set('Cookie', other.cookie).send({ body: 'Respuesta que permanece', parentId: root.id, requestId: randomUUID() }).expect(201);
  await api.patch(path).set('Origin', origin).set('Cookie', other.cookie).send({ body: 'Ajeno', revision: 1 }).expect(403);
  const edited = await api.patch(path).set('Origin', origin).set('Cookie', user.cookie).send({ body: 'Editado', revision: 1 }).expect(200);
  assert.equal(edited.body.reply.revision, 2); assert.ok(edited.body.reply.updatedAt);
  await api.patch(path).set('Origin', origin).set('Cookie', user.cookie).send({ body: 'Cambios viejos', revision: 1 }).expect(409);
  // El reintento de creación conserva su identidad incluso después de editar.
  assert.equal((await api.post(base + '/replies').set('Origin', origin).set('Cookie', user.cookie).send(input).expect(200)).body.reply.body, 'Editado');
  await api.put(path + '/vote').set('Origin', origin).set('Cookie', other.cookie).send({ value: 1 }).expect(200);
  await api.delete(path).set('Origin', origin).set('Cookie', other.cookie).send({ revision: 2 }).expect(403);
  await api.delete(path).set('Origin', origin).set('Cookie', user.cookie).send({ revision: 1 }).expect(409);
  for (let retry = 0; retry < 2; retry++) {
    const removed = await api.delete(path).set('Origin', origin).set('Cookie', user.cookie).send({ revision: 2 }).expect(200);
    assert.equal(removed.body.replyCount, 1); assert.equal(removed.body.reply.body, '');
    assert.deepEqual(removed.body.reply.author, { id: '', displayName: 'Comentario eliminado' });
    assert.deepEqual(removed.body.reply.votes, { score: 0, value: 0 });
  }
  assert.equal((await api.get(base + '/replies?parentId=' + root.id).expect(200)).body.items.length, 1);
  await api.put(path + '/vote').set('Origin', origin).set('Cookie', other.cookie).send({ value: -1 }).expect(409);
});

test('solo el autor ancla un comentario principal y la paginación respeta el anclado', async t => {
  const { api, member } = await fixture(t); const author = await member(); const commenter = await member();
  const id = (await api.post('/api/posts').set('Origin', origin).set('Cookie', author.cookie).send(postInput()).expect(201)).body.post.id as string;
  const base = '/api/posts/' + id + '/replies'; const ids: string[] = [];
  for (let index = 0; index < 3; index++) ids.push((await api.post(base).set('Origin', origin).set('Cookie', commenter.cookie).send({ body: 'Comentario ' + index, requestId: randomUUID() }).expect(201)).body.reply.id as string);
  await api.put(base + '/' + ids[0] + '/pin').set('Origin', origin).set('Cookie', commenter.cookie).send({ pinned: true }).expect(403);
  await api.put(base + '/' + ids[0] + '/pin').set('Origin', origin).set('Cookie', author.cookie).send({ pinned: true }).expect(200);
  const first = (await api.get(base + '?limit=1').expect(200)).body;
  assert.equal(first.items[0].id, ids[0]); assert.equal(first.items[0].pinned, true);
  const next = (await api.get(base + '?before=' + first.nextCursor).expect(200)).body;
  assert.deepEqual(next.items.map((item: ForumReply) => item.id), ids.slice(1).reverse());
  await api.put(base + '/' + ids[1] + '/pin').set('Origin', origin).set('Cookie', author.cookie).send({ pinned: true }).expect(200);
  const all = (await api.get(base).expect(200)).body.items as ForumReply[];
  assert.equal(all.filter(item => item.pinned).length, 1); assert.equal(all[0]!.id, ids[1]);
});


test('los hilos privados y sus votos quedan ocultos a invitados, ajenos y exmiembros', async t => {
  const { api, member, database } = await fixture(t); const owner = await member(); const user = await member(); const outsider = await member();
  const community = (await api.post('/api/communities').set('Origin', origin).set('Cookie', owner.cookie).send({ name: 'Lecturas privadas', description: 'Un espacio privado para conversar.', visibility: 'private', requestId: randomUUID() }).expect(201)).body.community.id as string;
  // Preparación de membresía; no se prueba de nuevo el flujo de invitaciones aquí.
  await database.query("INSERT INTO community_memberships(community_id,user_id,role) VALUES($1,$2,'member')", [community, user.id]);
  await database.query('UPDATE communities SET member_count=member_count+1 WHERE id=$1', [community]);
  const id = (await api.post('/api/posts').set('Origin', origin).set('Cookie', owner.cookie).send({ ...postInput(), communityId: community }).expect(201)).body.post.id as string;
  const base = '/api/posts/' + id;
  const item = (await api.post(base + '/replies').set('Origin', origin).set('Cookie', user.cookie).send({ body: 'Texto privado', requestId: randomUUID() }).expect(201)).body.reply as ForumReply;
  const path = base + '/replies/' + item.id;
  for (const cookie of [undefined, outsider.cookie]) {
    let read = api.get(path); if (cookie) read = read.set('Cookie', cookie); await read.expect(404);
    let list = api.get(base + '/replies?parentId=' + item.id); if (cookie) list = list.set('Cookie', cookie); await list.expect(404);
  }
  await api.put(base + '/vote').set('Origin', origin).set('Cookie', outsider.cookie).send({ value: 1 }).expect(404);
  await api.put(path + '/vote').set('Origin', origin).set('Cookie', user.cookie).send({ value: 1 }).expect(200);
  await api.delete('/api/communities/' + community + '/membership').set('Origin', origin).set('Cookie', user.cookie).send({}).expect(200);
  await api.get(path).set('Cookie', user.cookie).expect(404);
  await api.patch(path).set('Origin', origin).set('Cookie', user.cookie).send({ body: 'Cambio', revision: 1 }).expect(404);
  await api.delete(path).set('Origin', origin).set('Cookie', user.cookie).send({ revision: 1 }).expect(404);
  await api.put(path + '/vote').set('Origin', origin).set('Cookie', user.cookie).send({ value: -1 }).expect(404);
});


test('seguir autores es propio de cada cuenta, idempotente y no revela datos personales', async t => {
  const { api, member, database } = await fixture(t); const author = await member(); const viewer = await member(); const other = await member();
  const id = (await api.post('/api/posts').set('Origin', origin).set('Cookie', author.cookie).send(postInput()).expect(201)).body.post.id as string;
  const path = '/api/authors/' + author.id;
  await api.get('/api/posts?feed=following').expect(401);
  await api.put(path + '/follow').set('Origin', origin).send({ following: true }).expect(401);
  await api.put(path + '/follow').set('Origin', 'https://otro.test').set('Cookie', viewer.cookie).send({ following: true }).expect(403);
  await api.put(path + '/follow').set('Origin', origin).set('Cookie', viewer.cookie).send({ following: 'yes' }).expect(400);
  await api.put('/api/authors/' + viewer.id + '/follow').set('Origin', origin).set('Cookie', viewer.cookie).send({ following: true }).expect(400);
  for (let retry = 0; retry < 2; retry++) assert.equal((await api.put(path + '/follow').set('Origin', origin).set('Cookie', viewer.cookie).send({ following: true }).expect(200)).body.isFollowing, true);
  const profile = (await api.get(path).set('Cookie', viewer.cookie).expect(200)).body as Record<string, unknown>;
  assert.equal(profile.isFollowing, true); assert.equal(profile.email, undefined); assert.equal(profile.givenName, undefined);
  assert.equal((await api.get(path).set('Cookie', other.cookie).expect(200)).body.isFollowing, false);
  assert.equal((await api.get('/api/posts/' + id).set('Cookie', viewer.cookie).expect(200)).body.author.isFollowing, true);
  assert.equal((await api.get('/api/posts?feed=following').set('Cookie', viewer.cookie).expect(200)).body.items.length, 1);
  await api.put(path + '/follow').set('Origin', origin).set('Cookie', viewer.cookie).send({ following: false }).expect(200);
  assert.equal((await api.get('/api/posts?feed=following').set('Cookie', viewer.cookie).expect(200)).body.items.length, 0);
  await database.query('DELETE FROM auth_sessions WHERE user_id=$1', [viewer.id]);
  await api.put(path + '/follow').set('Origin', origin).set('Cookie', viewer.cookie).send({ following: true }).expect(401);
});

test('Siguiendo combina autores y comunidades, sin duplicar publicaciones y con cursor', async t => {
  const { api, member } = await fixture(t); const author = await member(); const viewer = await member(); const other = await member();
  const community = (await api.post('/api/communities').set('Origin', origin).set('Cookie', author.cookie).send({ name: 'Comunidad seguida', description: 'Lecturas compartidas.', requestId: randomUUID() }).expect(201)).body.community.id as string;
  const ids: string[] = [];
  for (const [cookie, communityId] of [[author.cookie, undefined], [author.cookie, community], [other.cookie, undefined]] as const) ids.push((await api.post('/api/posts').set('Origin', origin).set('Cookie', cookie).send({ ...postInput(), communityId }).expect(201)).body.post.id as string);
  await api.put('/api/authors/' + author.id + '/follow').set('Origin', origin).set('Cookie', viewer.cookie).send({ following: true }).expect(200);
  await api.put('/api/communities/' + community + '/follow').set('Origin', origin).set('Cookie', viewer.cookie).send({ following: true }).expect(200);
  const first = (await api.get('/api/posts?feed=following&limit=1').set('Cookie', viewer.cookie).expect(200)).body;
  const next = (await api.get('/api/posts?feed=following&before=' + encodeURIComponent(first.nextCursor as string)).set('Cookie', viewer.cookie).expect(200)).body;
  assert.deepEqual(new Set([...first.items, ...next.items].map((item: ForumPostSummary) => item.id)), new Set(ids.slice(0, 2)));
  assert.equal(first.items.length + next.items.length, 2);
  assert.equal((await api.get('/api/communities/' + community).set('Cookie', viewer.cookie).expect(200)).body.membership, null);
  assert.equal((await api.get('/api/communities?scope=following').set('Cookie', viewer.cookie).expect(200)).body.items.length, 1);
  await api.get('/api/posts?feed=unknown').set('Cookie', viewer.cookie).expect(400);
});

test('seguir no concede acceso privado y salir oculta publicaciones incluso de autores seguidos', async t => {
  const { api, member, database } = await fixture(t); const author = await member(); const viewer = await member();
  await api.post('/api/posts').set('Origin', origin).set('Cookie', author.cookie).send(postInput('Pública')).expect(201);
  const community = (await api.post('/api/communities').set('Origin', origin).set('Cookie', author.cookie).send({ name: 'Lecturas solo invitadas', description: 'Contenido reservado.', visibility: 'private', requestId: randomUUID() }).expect(201)).body.community.id as string;
  const privatePost = (await api.post('/api/posts').set('Origin', origin).set('Cookie', author.cookie).send({ ...postInput('Privada'), communityId: community }).expect(201)).body.post.id as string;
  await api.put('/api/authors/' + author.id + '/follow').set('Origin', origin).set('Cookie', viewer.cookie).send({ following: true }).expect(200);
  await api.put('/api/communities/' + community + '/follow').set('Origin', origin).set('Cookie', viewer.cookie).send({ following: true }).expect(404);
  assert.equal((await api.get('/api/posts?feed=following').set('Cookie', viewer.cookie).expect(200)).body.items.some((item: ForumPostSummary) => item.id === privatePost), false);
  await database.query('INSERT INTO community_memberships(community_id,user_id) VALUES($1,$2)', [community, viewer.id]);
  await database.query('UPDATE communities SET member_count=member_count+1 WHERE id=$1', [community]);
  await api.put('/api/communities/' + community + '/follow').set('Origin', origin).set('Cookie', viewer.cookie).send({ following: true }).expect(200);
  assert.equal((await api.get('/api/posts?feed=following').set('Cookie', viewer.cookie).expect(200)).body.items.length, 2);
  await api.delete('/api/communities/' + community + '/membership').set('Origin', origin).set('Cookie', viewer.cookie).send({}).expect(200);
  assert.equal((await api.get('/api/posts?feed=following').set('Cookie', viewer.cookie).expect(200)).body.items.length, 1);
  assert.equal((await api.get('/api/communities?scope=following').set('Cookie', viewer.cookie).expect(200)).body.items.length, 0);
});

test('crear y unirse siguen una comunidad; dejar de seguir no abandona ni cambia avisos', async t => {
  const { api, member } = await fixture(t); const owner = await member(); const viewer = await member();
  const created = await api.post('/api/communities').set('Origin', origin).set('Cookie', owner.cookie).send({ name: 'Para seguir aprendiendo', description: 'Un espacio público.', requestId: randomUUID() }).expect(201);
  assert.equal(created.body.community.isFollowing, true);
  const base = '/api/communities/' + created.body.community.id;
  const joined = await api.post(base + '/membership').set('Origin', origin).set('Cookie', viewer.cookie).send({}).expect(201);
  assert.equal(joined.body.isFollowing, true);
  await api.put(base + '/follow').set('Origin', origin).set('Cookie', viewer.cookie).send({ following: false }).expect(200);
  const current = (await api.get(base).set('Cookie', viewer.cookie).expect(200)).body;
  assert.equal(current.isFollowing, false); assert.equal(current.membership.notifyPosts, true);
  assert.equal((await api.post(base + '/membership').set('Origin', origin).set('Cookie', viewer.cookie).send({}).expect(201)).body.isFollowing, false);
});

test('el perfil público pagina solo las publicaciones y membresías públicas de esa persona, también para su dueño', async t => {
  const { api, member, database } = await fixture(t);
  const author = await member(); const other = await member(); const viewer = await member();
  const createCommunity = async (cookie: string, name: string, visibility: 'public' | 'private' = 'public') =>
    (await api.post('/api/communities').set('Origin', origin).set('Cookie', cookie).send({ name, description: 'Un espacio compartido.', visibility, requestId: randomUUID() }).expect(201)).body.community.id as string;
  const owned = await createCommunity(author.cookie, 'Creada por la autora');
  const joined = await createCommunity(other.cookie, 'Comunidad a la que pertenece');
  const hidden = await createCommunity(author.cookie, 'Comunidad privada de la autora', 'private');
  await api.post('/api/communities/' + joined + '/membership').set('Origin', origin).set('Cookie', author.cookie).send({}).expect(201);
  await database.query('INSERT INTO community_memberships(community_id,user_id) VALUES($1,$2)', [hidden, viewer.id]);
  await database.query('UPDATE communities SET member_count=member_count+1 WHERE id=$1', [hidden]);
  await database.query('UPDATE users SET bio=$2 WHERE id=$1', [author.id, 'Leo y comparto lo que aprendo.']);
  const ids: string[] = [];
  for (const communityId of [undefined, owned]) ids.push((await api.post('/api/posts').set('Origin', origin).set('Cookie', author.cookie).send({ ...postInput(), communityId }).expect(201)).body.post.id as string);
  await api.post('/api/posts').set('Origin', origin).set('Cookie', author.cookie).send({ ...postInput('Solo para miembros'), communityId: hidden }).expect(201);
  await api.post('/api/posts').set('Origin', origin).set('Cookie', other.cookie).send(postInput('Otro autor')).expect(201);
  const path = '/api/authors/' + author.id;
  for (const cookie of ['', author.cookie, viewer.cookie]) {
    const profile = (await api.get(path).set('Cookie', cookie).expect(200)).body as ForumAuthorProfile;
    assert.equal(profile.displayName, 'Ana'); assert.equal(profile.bio, 'Leo y comparto lo que aprendo.');
    assert.equal(profile.publicPostCount, 2); assert.equal(profile.publicCommunityCount, 2);
    assert.equal(Number.isNaN(Date.parse(profile.createdAt)), false);
    assert.deepEqual(Object.keys(profile).sort(), ['bio', 'createdAt', 'displayName', 'id', 'isFollowing', 'publicCommunityCount', 'publicPostCount']);
    const first = (await api.get(path + '/posts?limit=1&author=' + other.id + '&publicOnly=false&community=' + hidden).set('Cookie', cookie).expect(200)).body as ForumPage<ForumPostSummary>;
    const last = (await api.get(path + '/posts').query({ limit: '1', before: first.nextCursor }).set('Cookie', cookie).expect(200)).body as ForumPage<ForumPostSummary>;
    assert.equal(first.hasMore, true); assert.equal(last.hasMore, false);
    assert.deepEqual([...first.items, ...last.items].map(item => item.id).sort(), [...ids].sort());
    const communities = (await api.get(path + '/communities?limit=1').set('Cookie', cookie).expect(200)).body as ForumPage<Community>;
    const next = (await api.get(path + '/communities').query({ limit: '1', before: communities.nextCursor }).set('Cookie', cookie).expect(200)).body as ForumPage<Community>;
    assert.equal(communities.hasMore, true); assert.equal(next.hasMore, false);
    assert.deepEqual([...communities.items, ...next.items].map(item => item.id).sort(), [owned, joined].sort());
    if (!cookie) assert.equal(communities.items.every(item => item.membership === null && !item.isFavorite && !item.isFollowing), true);
  }
});

test('abre perfiles de comentaristas, miembros y participantes registrados del chat sin atribuir invitados a una cuenta', async t => {
  const { api, member } = await fixture(t);
  const author = await member(); const commenter = await member(); const participant = await member(); const guest = await member(); const owner = await member();
  const post = (await api.post('/api/posts').set('Origin', origin).set('Cookie', author.cookie).send(postInput()).expect(201)).body.post.id as string;
  await api.post('/api/posts/' + post + '/replies').set('Origin', origin).set('Cookie', commenter.cookie).send({ body: 'Una respuesta pública.', requestId: randomUUID() }).expect(201);
  await api.post('/api/communities').set('Origin', origin).set('Cookie', owner.cookie).send({ name: 'Comunidad sin publicaciones', description: 'Abierta para conversar.', requestId: randomUUID() }).expect(201);
  await api.post('/api/messages').set('Origin', origin).set('Cookie', participant.cookie).send({ author: 'Invitado', body: 'Un saludo como miembro.', senderId: randomUUID(), requestId: randomUUID() }).expect(201);
  await api.post('/api/messages').set('Origin', origin).send({ author: 'Ana', body: 'Un saludo como invitado.', senderId: guest.id, requestId: randomUUID() }).expect(201);
  await api.post('/api/messages').set('Origin', origin).send({ author: 'Ana', body: 'Intento atribuir otra cuenta.', senderId: randomUUID(), requestId: randomUUID(), accountId: guest.id }).expect(400);
  for (const person of [commenter, participant, owner]) {
    const path = '/api/authors/' + person.id;
    assert.equal((await api.get(path).expect(200)).body.publicPostCount, 0);
    assert.equal((await api.get(path + '/posts').expect(200)).body.items.length, 0);
  }
  await api.get('/api/authors/' + guest.id).expect(404);
  await api.get('/api/authors/' + commenter.id + '/posts?before=no-es-un-cursor').expect(400);
  await api.get('/api/authors/' + owner.id + '/communities?limit=101').expect(400);
});

test('un perfil de actividad exclusivamente privada no se revela fuera de sus miembros ni revela contenido privado a ellos', async t => {
  const { api, member, database } = await fixture(t);
  const author = await member(); const peer = await member(); const outsider = await member();
  const community = (await api.post('/api/communities').set('Origin', origin).set('Cookie', author.cookie).send({ name: 'Solo por invitación', description: 'Espacio privado.', visibility: 'private', requestId: randomUUID() }).expect(201)).body.community.id as string;
  await database.query('INSERT INTO community_memberships(community_id,user_id) VALUES($1,$2)', [community, peer.id]);
  await database.query('UPDATE communities SET member_count=member_count+1 WHERE id=$1', [community]);
  await api.post('/api/posts').set('Origin', origin).set('Cookie', author.cookie).send({ ...postInput(), communityId: community }).expect(201);
  const path = '/api/authors/' + author.id;
  for (const suffix of ['', '/posts', '/communities']) {
    await api.get(path + suffix).expect(404);
    await api.get(path + suffix).set('Cookie', outsider.cookie).expect(404);
    await api.get('/api/authors/' + randomUUID() + suffix).expect(404);
    await api.get('/api/authors/no-es-uuid' + suffix).expect(400);
  }
  for (const cookie of [author.cookie, peer.cookie]) {
    const profile = (await api.get(path).set('Cookie', cookie).expect(200)).body as ForumAuthorProfile;
    assert.equal(profile.publicPostCount, 0); assert.equal(profile.publicCommunityCount, 0);
    for (const suffix of ['/posts', '/communities']) assert.deepEqual((await api.get(path + suffix).set('Cookie', cookie).expect(200)).body, { items: [], hasMore: false, nextCursor: null });
  }
});
