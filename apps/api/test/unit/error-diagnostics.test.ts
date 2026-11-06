import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errorDiagnostics } from '../../src/common/errors/error-diagnostics.js';
import { HttpError } from '../../src/common/errors/http-error.js';

test('los diagnósticos conservan la causa y metadatos útiles sin mensajes privados del proveedor', () => {
  const provider = Object.assign(new Error('secretAccessKey=privado; https://storage.test/key?X-Amz-Signature=firma'), {
    name: 'AccessDenied', $metadata: { httpStatusCode: 403, requestId: 'r2-request-123' },
    input: { password: 'privado' },
  });
  const error = new HttpError(503, 'MEDIA_PROVIDER_UNAVAILABLE', 'Almacenamiento no disponible.', { cause: provider });
  const result = errorDiagnostics(error);
  assert.equal(result.code, 'MEDIA_PROVIDER_UNAVAILABLE');
  assert.equal(result.cause?.type, 'AccessDenied');
  assert.equal(result.cause?.upstreamStatus, 403);
  assert.equal(result.cause?.upstreamRequestId, 'r2-request-123');
  assert.match(result.cause?.hint ?? '', /credenciales S3/u);
  assert.doesNotMatch(JSON.stringify(result), /privado|X-Amz-Signature|firma/u);
});

test('los mensajes multilínea tampoco pueden introducir secretos como frames falsos', () => {
  const error = new Error('SELECT password FROM users\n    at password=privado');
  const result = errorDiagnostics(error);
  assert.doesNotMatch(JSON.stringify(result), /password|SELECT|privado/u);
  assert.ok(result.frames?.length);
});

test('los códigos SQL y de disco reciben una explicación sin serializar consultas o parámetros', () => {
  const result = errorDiagnostics({ code: '42P01', query: 'SELECT secreto', values: ['privado'] });
  assert.match(result.hint ?? '', /migraciones/u);
  assert.doesNotMatch(JSON.stringify(result), /SELECT|privado/u);
  assert.match(errorDiagnostics({ code: 'ENOSPC' }).hint ?? '', /espacio/u);
});

test('las URLs de los frames también se ocultan antes de escribir el diagnóstico', () => {
  const error = new Error('storage unavailable');
  error.stack = 'Error: storage unavailable\n    at remote (https://storage.test/image?X-Amz-Signature=privado)\n    at local (app.ts:10:5)';
  const result = errorDiagnostics(error);
  assert.match(result.frames?.[0] ?? '', /url omitida/u);
  assert.doesNotMatch(JSON.stringify(result), /X-Amz|privado|storage\.test/u);
  assert.match(result.frames?.[1] ?? '', /app\.ts:10:5/u);
});

test('las causas cíclicas se limitan y nombres heredados no se interpretan como explicaciones', () => {
  const error: { code: string; cause?: unknown } = { code: 'constructor' };
  error.cause = error;
  const result = errorDiagnostics(error);
  assert.equal(result.hint, undefined);
  assert.equal(result.cause?.cause, undefined);
});
