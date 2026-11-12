import type { Migration } from '../database.types.js';

export const conversations: Migration = {
  version: 14,
  name: 'conversations',
  sql: `
    CREATE TABLE conversation_messages (
      id BIGSERIAL PRIMARY KEY,
      room_key VARCHAR(80) NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      author VARCHAR(32) NOT NULL,
      body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
      request_id UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(room_key,user_id,request_id)
    );
    CREATE INDEX conversation_messages_history ON conversation_messages(room_key,id);
    ALTER TABLE video_call_members ADD COLUMN room_key VARCHAR(80) NOT NULL DEFAULT 'global';
    CREATE INDEX video_call_members_room ON video_call_members(room_key,id);
  `,
};
