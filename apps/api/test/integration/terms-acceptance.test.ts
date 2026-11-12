import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import request from 'supertest';
import { createTestApplication } from '../support/application.js';
import { hashPassword, keyedHash } from '../../src/modules/auth/auth-crypto.js';

const origin = 'http://127.0.0.1:5173';
const termsVersion = '2026-11-12';

test('la cuenta existente entra sin términos y la verificación de un registro conserva su aceptación', async t => {
  const { app, server, database } = await createTestApplication({ auth: true });
  t.after(() => app.close());
  await app.init();
  const api = request(server);
  const user = randomUUID();
  const email = 'cuenta@example.test';
  const password = 'contraseña de prueba';
  const passwordHash = await hashPassword(password);
  await database.query(`INSERT INTO users(id,email,display_name,password_hash,email_verified_at)
    VALUES($1,$2,'Ana',$3,CURRENT_TIMESTAMP)`, [user, email, passwordHash]);
  const post = (path: string, body: object) => api.post('/api/auth/' + path).set('Origin', origin).send(body);

  assert.equal((await post('register', { email, password, displayName: 'Ana' }).expect(400)).body.error.code, 'TERMS_REQUIRED');
  const accepted = await post('login', { email, password }).expect(201);
  assert.equal(accepted.body.session.user.id, user);
  const acceptance = (id: string) => database.query<{ terms_version: string | null; terms_accepted_at: Date | null }>(
    'SELECT terms_version,terms_accepted_at FROM users WHERE id=$1', [id]);
  assert.deepEqual((await acceptance(user)).rows[0], { terms_version: null, terms_accepted_at: null });

  const pendingUser = randomUUID();
  const pendingEmail = 'pendiente@example.test';
  const challengeId = randomUUID();
  const code = '123456';
  const digest = keyedHash('foris-test-secret-with-at-least-32-characters', 'otp', challengeId, 'verify_email', code);
  await database.query("INSERT INTO users(id,email,display_name,password_hash) VALUES($1,$2,'Ana',$3)", [pendingUser, pendingEmail, passwordHash]);
  await database.query(`INSERT INTO auth_otp_challenges(id,user_id,email,purpose,code_digest,payload,expires_at)
    VALUES($1,$2,$3,'verify_email',$4,$5,CURRENT_TIMESTAMP+INTERVAL '10 minutes')`,
  [challengeId, pendingUser, pendingEmail, digest, { passwordHash, displayName: 'Ana', termsVersion }]);
  await post('verify-email', { challengeId, code }).expect(201);
  const saved = (await acceptance(pendingUser)).rows[0];
  assert.equal(saved.terms_version, termsVersion);
  assert.ok(saved.terms_accepted_at instanceof Date);
});

test('Google solicita términos solo para una cuenta nueva y conserva la aceptación al volver a entrar', async t => {
  const { app, server, database } = await createTestApplication({ auth: true, google: true });
  t.after(() => app.close());
  await app.init();
  const api = request(server);
  let nonce = '';
  t.mock.method(OAuth2Client.prototype, 'getToken', async () => ({ tokens: { id_token: 'fixture-token' } }));
  t.mock.method(OAuth2Client.prototype, 'verifyIdToken', async () => ({ getPayload: () => ({
    nonce, email_verified: true, email: 'google@example.test', sub: 'fixture-subject', name: 'Ana',
  }) }));
  const startFlow = async () => {
    const response = await api.post('/api/auth/google/start').set('Origin', origin).send({ intent: 'login', returnTo: '/chat' }).expect(201);
    const url = new URL(response.body.url as string);
    const cookies = response.headers['set-cookie'] as unknown as string[];
    const cookie = cookies.find(value => value.startsWith('foris_oauth='))!.split(';')[0];
    nonce = (await database.query<{ nonce: string }>('SELECT nonce FROM auth_google_flows')).rows[0].nonce;
    return { state: url.searchParams.get('state'), cookie };
  };
  const callback = (flow: { state: string | null; cookie: string }) => api.get('/api/auth/google/callback')
    .query({ state: flow.state, code: 'fixture-code' }).set('Cookie', flow.cookie);
  const pending = await callback(await startFlow()).expect(303);
  assert.equal(pending.headers.location, '/login?mode=google-signup&next=%2Fchat');
  const cookies = pending.headers['set-cookie'] as unknown as string[];
  assert.equal(cookies.some(value => value.startsWith('foris_session=')), false);
  const signupCookie = cookies.find(value => value.startsWith('foris_google_signup='))!.split(';')[0];
  const finish = (version?: string) => api.post('/api/auth/google/signup').set('Origin', origin).set('Cookie', signupCookie).send({ termsVersion: version });
  assert.equal((await finish().expect(400)).body.error.code, 'TERMS_REQUIRED');
  assert.deepEqual((await api.get('/api/auth/google/signup').set('Cookie', signupCookie).expect(200)).body, { email: 'google@example.test', displayName: 'Ana' });
  const acceptance = () => database.query<{ terms_version: string; terms_accepted_at: Date }>(
    'SELECT terms_version,terms_accepted_at FROM users WHERE email=$1', ['google@example.test']);
  assert.equal((await acceptance()).rows.length, 0);
  const created = await finish(termsVersion).expect(201);
  assert.equal(created.body.returnTo, '/chat');
  await finish(termsVersion).expect(409);
  const stored = (await acceptance()).rows[0];
  assert.equal(stored.terms_version, termsVersion);
  assert.ok(stored.terms_accepted_at instanceof Date);
  const login = await callback(await startFlow()).expect(303);
  assert.equal(login.headers.location, '/chat');
  assert.deepEqual((await acceptance()).rows[0], stored);
});
