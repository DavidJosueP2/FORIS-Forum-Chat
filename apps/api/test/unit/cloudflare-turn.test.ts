import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readConfig } from '../../src/config/app-config.js';
import { readVideoCallConfig } from '../../src/config/video-call-config.js';
import type { CloudflareTurnConfig } from '../../src/config/video-call-config.js';
import { HttpError } from '../../src/common/errors/http-error.js';
import { cloudflareTurnServers } from '../../src/modules/video-calls/cloudflare-turn.js';
import { VideoCallService } from '../../src/modules/video-calls/video-call.service.js';
import type { VideoCallRepository } from '../../src/modules/video-calls/video-call.repository.js';
import type { AuthContext } from '../../src/modules/auth/auth.types.js';

const turn: CloudflareTurnConfig = { provider: 'cloudflare', keyId: 'turn-key-id-for-tests-only', apiToken: 'fake-turn-api-token-for-tests-only' };
const environment = { NODE_ENV: 'production', CALLS_ENABLED: 'true', CALLS_TURN_PROVIDER: 'cloudflare',
  CALLS_CLOUDFLARE_TURN_KEY_ID: turn.keyId, CALLS_CLOUDFLARE_TURN_API_TOKEN: turn.apiToken };
const relay = { urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'], username: 'temporary-user', credential: 'temporary-password' };
const logger = { info() {}, error() {} };

test('Cloudflare habilita TURN en producción y rechaza credenciales ausentes, mezcladas o inseguras', () => {
  assert.deepEqual(readVideoCallConfig(environment).turn, turn);
  for (const override of [
    { CALLS_CLOUDFLARE_TURN_API_TOKEN: '' }, { CALLS_CLOUDFLARE_TURN_KEY_ID: '../bad-key-id-for-tests' },
    { CALLS_CLOUDFLARE_TURN_API_TOKEN: 'bad\r\nAuthorization: injected' }, { CALLS_TURN_PROVIDER: 'coturn' },
    { CALLS_TURN_PROVIDER: 'unknown' }, { CALLS_TURN_URLS: 'turn:relay.example.test' }, { CALLS_TURN_SECRET: 'other-secret' },
  ]) assert.throws(() => readVideoCallConfig({ ...environment, ...override }));
});

test('solo se entregan credenciales temporales y URLs relay utilizables por el navegador', async () => {
  const result = await cloudflareTurnServers(turn, async (url, options) => {
    assert.equal(String(url), `https://rtc.live.cloudflare.com/v1/turn/keys/${turn.keyId}/credentials/generate-ice-servers`);
    assert.equal(options?.method, 'POST');
    assert.equal(new Headers(options?.headers).get('Authorization'), `Bearer ${turn.apiToken}`);
    assert.deepEqual(JSON.parse(String(options?.body)), { ttl: 3600 });
    assert.equal(options?.redirect, 'error');
    assert.equal(options?.cache, 'no-store');
    assert.ok(options?.signal);
    return Response.json({ iceServers: [
      { urls: ['stun:stun.cloudflare.com:3478'] },
      { ...relay, urls: [...relay.urls, 'turn:turn.cloudflare.com:53?transport=udp', 'turn:unexpected.example:3478?transport=udp'] },
    ] }, { status: 201 });
  });
  assert.deepEqual(result, [relay]);
  assert.equal(JSON.stringify(result).includes(turn.apiToken), false);
});

test('respuesta inválida o sin relay no entrega datos arbitrarios al cliente', async () => {
  for (const payload of [null, { iceServers: [] }, { iceServers: [{ urls: ['stun:stun.cloudflare.com:3478'] }] },
    { iceServers: [{ ...relay, credential: '' }] }, { iceServers: [{ ...relay, username: 'bad\nuser' }] }]) {
    await assert.rejects(cloudflareTurnServers(turn, async () => Response.json(payload)),
      (error: unknown) => error instanceof HttpError && error.code === 'CALL_TURN_INVALID_RESPONSE');
  }
});

test('errores del proveedor no reflejan su cuerpo ni la clave en el mensaje público', async () => {
  for (const status of [401, 403, 429, 500]) {
    await assert.rejects(cloudflareTurnServers(turn, async () => new Response(turn.apiToken, { status })), (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.status, 503);
      assert.equal(error.code, status === 401 || status === 403 ? 'CALL_TURN_AUTH_FAILED' : 'CALL_TURN_UNAVAILABLE');
      assert.equal(error.message.includes(turn.apiToken), false);
      return true;
    });
  }
  await assert.rejects(cloudflareTurnServers(turn, async () => { throw new DOMException('timeout', 'TimeoutError'); }),
    (error: unknown) => error instanceof HttpError && error.code === 'CALL_TURN_UNAVAILABLE');
});

test('una caída de Cloudflare no reserva una plaza en la sala', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 503 }));
  let reservations = 0;
  const repository = { async join() { reservations++; throw new Error('No debe reservarse'); } } as unknown as VideoCallRepository;
  const config = readConfig({ ...environment, NODE_ENV: 'test', PGPASSWORD: 'test' });
  const service = new VideoCallService(config, logger, repository);
  await assert.rejects(service.join({} as AuthContext, randomUUID()),
    (error: unknown) => error instanceof HttpError && error.code === 'CALL_TURN_UNAVAILABLE');
  assert.equal(reservations, 0);
});

test('una entrada aceptada usa relay y no devuelve la clave del proveedor', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ iceServers: [relay] }));
  const memberId = randomUUID();
  const repository = { async join() { return { memberId, peers: [], signals: [], nextCursor: '0', hasMore: false, expiresAt: new Date(Date.now() + 1800000).toISOString() }; } } as unknown as VideoCallRepository;
  const service = new VideoCallService(readConfig({ ...environment, NODE_ENV: 'test', PGPASSWORD: 'test' }), logger, repository);
  const result = await service.join({} as AuthContext, randomUUID());
  assert.equal(result.memberId, memberId);
  assert.equal(result.iceTransportPolicy, 'relay');
  assert.deepEqual(result.iceServers, [relay]);
  assert.equal(JSON.stringify(result).includes(turn.apiToken), false);
});
