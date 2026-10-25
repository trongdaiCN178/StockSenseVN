CREATE TABLE data_ingestion_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source text NOT NULL,
  dataset text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'partial', 'failed')),
  range_start date NOT NULL,
  range_end date NOT NULL,
  symbols_total integer NOT NULL DEFAULT 0 CHECK (symbols_total >= 0),
  symbols_succeeded integer NOT NULL DEFAULT 0 CHECK (symbols_succeeded >= 0),
  rows_upserted integer NOT NULL DEFAULT 0 CHECK (rows_upserted >= 0),
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (range_start <= range_end)
);

CREATE INDEX data_ingestion_runs_recent_idx
  ON data_ingestion_runs(dataset, started_at DESC, id DESC);
