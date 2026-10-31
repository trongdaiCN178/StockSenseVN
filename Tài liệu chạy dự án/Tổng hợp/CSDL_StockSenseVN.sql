-- ====================================================================================================
-- CSDL STOCKSENSE VN (IDSS) – TOÀN BỘ BẢNG VÀ QUAN HỆ
-- Cập nhật: 31/10/2026 · PostgreSQL 17
--
-- PHẦN A (mục 1–12): 36 bảng đang chạy, sinh tự động từ CSDL thật (khớp migration 001–022),
--   gồm cột, khóa chính, khóa duy nhất, ràng buộc CHECK, 43 khóa ngoại, chỉ mục, hàm và trigger.
--   Không gồm bảng kỹ thuật schema_migrations (lưu lịch sử chạy migration).
-- PHẦN B: 7 bảng và các cột bổ sung cho mô hình AI (đề xuất theo SDD §6.2, CHƯA tạo trong CSDL).
--
-- Chạy được trên CSDL PostgreSQL trống theo thứ tự trong file (đã kiểm tra). Khóa ngoại để riêng ở mục 11
-- để không phụ thuộc thứ tự bảng; dưới mỗi bảng có dòng "Liên kết" tóm tắt quan hệ để tiện vẽ ERD.
-- Visual Paradigm: Tools → DB Modeling → Reverse Database (từ CSDL đang chạy) hoặc nhập file DDL này.
--
-- Nhóm bảng:
--   1. Người dùng, xác thực, đăng ký: users, auth_sessions, password_reset_tokens, password_reset_requests,
--      email_verification_tokens, registration_requests, user_consent, role_requests
--   2. Thị trường: symbols, daily_prices (giá khớp + giá điều chỉnh), market_index_daily, market_holidays
--   3. Dự báo: market_batches, forecasts, market_indices, market_summary
--   4. Tin tức: news_items, news_item_symbols
--   5. Watchlist, cảnh báo: watchlist_items, alert_rules, user_alerts
--   6. Screener: saved_screener_filters
--   7. Portfolio, Trade Plan, Journal: portfolio_transactions, investment_profiles, trade_plans,
--      trade_plan_revisions, journal_entries
--   8. Chat: chat_sessions, chat_messages
--   9. Thông báo: notification_preferences, notification_channels, notification_outbox
--  10. Quản trị, vận hành: admin_audit_log, admin_job_runs, admin_worker_instances, data_ingestion_runs
-- ====================================================================================================

-- ====================================================================================================
-- 1. Người dùng, xác thực và đăng ký (M0)
-- ====================================================================================================

CREATE TABLE users (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL,
  must_change_password boolean DEFAULT false NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  failed_login_count integer DEFAULT 0 NOT NULL,
  locked_until timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  full_name text,
  email_verified_at timestamp with time zone,
  age_confirmed_at timestamp with time zone,
  created_via text DEFAULT 'admin'::text NOT NULL,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_email_key UNIQUE (email),
  CONSTRAINT users_failed_login_count_check CHECK ((failed_login_count >= 0)),
  CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['retail'::text, 'trader'::text, 'analyst'::text, 'admin'::text])))
);

CREATE TABLE auth_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  token_hash text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  revoked_at timestamp with time zone,
  last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT auth_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT auth_sessions_token_hash_key UNIQUE (token_hash)
);
-- Liên kết: user_id → users(id) [xóa theo]
CREATE INDEX auth_sessions_user_active_idx ON auth_sessions USING btree (user_id, expires_at) WHERE (revoked_at IS NULL);

CREATE TABLE password_reset_tokens (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  token_hash character(64) NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT password_reset_tokens_token_hash_key UNIQUE (token_hash)
);
-- Liên kết: user_id → users(id) [xóa theo]
CREATE INDEX password_reset_tokens_user_active_idx ON password_reset_tokens USING btree (user_id, expires_at) WHERE (consumed_at IS NULL);

CREATE TABLE password_reset_requests (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  email_key character(64) NOT NULL,
  ip_key character(64) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT password_reset_requests_pkey PRIMARY KEY (id)
);
CREATE INDEX password_reset_requests_email_recent_idx ON password_reset_requests USING btree (email_key, created_at DESC);
CREATE INDEX password_reset_requests_ip_recent_idx ON password_reset_requests USING btree (ip_key, created_at DESC);

CREATE TABLE email_verification_tokens (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  token_hash character(64) NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT email_verification_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT email_verification_tokens_token_hash_key UNIQUE (token_hash)
);
-- Liên kết: user_id → users(id) [xóa theo]
CREATE INDEX email_verification_tokens_user_active_idx ON email_verification_tokens USING btree (user_id, expires_at) WHERE (consumed_at IS NULL);

CREATE TABLE registration_requests (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  email_key character(64) NOT NULL,
  ip_key character(64) NOT NULL,
  kind text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT registration_requests_pkey PRIMARY KEY (id),
  CONSTRAINT registration_requests_kind_check CHECK ((kind = ANY (ARRAY['register'::text, 'resend'::text])))
);
CREATE INDEX registration_requests_email_recent_idx ON registration_requests USING btree (email_key, kind, created_at DESC);
CREATE INDEX registration_requests_ip_recent_idx ON registration_requests USING btree (ip_key, kind, created_at DESC);

CREATE TABLE user_consent (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  doc_type text NOT NULL,
  version text NOT NULL,
  channel text NOT NULL,
  accepted_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT user_consent_pkey PRIMARY KEY (id)
);
-- Liên kết: user_id → users(id) [xóa theo]
CREATE INDEX user_consent_user_idx ON user_consent USING btree (user_id, doc_type, accepted_at DESC);

CREATE TABLE role_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  requested_role text NOT NULL,
  organization text NOT NULL,
  position text NOT NULL,
  work_email text NOT NULL,
  purpose text NOT NULL,
  status text DEFAULT 'pending_review'::text NOT NULL,
  decided_by uuid,
  decided_at timestamp with time zone,
  note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT role_requests_pkey PRIMARY KEY (id),
  CONSTRAINT role_requests_requested_role_check CHECK ((requested_role = 'analyst'::text)),
  CONSTRAINT role_requests_status_check CHECK ((status = ANY (ARRAY['pending_review'::text, 'approved'::text, 'rejected'::text])))
);
-- Liên kết: decided_by → users(id) [đặt NULL]; user_id → users(id) [xóa theo]
CREATE UNIQUE INDEX role_requests_one_pending_idx ON role_requests USING btree (user_id) WHERE (status = 'pending_review'::text);
CREATE INDEX role_requests_status_idx ON role_requests USING btree (status, created_at DESC);
CREATE INDEX role_requests_user_idx ON role_requests USING btree (user_id, created_at DESC);

-- ====================================================================================================
-- 2. Dữ liệu thị trường (M1, M2)
-- ====================================================================================================

CREATE TABLE symbols (
  symbol character varying(12) NOT NULL,
  name text NOT NULL,
  exchange text NOT NULL,
  currency character(3) DEFAULT 'VND'::bpchar NOT NULL,
  is_enabled boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  industry text,
  CONSTRAINT symbols_pkey PRIMARY KEY (symbol),
  CONSTRAINT symbols_exchange_check CHECK ((exchange = ANY (ARRAY['HOSE'::text, 'HNX'::text, 'UPCOM'::text]))),
  CONSTRAINT symbols_symbol_check CHECK (((symbol)::text = upper((symbol)::text)))
);

CREATE TABLE daily_prices (
  symbol character varying(12) NOT NULL,
  trade_date date NOT NULL,
  open numeric(18,4),
  high numeric(18,4),
  low numeric(18,4),
  close numeric(18,4) NOT NULL,
  volume bigint,
  turnover numeric(22,2),
  source text DEFAULT 'unknown'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  adj_open numeric(18,4),
  adj_high numeric(18,4),
  adj_low numeric(18,4),
  adj_close numeric(18,4),
  CONSTRAINT daily_prices_pkey PRIMARY KEY (symbol, trade_date),
  CONSTRAINT daily_prices_close_check CHECK ((close > (0)::numeric))
);
-- Liên kết: symbol → symbols(symbol) [xóa theo]

CREATE TABLE market_index_daily (
  code character varying(16) NOT NULL,
  trade_date date NOT NULL,
  open numeric(14,4),
  high numeric(14,4),
  low numeric(14,4),
  close numeric(14,4) NOT NULL,
  change_points numeric(14,4),
  change_percent numeric(10,4),
  volume bigint,
  turnover numeric(22,2),
  source text DEFAULT 'ssi'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT market_index_daily_pkey PRIMARY KEY (code, trade_date),
  CONSTRAINT market_index_daily_close_check CHECK ((close > (0)::numeric))
);

CREATE TABLE market_holidays (
  holiday date NOT NULL,
  name text NOT NULL,
  CONSTRAINT market_holidays_pkey PRIMARY KEY (holiday)
);

-- ====================================================================================================
-- 3. Dự báo (M2) – lô dự báo, chỉ số và độ rộng theo lô
-- ====================================================================================================

CREATE TABLE market_batches (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  data_date date NOT NULL,
  batch_completed_at timestamp with time zone,
  model_version text NOT NULL,
  state text NOT NULL,
  source_status text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT market_batches_pkey PRIMARY KEY (id),
  CONSTRAINT market_batches_data_date_model_version_key UNIQUE (data_date, model_version)
);

CREATE TABLE forecasts (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  batch_id bigint NOT NULL,
  symbol character varying(12) NOT NULL,
  horizon text NOT NULL,
  label text NOT NULL,
  probability_up numeric(8,7) NOT NULL,
  probability_hold numeric(8,7) NOT NULL,
  probability_down numeric(8,7) NOT NULL,
  confidence text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT forecasts_pkey PRIMARY KEY (id),
  CONSTRAINT forecasts_batch_id_symbol_horizon_key UNIQUE (batch_id, symbol, horizon),
  CONSTRAINT forecasts_check CHECK ((abs((((probability_up + probability_hold) + probability_down) - (1)::numeric)) < 0.0001)),
  CONSTRAINT forecasts_confidence_check CHECK ((confidence = ANY (ARRAY['low'::text, 'mid'::text, 'high'::text]))),
  CONSTRAINT forecasts_horizon_check CHECK ((horizon = ANY (ARRAY['t2'::text, 't5'::text]))),
  CONSTRAINT forecasts_label_check CHECK ((label = ANY (ARRAY['up'::text, 'hold'::text, 'down'::text]))),
  CONSTRAINT forecasts_probability_down_check CHECK (((probability_down >= (0)::numeric) AND (probability_down <= (1)::numeric))),
  CONSTRAINT forecasts_probability_hold_check CHECK (((probability_hold >= (0)::numeric) AND (probability_hold <= (1)::numeric))),
  CONSTRAINT forecasts_probability_up_check CHECK (((probability_up >= (0)::numeric) AND (probability_up <= (1)::numeric)))
);
-- Liên kết: batch_id → market_batches(id) [xóa theo]; symbol → symbols(symbol) [xóa theo]
CREATE INDEX forecasts_symbol_latest_idx ON forecasts USING btree (symbol, batch_id DESC, horizon);

CREATE TABLE market_indices (
  batch_id bigint NOT NULL,
  code text NOT NULL,
  label text NOT NULL,
  value numeric(18,4) NOT NULL,
  change_points numeric(18,4) NOT NULL,
  change_percent numeric(10,4) NOT NULL,
  CONSTRAINT market_indices_pkey PRIMARY KEY (batch_id, code)
);
-- Liên kết: batch_id → market_batches(id) [xóa theo]

CREATE TABLE market_summary (
  batch_id bigint NOT NULL,
  advances integer NOT NULL,
  nochanges integer NOT NULL,
  declines integer NOT NULL,
  labels_up integer NOT NULL,
  labels_hold integer NOT NULL,
  labels_down integer NOT NULL,
  CONSTRAINT market_summary_pkey PRIMARY KEY (batch_id),
  CONSTRAINT market_summary_advances_check CHECK ((advances >= 0)),
  CONSTRAINT market_summary_declines_check CHECK ((declines >= 0)),
  CONSTRAINT market_summary_labels_down_check CHECK ((labels_down >= 0)),
  CONSTRAINT market_summary_labels_hold_check CHECK ((labels_hold >= 0)),
  CONSTRAINT market_summary_labels_up_check CHECK ((labels_up >= 0)),
  CONSTRAINT market_summary_nochanges_check CHECK ((nochanges >= 0))
);
-- Liên kết: batch_id → market_batches(id) [xóa theo]

-- ====================================================================================================
-- 4. Tin tức (M4)
-- ====================================================================================================

CREATE TABLE news_items (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  symbol character varying(12),
  external_id text NOT NULL,
  title text NOT NULL,
  summary text DEFAULT ''::text NOT NULL,
  source text NOT NULL,
  published_at timestamp with time zone NOT NULL,
  sentiment text DEFAULT 'neutral'::text NOT NULL,
  url text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT news_items_pkey PRIMARY KEY (id),
  CONSTRAINT news_items_source_external_id_key UNIQUE (source, external_id),
  CONSTRAINT news_items_sentiment_check CHECK ((sentiment = ANY (ARRAY['positive'::text, 'neutral'::text, 'negative'::text])))
);
-- Liên kết: symbol → symbols(symbol) [xóa theo]
CREATE INDEX news_items_symbol_published_idx ON news_items USING btree (symbol, published_at DESC);

CREATE TABLE news_item_symbols (
  news_item_id bigint NOT NULL,
  symbol character varying(12) NOT NULL,
  match_method text DEFAULT 'symbol_match'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT news_item_symbols_pkey PRIMARY KEY (news_item_id, symbol)
);
-- Liên kết: news_item_id → news_items(id) [xóa theo]; symbol → symbols(symbol) [xóa theo]
CREATE INDEX news_item_symbols_symbol_idx ON news_item_symbols USING btree (symbol, news_item_id);

-- ====================================================================================================
-- 5. Watchlist và cảnh báo (M5)
-- ====================================================================================================

CREATE TABLE watchlist_items (
  user_id uuid NOT NULL,
  symbol character varying(12) NOT NULL,
  note character varying(500) DEFAULT ''::character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT watchlist_items_pkey PRIMARY KEY (user_id, symbol)
);
-- Liên kết: symbol → symbols(symbol) [xóa theo]; user_id → users(id) [xóa theo]

CREATE TABLE alert_rules (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  symbol character varying(12) NOT NULL,
  condition text NOT NULL,
  target_price numeric(18,4) NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT alert_rules_pkey PRIMARY KEY (id),
  CONSTRAINT alert_rules_condition_check CHECK ((condition = ANY (ARRAY['price_above'::text, 'price_below'::text]))),
  CONSTRAINT alert_rules_target_price_check CHECK ((target_price > (0)::numeric))
);
-- Liên kết: symbol → symbols(symbol) [xóa theo]; user_id → users(id) [xóa theo]
CREATE INDEX alert_rules_active_symbol_idx ON alert_rules USING btree (symbol, condition, target_price) WHERE (is_active = true);
CREATE INDEX alert_rules_user_idx ON alert_rules USING btree (user_id, created_at DESC);

CREATE TABLE user_alerts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  rule_id uuid,
  symbol character varying(12),
  trade_date date NOT NULL,
  alert_type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  plan_id uuid,
  CONSTRAINT user_alerts_pkey PRIMARY KEY (id),
  CONSTRAINT user_alerts_rule_id_trade_date_key UNIQUE (rule_id, trade_date),
  CONSTRAINT user_alerts_alert_type_check CHECK ((alert_type = ANY (ARRAY['price_crossed_above'::text, 'price_crossed_below'::text, 'plan_entry_reached'::text, 'plan_stop_hit'::text, 'plan_target_hit'::text, 'plan_expired'::text, 'job_failed'::text])))
);
-- Liên kết: plan_id → trade_plans(id) [xóa theo]; rule_id → alert_rules(id) [đặt NULL]; symbol → symbols(symbol) [xóa theo]; user_id → users(id) [xóa theo]
CREATE INDEX user_alerts_inbox_idx ON user_alerts USING btree (user_id, created_at DESC, id DESC);
CREATE UNIQUE INDEX user_alerts_plan_event_idx ON user_alerts USING btree (plan_id, alert_type, trade_date) WHERE (plan_id IS NOT NULL);
CREATE INDEX user_alerts_unread_idx ON user_alerts USING btree (user_id, created_at DESC) WHERE (read_at IS NULL);

-- ====================================================================================================
-- 6. Screener (M8)
-- ====================================================================================================

CREATE TABLE saved_screener_filters (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  name character varying(80) NOT NULL,
  filters jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT saved_screener_filters_pkey PRIMARY KEY (id),
  CONSTRAINT saved_screener_filters_user_id_name_key UNIQUE (user_id, name),
  CONSTRAINT saved_screener_filters_filters_check CHECK ((jsonb_typeof(filters) = 'object'::text))
);
-- Liên kết: user_id → users(id) [xóa theo]
CREATE INDEX saved_screener_filters_user_idx ON saved_screener_filters USING btree (user_id, updated_at DESC);

-- ====================================================================================================
-- 7. Portfolio, Trade Plan, Journal, hồ sơ đầu tư (M9, M10, M11)
-- ====================================================================================================

CREATE TABLE portfolio_transactions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  symbol character varying(12) NOT NULL,
  side text NOT NULL,
  quantity numeric(18,4) NOT NULL,
  unit_price numeric(18,4) NOT NULL,
  fee numeric(18,2) DEFAULT 0 NOT NULL,
  executed_at date NOT NULL,
  note character varying(500) DEFAULT ''::character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT portfolio_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT portfolio_transactions_fee_check CHECK ((fee >= (0)::numeric)),
  CONSTRAINT portfolio_transactions_quantity_check CHECK ((quantity > (0)::numeric)),
  CONSTRAINT portfolio_transactions_side_check CHECK ((side = ANY (ARRAY['buy'::text, 'sell'::text]))),
  CONSTRAINT portfolio_transactions_unit_price_check CHECK ((unit_price > (0)::numeric))
);
-- Liên kết: symbol → symbols(symbol); user_id → users(id) [xóa theo]
CREATE INDEX portfolio_transactions_history_idx ON portfolio_transactions USING btree (user_id, executed_at DESC, created_at DESC);
CREATE INDEX portfolio_transactions_ledger_idx ON portfolio_transactions USING btree (user_id, symbol, executed_at, created_at, id);

CREATE TABLE investment_profiles (
  user_id uuid NOT NULL,
  capital_vnd numeric(20,2) NOT NULL,
  risk_pct numeric(8,4) NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT investment_profiles_pkey PRIMARY KEY (user_id),
  CONSTRAINT investment_profiles_capital_vnd_check CHECK (((capital_vnd > (0)::numeric) AND (capital_vnd <= ('1000000000000000'::bigint)::numeric))),
  CONSTRAINT investment_profiles_risk_pct_check CHECK (((risk_pct > (0)::numeric) AND (risk_pct <= (100)::numeric)))
);
-- Liên kết: user_id → users(id) [xóa theo]

CREATE TABLE trade_plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  symbol character varying(12) NOT NULL,
  side text NOT NULL,
  status text DEFAULT 'planned'::text NOT NULL,
  entry_price numeric(18,4) NOT NULL,
  stop_price numeric(18,4) NOT NULL,
  target_price numeric(18,4) NOT NULL,
  quantity numeric(18,4),
  capital_vnd numeric(20,2),
  risk_pct numeric(8,4),
  note character varying(1000) DEFAULT ''::character varying NOT NULL,
  snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
  exit_price numeric(18,4),
  close_note character varying(1000),
  realized_pnl numeric(20,2),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  closed_at timestamp with time zone,
  entry_price_max numeric(18,4),
  expires_on date,
  close_reason text,
  CONSTRAINT trade_plans_pkey PRIMARY KEY (id),
  CONSTRAINT trade_plans_capital_vnd_check CHECK ((capital_vnd > (0)::numeric)),
  CONSTRAINT trade_plans_check CHECK (((status = 'closed'::text) = (closed_at IS NOT NULL))),
  CONSTRAINT trade_plans_check1 CHECK (((status = 'closed'::text) = (exit_price IS NOT NULL))),
  CONSTRAINT trade_plans_close_reason_check CHECK ((close_reason = ANY (ARRAY['target_hit'::text, 'stop_hit'::text, 'expired'::text, 'manual'::text, 'cancelled'::text]))),
  CONSTRAINT trade_plans_entry_price_check CHECK ((entry_price > (0)::numeric)),
  CONSTRAINT trade_plans_entry_price_max_check CHECK ((entry_price_max > (0)::numeric)),
  CONSTRAINT trade_plans_entry_zone_check CHECK (((entry_price_max IS NULL) OR (entry_price_max >= entry_price))),
  CONSTRAINT trade_plans_exit_price_check CHECK ((exit_price > (0)::numeric)),
  CONSTRAINT trade_plans_quantity_check CHECK ((quantity > (0)::numeric)),
  CONSTRAINT trade_plans_risk_pct_check CHECK (((risk_pct > (0)::numeric) AND (risk_pct <= (100)::numeric))),
  CONSTRAINT trade_plans_side_check CHECK ((side = ANY (ARRAY['long'::text, 'short'::text]))),
  CONSTRAINT trade_plans_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'planned'::text, 'active'::text, 'closed'::text, 'cancelled'::text]))),
  CONSTRAINT trade_plans_stop_price_check CHECK ((stop_price > (0)::numeric)),
  CONSTRAINT trade_plans_target_price_check CHECK ((target_price > (0)::numeric))
);
-- Liên kết: symbol → symbols(symbol); user_id → users(id) [xóa theo]
CREATE INDEX trade_plans_owner_status_idx ON trade_plans USING btree (user_id, status, created_at DESC);

CREATE TABLE trade_plan_revisions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  plan_id uuid NOT NULL,
  user_id uuid NOT NULL,
  previous jsonb NOT NULL,
  changes jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT trade_plan_revisions_pkey PRIMARY KEY (id)
);
-- Liên kết: plan_id → trade_plans(id) [xóa theo]; user_id → users(id) [xóa theo]
CREATE INDEX trade_plan_revisions_plan_idx ON trade_plan_revisions USING btree (plan_id, created_at DESC);

CREATE TABLE journal_entries (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  plan_id uuid,
  symbol character varying(12) NOT NULL,
  kind text NOT NULL,
  title character varying(160) NOT NULL,
  body text DEFAULT ''::text NOT NULL,
  realized_pnl numeric(20,2),
  snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  tags text[] DEFAULT '{}'::text[] NOT NULL,
  lesson text DEFAULT ''::text NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  decision_date date,
  CONSTRAINT journal_entries_pkey PRIMARY KEY (id),
  CONSTRAINT journal_entries_plan_id_key UNIQUE (plan_id),
  CONSTRAINT journal_entries_kind_check CHECK ((kind = ANY (ARRAY['plan_close'::text, 'manual'::text])))
);
-- Liên kết: plan_id → trade_plans(id) [đặt NULL]; symbol → symbols(symbol); user_id → users(id) [xóa theo]
CREATE INDEX journal_entries_owner_created_idx ON journal_entries USING btree (user_id, created_at DESC);
CREATE INDEX journal_entries_owner_symbol_idx ON journal_entries USING btree (user_id, symbol, created_at DESC);

-- ====================================================================================================
-- 8. Chat (M12)
-- ====================================================================================================

CREATE TABLE chat_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  title character varying(120) DEFAULT 'Cuộc trò chuyện mới'::character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT chat_sessions_pkey PRIMARY KEY (id)
);
-- Liên kết: user_id → users(id) [xóa theo]
CREATE INDEX chat_sessions_owner_updated_idx ON chat_sessions USING btree (user_id, updated_at DESC);

CREATE TABLE chat_messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  status text DEFAULT 'complete'::text NOT NULL,
  citations jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  engine text,
  intent text,
  filter_result text,
  personal boolean DEFAULT false NOT NULL,
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_content_check CHECK (((length(content) >= 1) AND (length(content) <= 8000))),
  CONSTRAINT chat_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text]))),
  CONSTRAINT chat_messages_status_check CHECK ((status = ANY (ARRAY['complete'::text, 'blocked'::text, 'failed'::text])))
);
-- Liên kết: session_id → chat_sessions(id) [xóa theo]; user_id → users(id) [xóa theo]
CREATE INDEX chat_messages_created_idx ON chat_messages USING btree (created_at DESC);
CREATE INDEX chat_messages_owner_session_idx ON chat_messages USING btree (user_id, session_id, created_at, id);

-- ====================================================================================================
-- 9. Thông báo email/Telegram (M5)
-- ====================================================================================================

CREATE TABLE notification_preferences (
  user_id uuid NOT NULL,
  in_app_enabled boolean DEFAULT true NOT NULL,
  email_enabled boolean DEFAULT false NOT NULL,
  telegram_enabled boolean DEFAULT false NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT notification_preferences_pkey PRIMARY KEY (user_id)
);
-- Liên kết: user_id → users(id) [xóa theo]

CREATE TABLE notification_channels (
  user_id uuid NOT NULL,
  channel text NOT NULL,
  destination text,
  verified_at timestamp with time zone,
  challenge_hash bytea,
  challenge_expires_at timestamp with time zone,
  challenge_attempts integer DEFAULT 0 NOT NULL,
  last_challenge_at timestamp with time zone,
  last_test_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT notification_channels_pkey PRIMARY KEY (user_id, channel),
  CONSTRAINT notification_channels_challenge_attempts_check CHECK (((challenge_attempts >= 0) AND (challenge_attempts <= 5))),
  CONSTRAINT notification_channels_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'telegram'::text]))),
  CONSTRAINT notification_channels_check CHECK (((verified_at IS NULL) OR ((destination IS NOT NULL) AND (challenge_hash IS NULL))))
);
-- Liên kết: user_id → users(id) [xóa theo]
CREATE UNIQUE INDEX notification_channels_destination_idx ON notification_channels USING btree (channel, destination) WHERE (verified_at IS NOT NULL);

CREATE TABLE notification_outbox (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  alert_id uuid NOT NULL,
  channel text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  attempt_count integer DEFAULT 0 NOT NULL,
  next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
  locked_at timestamp with time zone,
  sent_at timestamp with time zone,
  last_error_code character varying(80),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT notification_outbox_pkey PRIMARY KEY (id),
  CONSTRAINT notification_outbox_alert_id_channel_key UNIQUE (alert_id, channel),
  CONSTRAINT notification_outbox_attempt_count_check CHECK (((attempt_count >= 0) AND (attempt_count <= 5))),
  CONSTRAINT notification_outbox_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'telegram'::text]))),
  CONSTRAINT notification_outbox_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'skipped'::text, 'failed'::text])))
);
-- Liên kết: alert_id → user_alerts(id) [xóa theo]; user_id → users(id) [xóa theo]
CREATE INDEX notification_outbox_pending_idx ON notification_outbox USING btree (next_attempt_at, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'processing'::text]));

-- ====================================================================================================
-- 10. Quản trị và vận hành (M7)
-- ====================================================================================================

CREATE TABLE admin_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  actor_user_id uuid,
  target_user_id uuid,
  event_type text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id)
);
-- Liên kết: actor_user_id → users(id) [đặt NULL]; target_user_id → users(id) [đặt NULL]
CREATE INDEX admin_audit_log_created_idx ON admin_audit_log USING btree (created_at DESC, id DESC);
CREATE INDEX admin_audit_log_target_idx ON admin_audit_log USING btree (target_user_id, created_at DESC);

CREATE TABLE admin_job_runs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  job_key text NOT NULL,
  status text DEFAULT 'queued'::text NOT NULL,
  requested_by uuid,
  payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  attempt_count integer DEFAULT 0 NOT NULL,
  queued_at timestamp with time zone DEFAULT now() NOT NULL,
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  lease_expires_at timestamp with time zone,
  error_code text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  scheduled_for date,
  CONSTRAINT admin_job_runs_pkey PRIMARY KEY (id),
  CONSTRAINT admin_job_runs_attempt_count_check CHECK ((attempt_count >= 0)),
  CONSTRAINT admin_job_runs_job_key_check CHECK ((job_key = ANY (ARRAY['market.sync'::text, 'news.sync'::text, 'notifications.deliver'::text]))),
  CONSTRAINT admin_job_runs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'succeeded'::text, 'partial'::text, 'failed'::text])))
);
-- Liên kết: requested_by → users(id) [đặt NULL]
CREATE INDEX admin_job_runs_claim_idx ON admin_job_runs USING btree (status, queued_at, lease_expires_at);
CREATE UNIQUE INDEX admin_job_runs_one_active_per_job_idx ON admin_job_runs USING btree (job_key) WHERE (status = ANY (ARRAY['queued'::text, 'running'::text]));
CREATE INDEX admin_job_runs_recent_idx ON admin_job_runs USING btree (queued_at DESC, id DESC);
CREATE UNIQUE INDEX admin_job_runs_scheduled_idx ON admin_job_runs USING btree (job_key, scheduled_for) WHERE (scheduled_for IS NOT NULL);

CREATE TABLE admin_worker_instances (
  worker_id text NOT NULL,
  mode text NOT NULL,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  heartbeat_at timestamp with time zone DEFAULT now() NOT NULL,
  active_job_key text,
  stopped_at timestamp with time zone,
  CONSTRAINT admin_worker_instances_pkey PRIMARY KEY (worker_id),
  CONSTRAINT admin_worker_instances_active_job_key_check CHECK ((active_job_key = ANY (ARRAY['market.sync'::text, 'news.sync'::text, 'notifications.deliver'::text]))),
  CONSTRAINT admin_worker_instances_mode_check CHECK ((mode = ANY (ARRAY['once'::text, 'watch'::text])))
);
CREATE INDEX admin_worker_instances_heartbeat_idx ON admin_worker_instances USING btree (heartbeat_at DESC);

CREATE TABLE data_ingestion_runs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  source text NOT NULL,
  dataset text NOT NULL,
  status text NOT NULL,
  range_start date NOT NULL,
  range_end date NOT NULL,
  symbols_total integer DEFAULT 0 NOT NULL,
  symbols_succeeded integer DEFAULT 0 NOT NULL,
  rows_upserted integer DEFAULT 0 NOT NULL,
  error_message text,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  completed_at timestamp with time zone,
  units_label text DEFAULT 'symbols'::text NOT NULL,
  CONSTRAINT data_ingestion_runs_pkey PRIMARY KEY (id),
  CONSTRAINT data_ingestion_runs_check CHECK ((range_start <= range_end)),
  CONSTRAINT data_ingestion_runs_rows_upserted_check CHECK ((rows_upserted >= 0)),
  CONSTRAINT data_ingestion_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'succeeded'::text, 'partial'::text, 'failed'::text]))),
  CONSTRAINT data_ingestion_runs_symbols_succeeded_check CHECK ((symbols_succeeded >= 0)),
  CONSTRAINT data_ingestion_runs_symbols_total_check CHECK ((symbols_total >= 0))
);
CREATE INDEX data_ingestion_runs_recent_idx ON data_ingestion_runs USING btree (dataset, started_at DESC, id DESC);

-- ====================================================================================================
-- 11. Quan hệ giữa các bảng (khóa ngoại)
-- ====================================================================================================

ALTER TABLE auth_sessions ADD CONSTRAINT auth_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE password_reset_tokens ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE email_verification_tokens ADD CONSTRAINT email_verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE user_consent ADD CONSTRAINT user_consent_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE role_requests ADD CONSTRAINT role_requests_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE role_requests ADD CONSTRAINT role_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE daily_prices ADD CONSTRAINT daily_prices_symbol_fkey FOREIGN KEY (symbol) REFERENCES symbols(symbol) ON DELETE CASCADE;
ALTER TABLE forecasts ADD CONSTRAINT forecasts_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES market_batches(id) ON DELETE CASCADE;
ALTER TABLE forecasts ADD CONSTRAINT forecasts_symbol_fkey FOREIGN KEY (symbol) REFERENCES symbols(symbol) ON DELETE CASCADE;
ALTER TABLE market_indices ADD CONSTRAINT market_indices_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES market_batches(id) ON DELETE CASCADE;
ALTER TABLE market_summary ADD CONSTRAINT market_summary_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES market_batches(id) ON DELETE CASCADE;
ALTER TABLE news_items ADD CONSTRAINT news_items_symbol_fkey FOREIGN KEY (symbol) REFERENCES symbols(symbol) ON DELETE CASCADE;
ALTER TABLE news_item_symbols ADD CONSTRAINT news_item_symbols_news_item_id_fkey FOREIGN KEY (news_item_id) REFERENCES news_items(id) ON DELETE CASCADE;
ALTER TABLE news_item_symbols ADD CONSTRAINT news_item_symbols_symbol_fkey FOREIGN KEY (symbol) REFERENCES symbols(symbol) ON DELETE CASCADE;
ALTER TABLE watchlist_items ADD CONSTRAINT watchlist_items_symbol_fkey FOREIGN KEY (symbol) REFERENCES symbols(symbol) ON DELETE CASCADE;
ALTER TABLE watchlist_items ADD CONSTRAINT watchlist_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE alert_rules ADD CONSTRAINT alert_rules_symbol_fkey FOREIGN KEY (symbol) REFERENCES symbols(symbol) ON DELETE CASCADE;
ALTER TABLE alert_rules ADD CONSTRAINT alert_rules_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE user_alerts ADD CONSTRAINT user_alerts_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES trade_plans(id) ON DELETE CASCADE;
ALTER TABLE user_alerts ADD CONSTRAINT user_alerts_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE SET NULL;
ALTER TABLE user_alerts ADD CONSTRAINT user_alerts_symbol_fkey FOREIGN KEY (symbol) REFERENCES symbols(symbol) ON DELETE CASCADE;
ALTER TABLE user_alerts ADD CONSTRAINT user_alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE saved_screener_filters ADD CONSTRAINT saved_screener_filters_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE portfolio_transactions ADD CONSTRAINT portfolio_transactions_symbol_fkey FOREIGN KEY (symbol) REFERENCES symbols(symbol);
ALTER TABLE portfolio_transactions ADD CONSTRAINT portfolio_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE investment_profiles ADD CONSTRAINT investment_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE trade_plans ADD CONSTRAINT trade_plans_symbol_fkey FOREIGN KEY (symbol) REFERENCES symbols(symbol);
ALTER TABLE trade_plans ADD CONSTRAINT trade_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE trade_plan_revisions ADD CONSTRAINT trade_plan_revisions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES trade_plans(id) ON DELETE CASCADE;
ALTER TABLE trade_plan_revisions ADD CONSTRAINT trade_plan_revisions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES trade_plans(id) ON DELETE SET NULL;
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_symbol_fkey FOREIGN KEY (symbol) REFERENCES symbols(symbol);
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE chat_sessions ADD CONSTRAINT chat_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE notification_preferences ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE notification_channels ADD CONSTRAINT notification_channels_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE notification_outbox ADD CONSTRAINT notification_outbox_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES user_alerts(id) ON DELETE CASCADE;
ALTER TABLE notification_outbox ADD CONSTRAINT notification_outbox_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE admin_job_runs ADD CONSTRAINT admin_job_runs_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL;

-- ====================================================================================================
-- 12. Hàm và trigger bảo vệ dữ liệu
-- ====================================================================================================

CREATE OR REPLACE FUNCTION ensure_chat_message_owner()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM chat_sessions s WHERE s.id = NEW.session_id AND s.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'chat message owner does not match session owner' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION protect_immutable_snapshots()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.snapshot IS DISTINCT FROM OLD.snapshot THEN
    RAISE EXCEPTION 'snapshot is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION protect_journal_result()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.realized_pnl IS DISTINCT FROM OLD.realized_pnl
    OR NEW.symbol IS DISTINCT FROM OLD.symbol
    OR NEW.kind IS DISTINCT FROM OLD.kind
    OR NEW.title IS DISTINCT FROM OLD.title THEN
    RAISE EXCEPTION 'journal result fields are immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER chat_messages_owner_guard BEFORE INSERT OR UPDATE ON chat_messages FOR EACH ROW EXECUTE FUNCTION ensure_chat_message_owner();
CREATE TRIGGER journal_entries_result_immutable BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION protect_journal_result();
CREATE TRIGGER journal_entries_snapshot_immutable BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION protect_immutable_snapshots();
CREATE TRIGGER trade_plans_snapshot_immutable BEFORE UPDATE ON trade_plans FOR EACH ROW EXECUTE FUNCTION protect_immutable_snapshots();

-- ====================================================================================================
-- PHẦN B – BẢNG CHO MÔ HÌNH AI (ĐỀ XUẤT, CHƯA TẠO TRONG CSDL)
-- Theo SDD §6.2 và §7, đặt tên/kiểu khóa theo các bảng đang chạy ở phần A.
-- Cần đội mô hình xác nhận trước khi tạo thành migration.
-- ====================================================================================================

-- Phiên bản mô hình (dự báo đa phương thức và mô hình cảm xúc tin tức). FR-M7-03, FR-M7-06.
CREATE TABLE model_versions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  code text NOT NULL,                       -- ví dụ 'mm-2026.11.02-a'
  kind text NOT NULL,                       -- 'forecast' | 'sentiment'
  trained_at timestamp with time zone NOT NULL,
  data_from date NOT NULL,                  -- khoảng dữ liệu huấn luyện
  data_to date NOT NULL,
  metrics jsonb DEFAULT '{}'::jsonb NOT NULL,   -- Macro F1, AUC, hit rate, Brier, ECE, ablation...
  config jsonb DEFAULT '{}'::jsonb NOT NULL,    -- siêu tham số, seed, phiên bản thư viện (NFR-12)
  checkpoint_uri text NOT NULL,
  passed_gate boolean DEFAULT false NOT NULL,   -- qua cổng đánh giá (SDD §7.7)
  is_serving boolean DEFAULT false NOT NULL,
  registered_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT model_versions_pkey PRIMARY KEY (id),
  CONSTRAINT model_versions_code_key UNIQUE (code),
  CONSTRAINT model_versions_kind_check CHECK ((kind = ANY (ARRAY['forecast'::text, 'sentiment'::text]))),
  CONSTRAINT model_versions_range_check CHECK ((data_from <= data_to))
);
CREATE UNIQUE INDEX model_versions_one_serving_idx ON model_versions USING btree (kind) WHERE is_serving;

-- Cảm xúc của từng tin theo một phiên bản mô hình cảm xúc. FR-M4-02.
CREATE TABLE news_sentiments (
  news_item_id bigint NOT NULL,
  model_version_id bigint NOT NULL,
  label text NOT NULL,                      -- 'positive' | 'neutral' | 'negative'
  probabilities jsonb NOT NULL,             -- {"positive":..,"neutral":..,"negative":..}
  confidence numeric(6,5) NOT NULL,
  scored_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT news_sentiments_pkey PRIMARY KEY (news_item_id, model_version_id),
  CONSTRAINT news_sentiments_label_check CHECK ((label = ANY (ARRAY['positive'::text, 'neutral'::text, 'negative'::text])))
);
-- Liên kết: news_item_id → news_items(id) [xóa theo]; model_version_id → model_versions(id)

-- Embedding PhoBERT của tin, tính một lần và dùng lại (SDD D8).
CREATE TABLE news_embeddings (
  news_item_id bigint NOT NULL,
  model_version_id bigint NOT NULL,
  vector bytea NOT NULL,                    -- float16 × 768
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT news_embeddings_pkey PRIMARY KEY (news_item_id, model_version_id)
);
-- Liên kết: news_item_id → news_items(id) [xóa theo]; model_version_id → model_versions(id)

-- Báo cáo tài chính quý, dùng theo ngày công bố (point-in-time). FR-M2-07, FR-M7-09.
CREATE TABLE financial_reports (
  symbol character varying(12) NOT NULL,
  period text NOT NULL,                     -- ví dụ '2026Q3'
  published_at timestamp with time zone NOT NULL,
  revenue numeric(22,2),
  net_income numeric(22,2),
  eps numeric(14,2),
  roe numeric(10,4),
  roa numeric(10,4),
  pe numeric(10,2),
  pb numeric(10,2),
  debt_to_equity numeric(10,4),
  extra jsonb DEFAULT '{}'::jsonb NOT NULL,
  source text NOT NULL,
  CONSTRAINT financial_reports_pkey PRIMARY KEY (symbol, period)
);
CREATE INDEX financial_reports_published_idx ON financial_reports USING btree (symbol, published_at DESC);
-- Liên kết: symbol → symbols(symbol) [xóa theo]

-- Snapshot đầu vào của một dự báo để tái lập (NFR-06).
CREATE TABLE forecast_inputs (
  snapshot_hash character(64) NOT NULL,     -- SHA-256 của tensor đầu vào
  manifest jsonb NOT NULL,                  -- giá, đặc trưng, BCTC, danh sách tin, cut-off đã dùng (FR-M7-09)
  tensors bytea NOT NULL,                   -- npz nén, đủ để chạy lại
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT forecast_inputs_pkey PRIMARY KEY (snapshot_hash)
);

-- Bổ sung cho bảng dự báo và lô dự báo đang có.
ALTER TABLE market_batches ADD COLUMN model_version_id bigint;   -- phiên bản đã ghim cho cả lô (AC-16)
ALTER TABLE forecasts
  ADD COLUMN model_version_id bigint,
  ADD COLUMN snapshot_hash character(64),
  ADD COLUMN due_on date,                        -- T+2/T+5 theo lịch giao dịch (FR-M2-03)
  ADD COLUMN data_status text[] DEFAULT '{}'::text[] NOT NULL,   -- 'missing_news', 'missing_fin', 'stale'
  ADD COLUMN actual_label text,                  -- điền khi đáo hạn (FR-M6)
  ADD COLUMN actual_return numeric(10,6),
  ADD COLUMN resolved_at timestamp with time zone,
  ADD CONSTRAINT forecasts_actual_label_check CHECK ((actual_label = ANY (ARRAY['up'::text, 'hold'::text, 'down'::text])));
-- Liên kết: market_batches.model_version_id → model_versions(id); forecasts.model_version_id → model_versions(id); forecasts.snapshot_hash → forecast_inputs(snapshot_hash)

-- Giải thích dự báo theo vai trò (FR-M3-01..04, FR-M2-09).
CREATE TABLE forecast_explanations (
  forecast_id bigint NOT NULL,
  group_share jsonb NOT NULL,               -- {"fin":.2,"tech":.5,"news":.3}
  top_features jsonb NOT NULL,              -- 15 đặc trưng: tên, nhóm, giá trị, đóng góp
  news_attention jsonb,                     -- [{"news_item_id":..,"weight":..}]
  reasons text[] NOT NULL,                  -- 3 câu cho retail
  risk_notes text[] DEFAULT '{}'::text[] NOT NULL,  -- "Điều gì có thể làm dự báo sai"
  CONSTRAINT forecast_explanations_pkey PRIMARY KEY (forecast_id)
);
-- Liên kết: forecast_id → forecasts(id) [xóa theo]

-- Yêu cầu chạy lại một dự báo và kết quả (FR-M7-10, AC-14).
CREATE TABLE forecast_replays (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  forecast_id bigint NOT NULL,
  requested_by uuid,
  model_version_id bigint NOT NULL,
  snapshot_hash character(64) NOT NULL,
  status text DEFAULT 'queued'::text NOT NULL,
  replay_probabilities jsonb,
  max_abs_error double precision,
  passed boolean,
  error_code text,
  requested_at timestamp with time zone DEFAULT now() NOT NULL,
  finished_at timestamp with time zone,
  CONSTRAINT forecast_replays_pkey PRIMARY KEY (id),
  CONSTRAINT forecast_replays_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text, 'failed'::text, 'not_reproducible'::text])))
);
-- Liên kết: forecast_id → forecasts(id) [xóa theo]; requested_by → users(id) [đặt NULL]; model_version_id → model_versions(id)

-- Quan hệ (khóa ngoại) của phần B.
ALTER TABLE news_sentiments ADD CONSTRAINT news_sentiments_news_item_id_fkey FOREIGN KEY (news_item_id) REFERENCES news_items(id) ON DELETE CASCADE;
ALTER TABLE news_sentiments ADD CONSTRAINT news_sentiments_model_version_id_fkey FOREIGN KEY (model_version_id) REFERENCES model_versions(id);
ALTER TABLE news_embeddings ADD CONSTRAINT news_embeddings_news_item_id_fkey FOREIGN KEY (news_item_id) REFERENCES news_items(id) ON DELETE CASCADE;
ALTER TABLE news_embeddings ADD CONSTRAINT news_embeddings_model_version_id_fkey FOREIGN KEY (model_version_id) REFERENCES model_versions(id);
ALTER TABLE financial_reports ADD CONSTRAINT financial_reports_symbol_fkey FOREIGN KEY (symbol) REFERENCES symbols(symbol) ON DELETE CASCADE;
ALTER TABLE market_batches ADD CONSTRAINT market_batches_model_version_id_fkey FOREIGN KEY (model_version_id) REFERENCES model_versions(id);
ALTER TABLE forecasts ADD CONSTRAINT forecasts_model_version_id_fkey FOREIGN KEY (model_version_id) REFERENCES model_versions(id);
ALTER TABLE forecasts ADD CONSTRAINT forecasts_snapshot_hash_fkey FOREIGN KEY (snapshot_hash) REFERENCES forecast_inputs(snapshot_hash);
ALTER TABLE forecast_explanations ADD CONSTRAINT forecast_explanations_forecast_id_fkey FOREIGN KEY (forecast_id) REFERENCES forecasts(id) ON DELETE CASCADE;
ALTER TABLE forecast_replays ADD CONSTRAINT forecast_replays_forecast_id_fkey FOREIGN KEY (forecast_id) REFERENCES forecasts(id) ON DELETE CASCADE;
ALTER TABLE forecast_replays ADD CONSTRAINT forecast_replays_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE forecast_replays ADD CONSTRAINT forecast_replays_model_version_id_fkey FOREIGN KEY (model_version_id) REFERENCES model_versions(id);
