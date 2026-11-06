import type { Migration } from '../database.types.js';

export const forumDiscussion: Migration = {
  version: 10, name: 'forum-discussion',
  sql: `
    ALTER TABLE forum_replies ADD COLUMN parent_id BIGINT;
    ALTER TABLE forum_replies ADD COLUMN depth SMALLINT NOT NULL DEFAULT 0 CHECK(depth BETWEEN 0 AND 5);
    ALTER TABLE forum_replies ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0);
    ALTER TABLE forum_replies ADD COLUMN updated_at TIMESTAMPTZ;
    ALTER TABLE forum_replies ADD COLUMN deleted_at TIMESTAMPTZ;
    ALTER TABLE forum_replies ADD COLUMN request_hash CHAR(64);
    ALTER TABLE forum_replies ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE forum_replies ADD CONSTRAINT forum_reply_identity UNIQUE(id,post_id);
    ALTER TABLE forum_replies ADD CONSTRAINT forum_reply_parent FOREIGN KEY(parent_id,post_id) REFERENCES forum_replies(id,post_id);
    ALTER TABLE forum_replies ADD CONSTRAINT forum_reply_depth CHECK((parent_id IS NULL AND depth=0) OR (parent_id IS NOT NULL AND depth>0));
    ALTER TABLE forum_replies ADD CONSTRAINT forum_reply_pin CHECK(NOT pinned OR (parent_id IS NULL AND deleted_at IS NULL));
    ALTER TABLE forum_replies DROP CONSTRAINT forum_replies_body_check;
    ALTER TABLE forum_replies ADD CONSTRAINT forum_reply_body CHECK((deleted_at IS NULL AND char_length(body)>0) OR (deleted_at IS NOT NULL AND body=''));
    CREATE INDEX forum_reply_threads ON forum_replies(post_id,parent_id,pinned DESC,id DESC);
    CREATE UNIQUE INDEX forum_reply_one_pin ON forum_replies(post_id) WHERE pinned;
    CREATE TABLE forum_post_votes (
      post_id UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      value SMALLINT NOT NULL CHECK(value IN (-1,1)),
      PRIMARY KEY(post_id,user_id)
    );
    CREATE TABLE forum_reply_votes (
      reply_id BIGINT NOT NULL REFERENCES forum_replies(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      value SMALLINT NOT NULL CHECK(value IN (-1,1)),
      PRIMARY KEY(reply_id,user_id)
    );
  `,
};
