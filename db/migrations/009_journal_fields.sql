ALTER TABLE journal_entries
  ADD COLUMN tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN lesson text NOT NULL DEFAULT '',
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX journal_entries_owner_symbol_idx ON journal_entries(user_id, symbol, created_at DESC);

CREATE FUNCTION protect_journal_result() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.realized_pnl IS DISTINCT FROM OLD.realized_pnl
    OR NEW.symbol IS DISTINCT FROM OLD.symbol
    OR NEW.kind IS DISTINCT FROM OLD.kind
    OR NEW.title IS DISTINCT FROM OLD.title THEN
    RAISE EXCEPTION 'journal result fields are immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER journal_entries_result_immutable BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION protect_journal_result();
