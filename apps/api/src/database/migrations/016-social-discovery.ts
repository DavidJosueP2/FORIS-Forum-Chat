import type { Migration } from '../database.types.js';

export const socialDiscovery: Migration = {
  version: 16,
  name: 'social-discovery',
  sql: `
    ALTER TABLE community_notifications ALTER COLUMN community_id DROP NOT NULL;
    ALTER TABLE community_notifications ALTER COLUMN post_id DROP NOT NULL;
    ALTER TABLE community_notifications ADD COLUMN follower_id UUID REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE community_notifications ADD CONSTRAINT notification_has_one_source CHECK (
      (follower_id IS NULL AND community_id IS NOT NULL AND post_id IS NOT NULL)
      OR (follower_id IS NOT NULL AND follower_id <> recipient_id AND community_id IS NULL AND post_id IS NULL)
    );
    ALTER TABLE community_notifications ADD CONSTRAINT notification_unique_follower UNIQUE(recipient_id,follower_id);

    CREATE TABLE direct_conversations (
      first_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      second_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY(first_id,second_id),
      CHECK(first_id < second_id)
    );
    CREATE INDEX direct_conversations_second ON direct_conversations(second_id,first_id);
    INSERT INTO direct_conversations(first_id,second_id)
      SELECT DISTINCT split_part(room_key,':',2)::uuid,split_part(room_key,':',3)::uuid
      FROM conversation_messages WHERE room_key LIKE 'direct:%';
  `,
};
