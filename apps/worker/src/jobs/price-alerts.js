export async function createPriceCrossingAlerts(client, symbol) {
  const result = await client.query(`WITH created AS (
    INSERT INTO user_alerts
    (user_id, rule_id, symbol, trade_date, alert_type, title, message, payload)
    SELECT r.user_id, r.id, p.symbol, p.trade_date,
      CASE WHEN r.condition='price_above' THEN 'price_crossed_above' ELSE 'price_crossed_below' END,
      CASE WHEN r.condition='price_above' THEN p.symbol || ' vượt ngưỡng giá' ELSE p.symbol || ' giảm dưới ngưỡng giá' END,
      'Giá đóng cửa ' || p.close::text || ' VND; ngưỡng của bạn là ' || r.target_price::text || ' VND.',
      jsonb_build_object('condition', r.condition, 'target_price', r.target_price,
        'previous_close', previous.close, 'close', p.close, 'source', p.source)
    FROM alert_rules r
    JOIN LATERAL (
      SELECT trade_date, close, symbol, source FROM daily_prices
      WHERE symbol=r.symbol AND source='ssi' ORDER BY trade_date DESC LIMIT 1
    ) p ON true
    JOIN LATERAL (
      SELECT close FROM daily_prices
      WHERE symbol=r.symbol AND source='ssi' AND trade_date < p.trade_date
      ORDER BY trade_date DESC LIMIT 1
    ) previous ON true
    WHERE r.symbol=$1 AND r.is_active AND (
      (r.condition='price_above' AND previous.close < r.target_price AND p.close >= r.target_price) OR
      (r.condition='price_below' AND previous.close > r.target_price AND p.close <= r.target_price)
    )
    ON CONFLICT (rule_id, trade_date) DO NOTHING
    RETURNING id,user_id
  )
  INSERT INTO notification_outbox(user_id,alert_id,channel)
  SELECT created.user_id,created.id,channel_options.channel_name
  FROM created
  JOIN notification_preferences preferences ON preferences.user_id=created.user_id
  CROSS JOIN LATERAL (VALUES ('email',preferences.email_enabled),('telegram',preferences.telegram_enabled)) channel_options(channel_name,is_enabled)
  JOIN notification_channels channels ON channels.user_id=created.user_id AND channels.channel=channel_options.channel_name AND channels.verified_at IS NOT NULL
  WHERE channel_options.is_enabled
  ON CONFLICT (alert_id,channel) DO NOTHING`, [symbol]);
  return result.rowCount;
}

// Queues out-of-app delivery (email/Telegram) for freshly created alerts, honouring verified, enabled channels.
const QUEUE_DELIVERIES = `INSERT INTO notification_outbox(user_id,alert_id,channel)
  SELECT created.user_id,created.id,channel_options.channel_name
  FROM created
  JOIN notification_preferences preferences ON preferences.user_id=created.user_id
  CROSS JOIN LATERAL (VALUES ('email',preferences.email_enabled),('telegram',preferences.telegram_enabled)) channel_options(channel_name,is_enabled)
  JOIN notification_channels channels ON channels.user_id=created.user_id AND channels.channel=channel_options.channel_name AND channels.verified_at IS NOT NULL
  WHERE channel_options.is_enabled
  ON CONFLICT (alert_id,channel) DO NOTHING`;

// FR-M10-06: alert when the latest daily bar touches a plan's entry zone (waiting plans) or its stop/target (open plans).
export async function createTradePlanAlerts(client, symbol) {
  const result = await client.query(`WITH bar AS (
      SELECT symbol, trade_date, close, COALESCE(low, close) AS low, COALESCE(high, close) AS high
      FROM daily_prices WHERE symbol=$1 ORDER BY trade_date DESC LIMIT 1
    ), events AS (
      SELECT p.id AS plan_id, p.user_id, p.symbol, bar.trade_date, bar.close, event.alert_type, event.level
      FROM trade_plans p JOIN bar ON bar.symbol=p.symbol
      CROSS JOIN LATERAL (VALUES
        ('plan_entry_reached', p.entry_price, p.status='planned'
          AND bar.low <= COALESCE(p.entry_price_max, p.entry_price) AND bar.high >= p.entry_price),
        ('plan_stop_hit', p.stop_price, p.status='active'
          AND ((p.side='long' AND bar.low <= p.stop_price) OR (p.side='short' AND bar.high >= p.stop_price))),
        ('plan_target_hit', p.target_price, p.status='active'
          AND ((p.side='long' AND bar.high >= p.target_price) OR (p.side='short' AND bar.low <= p.target_price)))
      ) event(alert_type, level, triggered)
      WHERE event.triggered AND bar.trade_date >= (p.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
    ), created AS (
      INSERT INTO user_alerts(user_id, plan_id, symbol, trade_date, alert_type, title, message, payload)
      SELECT user_id, plan_id, symbol, trade_date, alert_type,
        symbol || CASE alert_type WHEN 'plan_entry_reached' THEN ' chạm vùng giá vào kế hoạch'
          WHEN 'plan_stop_hit' THEN ' chạm giá cắt lỗ kế hoạch' ELSE ' chạm giá mục tiêu kế hoạch' END,
        'Giá phiên ' || to_char(trade_date, 'DD/MM/YYYY') || ' đã chạm mức ' || level::text || ' VND trong Trade Plan của bạn (đóng cửa ' || close::text || ' VND).',
        jsonb_build_object('plan_id', plan_id, 'level', level, 'close', close)
      FROM events
      ON CONFLICT (plan_id, alert_type, trade_date) WHERE plan_id IS NOT NULL DO NOTHING
      RETURNING id, user_id
    )
    ${QUEUE_DELIVERIES}`, [symbol]);
  return result.rowCount;
}

// FR-M10-05: draft and waiting plans past their expiry date are closed as "Hết hạn" and the owner is notified.
export async function expireTradePlans(client) {
  const result = await client.query(`WITH expired AS (
      UPDATE trade_plans SET status='cancelled', close_reason='expired', updated_at=now()
      WHERE status IN ('draft','planned') AND expires_on < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
      RETURNING id, user_id, symbol, expires_on
    ), created AS (
      INSERT INTO user_alerts(user_id, plan_id, symbol, trade_date, alert_type, title, message, payload)
      SELECT user_id, id, symbol, expires_on, 'plan_expired', symbol || ': kế hoạch đã hết hạn',
        'Kế hoạch chưa được vào lệnh trước ngày ' || to_char(expires_on, 'DD/MM/YYYY') || ' nên đã chuyển sang Hết hạn.',
        jsonb_build_object('plan_id', id)
      FROM expired
      ON CONFLICT (plan_id, alert_type, trade_date) WHERE plan_id IS NOT NULL DO NOTHING
      RETURNING id, user_id
    )
    ${QUEUE_DELIVERIES}`);
  return result.rowCount;
}

// FR-M5-04: the in-app history keeps 90 days; older alerts (and their delivery rows) are removed.
export async function pruneAlertHistory(client, days = 90) {
  const result = await client.query("DELETE FROM user_alerts WHERE created_at < now() - ($1::integer * interval '1 day')", [days]);
  return result.rowCount;
}
