import { Global, Module } from '@nestjs/common';
import pg from 'pg';
import { APP_CONFIG } from '../config/app-config.js';
import type { AppConfig } from '../config/app-config.js';
import { DATABASE_POOL } from './database.types.js';
import { DatabaseService } from './database.service.js';

@Global()
@Module({
  providers: [
    { provide: DATABASE_POOL, inject: [APP_CONFIG], useFactory: (config: AppConfig) => new pg.Pool(config.database) },
    DatabaseService,
  ],
  exports: [DatabaseService],
})
export class DatabaseModule {}
