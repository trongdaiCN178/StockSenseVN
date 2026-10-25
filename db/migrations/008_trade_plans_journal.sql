CREATE TABLE trade_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol varchar(12) NOT NULL REFERENCES symbols(symbol),
  side text NOT NULL CHECK (side IN ('long', 'short')),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'closed', 'cancelled')),
  entry_price numeric(18, 4) NOT NULL CHECK (entry_price > 0),
  stop_price numeric(18, 4) NOT NULL CHECK (stop_price > 0),
  target_price numeric(18, 4) NOT NULL CHECK (target_price > 0),
  quantity numeric(18, 4) CHECK (quantity > 0),
  capital_vnd numeric(20, 2) CHECK (capital_vnd > 0),
  risk_pct numeric(8, 4) CHECK (risk_pct > 0 AND risk_pct <= 100),
  note varchar(1000) NOT NULL DEFAULT '',
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  exit_price numeric(18, 4) CHECK (exit_price > 0),
  close_note varchar(1000),
  realized_pnl numeric(20, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CHECK ((status = 'closed') = (closed_at IS NOT NULL)),
  CHECK ((status = 'closed') = (exit_price IS NOT NULL))
);
CREATE INDEX trade_plans_owner_status_idx ON trade_plans(user_id, status, created_at DESC);

CREATE TABLE journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id uuid UNIQUE REFERENCES trade_plans(id) ON DELETE SET NULL,
  symbol varchar(12) NOT NULL REFERENCES symbols(symbol),
  kind text NOT NULL CHECK (kind IN ('plan_close', 'manual')),
  title varchar(160) NOT NULL,
  body text NOT NULL DEFAULT '',
  realized_pnl numeric(20, 2),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX journal_entries_owner_created_idx ON journal_entries(user_id, created_at DESC);

CREATE FUNCTION protect_immutable_snapshots() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.snapshot IS DISTINCT FROM OLD.snapshot THEN
    RAISE EXCEPTION 'snapshot is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trade_plans_snapshot_immutable BEFORE UPDATE ON trade_plans
  FOR EACH ROW EXECUTE FUNCTION protect_immutable_snapshots();
CREATE TRIGGER journal_entries_snapshot_immutable BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION protect_immutable_snapshots();
