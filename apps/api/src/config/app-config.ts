import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import type { PoolConfig } from 'pg';
import { readAuthConfig } from './auth-config.js';
import type { AuthConfig } from './auth-config.js';
import { readMediaConfig } from './media-config.js';
import type { MediaConfig } from './media-config.js';
import { readVideoCallConfig } from './video-call-config.js';
import type { VideoCallConfig } from './video-call-config.js';

export const APP_CONFIG = Symbol('APP_CONFIG');
export const APP_LOGGER = Symbol('APP_LOGGER');
export type AppLogger = Pick<Console, 'info' | 'error'>;
export type ApplicationEnvironment = 'development' | 'test' | 'production';

export function readApplicationEnvironment(value: string | undefined): ApplicationEnvironment {
  if (value === undefined) return 'development';
  if (value === 'development' || value === 'test' || value === 'production') return value;
  throw new Error('NODE_ENV debe ser development, test o production.');
}

export interface AppConfig {
  environment: ApplicationEnvironment;
  media: MediaConfig;
  videoCalls: VideoCallConfig;
  auth?: AuthConfig;
  trustProxy?: number;
  host: string;
  port: number;
  database: PoolConfig;
  publicDirectory: string;
  messagesPerMinute: number;
  events: { heartbeatMs: number; maxConnections: number; maxPerIp: number };
}

const root = new URL('../../', import.meta.resolve('@messages/api/package.json'));

export function loadEnvironment(): void {
  const mode = readApplicationEnvironment(process.env.NODE_ENV);
  process.env.NODE_ENV = mode;
  // loadEnvFile conserva las variables ya definidas: primero se carga la mayor prioridad.
  for (const name of ['.env.' + mode + '.local', '.env.' + mode, '.env.local', '.env']) {
    try {
      loadEnvFile(new URL(name, root));
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
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
    environment: readApplicationEnvironment(env.NODE_ENV),
    media: readMediaConfig(env, fileURLToPath(root)),
    videoCalls: readVideoCallConfig(env),
    auth: readAuthConfig(env),
    trustProxy: env.TRUST_PROXY === '1' ? 1 : 0,
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
