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

test('el historial directo y comunitario solo llega a sus participantes vigentes', async t => {
  const { api, database, alice, bob, outsider, community, post } = await fixture(t);
  const shared = history('community:' + community.id);
  const direct = history('direct:' + bob.id);
  await api.get(shared).expect(401);
  await api.get(shared).set('Cookie', outsider.cookie).expect(404);
  await post(history('direct:' + alice.id), outsider.cookie, { body: 'Sin permiso', requestId: randomUUID() }).expect(404);

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
  await api.get(direct).set('Cookie', alice.cookie).expect(404);
  await database.query('DELETE FROM community_memberships WHERE community_id=$1 AND user_id=$2', [community.id, bob.id]);
  await api.get(shared).set('Cookie', bob.cookie).expect(404);
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
