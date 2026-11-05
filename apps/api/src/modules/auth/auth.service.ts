import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { APP_CONFIG } from '../../config/app-config.js';
import type { AppConfig } from '../../config/app-config.js';
import { readAuthConfig } from '../../config/auth-config.js';
import { HttpError } from '../../common/errors/http-error.js';
import { AuthRepository, accountUser } from './auth.repository.js';
import { AuthMailService } from './auth-mail.service.js';
import { OtpService } from './otp.service.js';
import { SessionService } from './session.service.js';
import { hashPassword, keyedHash, verifyPassword } from './auth-crypto.js';
import * as validate from './auth-validation.js';
import type { AuthContext, AuthUserRow, SqlClient } from './auth.types.js';

@Injectable()
export class AuthService {
  private readonly config;
  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    @Inject(AuthRepository) private readonly repository: AuthRepository,
    @Inject(AuthMailService) private readonly mail: AuthMailService,
    @Inject(OtpService) private readonly otp: OtpService,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) { this.config = config.auth ?? readAuthConfig({}); }

  options() {
    const enabled = Boolean(this.config.secret);
    return { enabled, google: enabled && Boolean(this.config.google.clientId), emailDelivery: this.mail.enabled };
  }
  async register(body: unknown) {
    this.sessions.requireEnabled();
    this.mail.requireEnabled();
    const fields = validate.record(body, ['email', 'password', 'displayName']);
    const email = validate.email(fields.email);
    const displayName = validate.text(fields.displayName, 'El nombre visible', 32);
    const passwordHash = await hashPassword(validate.password(fields.password));
    return this.repository.transaction(async client => {
      await client.query(`INSERT INTO users(id,email,display_name,password_hash)
        VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING`, [randomUUID(), email, displayName, passwordHash]);
      const found = await this.repository.byEmail(email, client);
      if (!found) throw new HttpError(503, 'UNAVAILABLE', 'Inténtalo de nuevo.');
      const user = await this.repository.user(found.id, client, true);
      const eligible = user && !user.email_verified_at;
      // El hash elegido pertenece a esta solicitud; solo se aplica al demostrar el correo.
      return this.otp.issue(client, eligible ? user.id : null, email, 'verify_email',
        eligible ? { passwordHash, displayName } : {}, Boolean(eligible));
    });
  }
  async verifyEmail(body: unknown) {
    const fields = validate.challengeInput(body);
    return this.otp.consume(fields.challengeId, fields.code, 'verify_email', undefined, async (client, row) => {
      const user = await this.repository.user(row.user_id!, client, true);
      if (!user || user.email_verified_at || user.email !== row.email
        || typeof row.payload.passwordHash !== 'string' || typeof row.payload.displayName !== 'string') {
        throw new HttpError(400, 'OTP_INVALID', 'Esta solicitud ya no es válida.');
      }
      await client.query(`UPDATE users SET password_hash = $2, display_name = $3,
        email_verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [user.id, row.payload.passwordHash, row.payload.displayName]);
      await this.otp.invalidateUser(client, user.id);
      return this.sessions.issue(client, user.id, true);
    });
  }
  async login(body: unknown) {
    this.sessions.requireEnabled();
    const fields = validate.record(body, ['email', 'password']);
    const email = validate.email(fields.email);
    const password = validate.password(fields.password, false);
    const key = keyedHash(this.config.secret, 'login', email);
    const result = await this.repository.transaction(async client => {
      await this.repository.lockKey(client, 'login:' + key);
      const throttle = (await client.query<{ failures: number; window_start: Date }>('SELECT failures,window_start FROM auth_login_attempts WHERE email_hash = $1', [key])).rows[0];
      if (throttle && Date.now() - new Date(throttle.window_start).getTime() < 15 * 60000 && throttle.failures >= 10) {
        return { error: 'limited' as const };
      }
      const found = await this.repository.byEmail(email, client);
      const user = found ? await this.repository.user(found.id, client, true) : undefined;
      const valid = await verifyPassword(password, user?.password_hash ?? null);
      if (!user || !valid) {
        await client.query(`INSERT INTO auth_login_attempts(email_hash,failures) VALUES($1,1)
          ON CONFLICT(email_hash) DO UPDATE SET
          failures = CASE WHEN auth_login_attempts.window_start < CURRENT_TIMESTAMP - INTERVAL '15 minutes' THEN 1 ELSE auth_login_attempts.failures + 1 END,
          window_start = CASE WHEN auth_login_attempts.window_start < CURRENT_TIMESTAMP - INTERVAL '15 minutes' THEN CURRENT_TIMESTAMP ELSE auth_login_attempts.window_start END`, [key]);
        return { error: 'invalid' as const };
      }
      await client.query('DELETE FROM auth_login_attempts WHERE email_hash = $1', [key]);
      if (!user.email_verified_at) {
        const challenge = await this.otp.issue(client, user.id, user.email, 'verify_email', { passwordHash: user.password_hash, displayName: user.display_name });
        return { challenge };
      }
      return { grant: await this.sessions.issue(client, user.id) };
    });
    if ('error' in result) {
      if (result.error === 'limited') throw new HttpError(429, 'LOGIN_RATE_LIMIT', 'Espera 15 minutos antes de volver a intentar con este correo.');
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'El correo o la contraseña no coinciden.');
    }
    return result;
  }
  async forgotPassword(body: unknown) {
    this.sessions.requireEnabled();
    const fields = validate.record(body, ['email']);
    const email = validate.email(fields.email);
    return this.repository.transaction(async client => {
      const found = await this.repository.byEmail(email, client);
      return this.otp.issue(client, found?.id ?? null, email, 'reset_password', {}, Boolean(found));
    });
  }
  async resetPassword(body: unknown) {
    const fields = validate.challengeInput(body, ['newPassword']);
    const password = validate.password(fields.newPassword);
    await this.otp.consume(fields.challengeId, fields.code, 'reset_password', undefined, async (client, row) => {
      const user = await this.repository.user(row.user_id!, client, true);
      if (!user || user.email !== row.email) throw new HttpError(400, 'OTP_INVALID', 'Esta solicitud ya no es válida.');
      await client.query(`UPDATE users SET password_hash = $2, email_verified_at = COALESCE(email_verified_at,CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [user.id, await hashPassword(password)]);
      await client.query('DELETE FROM auth_sessions WHERE user_id = $1', [user.id]);
      await client.query('DELETE FROM auth_login_attempts WHERE email_hash = $1', [keyedHash(this.config.secret, 'login', user.email)]);
      await this.otp.invalidateUser(client, user.id);
    });
    return { message: 'Contraseña actualizada. Entra con tu nueva contraseña.' };
  }
  private async lockedUser(client: SqlClient, context: AuthContext): Promise<AuthUserRow> {
    const user = await this.repository.user(context.user.id, client, true);
    await this.sessions.assertCurrent(client, context);
    if (!user?.email_verified_at) throw new HttpError(401, 'SESSION_REQUIRED', 'Vuelve a entrar.');
    return user;
  }
  async confirmIdentity(user: AuthUserRow, currentPassword: unknown, context: AuthContext) {
    if (user.password_hash) {
      if (!await verifyPassword(validate.password(currentPassword, false), user.password_hash)) {
        throw new HttpError(401, 'PASSWORD_INCORRECT', 'Tu contraseña actual no coincide.');
      }
    } else if (Date.now() - context.authenticatedAt.getTime() > 10 * 60000) {
      throw new HttpError(403, 'REAUTH_REQUIRED', 'Confirma tu identidad con Google antes de continuar.');
    }
  }
  async updateProfile(body: unknown, context: AuthContext) {
    const fields = validate.record(body, ['displayName', 'givenName', 'familyName', 'bio']);
    const displayName = validate.text(fields.displayName, 'El nombre visible', 32);
    const givenName = validate.text(fields.givenName, 'Los nombres', 80, true);
    const familyName = validate.text(fields.familyName, 'Los apellidos', 80, true);
    const bio = validate.text(fields.bio, 'La presentación', 280, true, true);
    return this.repository.transaction(async client => {
      await this.lockedUser(client, context);
      await client.query(`UPDATE users SET display_name = $2, given_name = $3, family_name = $4,
        bio = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [context.user.id, displayName, givenName, familyName, bio]);
      return accountUser((await this.repository.user(context.user.id, client))!);
    });
  }
  async requestPasswordChange(body: unknown, context: AuthContext) {
    const fields = validate.record(body, ['currentPassword']);
    return this.repository.transaction(async client => {
      const user = await this.lockedUser(client, context);
      await this.confirmIdentity(user, fields.currentPassword, context);
      return this.otp.issue(client, user.id, user.email, 'change_password', { sessionId: context.sessionId });
    });
  }
  async changePassword(body: unknown, context: AuthContext) {
    const fields = validate.challengeInput(body, ['newPassword']);
    const password = validate.password(fields.newPassword);
    return this.otp.consume(fields.challengeId, fields.code, 'change_password', context, async (client, row) => {
      const user = await this.lockedUser(client, context);
      if (user.email !== row.email) throw new HttpError(400, 'OTP_INVALID', 'Esta solicitud ya no es válida.');
      await client.query('UPDATE users SET password_hash = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id, await hashPassword(password)]);
      await this.otp.invalidateUser(client, user.id);
      return this.sessions.issue(client, user.id, true);
    });
  }
  async requestEmailChange(body: unknown, context: AuthContext) {
    const fields = validate.record(body, ['email', 'currentPassword']);
    const email = validate.email(fields.email);
    return this.repository.transaction(async client => {
      const user = await this.lockedUser(client, context);
      await this.confirmIdentity(user, fields.currentPassword, context);
      if (email === user.email || await this.repository.byEmail(email, client)) {
        throw new HttpError(409, 'EMAIL_UNAVAILABLE', 'No podemos utilizar ese correo. Elige otro.');
      }
      return this.otp.issue(client, user.id, email, 'change_email', { sessionId: context.sessionId, previousEmail: user.email });
    });
  }
  async changeEmail(body: unknown, context: AuthContext) {
    const fields = validate.challengeInput(body);
    return this.otp.consume(fields.challengeId, fields.code, 'change_email', context, async (client, row) => {
      const user = await this.lockedUser(client, context);
      if (user.email !== row.payload.previousEmail || await this.repository.byEmail(row.email, client)) {
        throw new HttpError(409, 'EMAIL_UNAVAILABLE', 'No podemos utilizar ese correo. Solicita un cambio nuevo.');
      }
      try {
        await client.query('UPDATE users SET email = $2, email_verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id, row.email]);
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
          throw new HttpError(409, 'EMAIL_UNAVAILABLE', 'No podemos utilizar ese correo.');
        }
        throw error;
      }
      await this.otp.invalidateUser(client, user.id);
      return this.sessions.issue(client, user.id, true);
    });
  }
  async unlinkGoogle(body: unknown, context: AuthContext) {
    const fields = validate.record(body, ['currentPassword']);
    return this.repository.transaction(async client => {
      const user = await this.lockedUser(client, context);
      if (!user.password_hash) throw new HttpError(409, 'PASSWORD_REQUIRED', 'Crea una contraseña antes de desvincular Google para conservar el acceso.');
      await this.confirmIdentity(user, fields.currentPassword, context);
      await client.query('DELETE FROM user_google_identities WHERE user_id = $1', [user.id]);
      await this.otp.invalidateUser(client, user.id);
      return this.sessions.issue(client, user.id, true);
    });
  }
}
