import type { Migration } from '../database.types.js';

export const createMedia: Migration = {
  version: 5, name: 'create-media',
  sql: `
    CREATE TABLE media_quotas (
      scope VARCHAR(80) PRIMARY KEY,
      used_bytes BIGINT NOT NULL DEFAULT 0 CHECK (used_bytes>=0),
      reserved_bytes BIGINT NOT NULL DEFAULT 0 CHECK (reserved_bytes>=0)
    );
    INSERT INTO media_quotas(scope) VALUES('global');
    CREATE TABLE media (
      id UUID PRIMARY KEY,
      owner_id UUID NOT NULL REFERENCES users(id),
      request_id UUID NOT NULL,
      storage_profile VARCHAR(80) NOT NULL,
      provider VARCHAR(32) NOT NULL,
      staging_key VARCHAR(240) NOT NULL UNIQUE,
      object_key VARCHAR(240) NOT NULL UNIQUE,
      original_name VARCHAR(180) NOT NULL,
      declared_mime VARCHAR(40) NOT NULL,
      declared_bytes BIGINT NOT NULL CHECK(declared_bytes>0),
      validated_mime VARCHAR(40),
      actual_bytes BIGINT NOT NULL DEFAULT 0 CHECK(actual_bytes>=0),
      accounted_bytes BIGINT NOT NULL DEFAULT 0 CHECK(accounted_bytes>=0),
      reserved_bytes BIGINT NOT NULL CHECK(reserved_bytes>=0),
      width INTEGER, height INTEGER, checksum CHAR(64),
      state VARCHAR(16) NOT NULL DEFAULT 'PENDING'
        CHECK(state IN ('PENDING','VERIFYING','READY','REJECTED','DELETING','DELETED','EXPIRED')),
      upload_expires_at TIMESTAMPTZ NOT NULL,
      cleanup_after TIMESTAMPTZ NOT NULL,
      lease_token UUID, lease_until TIMESTAMPTZ,
      staging_deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      confirmed_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ,
      post_id BIGINT REFERENCES forum_posts(id) ON DELETE SET NULL,
      position INTEGER CHECK(position>=0),
      UNIQUE(owner_id,request_id),
      UNIQUE(post_id,position)
    );
    CREATE INDEX media_owner ON media(owner_id,created_at DESC);
    CREATE INDEX media_post ON media(post_id,position);
    CREATE INDEX media_cleanup ON media(storage_profile,cleanup_after);
    ALTER TABLE forum_posts ADD COLUMN media_request_ids UUID[] NOT NULL DEFAULT '{}';
    CREATE TABLE media_events (
      id BIGSERIAL PRIMARY KEY, media_id UUID NOT NULL REFERENCES media(id),
      operation VARCHAR(40) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX media_events_retention ON media_events(created_at);
    CREATE TABLE media_metrics (
      day DATE NOT NULL DEFAULT CURRENT_DATE, operation VARCHAR(40) NOT NULL,
      total BIGINT NOT NULL DEFAULT 0, PRIMARY KEY(day,operation)
    );
  `,
};
