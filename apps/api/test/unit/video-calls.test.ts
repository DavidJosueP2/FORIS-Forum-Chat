import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { readVideoCallConfig } from '../../src/config/video-call-config.js';
import { readConfig } from '../../src/config/app-config.js';
import { joinInput, signalInput, syncInput } from '../../src/modules/video-calls/video-call-validation.js';
import { VideoCallService } from '../../src/modules/video-calls/video-call.service.js';
import type { VideoCallRepository } from '../../src/modules/video-calls/video-call.repository.js';
import type { AuthContext } from '../../src/modules/auth/auth.types.js';

test('producción mantiene llamadas desactivadas y exige TURN al activarlas', () => {
  assert.equal(readVideoCallConfig({ NODE_ENV: 'production' }).enabled, false);
  assert.equal(readVideoCallConfig({ NODE_ENV: 'test' }).enabled, true);
  assert.throws(() => readVideoCallConfig({ NODE_ENV: 'production', CALLS_ENABLED: 'true' }));
  assert.throws(() => readVideoCallConfig({ CALLS_ENABLED: 'yes' }));
  assert.throws(() => readVideoCallConfig({ CALLS_TURN_URLS: 'https://example.test' }));
  assert.throws(() => readVideoCallConfig({ CALLS_TURN_URLS: 'turn:example.test', CALLS_TURN_SECRET: 'short' }));
});
test('señales y cursores rechazan objetos extra, tamaños excesivos y descripciones inválidas', () => {
  const input = { to: randomUUID(), requestId: randomUUID(), description: { type: 'offer', sdp: 'v=0\r\n' } };
  assert.deepEqual(signalInput(input), input);
  assert.throws(() => signalInput({ ...input, from: randomUUID() }));
  for (const description of [{ type: 'candidate', sdp: 'v=0\r\n' }, { type: 'offer', sdp: 'otro' }, { type: 'offer', sdp: 'v=0\r\n' + 'x'.repeat(65536) }, { type: 'offer', sdp: 'v=0\r\n\0' }]) {
    assert.throws(() => signalInput({ ...input, description }));
  }
  assert.equal(syncInput({ after: '0' }), '0');
  for (const after of [-1, '01', '-1', '9223372036854775808']) assert.throws(() => syncInput({ after }));
  assert.throws(() => joinInput({ requestId: randomUUID(), userId: randomUUID() }));
});
test('TURN entrega credenciales temporales por participante sin exponer el secreto compartido', async () => {
  const secret = 'temporary-test-turn-secret-with-32-characters';
  const memberId = randomUUID();
  const repository = { async join() { return { memberId, peers: [], signals: [], nextCursor: '0', hasMore: false, expiresAt: new Date(Date.now() + 1800000).toISOString() }; } } as unknown as VideoCallRepository;
  const config = readConfig({ NODE_ENV: 'test', PGPASSWORD: 'test', CALLS_TURN_URLS: 'turns:relay.example.test:5349?transport=tcp', CALLS_TURN_SECRET: secret });
  const service = new VideoCallService(config, { info() {}, error() {} }, repository);
  const result = await service.join({} as AuthContext, randomUUID());
  assert.equal(result.iceTransportPolicy, 'relay');
  const server = result.iceServers[0];
  assert.equal(server.credential, createHmac('sha1', secret).update(server.username!).digest('base64'));
  assert.ok(Number(server.username!.split(':')[0]) > Date.now() / 1000 + 3500);
  assert.equal(JSON.stringify(result).includes(secret), false);
});
