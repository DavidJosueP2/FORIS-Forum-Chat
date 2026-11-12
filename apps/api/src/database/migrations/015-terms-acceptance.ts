import type { Migration } from '../database.types.js';

export const termsAcceptance: Migration = {
  version: 15,
  name: 'terms-acceptance',
  sql: `
    ALTER TABLE users ADD COLUMN terms_version VARCHAR(32), ADD COLUMN terms_accepted_at TIMESTAMPTZ;
    ALTER TABLE users ADD CONSTRAINT users_terms_acceptance_pair CHECK ((terms_version IS NULL) = (terms_accepted_at IS NULL));
    ALTER TABLE auth_google_flows ADD COLUMN terms_version VARCHAR(32);
  `,
};
