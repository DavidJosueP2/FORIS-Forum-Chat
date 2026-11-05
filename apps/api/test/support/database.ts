import { newDb, DataType } from 'pg-mem';
import type { DatabasePool } from '../../src/database/database.types.js';

export async function testDatabase() {
  // El adaptador no recorre el AST de CREATE TABLE cuando la tabla ya existe.
  const database = newDb({ noAstCoverageCheck: true });
  database.public.registerFunction({ name: 'char_length', args: [DataType.text], returns: DataType.integer, implementation: (value: string) => value.length });
  // PostgreSQL realiza el bloqueo real; pg-mem corre en un único proceso de pruebas.
  database.public.registerFunction({ name: 'pg_advisory_xact_lock', args: [DataType.integer], returns: DataType.integer, implementation: () => 1 });
  // pg-mem expone el adaptador sin tipos; el resto de las pruebas usa el contrato real.
  const { Pool } = database.adapters.createPg() as { Pool: new () => DatabasePool };
  const pool = new Pool();
  return { pool, Pool };
}
