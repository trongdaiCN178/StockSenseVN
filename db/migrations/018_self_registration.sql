ALTER TABLE users
  ADD COLUMN full_name text,
  ADD COLUMN email_verified_at timestamptz,
  ADD COLUMN age_confirmed_at timestamptz,
  ADD COLUMN created_via text NOT NULL DEFAULT 'admin';

-- Accounts created before this migration (admin-created or seeded demo users) are trusted already.
UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL;

CREATE TABLE email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_verification_tokens_user_active_idx ON email_verification_tokens(user_id, expires_at)
  WHERE consumed_at IS NULL;

CREATE TABLE registration_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email_key char(64) NOT NULL,
  ip_key char(64) NOT NULL,
  kind text NOT NULL CHECK (kind IN ('register', 'resend')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX registration_requests_email_recent_idx ON registration_requests(email_key, kind, created_at DESC);
CREATE INDEX registration_requests_ip_recent_idx ON registration_requests(ip_key, kind, created_at DESC);

CREATE TABLE user_consent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  version text NOT NULL,
  channel text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_consent_user_idx ON user_consent(user_id, doc_type, accepted_at DESC);
