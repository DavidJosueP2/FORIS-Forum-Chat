import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Server } from 'node:http';
import { AppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/application.js';
import { APP_CONFIG, APP_LOGGER, readConfig } from '../../src/config/app-config.js';
import type { AppLogger } from '../../src/config/app-config.js';
import { DATABASE_POOL } from '../../src/database/database.types.js';
import type { DatabasePool } from '../../src/database/database.types.js';
import { DatabaseService } from '../../src/database/database.service.js';
import { MessagesRepository } from '../../src/modules/messages/messages.repository.js';
import type { MessageRepositoryPort } from '../../src/modules/messages/messages.types.js';
import { MessageEventsService } from '../../src/modules/messages/message-events.service.js';
import { HealthService } from '../../src/modules/health/health.service.js';
import { testDatabase } from './database.js';
import type { MediaConfig } from '../../src/config/media-config.js';
import { PresenceRepository } from '../../src/modules/messages/presence.repository.js';

export interface FixtureOptions {
  repository?: MessageRepositoryPort;
  health?: Pick<HealthService, 'check'>;
  sendLimit?: number;
  port?: number;
  pool?: DatabasePool;
  logger?: AppLogger;
  auth?: boolean;
  appUrl?: string;
  presence?: Pick<PresenceRepository, 'acquire' | 'refresh' | 'release'>;
  media?: Partial<MediaConfig>;
}

export async function createTestApplication(options: FixtureOptions = {}) {
  const pool = options.pool ?? (await testDatabase()).pool;
  const config = readConfig({ NODE_ENV: 'test', PGPASSWORD: 'test-only', AUTH_SECRET: options.auth ? 'foris-test-secret-with-at-least-32-characters' : undefined,
    APP_URL: options.appUrl, STORAGE_LOCAL_ROOT: options.media?.localRoot });
  config.media = { ...config.media, ...options.media };
  config.port = options.port ?? 3099;
  config.messagesPerMinute = options.sendLimit ?? 40;
  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(APP_CONFIG).useValue(config)
    .overrideProvider(APP_LOGGER).useValue(options.logger ?? { info() {}, error() {} })
    .overrideProvider(DATABASE_POOL).useValue(pool);
  if (options.repository) builder.overrideProvider(MessagesRepository).useValue(options.repository);
  if (options.health) builder.overrideProvider(HealthService).useValue(options.health);
  if (options.presence) builder.overrideProvider(PresenceRepository).useValue(options.presence);
  try {
    const module = await builder.compile();
    const app = module.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false });
    configureApplication(app);
    return {
      app, pool,
      server: app.getHttpServer() as Server,
      repository: app.get<MessagesRepository>(MessagesRepository),
      database: app.get(DatabaseService),
      hub: app.get(MessageEventsService),
    };
  } catch (error) {
    await pool.end();
    throw error;
  }
}
