import type { Migration } from '../database.types.js';

export const chatPresence: Migration = {
  version: 13, name: 'chat-presence',
  sql: `
    CREATE TABLE chat_presence_rooms (scope CHAR(64) PRIMARY KEY);
    CREATE TABLE chat_presence_leases (
      id UUID PRIMARY KEY,
      scope CHAR(64) NOT NULL REFERENCES chat_presence_rooms(scope),
      browser_key CHAR(64), ip_key CHAR(64),
      kind VARCHAR(8) NOT NULL CHECK(kind IN ('account','guest','unknown')),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      session_id UUID REFERENCES auth_sessions(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      CHECK ((kind='account' AND user_id IS NOT NULL AND session_id IS NOT NULL)
        OR (kind='guest' AND browser_key IS NOT NULL AND user_id IS NULL AND session_id IS NULL)
        OR (kind='unknown' AND user_id IS NULL AND session_id IS NULL))
    );
    CREATE INDEX chat_presence_expiry ON chat_presence_leases(scope,expires_at);
    CREATE INDEX chat_presence_account ON chat_presence_leases(scope,user_id);
    CREATE INDEX chat_presence_browser ON chat_presence_leases(scope,browser_key);
    CREATE INDEX chat_presence_ip ON chat_presence_leases(scope,ip_key);
  `,
};
