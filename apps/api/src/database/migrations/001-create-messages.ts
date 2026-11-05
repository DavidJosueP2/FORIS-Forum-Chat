import type { Migration } from '../database.types.js';

export const createMessages: Migration = {
  version: 1,
  name: 'create-messages',
  sql: `
    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,
      author VARCHAR(32) NOT NULL,
      body VARCHAR(2000) NOT NULL,
      sender_id UUID NOT NULL,
      request_id UUID NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (char_length(author) > 0),
      CHECK (char_length(body) > 0)
    );
  `,
};
