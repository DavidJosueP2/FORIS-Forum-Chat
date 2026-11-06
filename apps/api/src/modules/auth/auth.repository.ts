import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import type { AccountUser } from '@messages/contracts';
import type { AuthUserRow, SqlClient } from './auth.types.js';
export function accountUser(row: AuthUserRow): AccountUser {
  return {
    id: row.id, email: row.email, displayName: row.display_name, avatarId: row.avatar_id ?? null,
    givenName: row.given_name, familyName: row.family_name, bio: row.bio,
    emailVerified: Boolean(row.email_verified_at), hasPassword: Boolean(row.password_hash),
    google: row.google_email ? { email: row.google_email } : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
@Injectable()
export class AuthRepository {
  constructor(@Inject(DatabaseService) readonly database: DatabaseService) {}
  transaction<T>(work: (client: SqlClient) => Promise<T>): Promise<T> { return this.database.transaction(work); }
  async user(id: string, client: SqlClient = this.database, lock = false): Promise<AuthUserRow | undefined> {
    const { rows } = await client.query<AuthUserRow>('SELECT * FROM users WHERE id = $1' + (lock ? ' FOR UPDATE' : ''), [id]);
    if (!rows[0]) return undefined;
    const google = await client.query<{ email: string }>('SELECT email FROM user_google_identities WHERE user_id = $1', [id]);
    const avatar = await client.query<{ id: string }>("SELECT id FROM media WHERE avatar_user_id=$1 AND state='READY'", [id]);
    return { ...rows[0], google_email: google.rows[0]?.email ?? null, avatar_id: avatar.rows[0]?.id ?? null };
  }
  async byEmail(email: string, client: SqlClient = this.database): Promise<AuthUserRow | undefined> {
    const { rows } = await client.query<AuthUserRow>('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0];
  }
  async lockKey(client: SqlClient, key: string): Promise<void> {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
  }
}
