CREATE TABLE notification_channels (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'telegram')),
  destination text,
  verified_at timestamptz,
  challenge_hash bytea,
  challenge_expires_at timestamptz,
  challenge_attempts integer NOT NULL DEFAULT 0 CHECK (challenge_attempts BETWEEN 0 AND 5),
  last_challenge_at timestamptz,
  last_test_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel),
  CHECK ((verified_at IS NULL) OR (destination IS NOT NULL AND challenge_hash IS NULL))
);
CREATE UNIQUE INDEX notification_channels_destination_idx ON notification_channels(channel,destination)
  WHERE verified_at IS NOT NULL;
