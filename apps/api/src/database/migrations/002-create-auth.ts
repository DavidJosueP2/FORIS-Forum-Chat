import type { Migration } from '../database.types.js';
export const createAuth: Migration = {
  version: 2,
  name: 'create-auth',
  sql: `
    CREATE TABLE users (
      id UUID PRIMARY KEY,
      email VARCHAR(254) NOT NULL UNIQUE,
      display_name VARCHAR(32) NOT NULL,
      given_name VARCHAR(80) NOT NULL DEFAULT '',
      family_name VARCHAR(80) NOT NULL DEFAULT '',
      bio VARCHAR(280) NOT NULL DEFAULT '',
      password_hash TEXT,
      email_verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE user_google_identities (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      subject VARCHAR(255) NOT NULL UNIQUE,
      email VARCHAR(254) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE auth_sessions (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash CHAR(64) NOT NULL UNIQUE,
      authenticated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX auth_sessions_user ON auth_sessions(user_id);
    CREATE INDEX auth_sessions_expiry ON auth_sessions(expires_at);
    CREATE TABLE auth_otp_challenges (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      email VARCHAR(254) NOT NULL,
      purpose VARCHAR(24) NOT NULL CHECK (purpose IN ('verify_email','reset_password','change_password','change_email')),
      code_digest CHAR(64) NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}',
      attempts INTEGER NOT NULL DEFAULT 0,
      send_count INTEGER NOT NULL DEFAULT 1,
      expires_at TIMESTAMPTZ NOT NULL,
      last_sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      consumed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX auth_otp_recipient ON auth_otp_challenges(email, purpose, created_at);
    CREATE INDEX auth_otp_user ON auth_otp_challenges(user_id);
    CREATE TABLE auth_google_flows (
      state_hash CHAR(64) PRIMARY KEY,
      binding_hash CHAR(64) NOT NULL,
      nonce VARCHAR(86) NOT NULL,
      code_verifier VARCHAR(128) NOT NULL,
      intent VARCHAR(12) NOT NULL CHECK (intent IN ('login','link','reauth')),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      session_id UUID REFERENCES auth_sessions(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE auth_mail_outbox (
      id UUID PRIMARY KEY,
      challenge_id UUID REFERENCES auth_otp_challenges(id) ON DELETE CASCADE,
      encrypted_payload TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      locked_until TIMESTAMPTZ,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX auth_mail_ready ON auth_mail_outbox(available_at);
    CREATE TABLE auth_login_attempts (
      email_hash CHAR(64) PRIMARY KEY,
      failures INTEGER NOT NULL,
      window_start TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE messages ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;
    CREATE INDEX messages_user ON messages(user_id);
  `,
};
