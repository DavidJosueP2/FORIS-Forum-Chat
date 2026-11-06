import type { Migration } from '../database.types.js';
import { forumCatalogSql } from '../seeds/forum-catalog.js';

export const createForum: Migration = {
  version: 3,
  name: 'create-forum',
  sql: `
    CREATE TABLE forum_categories (
      id UUID PRIMARY KEY,
      slug VARCHAR(64) NOT NULL,
      name VARCHAR(80) NOT NULL,
      description VARCHAR(240) NOT NULL,
      parent_id UUID,
      root_id UUID NOT NULL REFERENCES forum_categories(id),
      depth SMALLINT NOT NULL CHECK(depth BETWEEN 0 AND 6),
      path UUID[] NOT NULL,
      position INTEGER NOT NULL CHECK(position >= 0),
      UNIQUE(id,root_id),
      FOREIGN KEY(parent_id,root_id) REFERENCES forum_categories(id,root_id),
      CHECK(cardinality(path)=depth+1 AND path[1]=root_id AND path[depth+1]=id),
      CHECK((depth=0 AND parent_id IS NULL AND root_id=id) OR (depth>0 AND parent_id IS NOT NULL AND root_id<>id))
    );
    CREATE UNIQUE INDEX forum_categories_roots ON forum_categories(slug) WHERE parent_id IS NULL;
    CREATE UNIQUE INDEX forum_categories_siblings ON forum_categories(parent_id,slug) WHERE parent_id IS NOT NULL;
    CREATE INDEX forum_categories_parent ON forum_categories(parent_id,position);
    CREATE TABLE forum_tags (
      id UUID PRIMARY KEY,
      name VARCHAR(32) NOT NULL UNIQUE CHECK(char_length(name)>0),
      is_seeded BOOLEAN NOT NULL DEFAULT FALSE
    );
    ${forumCatalogSql}
    CREATE TABLE forum_posts (
      id UUID PRIMARY KEY,
      category_id UUID REFERENCES forum_categories(id),
      author_id UUID NOT NULL REFERENCES users(id),
      title VARCHAR(160) NOT NULL CHECK (char_length(title) > 0),
      body VARCHAR(10000) NOT NULL CONSTRAINT forum_posts_body_check CHECK (char_length(body) > 0),
      request_id UUID NOT NULL,
      tag_request_names TEXT[] NOT NULL DEFAULT '{}',
      reply_count INTEGER NOT NULL DEFAULT 0 CHECK (reply_count >= 0),
      created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_activity_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(author_id,request_id)
    );
    CREATE INDEX forum_posts_page ON forum_posts(created_at DESC,id DESC);
    CREATE INDEX forum_posts_category_page ON forum_posts(category_id,created_at DESC,id DESC);
    CREATE INDEX forum_posts_author_page ON forum_posts(author_id,created_at DESC,id DESC);
    CREATE TABLE forum_post_tags (
      post_id UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
      tag_id UUID NOT NULL REFERENCES forum_tags(id),
      position SMALLINT NOT NULL CHECK(position BETWEEN 0 AND 7),
      PRIMARY KEY(post_id,tag_id),
      UNIQUE(post_id,position)
    );
    CREATE INDEX forum_post_tags_tag ON forum_post_tags(tag_id,post_id);
    CREATE TABLE forum_replies (
      id BIGSERIAL PRIMARY KEY,
      post_id UUID NOT NULL REFERENCES forum_posts(id),
      author_id UUID NOT NULL REFERENCES users(id),
      body VARCHAR(5000) NOT NULL CHECK (char_length(body) > 0),
      request_id UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(author_id,request_id)
    );
    CREATE INDEX forum_replies_page ON forum_replies(post_id,id DESC);
    ALTER TABLE auth_google_flows ADD COLUMN return_to VARCHAR(256) NOT NULL DEFAULT '/';
  `,
};
