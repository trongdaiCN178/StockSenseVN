CREATE TABLE password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_tokens_user_active_idx ON password_reset_tokens(user_id, expires_at)
  WHERE consumed_at IS NULL;

CREATE TABLE password_reset_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email_key char(64) NOT NULL,
  ip_key char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_requests_email_recent_idx ON password_reset_requests(email_key, created_at DESC);
CREATE INDEX password_reset_requests_ip_recent_idx ON password_reset_requests(ip_key, created_at DESC);
