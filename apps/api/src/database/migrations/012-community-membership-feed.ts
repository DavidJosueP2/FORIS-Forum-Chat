import type { Migration } from '../database.types.js';

/** Las membresías son la única relación con una comunidad; no convierte seguimientos en miembros. */
export const communityMembershipFeed: Migration = {
  version: 12, name: 'community_membership_feed',
  sql: `DROP TABLE community_follows;`,
};
