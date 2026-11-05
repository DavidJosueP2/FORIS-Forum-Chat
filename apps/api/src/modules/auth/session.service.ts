import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import type { AuthSession } from '@messages/contracts';
import { APP_CONFIG } from '../../config/app-config.js';
import type { AppConfig } from '../../config/app-config.js';
import { readAuthConfig } from '../../config/auth-config.js';
import { HttpError } from '../../common/errors/http-error.js';
import { AuthRepository, accountUser } from './auth.repository.js';
import { randomToken, tokenHash } from './auth-crypto.js';
import type { AuthContext, AuthRequest, SqlClient } from './auth.types.js';

export interface SessionGrant { token: string; context: AuthContext }
export function cookieValue(request: Request, name: string): string | undefined {
  const values = (request.headers.cookie || '').split(';').map(value => value.trim());
  const item = values.find(value => value.startsWith(name + '='));
  if (!item) return undefined;
  try { return decodeURIComponent(item.slice(name.length + 1)); } catch { return undefined; }
}
@Injectable()
export class SessionService {
  readonly config;
  constructor(@Inject(APP_CONFIG) config: AppConfig, @Inject(AuthRepository) private readonly repository: AuthRepository) {
    this.config = config.auth ?? readAuthConfig({});
  }
  get cookieName(): string { return this.config.secureCookies ? '__Host-foris_session' : 'foris_session'; }
  hasCookie(request: AuthRequest): boolean { return cookieValue(request, this.cookieName) !== undefined; }
  requireEnabled(): void {
    if (!this.config.secret) throw new HttpError(503, 'AUTH_UNAVAILABLE', 'El acceso a cuentas no está disponible ahora.');
  }
  async optional(request: AuthRequest): Promise<AuthContext | null> {
    if (request.auth) return request.auth;
    const token = cookieValue(request, this.cookieName);
    if (!token || !/^[\w-]{43}$/.test(token) || !this.config.secret) return null;
    const result = await this.repository.database.query<{
      id: string; user_id: string; authenticated_at: Date; expires_at: Date;
    }>('SELECT id,user_id,authenticated_at,expires_at FROM auth_sessions WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP', [tokenHash(token)]);
    const row = result.rows[0];
    if (!row) return null;
    const user = await this.repository.user(row.user_id);
    if (!user?.email_verified_at) return null;
    const context: AuthContext = {
      user: accountUser(user), sessionId: row.id,
      authenticatedAt: new Date(row.authenticated_at), expiresAt: new Date(row.expires_at),
    };
    request.auth = context;
    return context;
  }
  async required(request: AuthRequest): Promise<AuthContext> {
    const context = await this.optional(request);
    if (!context) throw new HttpError(401, 'SESSION_REQUIRED', 'Inicia sesión para continuar.');
    return context;
  }
  async assertCurrent(client: SqlClient, context: AuthContext): Promise<void> {
    const result = await client.query('SELECT id FROM auth_sessions WHERE id = $1 AND user_id = $2 AND expires_at > CURRENT_TIMESTAMP', [context.sessionId, context.user.id]);
    if (!result.rows[0]) throw new HttpError(401, 'SESSION_REQUIRED', 'Tu sesión terminó. Vuelve a entrar.');
  }
  // El llamador mantiene el bloqueo de users para serializar cambios de credenciales.
  async issue(client: SqlClient, userId: string, revokeAll = false): Promise<SessionGrant> {
    this.requireEnabled();
    if (revokeAll) await client.query('DELETE FROM auth_sessions WHERE user_id = $1', [userId]);
    const token = randomToken();
    const result = await client.query<{ id: string; authenticated_at: Date; expires_at: Date }>(
      `INSERT INTO auth_sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,CURRENT_TIMESTAMP + INTERVAL '7 days')
      RETURNING id,authenticated_at,expires_at`, [randomUUID(), userId, tokenHash(token)]);
    await client.query(`DELETE FROM auth_sessions WHERE id IN (
      SELECT id FROM auth_sessions WHERE user_id = $1 AND id <> $2 ORDER BY created_at DESC, id DESC OFFSET 4
    )`, [userId, result.rows[0].id]);
    const user = await this.repository.user(userId, client);
    if (!user) throw new HttpError(401, 'SESSION_REQUIRED', 'Vuelve a entrar.');
    const row = result.rows[0];
    return { token, context: {
      user: accountUser(user), sessionId: row.id,
      authenticatedAt: new Date(row.authenticated_at), expiresAt: new Date(row.expires_at),
    } };
  }
  view(context: AuthContext | null): AuthSession {
    return { user: context?.user ?? null, expiresAt: context?.expiresAt.toISOString() ?? null, authenticatedAt: context?.authenticatedAt.toISOString() ?? null };
  }
  setCookie(response: Response, grant: SessionGrant): void {
    response.cookie(this.cookieName, grant.token, {
      httpOnly: true, secure: this.config.secureCookies, sameSite: 'lax',
      path: '/', expires: grant.context.expiresAt,
    });
  }
  clearCookie(response: Response): void {
    response.clearCookie(this.cookieName, { httpOnly: true, secure: this.config.secureCookies, sameSite: 'lax', path: '/' });
  }
  async logout(request: AuthRequest, response: Response): Promise<void> {
    const token = cookieValue(request, this.cookieName);
    if (token && /^[\w-]{43}$/.test(token)) await this.repository.database.query('DELETE FROM auth_sessions WHERE token_hash = $1', [tokenHash(token)]);
    this.clearCookie(response);
  }
}
