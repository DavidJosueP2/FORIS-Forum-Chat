import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import type { PoolConfig } from 'pg';

export const APP_CONFIG = Symbol('APP_CONFIG');
export const APP_LOGGER = Symbol('APP_LOGGER');
export type AppLogger = Pick<Console, 'info' | 'error'>;

export interface AppConfig {
  host: string;
  port: number;
  database: PoolConfig;
  publicDirectory: string;
  messagesPerMinute: number;
  events: { heartbeatMs: number; maxConnections: number; maxPerIp: number };
}

const root = new URL('../../', import.meta.resolve('@messages/api/package.json'));

export function loadEnvironment(): void {
  try {
    loadEnvFile(new URL('.env', root));
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
}

function port(value: string, name: string): number {
  if (!/^\d{1,5}$/u.test(String(value)) || Number(value) < 1 || Number(value) > 65535) {
    throw new Error(`${name} debe ser un puerto entre 1 y 65535.`);
  }
  return Number(value);
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (!env.PGPASSWORD) throw new Error('Falta PGPASSWORD. Configura la base de datos en .env.');
  return {
    host: env.HOST || '127.0.0.1',
    port: port(env.PORT || env.APP_PORT || '3000', 'PORT'),
    publicDirectory: fileURLToPath(new URL('apps/web/dist/', root)),
    messagesPerMinute: 40,
    events: { heartbeatMs: 15000, maxConnections: 200, maxPerIp: 10 },
    database: {
      host: env.PGHOST || '127.0.0.1',
      port: port(env.PGPORT || '5433', 'PGPORT'),
      database: env.PGDATABASE || 'messages',
      user: env.PGUSER || 'messages',
      password: env.PGPASSWORD,
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    },
  };
}
