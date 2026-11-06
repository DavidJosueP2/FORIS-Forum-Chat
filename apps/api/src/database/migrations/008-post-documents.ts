import type { Migration } from '../database.types.js';

export const postDocuments: Migration = {
  version: 8, name: 'post-documents',
  sql: `
    ALTER TABLE forum_posts ADD COLUMN content JSONB;
    ALTER TABLE forum_posts DROP CONSTRAINT forum_posts_body_check;
    ALTER TABLE forum_posts ADD CONSTRAINT forum_posts_content_required CHECK(char_length(body)>0 OR content IS NOT NULL);
  `,
};
