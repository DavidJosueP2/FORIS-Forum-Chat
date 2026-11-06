import type { Migration } from '../database.types.js';

export const following: Migration = {
  version: 11, name: 'following',
  sql: `
    CREATE TABLE author_follows (
      follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(follower_id,author_id),
      CHECK(follower_id<>author_id)
    );
    CREATE INDEX author_follows_author ON author_follows(author_id);
    CREATE TABLE community_follows (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      community_id BIGINT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(user_id,community_id)
    );
    CREATE INDEX community_follows_community ON community_follows(community_id);
    INSERT INTO community_follows(user_id,community_id) SELECT user_id,community_id FROM community_memberships;
  `,
};
