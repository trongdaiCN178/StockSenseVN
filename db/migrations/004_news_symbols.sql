ALTER TABLE data_ingestion_runs
  ADD COLUMN units_label text NOT NULL DEFAULT 'symbols';

ALTER TABLE news_items ALTER COLUMN symbol DROP NOT NULL;

CREATE TABLE news_item_symbols (
  news_item_id bigint NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
  symbol varchar(12) NOT NULL REFERENCES symbols(symbol) ON DELETE CASCADE,
  match_method text NOT NULL DEFAULT 'symbol_match',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (news_item_id, symbol)
);
CREATE INDEX news_item_symbols_symbol_idx ON news_item_symbols(symbol, news_item_id);

INSERT INTO news_item_symbols(news_item_id, symbol, match_method)
SELECT id, symbol, 'legacy_primary_symbol' FROM news_items WHERE symbol IS NOT NULL
ON CONFLICT DO NOTHING;
