import { Inject, Injectable } from '@nestjs/common';
import type { OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { APP_LOGGER } from '../config/app-config.js';
import type { AppLogger } from '../config/app-config.js';
import { DATABASE_POOL } from './database.types.js';
import type { DatabasePool, SqlDatabase } from './database.types.js';
import { runMigrations } from './migrations/run-migrations.js';

@Injectable()
export class DatabaseService implements SqlDatabase, OnModuleInit, OnApplicationShutdown {
  private closing: Promise<void> | undefined;

  constructor(
    @Inject(DATABASE_POOL) private readonly pool: DatabasePool,
    @Inject(APP_LOGGER) private readonly logger: AppLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    this.pool.on('error', error => this.logger.error('database_connection_failed', { type: error.name }));
    await runMigrations(this.pool);
  }

  query<Row extends QueryResultRow>(sql: string, values?: unknown[]): Promise<QueryResult<Row>> {
    return this.pool.query<Row>(sql, values);
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  onApplicationShutdown(): Promise<void> {
    this.closing ??= this.pool.end();
    return this.closing;
  }
}
