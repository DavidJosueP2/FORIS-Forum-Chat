import type { Migration } from '../database.types.js';
export const communityPrivacyAndPortraits: Migration = {
  version: 7, name: 'community-privacy-and-portraits',
  sql: `
    ALTER TABLE communities ADD COLUMN visibility VARCHAR(7) NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','private'));
    ALTER TABLE communities ADD COLUMN image_request_id UUID;
    ALTER TABLE media ADD COLUMN purpose VARCHAR(9) NOT NULL DEFAULT 'post' CHECK(purpose IN ('post','community','avatar'));
    ALTER TABLE media ADD COLUMN community_id BIGINT UNIQUE REFERENCES communities(id);
    ALTER TABLE media ADD COLUMN avatar_user_id UUID UNIQUE REFERENCES users(id);
    ALTER TABLE media ADD CONSTRAINT media_single_attachment CHECK(
      (CASE WHEN post_id IS NULL THEN 0 ELSE 1 END) +
      (CASE WHEN community_id IS NULL THEN 0 ELSE 1 END) +
      (CASE WHEN avatar_user_id IS NULL THEN 0 ELSE 1 END) <= 1
    );
    ALTER TABLE media ADD CONSTRAINT media_attachment_purpose CHECK(
      (post_id IS NULL OR purpose='post') AND (community_id IS NULL OR purpose='community') AND (avatar_user_id IS NULL OR purpose='avatar')
    );
    CREATE TABLE community_invitations (
      id UUID PRIMARY KEY,
      community_id BIGINT NOT NULL REFERENCES communities(id),
      created_by UUID NOT NULL REFERENCES users(id),
      token_hash CHAR(64) NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMPTZ NOT NULL,
      used_by UUID REFERENCES users(id), used_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ
    );
    CREATE INDEX community_invitations_community ON community_invitations(community_id,created_at DESC);
    CREATE INDEX community_invitations_expiry ON community_invitations(expires_at);
  `,
};
