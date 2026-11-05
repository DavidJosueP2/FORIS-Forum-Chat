import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { startServer } from '../../src/application.js';
import { MessagesRepository } from '../../src/modules/messages/messages.repository.js';
import { testDatabase } from '../support/database.js';
import { createTestApplication } from '../support/application.js';
import type { AddressInfo } from 'node:net';
import type { DatabasePool, SqlDatabase } from '../../src/database/database.types.js';
import type { QueryResultRow } from 'pg';

async function portReservation() {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return { port: (server.address() as AddressInfo).port, close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}

test('inicia el servidor y cierra las conexiones de forma idempotente', async t => {
  const { pool } = await testDatabase();
  const reservation = await portReservation();
  await reservation.close();
  const errors: unknown[][] = [];
  let ended = false;
  class Pool extends EventEmitter {
    query = pool.query.bind(pool);
    connect = pool.connect.bind(pool);
    async end() { ended = true; await pool.end(); }
  }
  const instrumented = new Pool();
  const { app } = await createTestApplication({
    pool: instrumented, port: reservation.port,
    logger: { info() {}, error: (...args) => errors.push(args) },
  });
  const runtime = await startServer(app);
  t.after(() => runtime.close());
  assert.equal((await fetch(`http://127.0.0.1:${reservation.port}/api/health`)).status, 200);
  instrumented.emit('error', new Error('conexión interrumpida'));
  assert.equal(errors.length, 1);
  await Promise.all([runtime.close(), runtime.close()]);
  assert.equal(ended, true);
});

test('un puerto ocupado cierra la base y devuelve un error claro', async t => {
  const { pool } = await testDatabase();
  const reservation = await portReservation();
  t.after(reservation.close);
  let ended = false;
  class Pool extends EventEmitter {
    query = pool.query.bind(pool);
    connect = pool.connect.bind(pool);
    async end() { ended = true; await pool.end(); }
  }
  const { app } = await createTestApplication({ pool: new Pool(), port: reservation.port });
  await assert.rejects(startServer(app), { code: 'EADDRINUSE' });
  assert.equal(ended, true);
});

test('una base no disponible impide arrancar y libera el pool', async () => {
  let ended = false;
  class Pool extends EventEmitter {
    query: DatabasePool['query'] = () => { throw new Error('base no disponible'); };
    connect: DatabasePool['connect'] = () => { throw new Error('base no disponible'); };
    async end() { ended = true; }
  }
  const { app } = await createTestApplication({ pool: new Pool() });
  await assert.rejects(startServer(app), /base no disponible/u);
  assert.equal(ended, true);
});

test('resuelve la carrera entre dos envíos con el mismo identificador', async () => {
  const input = { author: 'Ana', body: 'Hola', senderId: 'sender', requestId: 'request' };
  const row = { id: '7', author: 'Ana', body: 'Hola', sender_id: 'sender', request_id: 'request', created_at: new Date() };
  const responses = [{ rows: [] }, { rows: [] }, { rows: [row] }];
  const database: SqlDatabase = { query: async <Row extends QueryResultRow>() => {
    const response = responses.shift();
    assert.ok(response);
    return response as unknown as { rows: Row[] };
  } };
  const repository = new MessagesRepository(database);
  const result = await repository.save(input);
  assert.equal(result.created, false);
  assert.equal(result.message.id, '7');
  assert.equal(responses.length, 0);
});
