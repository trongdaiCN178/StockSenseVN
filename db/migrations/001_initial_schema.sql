CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('retail', 'trader', 'analyst', 'admin')),
  must_change_password boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  failed_login_count integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_user_active_idx ON auth_sessions(user_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE symbols (
  symbol varchar(12) PRIMARY KEY CHECK (symbol = upper(symbol)),
  name text NOT NULL,
  exchange text NOT NULL CHECK (exchange IN ('HOSE', 'HNX', 'UPCOM')),
  currency char(3) NOT NULL DEFAULT 'VND',
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE market_batches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  data_date date NOT NULL,
  batch_completed_at timestamptz,
  model_version text NOT NULL,
  state text NOT NULL,
  source_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (data_date, model_version)
);

CREATE TABLE market_indices (
  batch_id bigint NOT NULL REFERENCES market_batches(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  value numeric(18, 4) NOT NULL,
  change_points numeric(18, 4) NOT NULL,
  change_percent numeric(10, 4) NOT NULL,
  PRIMARY KEY (batch_id, code)
);

CREATE TABLE market_summary (
  batch_id bigint PRIMARY KEY REFERENCES market_batches(id) ON DELETE CASCADE,
  advances integer NOT NULL CHECK (advances >= 0),
  nochanges integer NOT NULL CHECK (nochanges >= 0),
  declines integer NOT NULL CHECK (declines >= 0),
  labels_up integer NOT NULL CHECK (labels_up >= 0),
  labels_hold integer NOT NULL CHECK (labels_hold >= 0),
  labels_down integer NOT NULL CHECK (labels_down >= 0)
);

CREATE TABLE forecasts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_id bigint NOT NULL REFERENCES market_batches(id) ON DELETE CASCADE,
  symbol varchar(12) NOT NULL REFERENCES symbols(symbol) ON DELETE CASCADE,
  horizon text NOT NULL CHECK (horizon IN ('t2', 't5')),
  label text NOT NULL CHECK (label IN ('up', 'hold', 'down')),
  probability_up numeric(8, 7) NOT NULL CHECK (probability_up BETWEEN 0 AND 1),
  probability_hold numeric(8, 7) NOT NULL CHECK (probability_hold BETWEEN 0 AND 1),
  probability_down numeric(8, 7) NOT NULL CHECK (probability_down BETWEEN 0 AND 1),
  confidence text NOT NULL CHECK (confidence IN ('low', 'mid', 'high')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, symbol, horizon),
  CHECK (abs(probability_up + probability_hold + probability_down - 1) < 0.0001)
);
CREATE INDEX forecasts_symbol_latest_idx ON forecasts(symbol, batch_id DESC, horizon);

CREATE TABLE daily_prices (
  symbol varchar(12) NOT NULL REFERENCES symbols(symbol) ON DELETE CASCADE,
  trade_date date NOT NULL,
  open numeric(18, 4),
  high numeric(18, 4),
  low numeric(18, 4),
  close numeric(18, 4) NOT NULL CHECK (close > 0),
  volume bigint,
  turnover numeric(22, 2),
  source text NOT NULL DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, trade_date)
);

CREATE TABLE news_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  symbol varchar(12) NOT NULL REFERENCES symbols(symbol) ON DELETE CASCADE,
  external_id text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  source text NOT NULL,
  published_at timestamptz NOT NULL,
  sentiment text NOT NULL DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);
CREATE INDEX news_items_symbol_published_idx ON news_items(symbol, published_at DESC);
