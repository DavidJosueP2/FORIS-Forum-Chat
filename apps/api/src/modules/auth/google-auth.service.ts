import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import type { Response } from 'express';
import { AuthRepository } from './auth.repository.js';
import { SessionService, cookieValue } from './session.service.js';
import { AuthService } from './auth.service.js';
import { OtpService } from './otp.service.js';
import { randomToken, tokenHash, equalSecret, keyedHash, seal, unseal } from './auth-crypto.js';
import { record } from './auth-validation.js';
import * as validate from './auth-validation.js';
import { HttpError } from '../../common/errors/http-error.js';
import type { AuthRequest } from './auth.types.js';
import { returnTarget } from './return-target.js';

type Intent = 'login' | 'link' | 'reauth';
interface GoogleFlow {
  [key: string]: unknown;
  intent: Intent; user_id: string | null; session_id: string | null;
  code_verifier: string; nonce: string; return_to: string;
}
interface GoogleSignup { subject: string; email: string; displayName: string; givenName: string; familyName: string; returnTo: string; expiresAt: number }
const signupLifetime = 10 * 60000;
/** Conserva únicamente el destino local de un flujo ya validado. */
export class GoogleCallbackError extends HttpError {
  readonly returnTo: string;
  constructor(cause: unknown, destination: string) {
    super(cause instanceof HttpError ? cause.status : 503,
      cause instanceof HttpError ? cause.code : 'GOOGLE_FAILED',
      cause instanceof HttpError ? cause.message : 'No pudimos completar el acceso con Google.');
    this.returnTo = returnTarget(destination);
  }
}
@Injectable()
export class GoogleAuthService {
  private readonly client: OAuth2Client;
  constructor(
    @Inject(AuthRepository) private readonly repository: AuthRepository,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(OtpService) private readonly otp: OtpService,
  ) {
    const config = sessions.config.google;
    this.client = new OAuth2Client({
      clientId: config.clientId, clientSecret: config.clientSecret, redirectUri: config.callbackUrl,
      transporterOptions: { timeout: 15000, retry: false },
    });
  }
  private get cookieName() { return this.sessions.config.secureCookies ? '__Host-foris_oauth' : 'foris_oauth'; }
  private get signupCookieName() { return this.sessions.config.secureCookies ? '__Host-foris_google_signup' : 'foris_google_signup'; }
  private get signupKey() { return keyedHash(this.sessions.config.secret, 'google-signup-v1'); }
  clearCookie(response: Response) {
    response.clearCookie(this.cookieName, { httpOnly: true, secure: this.sessions.config.secureCookies, sameSite: 'lax', path: '/' });
  }
  private readSignup(request: AuthRequest): GoogleSignup {
    this.sessions.requireEnabled();
    const cookie = cookieValue(request, this.signupCookieName);
    if (cookie && cookie.length <= 4096) {
      try {
        const pending = unseal(this.signupKey, cookie) as GoogleSignup;
        if (typeof pending.expiresAt === 'number' && pending.expiresAt > Date.now()) return pending;
      } catch { /* Una cookie inválida no autoriza un registro. */ }
    }
    throw new HttpError(400, 'GOOGLE_FLOW_EXPIRED', 'La solicitud caducó. Vuelve a continuar con Google.');
  }
  signupDetails(request: AuthRequest) {
    const { email, displayName } = this.readSignup(request);
    return { email, displayName };
  }
  setSignupCookie(response: Response, signup: GoogleSignup) {
    response.cookie(this.signupCookieName, seal(this.signupKey, signup), {
      httpOnly: true, secure: this.sessions.config.secureCookies, sameSite: 'lax', path: '/', maxAge: signupLifetime,
    });
  }
  clearSignupCookie(response: Response) {
    response.clearCookie(this.signupCookieName, { httpOnly: true, secure: this.sessions.config.secureCookies, sameSite: 'lax', path: '/' });
  }
  async finishSignup(body: unknown, request: AuthRequest) {
    const version = validate.termsVersion(record(body, ['termsVersion']).termsVersion);
    const signup = this.readSignup(request);
    const grant = await this.repository.transaction(async client => {
      await this.repository.lockKey(client, 'google:' + signup.subject);
      const identity = await client.query('SELECT user_id FROM user_google_identities WHERE subject=$1', [signup.subject]);
      if (identity.rows.length) throw new HttpError(409, 'GOOGLE_ACCOUNT_EXISTS', 'Esta cuenta ya está creada. Vuelve a entrar con Google.');
      const id = randomUUID();
      const inserted = await client.query(`INSERT INTO users(id,email,display_name,given_name,family_name,email_verified_at)
        VALUES($1,$2,$3,$4,$5,CURRENT_TIMESTAMP) ON CONFLICT(email) DO NOTHING RETURNING id`,
      [id, signup.email, signup.displayName, signup.givenName, signup.familyName]);
      if (!inserted.rows[0]) throw new HttpError(409, 'GOOGLE_ACCOUNT_EXISTS', 'Ya existe una cuenta con ese correo. Entra primero y vincula Google desde tu perfil.');
      await client.query('INSERT INTO user_google_identities(user_id,subject,email) VALUES($1,$2,$3)', [id, signup.subject, signup.email]);
      await this.repository.acceptTerms(client, id, version);
      return this.sessions.issue(client, id);
    });
    return { grant, returnTo: signup.returnTo };
  }
  async start(body: unknown, request: AuthRequest, response: Response) {
    this.sessions.requireEnabled();
    const fields = record(body, ['intent', 'currentPassword', 'returnTo', 'termsVersion']);
    const intent = fields.intent ?? 'login';
    if (intent !== 'login' && intent !== 'link' && intent !== 'reauth') validate.invalid('La solicitud de Google no es válida.');
    if (!this.auth.options().google) throw new HttpError(503, 'GOOGLE_UNAVAILABLE', 'El acceso con Google no está disponible ahora.');
    const context = intent === 'login' ? null : await this.sessions.required(request);
    const state = randomToken();
    const binding = randomToken();
    const nonce = randomToken();
    const pkce = await this.client.generateCodeVerifierAsync();
    await this.repository.transaction(async client => {
      if (context) {
        const user = await this.repository.user(context.user.id, client, true);
        await this.sessions.assertCurrent(client, context);
        if (!user) throw new HttpError(401, 'SESSION_REQUIRED', 'Vuelve a entrar.');
        if (intent === 'link') {
          if (user.google_email) throw new HttpError(409, 'GOOGLE_ALREADY_LINKED', 'Tu cuenta ya tiene Google vinculado.');
          await this.auth.confirmIdentity(user, fields.currentPassword, context);
        } else if (!user.google_email) {
          throw new HttpError(409, 'GOOGLE_NOT_LINKED', 'Tu cuenta no tiene Google vinculado.');
        }
      }
      await client.query(`INSERT INTO auth_google_flows(state_hash,binding_hash,nonce,code_verifier,intent,user_id,session_id,return_to,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_TIMESTAMP + INTERVAL '10 minutes')`,
      [tokenHash(state), tokenHash(binding), nonce, pkce.codeVerifier, intent, context?.user.id ?? null, context?.sessionId ?? null, returnTarget(fields.returnTo)]);
    });
    if (intent === 'login') this.clearSignupCookie(response);
    response.cookie(this.cookieName, binding, {
      httpOnly: true, secure: this.sessions.config.secureCookies, sameSite: 'lax',
      path: '/', maxAge: 10 * 60000,
    });
    const url = new URL(this.client.generateAuthUrl({
      scope: ['openid', 'email', 'profile'], state,
      code_challenge: pkce.codeChallenge, code_challenge_method: CodeChallengeMethod.S256,
      prompt: 'select_account', access_type: 'online',
    }));
    url.searchParams.set('nonce', nonce);
    if (intent === 'reauth') url.searchParams.set('max_age', '0');
    return { url: url.toString() };
  }
  async callback(query: Record<string, unknown>, request: AuthRequest) {
    const state = typeof query.state === 'string' ? query.state : '';
    const binding = cookieValue(request, this.cookieName) ?? '';
    if (!/^[\w-]{43}$/.test(state) || !/^[\w-]{43}$/.test(binding)) throw new HttpError(400, 'GOOGLE_FLOW_EXPIRED', 'Vuelve a iniciar el acceso con Google.');
    const result = await this.repository.database.query<GoogleFlow>(`
      DELETE FROM auth_google_flows WHERE state_hash = $1 AND binding_hash = $2
      AND expires_at > CURRENT_TIMESTAMP RETURNING *`, [tokenHash(state), tokenHash(binding)]);
    const flow = result.rows[0];
    if (!flow) throw new HttpError(400, 'GOOGLE_FLOW_EXPIRED', 'Vuelve a iniciar el acceso con Google.');
    try {
      if (query.error) throw new HttpError(400, 'GOOGLE_CANCELLED', 'No se completó el acceso con Google.');
      const code = typeof query.code === 'string' ? query.code : '';
      if (!code || code.length > 4096) throw new HttpError(400, 'GOOGLE_FAILED', 'No pudimos completar el acceso con Google.');
      const tokenResult = await this.client.getToken({ code, codeVerifier: flow.code_verifier, redirect_uri: this.sessions.config.google.callbackUrl });
      const idToken = tokenResult.tokens.id_token;
      if (!idToken) throw new HttpError(400, 'GOOGLE_FAILED', 'Google no confirmó tu identidad.');
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.sessions.config.google.clientId });
      const payload = ticket.getPayload();
      const nonce = payload && 'nonce' in payload ? payload.nonce : undefined;
      if (!payload || typeof nonce !== 'string' || !equalSecret(nonce, flow.nonce)
        || payload.email_verified !== true || !payload.email || !payload.sub) {
        throw new HttpError(400, 'GOOGLE_FAILED', 'Google no confirmó una cuenta de correo verificada.');
      }
      const email = validate.email(payload.email);
      const cleanName = (value: string | undefined, maximum: number) => Array.from(value || '').filter(character => {
        const point = character.codePointAt(0) ?? 0;
        return point >= 32 && point !== 127;
      }).join('').trim().slice(0, maximum);
      const displayName = cleanName(payload.name, 32) || 'Miembro';
      const context = flow.intent === 'login' ? null : await this.sessions.required(request);
      const result = await this.repository.transaction(async client => {
        await this.repository.lockKey(client, 'google:' + payload.sub);
        const identity = (await client.query<{ user_id: string }>('SELECT user_id FROM user_google_identities WHERE subject = $1', [payload.sub])).rows[0];
        if (flow.intent !== 'login') {
          if (!context || flow.user_id !== context.user.id || flow.session_id !== context.sessionId) throw new HttpError(401, 'SESSION_REQUIRED', 'Vuelve a entrar antes de vincular Google.');
          const user = await this.repository.user(context.user.id, client, true);
          await this.sessions.assertCurrent(client, context);
          if (!user) throw new HttpError(401, 'SESSION_REQUIRED', 'Vuelve a entrar.');
          if (flow.intent === 'reauth') {
            if (!identity || identity.user_id !== user.id) throw new HttpError(409, 'GOOGLE_IDENTITY_MISMATCH', 'Elige la cuenta de Google vinculada a tu perfil.');
            await client.query('DELETE FROM auth_sessions WHERE id = $1', [context.sessionId]);
            return { grant: await this.sessions.issue(client, user.id) };
          }
          if (identity && identity.user_id !== user.id) throw new HttpError(409, 'GOOGLE_IN_USE', 'Esta cuenta de Google ya está vinculada a otro perfil.');
          if (user.google_email) throw new HttpError(409, 'GOOGLE_ALREADY_LINKED', 'Ya tienes Google vinculado.');
          await client.query('INSERT INTO user_google_identities(user_id,subject,email) VALUES($1,$2,$3)', [user.id, payload.sub, email]);
          await this.otp.invalidateUser(client, user.id);
          return { grant: await this.sessions.issue(client, user.id, true) };
        }
        if (identity) {
          const user = await this.repository.user(identity.user_id, client, true);
          if (!user?.email_verified_at) throw new HttpError(401, 'GOOGLE_FAILED', 'No pudimos abrir esta cuenta.');
          await client.query('UPDATE user_google_identities SET email = $2 WHERE user_id = $1', [user.id, email]);
          return { grant: await this.sessions.issue(client, user.id) };
        }
        // Coincidir por correo no autoriza la fusión ni el acceso a una cuenta local.
        if (await this.repository.byEmail(email, client)) throw new HttpError(409, 'GOOGLE_ACCOUNT_EXISTS', 'Ya existe una cuenta con ese correo. Entra primero y vincula Google desde tu perfil.');
        const signup: GoogleSignup = { subject: payload.sub, email, displayName,
          givenName: cleanName(payload.given_name, 80), familyName: cleanName(payload.family_name, 80),
          returnTo: returnTarget(flow.return_to), expiresAt: Date.now() + signupLifetime };
        return { signup };
      });
      return { ...result, intent: flow.intent, returnTo: returnTarget(flow.return_to) };
    } catch (cause) {
      throw new GoogleCallbackError(cause, flow.return_to);
    }
  }
}
