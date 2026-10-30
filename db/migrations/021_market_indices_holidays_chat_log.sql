-- FR-M1-06: daily market indices (VN-Index, HNX-Index, VN30) synced from SSI.
CREATE TABLE market_index_daily (
  code varchar(16) NOT NULL,
  trade_date date NOT NULL,
  open numeric(14, 4),
  high numeric(14, 4),
  low numeric(14, 4),
  close numeric(14, 4) NOT NULL CHECK (close > 0),
  change_points numeric(14, 4),
  change_percent numeric(10, 4),
  volume bigint,
  turnover numeric(22, 2),
  source text NOT NULL DEFAULT 'ssi',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (code, trade_date)
);

-- FR-M2-03, FR-M7-07: exchange holidays (weekdays without a trading session).
CREATE TABLE market_holidays (
  holiday date PRIMARY KEY,
  name text NOT NULL
);

-- 2025–2026 are the weekdays on which VN-Index had no session; add each new year when the exchanges publish it.
INSERT INTO market_holidays (holiday, name) VALUES
  ('2025-01-01', 'Tết Dương lịch'),
  ('2025-01-27', 'Tết Nguyên đán'), ('2025-01-28', 'Tết Nguyên đán'), ('2025-01-29', 'Tết Nguyên đán'),
  ('2025-01-30', 'Tết Nguyên đán'), ('2025-01-31', 'Tết Nguyên đán'),
  ('2025-04-07', 'Giỗ Tổ Hùng Vương'),
  ('2025-04-30', 'Ngày Giải phóng miền Nam'), ('2025-05-01', 'Quốc tế Lao động'), ('2025-05-02', 'Nghỉ bù'),
  ('2025-09-01', 'Quốc khánh'), ('2025-09-02', 'Quốc khánh'),
  ('2026-01-01', 'Tết Dương lịch'), ('2026-01-02', 'Nghỉ bù'),
  ('2026-02-16', 'Tết Nguyên đán'), ('2026-02-17', 'Tết Nguyên đán'), ('2026-02-18', 'Tết Nguyên đán'),
  ('2026-02-19', 'Tết Nguyên đán'), ('2026-02-20', 'Tết Nguyên đán'),
  ('2026-04-27', 'Giỗ Tổ Hùng Vương (nghỉ bù)'),
  ('2026-04-30', 'Ngày Giải phóng miền Nam'), ('2026-05-01', 'Quốc tế Lao động'),
  ('2026-08-31', 'Quốc khánh (nghỉ bù)'), ('2026-09-01', 'Quốc khánh'), ('2026-09-02', 'Quốc khánh'),
  ('2027-01-01', 'Tết Dương lịch');

-- FR-M12-07: chat log keeps how each answer was produced; personal questions are masked when staff read the log.
ALTER TABLE chat_messages
  ADD COLUMN engine text,
  ADD COLUMN intent text,
  ADD COLUMN filter_result text,
  ADD COLUMN personal boolean NOT NULL DEFAULT false;
CREATE INDEX chat_messages_created_idx ON chat_messages(created_at DESC);
