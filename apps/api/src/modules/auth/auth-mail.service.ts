import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { APP_CONFIG, APP_LOGGER } from '../../config/app-config.js';
import type { AppConfig, AppLogger } from '../../config/app-config.js';
import { readAuthConfig } from '../../config/auth-config.js';
import { resolveMailSender } from '../../config/mail-sender.js';
import { HttpError } from '../../common/errors/http-error.js';
import { AuthRepository } from './auth.repository.js';
import { seal, unseal } from './auth-crypto.js';
import type { SqlClient } from './auth.types.js';

interface MailJob { to: string; subject: string; text: string }
@Injectable()
export class AuthMailService implements OnModuleInit, OnApplicationShutdown {
  private readonly config;
  private readonly sender;
  private transport: Transporter | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private busy = false;

  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    @Inject(AuthRepository) private readonly repository: AuthRepository,
    @Inject(APP_LOGGER) private readonly logger: AppLogger,
  ) {
    this.config = config.auth ?? readAuthConfig({});
    this.sender = resolveMailSender(this.config.mail);
  }

  get enabled(): boolean {
    const { mail, secret } = this.config;
    return Boolean(secret && mail.host && mail.user && mail.password && this.sender);
  }
  requireEnabled(): void {
    if (!this.enabled) throw new HttpError(503, 'MAIL_UNAVAILABLE', 'El envío de códigos no está disponible ahora. Inténtalo más tarde.');
  }
  onModuleInit(): void {
    if (!this.enabled) return;
    const mail = this.config.mail;
    this.transport = nodemailer.createTransport({
      host: mail.host, port: mail.port, secure: mail.secure, requireTLS: !mail.secure,
      auth: { user: mail.user, pass: mail.password },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
      disableFileAccess: true, disableUrlAccess: true,
    });
    this.timer = setInterval(() => { void this.deliver(); }, 3000);
    this.timer.unref();
  }
  onApplicationShutdown(): void { clearInterval(this.timer); this.transport?.close(); }

  async queue(client: SqlClient, job: MailJob, challengeId: string | null, expiresAt: Date): Promise<void> {
    this.requireEnabled();
    await client.query(
      'INSERT INTO auth_mail_outbox(id, challenge_id, encrypted_payload, expires_at) VALUES ($1,$2,$3,$4)',
      [randomUUID(), challengeId, seal(this.config.secret, job), expiresAt],
    );
  }
  async queueCode(client: SqlClient, email: string, code: string, purpose: string, id: string, expiry: Date): Promise<void> {
    const labels: Record<string, string> = {
      verify_email: 'Verifica tu cuenta', reset_password: 'Recupera tu contraseña',
      change_password: 'Cambia tu contraseña', change_email: 'Confirma tu nuevo correo',
    };
    await this.queue(client, {
      to: email, subject: labels[purpose] + ' en Foris',
      text: labels[purpose] + '\n\nTu código es: ' + code
        + '\n\nCaduca en 10 minutos y solo puede usarse una vez. Si solicitaste otro, usa el más reciente.'
        + '\nNo compartas este código. Si no solicitaste este cambio, ignora este correo.\n\nForis',
    }, id, expiry);
  }
  private async deliver(): Promise<void> {
    if (this.busy || !this.transport || !this.sender) return;
    this.busy = true;
    try {
      const { rows } = await this.repository.database.query<{
        id: string; encrypted_payload: string; attempts: number;
      }>(`UPDATE auth_mail_outbox SET locked_until = CURRENT_TIMESTAMP + INTERVAL '60 seconds', attempts = attempts + 1
        WHERE id = (
          SELECT id FROM auth_mail_outbox WHERE available_at <= CURRENT_TIMESTAMP
          AND expires_at > CURRENT_TIMESTAMP AND (locked_until IS NULL OR locked_until < CURRENT_TIMESTAMP)
          AND (challenge_id IS NULL OR EXISTS (
            SELECT 1 FROM auth_otp_challenges c WHERE c.id = challenge_id
            AND c.consumed_at IS NULL AND c.expires_at > CURRENT_TIMESTAMP
          )) ORDER BY available_at LIMIT 1 FOR UPDATE SKIP LOCKED
        ) RETURNING id, encrypted_payload, attempts`);
      const job = rows[0];
      if (job) {
        try {
          const data = unseal(this.config.secret, job.encrypted_payload) as MailJob;
          await this.transport.sendMail({ from: this.sender, to: data.to, subject: data.subject, text: data.text });
          await this.repository.database.query('DELETE FROM auth_mail_outbox WHERE id = $1', [job.id]);
        } catch (error) {
          this.logger.error('auth_mail_delivery_failed', { type: error instanceof Error ? error.name : 'UnknownError' });
          await this.repository.database.query(
            `UPDATE auth_mail_outbox SET locked_until = NULL,
            available_at = CURRENT_TIMESTAMP + ($2 * INTERVAL '1 second') WHERE id = $1`,
            [job.id, Math.min(120, 10 * job.attempts)],
          );
        }
      }
      await this.repository.database.query('DELETE FROM auth_mail_outbox WHERE expires_at < CURRENT_TIMESTAMP');
      await this.repository.database.query(`DELETE FROM auth_otp_challenges WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 day'`);
      await this.repository.database.query('DELETE FROM auth_google_flows WHERE expires_at < CURRENT_TIMESTAMP');
      await this.repository.database.query('DELETE FROM auth_sessions WHERE expires_at < CURRENT_TIMESTAMP');
      await this.repository.database.query(`DELETE FROM auth_login_attempts WHERE window_start < CURRENT_TIMESTAMP - INTERVAL '1 day'`);
    } catch (error) {
      this.logger.error('auth_mail_worker_failed', { type: error instanceof Error ? error.name : 'UnknownError' });
    } finally { this.busy = false; }
  }
}
