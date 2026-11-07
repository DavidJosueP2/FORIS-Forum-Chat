import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setTimeout } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { MessageEventsService, eventFrame } from '../../src/modules/messages/message-events.service.js';
import { readConfig } from '../../src/config/app-config.js';
import { unavailablePresence } from '../../src/modules/messages/presence.repository.js';
import type { PresenceRepository } from '../../src/modules/messages/presence.repository.js';
import type { PresenceIdentity } from '../../src/modules/messages/presence-identity.service.js';

const guest: PresenceIdentity = { kind: 'guest', browserKey: 'a'.repeat(64), ipKey: null, userId: null, sessionId: null };
// Doble de transporte: no demuestra concurrencia PostgreSQL (hay una suite real opt-in).
function eventHub(events: Partial<ReturnType<typeof readConfig>['events']> = {}, overrides: Partial<Pick<PresenceRepository, 'acquire' | 'refresh' | 'release'>> = {}) {
  const config = readConfig({ PGPASSWORD: 'test-only' });
  const leases = new Set<string>();
  const presence: Pick<PresenceRepository, 'acquire' | 'refresh' | 'release'> = {
    async acquire() { const id = randomUUID(); leases.add(id); return id; },
    async refresh(ids) { return { presence: { status: 'available', accounts: 0, guestBrowsers: 1, observedAt: new Date().toISOString(), leaseSeconds: 90 }, renewed: new Set(ids.filter(id => leases.has(id))) }; },
    async release(id) { leases.delete(id); }, ...overrides,
  };
  return new MessageEventsService({ ...config, events: { ...config.events, ...events } }, presence, { info() {}, error() {} });
}

class Response extends EventEmitter {
  frames: string[] = [];
  headers: Record<string, string> = {};
  flushed = false;
  writableEnded = false;
  set(headers: Record<string, string>) { this.headers = headers; }
  flushHeaders() { this.flushed = true; }
  write(frame: string) { this.frames.push(frame); return true; }
  end() {
    if (this.writableEnded) return;
    this.writableEnded = true;
    this.emit('close');
  }
}

test('SSE serializa texto sin permitir inyección de eventos', () => {
  const frame = eventFrame('message', { body: 'hola\n\nevent: otro' });
  assert.equal(frame.split('\n\n').length, 2);
  assert.match(frame, /hola\\n\\nevent/u);
});

test('difunde a todos, actualiza presencia y limpia conexiones y latidos', async () => {
  const hub = eventHub({ heartbeatMs: 10 });
  const a = new Response();
  const b = new Response();
  await hub.connect({ ip: '127.0.0.1' }, a, guest);
  await hub.connect({ ip: '127.0.0.2' }, b, guest);
  assert.equal(a.headers['Content-Type'], 'text/event-stream; charset=utf-8');
  assert.equal(a.flushed, true);
  hub.publish('message', { body: 'Hola' });
  assert.ok(a.frames.some(frame => frame.includes('"body":"Hola"')));
  assert.ok(b.frames.some(frame => frame.includes('"guestBrowsers":1')));
  assert.ok(b.frames.every(frame => !frame.includes('"connections"')));
  await setTimeout(25);
  assert.ok(a.frames.includes(': keepalive\n\n'));
  a.end();
  assert.equal(hub.clients.size, 1);
  await hub.beforeApplicationShutdown();
  assert.equal(hub.clients.size, 0);
});

test('limita conexiones por dirección y en total', async () => {
  const hub = eventHub({ maxConnections: 2, maxPerIp: 1 });
  await hub.connect({ ip: 'a' }, new Response(), guest);
  await assert.rejects(hub.connect({ ip: 'a' }, new Response(), guest), { status: 429 });
  await hub.connect({ ip: 'b' }, new Response(), guest);
  await assert.rejects(hub.connect({ ip: 'c' }, new Response(), guest), { status: 429 });
  await hub.beforeApplicationShutdown();
});

test('desconecta clientes lentos o rotos sin detener a los demás', async () => {
  const hub = eventHub();
  const slow = new Response();
  slow.write = () => false;
  await hub.connect({ ip: 'a' }, slow, guest);
  assert.equal(slow.writableEnded, true);
  const broken = new Response();
  broken.write = () => { throw new Error('socket cerrado'); };
  await hub.connect({ ip: 'b' }, broken, guest);
  assert.equal(broken.writableEnded, true);
  const ended = new Response();
  ended.writableEnded = true;
  hub.write({ response: ended }, 'frame');
  await hub.beforeApplicationShutdown();
});

test('un fallo publica desconocido en lugar del número local y recupera después', async () => {
  let failed = true;
  const hub = eventHub({}, { async refresh(ids) {
    if (failed) throw new Error('password=secreto SQL');
    return { presence: { status: 'available', accounts: 1, guestBrowsers: 0, observedAt: new Date().toISOString(), leaseSeconds: 90 }, renewed: new Set(ids) };
  } });
  const response = new Response(); await hub.connect({ ip: 'a' }, response, guest);
  assert.equal(response.frames.at(-1), eventFrame('presence', unavailablePresence()));
  assert.ok(response.frames.every(frame => !frame.includes('secreto')));
  failed = false; await hub.refreshPresence(); assert.match(response.frames.at(-1)!, /"accounts":1/u);
  await hub.beforeApplicationShutdown();
});

test('cerrar mientras se adquiere una concesión no deja presencia sin socket', async () => {
  let authorize: ((id: string) => void) | undefined;
  const released: string[] = [];
  const hub = eventHub({}, { acquire: () => new Promise(resolve => { authorize = resolve; }), async release(id) { released.push(id); } });
  const response = new Response(); const opening = hub.connect({ ip: 'a' }, response, guest);
  response.end(); const id = randomUUID(); authorize!(id); await opening;
  await hub.beforeApplicationShutdown(); assert.deepEqual(released, [id]); assert.equal(hub.clients.size, 0);
});

test('una concesión vencida o sesión revocada cierra el stream y exige un alta nueva', async () => {
  const hub = eventHub({}, { async refresh() { return { presence: unavailablePresence(), renewed: new Set<string>() }; } });
  const response = new Response(); await hub.connect({ ip: 'a' }, response, guest);
  assert.equal(response.writableEnded, true); await hub.beforeApplicationShutdown();
});
