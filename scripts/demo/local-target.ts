import { lstat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { Pool, PoolClient } from 'pg';
import { loadEnvironment, readConfig } from '../../apps/api/src/config/app-config.js';
import { runMigrations } from '../../apps/api/src/database/migrations/run-migrations.js';

export const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const installation = 'foris-local-demo-v1';

export class DemoError extends Error {}

export function localDemoTarget() {
  if (process.env.VERCEL || process.env.VERCEL_ENV || (process.env.NODE_ENV && process.env.NODE_ENV !== 'development')) {
    throw new DemoError('Estos comandos solo admiten el perfil local de desarrollo.');
  }
  loadEnvironment();
  const config = readConfig();
  const { host, database, ssl } = config.database;
  if (!database || (host !== '127.0.0.1' && host !== '::1' && host !== 'localhost') || ssl) {
    throw new DemoError('Selecciona una base en PostgreSQL local con PGHOST de loopback y PGSSL=0.');
  }
  if (config.media.driver !== 'local') {
    throw new DemoError('Estos comandos requieren STORAGE_DRIVER=local.');
  }
  return { config, database, connection: { ...config.database, host,
    ssl: false, max: 1, options: '-c search_path=public', application_name: 'foris-local-demo' } };
}

export function demoPool(target: ReturnType<typeof localDemoTarget>): Pool {
  return new pg.Pool(target.connection);
}

export async function localStat(path: string) {
  try { return await lstat(path); }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function assertLocalPath(path: string): Promise<void> {
  const child = relative(projectRoot, path);
  if (!child || child === '..' || child.startsWith('..' + sep) || isAbsolute(child)) {
    throw new DemoError('Se encontró una ruta fuera del proyecto.');
  }
  const parts = child.split(sep);
  let current = projectRoot;
  for (const [index, part] of parts.entries()) {
    current = resolve(current, part);
    const stat = await localStat(current);
    if (!stat) return;
    if (stat.isSymbolicLink() || (index < parts.length - 1 && !stat.isDirectory())) {
      throw new DemoError('La ruta de medios contiene un enlace o una carpeta inválida.');
    }
  }
}

export async function demoTransaction<T>(pool: Pool, database: string, work: (client: PoolClient) => Promise<T>,
  mode: 'read' | 'write' | 'exclusive' = 'write'): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query(mode === 'read' ? 'BEGIN READ ONLY' : 'BEGIN');
    const actual = (await client.query<{ name: string; schema: string }>('SELECT current_database() AS name,current_schema() AS schema')).rows[0];
    if (actual?.name !== database || actual.schema !== 'public') throw new DemoError('La conexión no coincide con la base configurada o con el esquema public.');
    if (mode !== 'read') {
      // Mismo bloqueo que las migraciones para serializar operaciones de mantenimiento.
      const lock = (await client.query<{ acquired: boolean }>('SELECT pg_try_advisory_xact_lock(60239415) AS acquired')).rows[0];
      if (!lock?.acquired) throw new DemoError('Hay otra migración u operación de mantenimiento en curso.');
    }
    if (mode === 'exclusive') {
      const busy = (await client.query<{ busy: boolean }>(`SELECT EXISTS (
        SELECT 1 FROM pg_stat_activity WHERE datname=current_database()
          AND pid<>pg_backend_pid() AND backend_type='client backend'
      ) AS busy`)).rows[0];
      if (busy?.busy !== false) throw new DemoError('Cierra la API y las demás conexiones a ' + database + ' antes de borrar sus datos.');
    }
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function demoMarkerExists(client: PoolClient): Promise<boolean> {
  const marker = (await client.query<{ name: string | null }>("SELECT to_regclass('public.foris_demo_installation')::text AS name")).rows[0];
  return Boolean(marker?.name);
}

export async function ensureDemoMarker(client: PoolClient, profile: string): Promise<Date | null> {
  if (!await demoMarkerExists(client)) {
    await client.query(`CREATE TABLE public.foris_demo_installation (
      installation TEXT PRIMARY KEY, storage_profile TEXT NOT NULL, seeded_at TIMESTAMPTZ
    )`);
    await client.query('INSERT INTO public.foris_demo_installation(installation,storage_profile) VALUES($1,$2)', [installation, profile]);
  }
  const record = (await client.query<{ installation: string; storage_profile: string; seeded_at: Date | null }>(
    'SELECT installation,storage_profile,seeded_at FROM public.foris_demo_installation LIMIT 2',
  )).rows;
  if (record.length !== 1 || record[0].installation !== installation || record[0].storage_profile !== profile) {
    throw new DemoError('La marca de la demo y la carpeta de medios no coinciden.');
  }
  return record[0].seeded_at;
}

export async function migrateLocalDatabase(pool: Pool, database: string): Promise<void> {
  await demoTransaction(pool, database, async () => undefined, 'read');
  await runMigrations(pool);
}
