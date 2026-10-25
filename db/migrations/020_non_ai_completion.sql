-- Completes the PRD requirements that do not depend on the forecast model.

-- FR-M1-01/02, FR-M8-01, FR-M9-05: sector (industry) per symbol.
ALTER TABLE symbols ADD COLUMN industry text;
UPDATE symbols SET industry = CASE symbol
  WHEN 'FPT' THEN 'Công nghệ'
  WHEN 'HPG' THEN 'Thép'
  WHEN 'VCB' THEN 'Ngân hàng'
  WHEN 'MBB' THEN 'Ngân hàng'
  WHEN 'ACB' THEN 'Ngân hàng'
  WHEN 'VNM' THEN 'Thực phẩm & đồ uống'
  WHEN 'QNS' THEN 'Thực phẩm & đồ uống'
  WHEN 'SSI' THEN 'Chứng khoán'
  WHEN 'SHS' THEN 'Chứng khoán'
  WHEN 'MWG' THEN 'Bán lẻ'
  WHEN 'VIC' THEN 'Bất động sản'
  WHEN 'IDC' THEN 'Bất động sản'
  WHEN 'GAS' THEN 'Dầu khí'
  WHEN 'PVS' THEN 'Dầu khí'
  WHEN 'BSR' THEN 'Dầu khí'
  WHEN 'HUT' THEN 'Xây dựng & hạ tầng'
  WHEN 'VGT' THEN 'Dệt may'
  ELSE industry END;

-- FR-M10-01/05/09: draft status, entry zone, expiry, close reason and edit history.
ALTER TABLE trade_plans DROP CONSTRAINT trade_plans_status_check;
ALTER TABLE trade_plans ADD CONSTRAINT trade_plans_status_check
  CHECK (status IN ('draft', 'planned', 'active', 'closed', 'cancelled'));
ALTER TABLE trade_plans
  ADD COLUMN entry_price_max numeric(18, 4) CHECK (entry_price_max > 0),
  ADD COLUMN expires_on date,
  ADD COLUMN close_reason text CHECK (close_reason IN ('target_hit', 'stop_hit', 'expired', 'manual', 'cancelled')),
  ADD CONSTRAINT trade_plans_entry_zone_check CHECK (entry_price_max IS NULL OR entry_price_max >= entry_price);

CREATE TABLE trade_plan_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES trade_plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  previous jsonb NOT NULL,
  changes jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trade_plan_revisions_plan_idx ON trade_plan_revisions(plan_id, created_at DESC);

-- FR-M11-04: decision date for manual journal entries.
ALTER TABLE journal_entries ADD COLUMN decision_date date;

-- FR-M10-06, FR-M7-08: alerts for trade plan price levels and for failed pipeline jobs (sent to admins).
ALTER TABLE user_alerts ALTER COLUMN symbol DROP NOT NULL;
ALTER TABLE user_alerts DROP CONSTRAINT user_alerts_alert_type_check;
ALTER TABLE user_alerts ADD CONSTRAINT user_alerts_alert_type_check CHECK (alert_type IN (
  'price_crossed_above', 'price_crossed_below',
  'plan_entry_reached', 'plan_stop_hit', 'plan_target_hit', 'plan_expired',
  'job_failed'));
ALTER TABLE user_alerts ADD COLUMN plan_id uuid REFERENCES trade_plans(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX user_alerts_plan_event_idx ON user_alerts(plan_id, alert_type, trade_date) WHERE plan_id IS NOT NULL;

-- FR-M7-07: one scheduled run per job and trading day.
ALTER TABLE admin_job_runs ADD COLUMN scheduled_for date;
CREATE UNIQUE INDEX admin_job_runs_scheduled_idx ON admin_job_runs(job_key, scheduled_for) WHERE scheduled_for IS NOT NULL;
