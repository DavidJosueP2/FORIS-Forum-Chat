import type { Pool, QueryResultRow } from 'pg';

export const DATABASE_POOL = Symbol('DATABASE_POOL');
export interface DatabasePool {
  query: Pool['query'];
  connect: Pool['connect'];
  end(): Promise<void>;
  on(event: 'error', listener: (error: Error) => void): unknown;
}

export interface SqlDatabase {
  query<Row extends QueryResultRow>(sql: string, values?: unknown[]): Promise<{ rows: Row[] }>;
}

export interface Migration {
  version: number;
  name: string;
  sql: string;
}
