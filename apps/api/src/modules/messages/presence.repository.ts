import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Presence } from '@messages/contracts';
import { APP_CONFIG } from '../../config/app-config.js';
import type { AppConfig } from '../../config/app-config.js';
import { DatabaseService } from '../../database/database.service.js';
import { HttpError } from '../../common/errors/http-error.js';
import type { SqlClient } from '../auth/auth.types.js';
import { PresenceIdentityService } from './presence-identity.service.js';
import type { PresenceIdentity } from './presence-identity.service.js';

export const PRESENCE_LEASE_SECONDS = 90;
export const PRESENCE_REFRESH_MS = 30000;
export const unavailablePresence = (): Presence => ({ status: 'unavailable', accounts: null, guestBrowsers: null, observedAt: null, leaseSeconds: PRESENCE_LEASE_SECONDS });

@Injectable()
export class PresenceRepository {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(PresenceIdentityService) private readonly identities: PresenceIdentityService,
    @Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async acquire(identity: PresenceIdentity): Promise<string> {
    return this.db.transaction(async client => {
      await client.query("SET LOCAL statement_timeout = '2500ms'");
      await client.query("SET LOCAL lock_timeout = '1500ms'");
      const scope = this.identities.scope;
      await client.query('INSERT INTO chat_presence_rooms(scope) VALUES($1) ON CONFLICT DO NOTHING', [scope]);
      await client.query('SELECT scope FROM chat_presence_rooms WHERE scope=$1 FOR UPDATE', [scope]);
      await client.query('DELETE FROM chat_presence_leases WHERE scope=$1 AND expires_at<=CURRENT_TIMESTAMP', [scope]);
      const counts = (await client.query<{ total: string; per_ip: string }>(`SELECT COUNT(*)::text AS total,
        COUNT(CASE WHEN ip_key=$2 THEN 1 END)::text AS per_ip FROM chat_presence_leases WHERE scope=$1`, [scope, identity.ipKey])).rows[0];
      if (BigInt(counts.total) >= BigInt(this.config.events.maxConnections)
        || (identity.ipKey && BigInt(counts.per_ip) >= BigInt(this.config.events.maxPerIp))) {
        throw new HttpError(429, 'CONNECTION_LIMIT', 'Hay demasiadas conexiones. Cierra otra pestaña y vuelve a intentar.');
      }
      if (identity.kind === 'account') {
        const valid = await client.query(`SELECT s.id FROM auth_sessions s JOIN users u ON u.id=s.user_id
          WHERE s.id=$1 AND s.user_id=$2 AND s.expires_at>CURRENT_TIMESTAMP AND u.email_verified_at IS NOT NULL`, [identity.sessionId, identity.userId]);
        if (!valid.rows.length) throw new HttpError(401, 'SESSION_REQUIRED', 'Tu sesión terminó. Vuelve a entrar.');
      }
      const id = randomUUID();
      await client.query(`INSERT INTO chat_presence_leases(id,scope,browser_key,ip_key,kind,user_id,session_id,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP+INTERVAL '90 seconds')`,
      [id, scope, identity.browserKey, identity.ipKey, identity.kind, identity.userId, identity.sessionId]);
      return id;
    });
  }

  async refresh(ids: string[]): Promise<{ presence: Presence; renewed: Set<string> }> {
    return this.db.transaction(async client => {
      await client.query("SET LOCAL statement_timeout = '2500ms'");
      await client.query("SET LOCAL lock_timeout = '1500ms'");
      // Una concesión vencida nunca resucita: el stream debe registrarse otra vez.
      const result = await client.query<{ id: string }>(`UPDATE chat_presence_leases l SET expires_at=CURRENT_TIMESTAMP+INTERVAL '90 seconds'
        WHERE l.scope=$1 AND l.id=ANY($2::uuid[]) AND l.expires_at>CURRENT_TIMESTAMP AND
        (l.kind<>'account' OR EXISTS (SELECT 1 FROM auth_sessions s JOIN users u ON u.id=s.user_id
          WHERE s.id=l.session_id AND s.user_id=l.user_id AND s.expires_at>CURRENT_TIMESTAMP AND u.email_verified_at IS NOT NULL)) RETURNING l.id`,
      [this.identities.scope, ids]);
      return { presence: await this.snapshot(client), renewed: new Set(result.rows.map(row => row.id)) };
    });
  }

  async snapshot(client: SqlClient = this.db): Promise<Presence> {
    const row = (await client.query<{ accounts: string; guests: string; unknown: string; observed_at: Date }>(`WITH active AS (
        SELECT l.* FROM chat_presence_leases l WHERE l.scope=$1 AND l.expires_at>CURRENT_TIMESTAMP
        AND (l.kind<>'account' OR EXISTS (SELECT 1 FROM auth_sessions s JOIN users u ON u.id=s.user_id
          WHERE s.id=l.session_id AND s.user_id=l.user_id AND s.expires_at>CURRENT_TIMESTAMP AND u.email_verified_at IS NOT NULL))
      ) SELECT CURRENT_TIMESTAMP AS observed_at,
        (SELECT COUNT(DISTINCT user_id)::text FROM active WHERE kind='account') AS accounts,
        (SELECT COUNT(DISTINCT g.browser_key)::text FROM active g WHERE g.kind='guest'
          AND NOT EXISTS (SELECT 1 FROM active a WHERE a.kind='account' AND a.browser_key=g.browser_key)) AS guests,
        (SELECT COUNT(*)::text FROM active WHERE kind='unknown') AS unknown`, [this.identities.scope])).rows[0];
    if (!row || BigInt(row.unknown) > 0n) return unavailablePresence();
    const accounts = Number(row.accounts); const guestBrowsers = Number(row.guests);
    if (![accounts, guestBrowsers].every(value => Number.isSafeInteger(value) && value >= 0)) return unavailablePresence();
    return { status: 'available', accounts, guestBrowsers, observedAt: new Date(row.observed_at).toISOString(), leaseSeconds: PRESENCE_LEASE_SECONDS };
  }

  async release(id: string): Promise<void> {
    await this.db.query('DELETE FROM chat_presence_leases WHERE id=$1 AND scope=$2', [id, this.identities.scope]);
  }
}
