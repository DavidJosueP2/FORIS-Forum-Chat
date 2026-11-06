import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { S3Client, HeadObjectCommand, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { readMediaConfig } from '../../src/config/media-config.js';
import { uploadInput, imageIds } from '../../src/modules/media/media-validation.js';
import { assertObjectKey } from '../../src/modules/media/storage.port.js';
import { localTicket, verifyLocalTicket } from '../../src/modules/media/local-tickets.js';
import { LocalStorageAdapter } from '../../src/modules/media/adapters/local-storage.adapter.js';
import { S3StorageAdapter } from '../../src/modules/media/adapters/s3-storage.adapter.js';
import { normalizeImage } from '../../src/modules/media/image-validator.js';

const secret = 'test-media-secret-with-at-least-32-characters';
const configuration = () => readMediaConfig({ NODE_ENV: 'test' }, process.cwd());
test('desarrollo usa disco sin credenciales S3 y producción exige configuración externa', () => {
  assert.equal(configuration().driver, 'local');
  assert.throws(() => readMediaConfig({ NODE_ENV: 'production', STORAGE_DRIVER: 'local' }, process.cwd()));
  assert.throws(() => readMediaConfig({ NODE_ENV: 'production' }, process.cwd()), /S3_BUCKET/u);
  for (const value of ['0', '-1', 'abc', '90000000000000000']) assert.throws(() => readMediaConfig({ MEDIA_MAX_IMAGE_BYTES: value }, process.cwd()));
});

test('R2 rechaza credenciales de ejemplo sin revelar sus valores y otros proveedores conservan su formato', () => {
  const env = { NODE_ENV: 'test', STORAGE_DRIVER: 's3', S3_PROVIDER: 'r2', S3_REGION: 'auto',
    S3_ENDPOINT: 'https://storage.example.test', S3_BUCKET: 'test-media',
    S3_ACCESS_KEY_ID: 'a'.repeat(32), S3_SECRET_ACCESS_KEY: 'b'.repeat(64) };
  assert.equal(readMediaConfig(env, process.cwd()).provider, 'r2');
  for (const field of ['S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const) {
    const placeholder = 'credencial-de-ejemplo-privada';
    assert.throws(() => readMediaConfig({ ...env, [field]: placeholder }, process.cwd()), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, new RegExp(field));
      assert.ok(!error.message.includes(placeholder));
      return true;
    });
  }
  assert.equal(readMediaConfig({ ...env, S3_PROVIDER: 'minio', S3_REGION: 'us-east-1',
    S3_ACCESS_KEY_ID: 'minio-user', S3_SECRET_ACCESS_KEY: 'minio-password' }, process.cwd()).provider, 'minio');
});
test('tipos, tamaños, solicitudes y claves físicas no permiten SVG ni rutas arbitrarias', () => {
  const config = configuration();
  const input = { originalName: 'foto.png', mime: 'image/png', bytes: 100, requestId: randomUUID() };
  assert.equal(uploadInput(input, config).mime, 'image/png');
  for (const changed of [{ mime: 'image/svg+xml' }, { bytes: 0 }, { bytes: config.maxBytes + 1 }, { originalName: '../otro.png' }, { requestId: 'otro' }, { ownerId: randomUUID() }]) {
    assert.throws(() => uploadInput({ ...input, ...changed }, config));
  }
  const id = randomUUID();
  assert.throws(() => imageIds([id, id]));
  assert.throws(() => assertObjectKey('../../privado'));
  assert.throws(() => assertObjectKey('foris/images/' + id + '/../../secreto'));
  assert.doesNotThrow(() => assertObjectKey('foris/images/' + id + '/' + randomUUID() + '.png'));
});
test('tickets locales separan lectura y subida y caducan', () => {
  const id = randomUUID();
  const query = Object.fromEntries(new URLSearchParams(localTicket(secret, id, 'read', new Date(Date.now() + 30000))));
  assert.doesNotThrow(() => verifyLocalTicket(secret, id, 'read', query));
  assert.throws(() => verifyLocalTicket(secret, id, 'upload', query));
  assert.throws(() => verifyLocalTicket(secret, randomUUID(), 'read', query));
  assert.throws(() => verifyLocalTicket(secret, id, 'read', { ...query, signature: '0'.repeat(64) }));
  const expired = Object.fromEntries(new URLSearchParams(localTicket(secret, id, 'read', new Date(Date.now() - 1000))));
  assert.throws(() => verifyLocalTicket(secret, id, 'read', expired));
});
test('la validación decodifica contenido real, limita píxeles y recodifica una imagen válida', async () => {
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#445544' } }).png().toBuffer();
  const normalized = await normalizeImage(bytes, 'image/png', configuration());
  assert.equal(normalized.width, 2);
  assert.equal(normalized.height, 2);
  assert.equal(normalized.mime, 'image/png');
  assert.equal(normalized.checksum.length, 64);
  assert.equal((await sharp(normalized.bytes).metadata()).exif, undefined);
  await assert.rejects(normalizeImage(bytes, 'image/jpeg', configuration()));
  await assert.rejects(normalizeImage(Buffer.from('<svg/>'), 'image/png', configuration()));
  await assert.rejects(normalizeImage(Buffer.from([255, 216, 255]), 'image/jpeg', configuration()));
  await assert.rejects(normalizeImage(bytes, 'image/png', { ...configuration(), maxPixels: 1 }));
});
test('adaptador local guarda objetos inmutables y elimina solo claves gestionadas', async t => {
  const prefix = resolve(tmpdir(), 'foris-media-unit-');
  const root = await mkdtemp(prefix);
  t.after(async () => { assert.ok(root.startsWith(prefix)); await rm(root, { recursive: true, force: true }); });
  const adapter = new LocalStorageAdapter({ ...configuration(), localRoot: root }, secret);
  const key = 'foris/images/' + randomUUID() + '/' + randomUUID() + '.png';
  await adapter.put(key, Buffer.from('original'), 'image/png');
  await adapter.put(key, Buffer.from('original'), 'image/png');
  await assert.rejects(adapter.put(key, Buffer.from('diferente'), 'image/png'));
  assert.equal((await adapter.read(key, 100)).toString(), 'original');
  await assert.rejects(adapter.read(key, 2));
  await assert.rejects(adapter.remove('../archivo-ajeno'));
  await adapter.remove(key);
  await adapter.remove(key);
  assert.equal(await adapter.head(key), null);
});
test('S3 genera permisos locales sin enviar peticiones y delega metadatos y borrado al SDK simulado', async t => {
  const config = readMediaConfig({ NODE_ENV: 'test', STORAGE_DRIVER: 's3', S3_PROVIDER: 's3', S3_REGION: 'us-east-1',
    S3_ENDPOINT: 'https://storage.example.test', S3_BUCKET: 'test-media', S3_ACCESS_KEY_ID: 'test-access', S3_SECRET_ACCESS_KEY: secret }, process.cwd());
  const client = new S3Client({ endpoint: config.s3.endpoint, region: config.s3.region, forcePathStyle: true,
    credentials: { accessKeyId: 'test-access', secretAccessKey: secret } });
  t.after(() => client.destroy());
  const send = mock.method(client, 'send', async (command: unknown) => {
    if (command instanceof HeadObjectCommand) return { ContentLength: 10, ContentType: 'image/png' };
    if (command instanceof DeleteObjectCommand) return {};
    throw new Error('No network request is permitted');
  });
  const storage = new S3StorageAdapter(config, client);
  const id = randomUUID();
  const key = 'foris/staging/' + id + '/' + randomUUID() + '.bin';
  const target = await storage.createUpload({ mediaId: id, key, mime: 'image/png', bytes: 10, expiresAt: new Date(Date.now() + 300000) });
  const url = new URL(target.url);
  assert.equal(url.origin, config.s3.endpoint);
  assert.ok(Number(url.searchParams.get('X-Amz-Expires')) <= 300);
  assert.match(url.searchParams.get('X-Amz-SignedHeaders') ?? '', /content-type/u);
  assert.equal(send.mock.callCount(), 0);
  assert.deepEqual(await storage.head(key), { bytes: 10, mime: 'image/png' });
  await storage.remove(key);
  assert.equal(send.mock.callCount(), 2);
});

test('S3 distingue objetos ausentes de fallos del proveedor y limita los bytes descargados', async t => {
  const config = configuration();
  const client = new S3Client({ region: 'us-east-1', credentials: { accessKeyId: 'test-access', secretAccessKey: secret } });
  t.after(() => client.destroy());
  let missing = true;
  const body = Readable.from([Buffer.alloc(4), Buffer.alloc(4)]);
  mock.method(client, 'send', async (command: unknown) => {
    if (command instanceof HeadObjectCommand) throw { $metadata: { httpStatusCode: missing ? 404 : 503 } };
    if (command instanceof GetObjectCommand) return { Body: body };
    throw new Error('No network request is permitted');
  });
  const storage = new S3StorageAdapter(config, client);
  const key = 'foris/staging/' + randomUUID() + '/' + randomUUID() + '.bin';
  assert.equal(await storage.head(key), null);
  missing = false;
  await assert.rejects(storage.head(key), error => (error as { $metadata: { httpStatusCode: number } }).$metadata.httpStatusCode === 503);
  await assert.rejects(storage.read(key, 5), /Invalid object size/u);
  assert.equal(body.destroyed, true);
});

test('S3 impide sobrescribir la versión validada y admite solo reintentos con los mismos bytes', async t => {
  const client = new S3Client({ region: 'us-east-1', credentials: { accessKeyId: 'test-access', secretAccessKey: secret } });
  t.after(() => client.destroy());
  const original = Buffer.from('imagen-original');
  mock.method(client, 'send', async (command: unknown) => {
    if (command instanceof PutObjectCommand) {
      assert.equal(command.input.IfNoneMatch, '*');
      throw { $metadata: { httpStatusCode: 412 } };
    }
    if (command instanceof GetObjectCommand) return { Body: Readable.from([original]) };
    throw new Error('No network request is permitted');
  });
  const storage = new S3StorageAdapter(configuration(), client);
  const key = 'foris/images/' + randomUUID() + '/' + randomUUID() + '.png';
  await storage.put(key, original, 'image/png');
  await assert.rejects(storage.put(key, Buffer.from('otro contenido'), 'image/png'), /already exists/u);
});
