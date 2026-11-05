import { Inject, Injectable } from '@nestjs/common';
import type { BeforeApplicationShutdown } from '@nestjs/common';
import { HttpError } from '../../common/errors/http-error.js';
import { APP_CONFIG } from '../../config/app-config.js';
import type { AppConfig } from '../../config/app-config.js';

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

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    const { heartbeatMs, maxConnections, maxPerIp } = config.events;
    this.clients = new Set();
    this.heartbeatMs = heartbeatMs;
    this.maxConnections = maxConnections;
    this.maxPerIp = maxPerIp;
  }

  connect(request: { ip?: string }, response: EventResponse): void {
    const count = [...this.clients].filter(client => client.ip === request.ip).length;
    if (this.clients.size >= this.maxConnections || count >= this.maxPerIp) {
      throw new HttpError(429, 'CONNECTION_LIMIT', 'Hay demasiadas conexiones. Cierra otra pestaña y vuelve a intentar.');
    }
    response.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    response.flushHeaders();
    const client = { response, ip: request.ip };
    const heartbeat = setInterval(() => this.write(client, ': keepalive\n\n'), this.heartbeatMs);
    heartbeat.unref();
    this.clients.add(client);
    response.once('close', () => {
      clearInterval(heartbeat);
      if (this.clients.delete(client)) this.publish('presence', { connections: this.clients.size });
    });
    this.write(client, 'retry: 2000\n\n');
    this.publish('presence', { connections: this.clients.size });
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
    for (const client of [...this.clients]) this.write(client, frame);
  }

  close() {
    for (const client of [...this.clients]) client.response.end();
  }

  beforeApplicationShutdown(): void {
    this.close();
  }
}
