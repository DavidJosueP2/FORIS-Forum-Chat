import { Inject, Injectable } from '@nestjs/common';
import { randomInt, randomUUID } from 'node:crypto';
import type { OtpChallenge, OtpPurpose } from '@messages/contracts';
import { APP_CONFIG } from '../../config/app-config.js';
import type { AppConfig } from '../../config/app-config.js';
import { readAuthConfig } from '../../config/auth-config.js';
import { HttpError } from '../../common/errors/http-error.js';
import { AuthRepository } from './auth.repository.js';
import { AuthMailService } from './auth-mail.service.js';
import { equalSecret, keyedHash } from './auth-crypto.js';
import type { AuthContext, OtpRow, SqlClient } from './auth.types.js';

@Injectable()
export class OtpService {
  private readonly config;
  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    @Inject(AuthRepository) private readonly repository: AuthRepository,
    @Inject(AuthMailService) private readonly mail: AuthMailService,
  ) { this.config = config.auth ?? readAuthConfig({}); }

  private digest(id: string, purpose: string, code: string): string {
    return keyedHash(this.config.secret, 'otp', id, purpose, code);
  }
  private view(row: OtpRow): OtpChallenge {
    return {
      challengeId: row.id, expiresAt: new Date(row.expires_at).toISOString(),
      resendAt: new Date(new Date(row.last_sent_at).getTime() + 60000).toISOString(),
      message: 'Si la solicitud corresponde a tu cuenta, recibirás un código en el correo indicado.',
    };
  }
  private async rateLimit(client: SqlClient, email: string, purpose: OtpPurpose) {
    await this.repository.lockKey(client, 'otp:' + purpose + ':' + email);
    const result = await client.query<{ total: string; latest: Date | null }>(`
      SELECT COALESCE(SUM(send_count),0)::text AS total, MAX(last_sent_at) AS latest
      FROM auth_otp_challenges WHERE email = $1 AND purpose = $2
      AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'`, [email, purpose]);
    const row = result.rows[0];
    if (Number(row.total) >= 5 || (row.latest && Date.now() - new Date(row.latest).getTime() < 60000)) {
      throw new HttpError(429, 'OTP_RATE_LIMIT', 'Espera antes de pedir otro código. Puedes solicitar hasta cinco por hora.');
    }
  }
  async issue(
    client: SqlClient, userId: string | null, email: string, purpose: OtpPurpose,
    payload: Record<string, unknown> = {}, deliver = true,
  ): Promise<OtpChallenge> {
    this.mail.requireEnabled();
    if (userId) await this.repository.user(userId, client, true);
    await this.rateLimit(client, email, purpose);
    await client.query(`DELETE FROM auth_mail_outbox WHERE challenge_id IN (
      SELECT id FROM auth_otp_challenges WHERE email = $1 AND purpose = $2 AND consumed_at IS NULL
    )`, [email, purpose]);
    await client.query('UPDATE auth_otp_challenges SET consumed_at = CURRENT_TIMESTAMP WHERE email = $1 AND purpose = $2 AND consumed_at IS NULL', [email, purpose]);
    const id = randomUUID();
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    const result = await client.query<OtpRow>(`
      INSERT INTO auth_otp_challenges(id,user_id,email,purpose,code_digest,payload,expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP + INTERVAL '10 minutes') RETURNING *`,
    [id, userId, email, purpose, this.digest(id, purpose, code), JSON.stringify({ ...payload, deliver })]);
    const row = result.rows[0];
    if (deliver) await this.mail.queueCode(client, email, code, purpose, id, row.expires_at);
    return this.view(row);
  }
  async resend(id: string, actor?: AuthContext): Promise<OtpChallenge> {
    return this.repository.transaction(async client => {
      const snapshot = await client.query<OtpRow>('SELECT * FROM auth_otp_challenges WHERE id = $1', [id]);
      const initial = snapshot.rows[0];
      if (!initial) throw this.invalid();
      if (initial.user_id) await this.repository.user(initial.user_id, client, true);
      await this.rateLimit(client, initial.email, initial.purpose);
      const result = await client.query<OtpRow>('SELECT * FROM auth_otp_challenges WHERE id = $1 FOR UPDATE', [id]);
      const row = result.rows[0];
      if (!row || row.consumed_at || Date.now() - new Date(row.created_at).getTime() > 30 * 60000
        || (row.payload.sessionId && (row.user_id !== actor?.user.id || row.payload.sessionId !== actor?.sessionId))) throw this.invalid();
      if (row.payload.sessionId) {
        const session = await client.query('SELECT id FROM auth_sessions WHERE id = $1 AND user_id = $2 AND expires_at > CURRENT_TIMESTAMP', [row.payload.sessionId, row.user_id]);
        if (!session.rows[0]) throw this.invalid();
      }
      const code = String(randomInt(0, 1000000)).padStart(6, '0');
      await client.query('DELETE FROM auth_mail_outbox WHERE challenge_id = $1', [id]);
      const updated = await client.query<OtpRow>(`UPDATE auth_otp_challenges SET code_digest = $2,
        expires_at = CURRENT_TIMESTAMP + INTERVAL '10 minutes', attempts = 0,
        last_sent_at = CURRENT_TIMESTAMP, send_count = send_count + 1 WHERE id = $1 RETURNING *`,
      [id, this.digest(id, row.purpose, code)]);
      if (row.payload.deliver === true) await this.mail.queueCode(client, row.email, code, row.purpose, id, updated.rows[0].expires_at);
      return this.view(updated.rows[0]);
    });
  }
  async consume<T>(
    id: string, code: string, purpose: OtpPurpose, actor: AuthContext | undefined,
    apply: (client: SqlClient, row: OtpRow) => Promise<T>,
  ): Promise<T> {
    const result = await this.repository.transaction(async client => {
      const initial = (await client.query<OtpRow>('SELECT * FROM auth_otp_challenges WHERE id = $1', [id])).rows[0];
      if (initial?.user_id) await this.repository.user(initial.user_id, client, true);
      const row = (await client.query<OtpRow>('SELECT * FROM auth_otp_challenges WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!row || row.purpose !== purpose || row.consumed_at || row.attempts >= 5
        || new Date(row.expires_at).getTime() <= Date.now()
        || (row.payload.sessionId && (row.user_id !== actor?.user.id || row.payload.sessionId !== actor?.sessionId))) return { ok: false as const };
      if (!equalSecret(row.code_digest, this.digest(id, purpose, code)) || !row.user_id) {
        await client.query(`UPDATE auth_otp_challenges SET attempts = attempts + 1,
          consumed_at = CASE WHEN attempts + 1 >= 5 THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id = $1`, [id]);
        return { ok: false as const };
      }
      await client.query('UPDATE auth_otp_challenges SET consumed_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
      const value = await apply(client, row);
      await client.query('DELETE FROM auth_mail_outbox WHERE challenge_id = $1', [id]);
      return { ok: true as const, value };
    });
    if (!result.ok) throw this.invalid();
    return result.value;
  }
  async invalidateUser(client: SqlClient, id: string): Promise<void> {
    await client.query('DELETE FROM auth_mail_outbox WHERE challenge_id IN (SELECT id FROM auth_otp_challenges WHERE user_id = $1)', [id]);
    await client.query('UPDATE auth_otp_challenges SET consumed_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND consumed_at IS NULL', [id]);
  }
  private invalid(): HttpError { return new HttpError(400, 'OTP_INVALID', 'El código no es válido, ha caducado o ya se utilizó. Solicita otro si hace falta.'); }
}
