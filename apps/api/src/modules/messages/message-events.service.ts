import { Inject, Injectable } from '@nestjs/common';
import type { BeforeApplicationShutdown } from '@nestjs/common';
import { HttpError } from '../../common/errors/http-error.js';
import { APP_CONFIG, APP_LOGGER } from '../../config/app-config.js';
import type { AppConfig, AppLogger } from '../../config/app-config.js';
import { PresenceRepository, PRESENCE_REFRESH_MS, unavailablePresence } from './presence.repository.js';
import type { PresenceIdentity } from './presence-identity.service.js';

export interface EventResponse {
  readonly writableEnded: boolean;
  set(headers: Record<string, string>): unknown;
  flushHeaders(): void;
  once(event: 'close', listener: () => void): unknown;
  write(frame: string): boolean;
  end(): unknown;
}

interface EventClient {
  response: EventResponse;
  ip?: string;
  leaseId?: string;
}

export function eventFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

@Injectable()
export class MessageEventsService implements BeforeApplicationShutdown {
  readonly clients: Set<EventClient>;
  readonly heartbeatMs: number;
  readonly maxConnections: number;
  readonly maxPerIp: number;
  private timer: ReturnType<typeof setInterval> | undefined;
  private refreshWork: Promise<void> | undefined;
  private readonly releases = new Set<Promise<void>>();
  private readonly openings = new Set<Promise<string>>();
  private nextRefresh = 0;
  private failed = false;
  private closing = false;

  constructor(@Inject(APP_CONFIG) config: AppConfig,
    @Inject(PresenceRepository) private readonly presence: Pick<PresenceRepository, 'acquire' | 'refresh' | 'release'>,
    @Inject(APP_LOGGER) private readonly logger: AppLogger) {
    const { heartbeatMs, maxConnections, maxPerIp } = config.events;
    this.clients = new Set();
    this.heartbeatMs = heartbeatMs;
    this.maxConnections = maxConnections;
    this.maxPerIp = maxPerIp;
  }

  async connect(request: { ip?: string }, response: EventResponse, identity: PresenceIdentity): Promise<void> {
    const count = [...this.clients].filter(client => client.ip === request.ip).length;
    if (this.closing || this.clients.size >= this.maxConnections || count >= this.maxPerIp) {
      throw new HttpError(429, 'CONNECTION_LIMIT', 'Hay demasiadas conexiones. Cierra otra pestaña y vuelve a intentar.');
    }
    const client: EventClient = { response, ip: request.ip };
    this.clients.add(client);
    response.once('close', () => {
      this.clients.delete(client);
      if (client.leaseId) this.release(client.leaseId);
      this.nextRefresh = 0;
      if (!this.clients.size && this.timer) { clearInterval(this.timer); this.timer = undefined; }
    });
    const opening = this.presence.acquire(identity);
    this.openings.add(opening);
    try {
      client.leaseId = await opening;
    } catch (cause) {
      this.clients.delete(client);
      if (cause instanceof HttpError) throw cause;
      throw new HttpError(503, 'PRESENCE_UNAVAILABLE', 'No pudimos comprobar la disponibilidad del chat. Inténtalo más tarde.');
    } finally { this.openings.delete(opening); }
    // El navegador pudo cerrar mientras PostgreSQL autorizaba la conexión.
    if (!this.clients.has(client) || response.writableEnded || this.closing) {
      this.clients.delete(client); this.release(client.leaseId); client.leaseId = undefined; response.end(); return;
    }
    response.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'private, no-store, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    response.flushHeaders();
    if (!this.timer) {
      this.timer = setInterval(() => {
        for (const active of this.clients) if (active.leaseId) this.write(active, ': keepalive\n\n');
        if (performance.now() >= this.nextRefresh) void this.refreshPresence();
      }, this.heartbeatMs);
      this.timer.unref();
    }
    this.write(client, 'retry: 2000\n\n');
    // Las altas concurrentes comparten una sola conciliación en esta instancia.
    this.write(client, eventFrame('presence', unavailablePresence()));
    this.nextRefresh = 0;
    await this.refreshPresence();
  }

  refreshPresence(): Promise<void> {
    this.refreshWork ??= this.refreshOnce().finally(() => { this.refreshWork = undefined; });
    return this.refreshWork;
  }
  private async refreshOnce(): Promise<void> {
    this.nextRefresh = performance.now() + PRESENCE_REFRESH_MS;
    const clients = [...this.clients].filter(client => client.leaseId);
    if (!clients.length) return;
    const started = performance.now();
    try {
      const result = await this.presence.refresh(clients.map(client => client.leaseId!));
      if (performance.now() - started > 10000) throw new Error('Presence observation expired');
      for (const client of clients) if (!result.renewed.has(client.leaseId!)) client.response.end();
      this.publish('presence', result.presence);
      if (this.failed) this.logger.info('chat_presence_recovered');
      this.failed = false;
    } catch {
      this.publish('presence', unavailablePresence());
      // Solo cambios de estado; un fallo por latido no inunda los logs.
      if (!this.failed) this.logger.error('chat_presence_unavailable', { mode: 'fail_closed' });
      this.failed = true;
    }
  }
  private release(id: string) {
    const work = this.presence.release(id).catch(() => {
      // Conserva la deuda hasta que caduque en PostgreSQL; nunca inventa un decremento.
      if (!this.failed) this.logger.error('chat_presence_release_pending', { mode: 'lease_expiry' });
      this.failed = true;
    }).finally(() => { this.releases.delete(work); });
    this.releases.add(work);
  }

  write(client: EventClient, frame: string): void {
    try {
      if (client.response.writableEnded || !client.response.write(frame)) client.response.end();
    } catch {
      client.response.end();
    }
  }

  publish(event: string, data: unknown): void {
    const frame = eventFrame(event, data);
    for (const client of [...this.clients]) if (client.leaseId) this.write(client, frame);
  }

  close() {
    this.closing = true;
    if (this.timer) { clearInterval(this.timer); this.timer = undefined; }
    for (const client of [...this.clients]) client.response.end();
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.close();
    await Promise.allSettled(this.openings);
    await this.refreshWork;
    await Promise.allSettled(this.releases);
  }
}
