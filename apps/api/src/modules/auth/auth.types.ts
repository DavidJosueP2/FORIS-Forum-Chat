import type { Request } from 'express';
import type { AccountUser, OtpPurpose } from '@messages/contracts';
import type { QueryResult, QueryResultRow } from 'pg';

export interface AuthUserRow extends QueryResultRow {
  id: string; email: string; display_name: string; given_name: string;
  family_name: string; bio: string; password_hash: string | null;
  email_verified_at: Date | null; created_at: Date; google_email?: string | null;
}
export interface AuthContext {
  user: AccountUser; sessionId: string; authenticatedAt: Date; expiresAt: Date;
}
export interface AuthRequest extends Request { auth?: AuthContext }
export interface SqlClient {
  query<Row extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]): Promise<QueryResult<Row>>;
}
export interface OtpRow extends QueryResultRow {
  id: string; user_id: string | null; email: string; purpose: OtpPurpose;
  code_digest: string; payload: Record<string, unknown>; attempts: number; send_count: number;
  expires_at: Date; last_sent_at: Date; consumed_at: Date | null; created_at: Date;
}
