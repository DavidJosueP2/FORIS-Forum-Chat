import { newDb, DataType } from 'pg-mem';
import { randomUUID } from 'node:crypto';
import { Pool as PostgresPool } from 'pg';
import type { DatabasePool } from '../../src/database/database.types.js';

async function postgresTestDatabase(): Promise<{ pool: DatabasePool }> {
  const schema = 'foris_test_' + randomUUID().replaceAll('-', '');
  const admin = new PostgresPool();
  try { await admin.query('CREATE SCHEMA ' + schema); }
  catch (error) { await admin.end(); throw error; }
  const pool = new PostgresPool({ options: '-c search_path=' + schema });
  const end = pool.end.bind(pool);
  pool.end = async () => {
    try { await end(); await admin.query('DROP SCHEMA ' + schema + ' CASCADE'); }
    finally { await admin.end(); }
  };
  return { pool };
}

export async function testDatabase() {
  if (process.env.FORIS_TEST_POSTGRES === '1') return postgresTestDatabase();
  // El adaptador no recorre el AST de CREATE TABLE cuando la tabla ya existe.
  const database = newDb({ noAstCoverageCheck: true });
  database.public.registerFunction({ name: 'char_length', args: [DataType.text], returns: DataType.integer, implementation: (value: string) => value.length });
  database.public.registerFunction({ name: 'cardinality', args: [database.public.getType(DataType.uuid).asArray()], returns: DataType.integer,
    implementation: (value: string[]) => value.length });
  // PostgreSQL realiza el bloqueo real; pg-mem corre en un único proceso de pruebas.
  database.public.registerFunction({ name: 'pg_advisory_xact_lock', args: [DataType.integer], returns: DataType.integer, implementation: () => 1 });
  database.public.registerFunction({ name: 'pg_advisory_xact_lock', args: [DataType.integer, DataType.integer], returns: DataType.integer, implementation: () => 1 });
  database.public.registerFunction({ name: 'hashtext', args: [DataType.text], returns: DataType.integer, implementation: () => 1 });
  // pg-mem expone el adaptador sin tipos; el resto de las pruebas usa el contrato real.
  const { Pool } = database.adapters.createPg() as { Pool: new () => DatabasePool };
  const pool = new Pool();
  return { pool };
}
