import type { Migration } from '../database.types.js';
export const createVideoCalls: Migration = {
  version: 6, name: 'create-video-calls',
  sql: `
    CREATE TABLE video_call_room (id VARCHAR(16) PRIMARY KEY CHECK(id='global'));
    INSERT INTO video_call_room(id) VALUES('global');
    CREATE TABLE video_call_members (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL UNIQUE REFERENCES users(id),
      session_id UUID NOT NULL REFERENCES auth_sessions(id) ON DELETE CASCADE,
      request_id UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMPTZ NOT NULL,
      hard_expires_at TIMESTAMPTZ NOT NULL,
      UNIQUE(session_id,request_id)
    );
    CREATE INDEX video_call_members_expiry ON video_call_members(expires_at);
    CREATE TABLE video_call_signals (
      id BIGSERIAL PRIMARY KEY,
      sender_id UUID NOT NULL REFERENCES video_call_members(id) ON DELETE CASCADE,
      recipient_id UUID NOT NULL REFERENCES video_call_members(id) ON DELETE CASCADE,
      request_id UUID NOT NULL,
      kind VARCHAR(6) NOT NULL CHECK(kind IN ('offer','answer')),
      sdp TEXT NOT NULL CHECK(char_length(sdp) BETWEEN 1 AND 65536),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK(sender_id<>recipient_id),
      UNIQUE(sender_id,request_id),
      UNIQUE(sender_id,recipient_id)
    );
    CREATE INDEX video_call_signals_recipient ON video_call_signals(recipient_id,id);
    CREATE INDEX video_call_signals_expiry ON video_call_signals(created_at);
  `,
};
