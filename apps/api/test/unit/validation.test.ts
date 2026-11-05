import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { validateMessage, validatePagination } from '../../src/modules/messages/dto/message-validation.js';
import { HttpError, publicError } from '../../src/common/errors/http-error.js';
import { readConfig } from '../../src/config/app-config.js';
import type { MessageInput } from '@messages/contracts';

const valid = (): Omit<MessageInput, 'author'> & { author?: string } => ({ author: ' Ana ', body: ' Hola\r\n sala ', senderId: randomUUID(), requestId: randomUUID() });

test('normaliza texto y permite saltos de línea, tabulaciones y Unicode', () => {
  assert.equal(validateMessage(valid()).body, 'Hola\n sala');
  assert.equal(validateMessage(valid()).author, 'Ana');
  const input = valid();
  delete input.author;
  input.body = '¡Hola!\tこんにちは';
  assert.equal(validateMessage(input).author, 'Invitado');
  assert.equal(validateMessage(input).body, input.body);
});

const invalidBodies = [null, [], 'texto', {}, { ...valid(), body: '' }, { ...valid(), body: 12 },
  { ...valid(), body: 'a'.repeat(2001) }, { ...valid(), author: 'a'.repeat(33) },
  { ...valid(), author: 'Ana\nMaria' }, { ...valid(), body: 'Hola\u0000' }, { ...valid(), body: 'a\u007f' },
  { ...valid(), attachment: 'video.mp4' }, { ...valid(), senderId: 'invalido' }, { ...valid(), requestId: null }];
for (const [index, input] of invalidBodies.entries()) {
  test(`rechaza un mensaje inválido (${index + 1})`, () => {
    assert.throws(() => validateMessage(input), error => error instanceof HttpError && error.status === 400);
  });
}

test('acepta exactamente el máximo y conserva HTML como texto', () => {
  assert.equal(validateMessage({ ...valid(), body: 'a'.repeat(2000) }).body.length, 2000);
  assert.equal(validateMessage({ ...valid(), body: '<script>alert(1)</script>' }).body, '<script>alert(1)</script>');
});

test('valida cursores y límites de paginación sin perder precisión', () => {
  assert.deepEqual(validatePagination({}), { before: undefined, after: undefined, limit: 50 });
  assert.deepEqual(validatePagination({ before: '9223372036854775807', limit: '100' }), { before: '9223372036854775807', after: undefined, limit: 100 });
  assert.equal(validatePagination({ after: '1', limit: '1' }).after, '1');
  for (const query of [{ before: '0' }, { before: '-1' }, { after: ['1'] }, { after: '9223372036854775808' },
    { before: '1', after: '2' }, { limit: '0' }, { limit: '101' }, { limit: '1.5' }, { limit: ['5'] }, { after: '1 OR 1=1' }]) {
    assert.throws(() => validatePagination(query), HttpError);
  }
});

test('los errores públicos nunca exponen datos internos', () => {
  const known = new HttpError(404, 'NOT_FOUND', 'No encontrado');
  assert.equal(publicError(known), known);
  assert.equal(publicError({ type: 'entity.parse.failed' }).status, 400);
  assert.equal(publicError({ type: 'entity.too.large' }).status, 413);
  const unexpected = publicError(new Error('password=secreto; SELECT * FROM mensajes'));
  assert.equal(unexpected.status, 503);
  assert.doesNotMatch(unexpected.message, /secreto|SELECT/u);
});

test('configuración local y contenedor con puertos validados', () => {
  const local = readConfig({ PGPASSWORD: 'test-only' });
  assert.equal(local.port, 3000);
  assert.equal(local.host, '127.0.0.1');
  assert.equal(local.database.port, 5433);
  const container = readConfig({ PGPASSWORD: 'test-only', PORT: '4000', HOST: '0.0.0.0', PGHOST: 'app-db', PGPORT: '5432', PGDATABASE: 'other', PGUSER: 'other' });
  assert.equal(container.database.host, 'app-db');
  assert.equal(container.port, 4000);
  assert.equal(readConfig({ PGPASSWORD: 'x', APP_PORT: '3001' }).port, 3001);
  assert.throws(() => readConfig({}), /PGPASSWORD/u);
  for (const value of ['0', '65536', 'abc', '30a', '-1']) {
    assert.throws(() => readConfig({ PGPASSWORD: 'x', PORT: value }), /PORT/u);
  }
  assert.throws(() => readConfig({ PGPASSWORD: 'x', PGPORT: 'invalid' }), /PGPORT/u);
});
