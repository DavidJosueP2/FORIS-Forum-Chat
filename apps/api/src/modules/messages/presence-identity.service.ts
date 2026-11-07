import { Inject, Injectable } from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';
import { APP_CONFIG } from '../../config/app-config.js';
import type { AppConfig } from '../../config/app-config.js';
import type { AuthRequest } from '../auth/auth.types.js';
import { cookieValue, SessionService } from '../auth/session.service.js';

export interface PresenceIdentity {
  kind: 'account' | 'guest' | 'unknown'; browserKey: string | null; ipKey: string | null;
  userId: string | null; sessionId: string | null;
}

@Injectable()
export class PresenceIdentityService {
  readonly scope: string;
  readonly cookieName: string;
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig, @Inject(SessionService) private readonly sessions: Pick<SessionService, 'optional' | 'hasCookie'>) {
    this.scope = createHash('sha256').update(JSON.stringify([config.auth?.origin, config.events.presenceNamespace])).digest('hex');
    this.cookieName = config.auth?.secureCookies ? '__Host-foris_presence' : 'foris_presence';
  }
  private digest(value: string): string {
    return createHmac('sha256', this.config.auth?.secret ?? '').update('foris-presence-v1|' + this.scope + '|' + value).digest('hex');
  }
  browser(request: AuthRequest): string | null {
    if (!this.config.auth?.secret) return null;
    const value = cookieValue(request, this.cookieName);
    if (!value || value.length > 160) return null;
    const match = /^(\d{10})\.([A-Za-z0-9_-]{43})\.([a-f0-9]{64})$/u.exec(value);
    if (!match || Number(match[1]) <= Math.floor(Date.now() / 1000)) return null;
    const expected = this.digest('cookie|' + match[1] + '.' + match[2]);
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(match[3]))) return null;
    return this.digest('browser|' + match[2]);
  }
  /** No devuelve el identificador al JavaScript ni lo acepta del cuerpo/query. */
  bootstrap(request: AuthRequest, response: Response): { ready: boolean } {
    if (!this.config.auth?.secret) return { ready: false };
    if (!this.browser(request)) {
      const value = Math.floor(Date.now() / 1000 + 30 * 86400) + '.' + randomBytes(32).toString('base64url');
      response.cookie(this.cookieName, value + '.' + this.digest('cookie|' + value), {
        httpOnly: true, secure: this.config.auth.secureCookies, sameSite: 'strict', path: '/', maxAge: 30 * 86400 * 1000,
      });
    }
    return { ready: true };
  }
  async resolve(request: AuthRequest): Promise<PresenceIdentity> {
    const browserKey = this.browser(request);
    const ipKey = request.ip && this.config.auth?.secret ? this.digest('ip|' + request.ip) : null;
    const actor = await this.sessions.optional(request);
    if (actor) return { kind: 'account', browserKey, ipKey, userId: actor.user.id, sessionId: actor.sessionId };
    // Una cookie de sesión inválida nunca se convierte silenciosamente en una cuenta.
    const kind = browserKey && !this.sessions.hasCookie(request) ? 'guest' : 'unknown';
    return { kind, browserKey, ipKey, userId: null, sessionId: null };
  }
}
