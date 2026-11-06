import type { Migration } from '../database.types.js';

export const postEditing: Migration = {
  version: 9, name: 'post-editing',
  sql: `
    ALTER TABLE forum_posts ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0);
    ALTER TABLE forum_posts ADD COLUMN updated_at TIMESTAMPTZ(3);
    CREATE TABLE forum_post_edits (
      id BIGSERIAL PRIMARY KEY,
      post_id UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
      author_id UUID NOT NULL REFERENCES users(id),
      request_id UUID NOT NULL,
      request_hash CHAR(64) NOT NULL,
      base_revision INTEGER NOT NULL CHECK(base_revision>0),
      revision INTEGER NOT NULL CHECK(revision=base_revision+1),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(author_id,request_id)
    );
    CREATE INDEX forum_post_edits_rate ON forum_post_edits(author_id,created_at DESC);
  `,
};
