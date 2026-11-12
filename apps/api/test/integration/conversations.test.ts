import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApplication } from '../support/application.js';
import { randomToken, tokenHash } from '../../src/modules/auth/auth-crypto.js';

const origin = 'http://127.0.0.1:5173';
const history = (room: string) => '/api/conversations/' + encodeURIComponent(room) + '/messages';

async function fixture(t: TestContext) {
  const instance = await createTestApplication({ auth: true });
  t.after(() => instance.app.close());
  await instance.app.init();
  const { database } = instance;
  const api = request(instance.server);
  async function account(name: string) {
    const id = randomUUID();
    const token = randomToken();
    await database.query('INSERT INTO users(id,email,display_name,email_verified_at) VALUES($1,$2,$3,CURRENT_TIMESTAMP)', [id, id + '@example.test', name]);
    await database.query(`INSERT INTO auth_sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,CURRENT_TIMESTAMP+INTERVAL '1 hour')`, [randomUUID(), id, tokenHash(token)]);
    return { id, cookie: 'foris_session=' + token };
  }
  const alice = await account('Alicia');
  const bob = await account('Bernardo');
  const outsider = await account('Carla');
  const community = (await database.query<{ id: string }>(`INSERT INTO communities(name,name_key,description,owner_id,request_id)
    VALUES('Taller','taller','Un grupo para crear',$1,$2) RETURNING id`, [alice.id, randomUUID()])).rows[0];
  await database.query('INSERT INTO community_memberships(community_id,user_id) VALUES($1,$2),($1,$3)', [community.id, alice.id, bob.id]);
  await database.query('INSERT INTO author_follows(follower_id,author_id) VALUES($1,$2),($2,$1),($3,$1)', [alice.id, bob.id, outsider.id]);
  return { database, api, alice, bob, outsider, community, post: (path: string, cookie: string, body: object) => api.post(path).set('Cookie', cookie).set('Origin', origin).send(body) };
}

test('el historial directo pertenece a la pareja y el comunitario requiere membresía vigente', async t => {
  const { api, database, alice, bob, outsider, community, post } = await fixture(t);
  const shared = history('community:' + community.id);
  const direct = history('direct:' + bob.id);
  await api.get(shared).expect(401);
  await api.get(shared).set('Cookie', outsider.cookie).expect(404);
  await api.get(history('direct:' + outsider.id)).set('Cookie', bob.cookie).expect(404);

  const directory = await api.get('/api/conversations').set('Cookie', alice.cookie).expect(200);
  assert.deepEqual(directory.body.rooms.map((room: { id: string; kind: string }) => [room.kind, room.id]), [['community', String(community.id)], ['direct', bob.id]]);
  const send = { body: 'Mensaje directo', requestId: randomUUID() };
  const first = await post(direct, alice.cookie, send).expect(200);
  assert.equal(first.body.message.accountId, alice.id);
  assert.equal((await post(direct, alice.cookie, send).expect(200)).body.message.id, first.body.message.id);
  await post(direct, alice.cookie, { ...send, body: 'Otro texto' }).expect(409);
  await post(shared, bob.cookie, { body: 'Mensaje comunitario', requestId: randomUUID() }).expect(200);
  const received = await api.get(history('direct:' + alice.id) + '?after=0').set('Cookie', bob.cookie).expect(200);
  assert.deepEqual(received.body.messages.map((entry: { body: string }) => entry.body), ['Mensaje directo']);
  const communityHistory = await api.get(shared).set('Cookie', alice.cookie).expect(200);
  assert.deepEqual(communityHistory.body.messages.map((entry: { body: string }) => entry.body), ['Mensaje comunitario']);
  assert.equal((await api.get('/api/messages').expect(200)).body.messages.length, 0);

  await database.query('DELETE FROM author_follows WHERE follower_id=$1 AND author_id=$2', [alice.id, bob.id]);
  const retained = await api.get(direct).set('Cookie', alice.cookie).expect(200);
  assert.equal(retained.body.messages.length, 1);
  assert.equal(retained.body.state.canCall, false);
  assert.equal((await api.get(history('direct:' + bob.id)).set('Cookie', outsider.cookie).expect(200)).body.messages.length, 0);
  await database.query('DELETE FROM community_memberships WHERE community_id=$1 AND user_id=$2', [community.id, bob.id]);
  await api.get(shared).set('Cookie', bob.cookie).expect(404);
});

test('un solo primer mensaje concurrente, reintento idempotente y apertura al responder', async t => {
  const { api, bob, outsider, post } = await fixture(t);
  const toBob = history('direct:' + bob.id);
  const toCarla = history('direct:' + outsider.id);
  const message = (body: string) => ({ body, requestId: randomUUID() });
  const target = await api.get('/api/conversations/direct/' + bob.id).set('Cookie', outsider.cookie).expect(200);
  assert.equal(target.body.name, 'Bernardo');
  assert.equal((await api.get(toBob).set('Cookie', outsider.cookie).expect(200)).body.state.permission, 'intro');
  const attempts = [message('Hola'), message('¿Qué tal?')];
  const results = await Promise.all(attempts.map(body => post(toBob, outsider.cookie, body)));
  const winner = results.findIndex(result => result.status === 200);
  assert.notEqual(winner, -1);
  assert.equal(results[1 - winner].body.error.code, 'DIRECT_INTRO_PENDING');
  assert.equal(results[winner].body.state.permission, 'awaiting');
  assert.equal((await post(toBob, outsider.cookie, attempts[winner]).expect(200)).body.message.id, results[winner].body.message.id);
  for (const [account, peer] of [[outsider, bob], [bob, outsider]]) {
    const directory = await api.get('/api/conversations').set('Cookie', account.cookie).expect(200);
    assert.ok(directory.body.rooms.some((room: { id: string }) => room.id === peer.id));
  }
  const received = await api.get(toCarla).set('Cookie', bob.cookie).expect(200);
  assert.equal(received.body.state.permission, 'reply');
  assert.equal(received.body.messages.length, 1);
  await post(toCarla, bob.cookie, message('Hola, Carla')).expect(200);
  assert.deepEqual((await post(toBob, outsider.cookie, message('Gracias')).expect(200)).body.state, { permission: 'open', canCall: false });
  await api.get('/api/video-call?room=' + encodeURIComponent('direct:' + bob.id)).set('Cookie', outsider.cookie).expect(404);
});

test('el seguimiento de la persona destinataria abre el chat y genera un aviso privado sin duplicados', async t => {
  const { api, alice, bob, outsider, post, database } = await fixture(t);
  const toBob = history('direct:' + bob.id);
  const send = (body: string) => post(toBob, outsider.cookie, { body, requestId: randomUUID() });
  await send('Hola, Bernardo').expect(200);
  const follow = (following: boolean) => api.put('/api/authors/' + outsider.id + '/follow').set('Origin', origin).set('Cookie', bob.cookie).send({ following }).expect(200);
  await follow(true);
  await follow(true);
  await follow(false);
  await follow(true);
  assert.deepEqual((await send('Gracias por seguirme').expect(200)).body.state, { permission: 'open', canCall: false });
  const count = await api.get('/api/notifications/count').set('Cookie', outsider.cookie).expect(200);
  assert.equal(count.body.unreadCount, 1);
  const inbox = await api.get('/api/notifications').set('Cookie', outsider.cookie).expect(200);
  assert.equal(inbox.body.items.length, 1);
  assert.equal(inbox.body.items[0].kind, 'follow');
  assert.deepEqual(inbox.body.items[0].follower, { id: bob.id, displayName: 'Bernardo' });
  assert.equal((await api.get('/api/notifications').set('Cookie', alice.cookie).expect(200)).body.items.length, 0);
  await post('/api/notifications/' + inbox.body.items[0].id + '/read', outsider.cookie, {}).expect(201);
  assert.equal((await api.get('/api/notifications/count').set('Cookie', outsider.cookie).expect(200)).body.unreadCount, 0);
  await database.query('DELETE FROM author_follows WHERE follower_id=$1 AND author_id=$2', [bob.id, outsider.id]);
  assert.equal((await api.get(toBob).set('Cookie', outsider.cookie).expect(200)).body.state.permission, 'awaiting');
});

test('la búsqueda global distingue los tres tipos y respeta la visibilidad', async t => {
  const { api, database, alice, outsider, community } = await fixture(t);
  await database.query("UPDATE users SET display_name='Alicia Táller' WHERE id=$1", [alice.id]);
  const hidden = (await database.query<{ id: string }>(`INSERT INTO communities(name,name_key,description,owner_id,request_id,visibility)
    VALUES('Taller privado','taller privado','Solo miembros',$1,$2,'private') RETURNING id`, [outsider.id, randomUUID()])).rows[0];
  await database.query('INSERT INTO community_memberships(community_id,user_id) VALUES($1,$2)', [hidden.id, outsider.id]);
  const publicPost = randomUUID();
  const privatePost = randomUUID();
  await database.query(`INSERT INTO forum_posts(id,author_id,title,body,request_id,community_id)
    VALUES($1,$2,'Taller de bicicletas','Texto',$3,$4),($5,$6,'Taller reservado','Texto',$7,$8)`,
  [publicPost, alice.id, randomUUID(), community.id, privatePost, outsider.id, randomUUID(), hidden.id]);
  const publicSearch = await api.get('/api/search?q=taller').expect(200);
  assert.deepEqual(publicSearch.body.results.map((item: { kind: string; id: string }) => [item.kind, item.id]),
    [['user', alice.id], ['community', String(community.id)], ['post', publicPost]]);
  const memberSearch = await api.get('/api/search?q=taller').set('Cookie', outsider.cookie).expect(200);
  assert.ok(memberSearch.body.results.some((item: { id: string }) => item.id === privatePost));
  assert.ok(memberSearch.body.results.some((item: { id: string }) => item.id === String(hidden.id)));
  assert.deepEqual((await api.get('/api/search?q=%25_').expect(200)).body.results, []);
});

test('las salas de videollamada validan permisos y no mezclan participantes ni señales', async t => {
  const { api, database, alice, bob, outsider, community, post } = await fixture(t);
  const room = '?room=' + encodeURIComponent('community:' + community.id);
  const join = (cookie: string, scope = '') => post('/api/video-call/join' + scope, cookie, { requestId: randomUUID() });
  await join(outsider.cookie, room).expect(404);
  const shared = await join(alice.cookie, room).expect(200);
  const global = await join(outsider.cookie).expect(200);
  assert.deepEqual(global.body.peers, []);
  const directStatus = await api.get('/api/video-call?room=' + encodeURIComponent('direct:' + alice.id)).set('Cookie', bob.cookie).expect(200);
  assert.equal(directStatus.body.capacity, 2);
  assert.equal(directStatus.body.participants, 0);
  const second = await join(bob.cookie, room).expect(200);
  assert.deepEqual(second.body.peers.map((peer: { id: string }) => peer.id), [shared.body.memberId]);
  await post(`/api/video-call/${shared.body.memberId}/signals`, alice.cookie,
    { to: global.body.memberId, requestId: randomUUID(), description: { type: 'offer', sdp: 'v=0\r\n' } }).expect(404);
  await database.query('DELETE FROM community_memberships WHERE community_id=$1 AND user_id=$2', [community.id, bob.id]);
  await post(`/api/video-call/${second.body.memberId}/sync`, bob.cookie, { after: '0' }).expect(404);
  await post(`/api/video-call/${shared.body.memberId}/leave`, alice.cookie, {}).expect(200);
  await post(`/api/video-call/${second.body.memberId}/leave`, bob.cookie, {}).expect(200);
  const direct = (peer: string) => '?room=' + encodeURIComponent('direct:' + peer);
  const call = await join(alice.cookie, direct(bob.id)).expect(200);
  const peer = await join(bob.cookie, direct(alice.id)).expect(200);
  assert.deepEqual(peer.body.peers.map((participant: { id: string }) => participant.id), [call.body.memberId]);
  assert.equal((await api.get('/api/video-call').set('Cookie', outsider.cookie).expect(200)).body.participants, 1);
});
