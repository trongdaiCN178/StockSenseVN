CREATE TABLE portfolio_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol varchar(12) NOT NULL REFERENCES symbols(symbol),
  side text NOT NULL CHECK (side IN ('buy', 'sell')),
  quantity numeric(18, 4) NOT NULL CHECK (quantity > 0),
  unit_price numeric(18, 4) NOT NULL CHECK (unit_price > 0),
  fee numeric(18, 2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  executed_at date NOT NULL,
  note varchar(500) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX portfolio_transactions_ledger_idx ON portfolio_transactions(user_id, symbol, executed_at, created_at, id);
CREATE INDEX portfolio_transactions_history_idx ON portfolio_transactions(user_id, executed_at DESC, created_at DESC);
