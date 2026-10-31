-- Adjusted OHLC (after stock dividends, bonus shares and splits) next to the traded prices.
-- Traded prices drive the board (reference, ceiling, floor) and portfolio values; adjusted prices drive charts,
-- indicators, period returns and the model's training data (PRD A2).
ALTER TABLE daily_prices
  ADD COLUMN adj_open numeric(18, 4),
  ADD COLUMN adj_high numeric(18, 4),
  ADD COLUMN adj_low numeric(18, 4),
  ADD COLUMN adj_close numeric(18, 4);

-- Exchange holidays for the 5-year history used by the model (weekdays on which VN-Index had no session).
INSERT INTO market_holidays (holiday, name) VALUES
  ('2022-01-03', 'Tết Dương lịch (nghỉ bù)'),
  ('2022-01-31', 'Tết Nguyên đán'), ('2022-02-01', 'Tết Nguyên đán'), ('2022-02-02', 'Tết Nguyên đán'),
  ('2022-02-03', 'Tết Nguyên đán'), ('2022-02-04', 'Tết Nguyên đán'),
  ('2022-04-11', 'Giỗ Tổ Hùng Vương'),
  ('2022-05-02', 'Ngày Giải phóng miền Nam (nghỉ bù)'), ('2022-05-03', 'Quốc tế Lao động (nghỉ bù)'),
  ('2022-09-01', 'Quốc khánh'), ('2022-09-02', 'Quốc khánh'),
  ('2023-01-02', 'Tết Dương lịch (nghỉ bù)'),
  ('2023-01-20', 'Tết Nguyên đán'), ('2023-01-23', 'Tết Nguyên đán'), ('2023-01-24', 'Tết Nguyên đán'),
  ('2023-01-25', 'Tết Nguyên đán'), ('2023-01-26', 'Tết Nguyên đán'),
  ('2023-05-01', 'Quốc tế Lao động'), ('2023-05-02', 'Nghỉ bù'), ('2023-05-03', 'Nghỉ bù'),
  ('2023-09-01', 'Quốc khánh'), ('2023-09-04', 'Quốc khánh (nghỉ bù)'),
  ('2024-01-01', 'Tết Dương lịch'),
  ('2024-02-08', 'Tết Nguyên đán'), ('2024-02-09', 'Tết Nguyên đán'), ('2024-02-12', 'Tết Nguyên đán'),
  ('2024-02-13', 'Tết Nguyên đán'), ('2024-02-14', 'Tết Nguyên đán'),
  ('2024-04-18', 'Giỗ Tổ Hùng Vương'),
  ('2024-04-29', 'Nghỉ bù'), ('2024-04-30', 'Ngày Giải phóng miền Nam'), ('2024-05-01', 'Quốc tế Lao động'),
  ('2024-09-02', 'Quốc khánh'), ('2024-09-03', 'Quốc khánh')
ON CONFLICT (holiday) DO NOTHING;
