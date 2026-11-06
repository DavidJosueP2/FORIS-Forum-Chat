import type { DatabasePool, Migration } from '../database.types.js';
import { createMessages } from './001-create-messages.js';
import { createAuth } from './002-create-auth.js';
import { createForum } from './003-create-forum.js';
import { createCommunities } from './004-create-communities.js';
import { createMedia } from './005-create-media.js';
import { createVideoCalls } from './006-create-video-calls.js';
import { communityPrivacyAndPortraits } from './007-community-privacy-and-portraits.js';

const migrations: readonly Migration[] = [createMessages, createAuth, createForum, createCommunities, createMedia, createVideoCalls, communityPrivacyAndPortraits];

export async function runMigrations(pool: DatabasePool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serializa los cambios de esquema cuando dos procesos arrancan a la vez.
    await client.query('SELECT pg_advisory_xact_lock($1)', [60239415]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_schema_migrations (
        version INTEGER PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const applied = await client.query<{ version: number }>('SELECT version FROM app_schema_migrations');
    const versions = new Set(applied.rows.map(row => row.version));
    for (const migration of migrations) {
      if (versions.has(migration.version)) continue;
      await client.query(migration.sql);
      await client.query('INSERT INTO app_schema_migrations (version, name) VALUES ($1, $2)', [migration.version, migration.name]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
