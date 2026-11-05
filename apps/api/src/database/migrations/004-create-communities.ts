import type { Migration } from '../database.types.js';

export const createCommunities: Migration = {
  version: 4,
  name: 'create-communities',
  sql: `
    CREATE TABLE communities (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(80) NOT NULL CHECK (char_length(name) >= 3),
      name_key TEXT NOT NULL UNIQUE,
      description VARCHAR(500) NOT NULL CHECK (char_length(description) > 0),
      owner_id UUID NOT NULL REFERENCES users(id),
      request_id UUID NOT NULL,
      member_count INTEGER NOT NULL DEFAULT 1 CHECK (member_count >= 1),
      post_count INTEGER NOT NULL DEFAULT 0 CHECK (post_count >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(owner_id,request_id)
    );
    CREATE INDEX communities_owner ON communities(owner_id,created_at);
    CREATE TABLE community_memberships (
      community_id BIGINT NOT NULL REFERENCES communities(id),
      user_id UUID NOT NULL REFERENCES users(id),
      joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(community_id,user_id)
    );
    CREATE INDEX community_memberships_user ON community_memberships(user_id,community_id DESC);
    CREATE TABLE community_preferences (
      community_id BIGINT NOT NULL REFERENCES communities(id),
      user_id UUID NOT NULL REFERENCES users(id),
      favorite BOOLEAN NOT NULL DEFAULT FALSE,
      notify_posts BOOLEAN NOT NULL DEFAULT TRUE,
      PRIMARY KEY(community_id,user_id)
    );
    CREATE INDEX community_preferences_user ON community_preferences(user_id,community_id DESC);
    ALTER TABLE forum_posts ADD COLUMN community_id BIGINT REFERENCES communities(id);
    CREATE INDEX forum_posts_community ON forum_posts(community_id,id DESC);
    CREATE TABLE community_notifications (
      id BIGSERIAL PRIMARY KEY,
      recipient_id UUID NOT NULL REFERENCES users(id),
      community_id BIGINT NOT NULL REFERENCES communities(id),
      post_id BIGINT NOT NULL REFERENCES forum_posts(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at TIMESTAMPTZ,
      UNIQUE(recipient_id,post_id)
    );
    CREATE INDEX community_notifications_inbox ON community_notifications(recipient_id,id DESC);
    CREATE INDEX community_notifications_unread ON community_notifications(recipient_id,read_at);
  `,
};
