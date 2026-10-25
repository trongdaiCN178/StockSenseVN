CREATE TABLE watchlist_items (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol varchar(12) NOT NULL REFERENCES symbols(symbol) ON DELETE CASCADE,
  note varchar(500) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, symbol)
);

CREATE TABLE alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol varchar(12) NOT NULL REFERENCES symbols(symbol) ON DELETE CASCADE,
  condition text NOT NULL CHECK (condition IN ('price_above', 'price_below')),
  target_price numeric(18, 4) NOT NULL CHECK (target_price > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX alert_rules_active_symbol_idx ON alert_rules(symbol, condition, target_price) WHERE is_active = true;
CREATE INDEX alert_rules_user_idx ON alert_rules(user_id, created_at DESC);

CREATE TABLE user_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES alert_rules(id) ON DELETE SET NULL,
  symbol varchar(12) NOT NULL REFERENCES symbols(symbol) ON DELETE CASCADE,
  trade_date date NOT NULL,
  alert_type text NOT NULL CHECK (alert_type IN ('price_crossed_above', 'price_crossed_below')),
  title text NOT NULL,
  message text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, trade_date)
);
CREATE INDEX user_alerts_inbox_idx ON user_alerts(user_id, created_at DESC, id DESC);
CREATE INDEX user_alerts_unread_idx ON user_alerts(user_id, created_at DESC) WHERE read_at IS NULL;
