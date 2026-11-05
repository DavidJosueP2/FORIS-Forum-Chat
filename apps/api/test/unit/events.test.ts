import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setTimeout } from 'node:timers/promises';
import { MessageEventsService, eventFrame } from '../../src/modules/messages/message-events.service.js';
import { readConfig } from '../../src/config/app-config.js';

function eventHub(events: Partial<ReturnType<typeof readConfig>['events']> = {}) {
  const config = readConfig({ PGPASSWORD: 'test-only' });
  return new MessageEventsService({ ...config, events: { ...config.events, ...events } });
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
  hub.connect({ ip: '127.0.0.1' }, a);
  hub.connect({ ip: '127.0.0.2' }, b);
  assert.equal(a.headers['Content-Type'], 'text/event-stream; charset=utf-8');
  assert.equal(a.flushed, true);
  hub.publish('message', { body: 'Hola' });
  assert.ok(a.frames.some(frame => frame.includes('"body":"Hola"')));
  assert.ok(b.frames.some(frame => frame.includes('"connections":2')));
  await setTimeout(25);
  assert.ok(a.frames.includes(': keepalive\n\n'));
  a.end();
  assert.ok(b.frames.some(frame => frame.includes('"connections":1')));
  hub.close();
  assert.equal(hub.clients.size, 0);
});

test('limita conexiones por dirección y en total', () => {
  const hub = eventHub({ maxConnections: 2, maxPerIp: 1 });
  hub.connect({ ip: 'a' }, new Response());
  assert.throws(() => hub.connect({ ip: 'a' }, new Response()), { status: 429 });
  hub.connect({ ip: 'b' }, new Response());
  assert.throws(() => hub.connect({ ip: 'c' }, new Response()), { status: 429 });
  hub.close();
});

test('desconecta clientes lentos o rotos sin detener a los demás', () => {
  const hub = eventHub();
  const slow = new Response();
  slow.write = () => false;
  hub.connect({ ip: 'a' }, slow);
  assert.equal(slow.writableEnded, true);
  const broken = new Response();
  broken.write = () => { throw new Error('socket cerrado'); };
  hub.connect({ ip: 'b' }, broken);
  assert.equal(broken.writableEnded, true);
  const ended = new Response();
  ended.writableEnded = true;
  hub.write({ response: ended }, 'frame');
  hub.close();
});
