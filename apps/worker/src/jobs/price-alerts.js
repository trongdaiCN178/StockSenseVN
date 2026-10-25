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
