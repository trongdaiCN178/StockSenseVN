import pg from 'pg';
import { marketMock, TRACKED_SYMBOLS } from '../mocks/market.js';
import { hashPassword } from '../apps/api/src/auth/password.js';

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to seed demo market data.');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
// --market-only refreshes symbols, demo forecasts and sample news without touching the demo accounts.
const marketOnly = process.argv.includes('--market-only');

try {
  await client.query('BEGIN');
  const demoUsers = marketOnly ? [] : [
    ['retail@stocksense.vn', 'retail'],
    ['trader@stocksense.vn', 'trader'],
    ['analyst@stocksense.vn', 'analyst'],
    ['admin@stocksense.vn', 'admin'],
  ];
  for (const [email, role] of demoUsers) {
    const demoPassword = `${role}12345678`;
    await client.query(`INSERT INTO users(email, password_hash, role, must_change_password, email_verified_at, created_via)
      VALUES ($1, $2, $3, false, now(), 'admin') ON CONFLICT (email) DO UPDATE SET
        password_hash=EXCLUDED.password_hash, role=EXCLUDED.role, must_change_password=false,
        is_active=true, failed_login_count=0, locked_until=NULL, email_verified_at=now(), updated_at=now()`,
    [email, await hashPassword(demoPassword), role]);
  }

  const status = marketMock.status;
  const batchResult = await client.query(`INSERT INTO market_batches
    (data_date, batch_completed_at, model_version, state, source_status)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (data_date, model_version) DO UPDATE SET
      batch_completed_at = EXCLUDED.batch_completed_at, state = EXCLUDED.state, source_status = EXCLUDED.source_status
    RETURNING id`, [status.dataDate, status.batchCompletedAt, status.modelVersion, status.state, status.sourceStatus]);
  const batchId = batchResult.rows[0].id;

  for (const index of marketMock.summary.indices) {
    await client.query(`INSERT INTO market_indices(batch_id, code, label, value, change_points, change_percent)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (batch_id, code) DO UPDATE SET label=EXCLUDED.label, value=EXCLUDED.value,
        change_points=EXCLUDED.change_points, change_percent=EXCLUDED.change_percent`,
    [batchId, index.code, index.label, index.value, index.changePoints, index.changePercent]);
  }

  const summary = marketMock.summary;
  await client.query(`INSERT INTO market_summary(batch_id, advances, nochanges, declines, labels_up, labels_hold, labels_down)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (batch_id) DO UPDATE SET advances=EXCLUDED.advances, nochanges=EXCLUDED.nochanges,
      declines=EXCLUDED.declines, labels_up=EXCLUDED.labels_up, labels_hold=EXCLUDED.labels_hold, labels_down=EXCLUDED.labels_down`,
  [batchId, summary.breadth.advances, summary.breadth.nochanges, summary.breadth.declines,
    summary.labelDistribution.up, summary.labelDistribution.hold, summary.labelDistribution.down]);

  for (const item of marketMock.symbols.items) {
    await client.query(`INSERT INTO symbols(symbol, name, exchange, industry, currency, is_enabled)
      VALUES ($1, $2, $3, $4, 'VND', true)
      ON CONFLICT (symbol) DO UPDATE SET name=EXCLUDED.name, exchange=EXCLUDED.exchange, industry=EXCLUDED.industry,
        currency=EXCLUDED.currency, is_enabled=EXCLUDED.is_enabled, updated_at=now()`,
    [item.symbol, item.name, item.exchange, item.industry]);

    for (const horizon of ['t2', 't5']) {
      const forecast = item.forecasts[horizon];
      await client.query(`INSERT INTO forecasts
        (batch_id, symbol, horizon, label, probability_up, probability_hold, probability_down, confidence)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (batch_id, symbol, horizon) DO UPDATE SET label=EXCLUDED.label,
          probability_up=EXCLUDED.probability_up, probability_hold=EXCLUDED.probability_hold,
          probability_down=EXCLUDED.probability_down, confidence=EXCLUDED.confidence`,
      [batchId, item.symbol, horizon, forecast.label, forecast.probabilities.up,
        forecast.probabilities.hold, forecast.probabilities.down, forecast.confidence]);
    }

    const seed = [...item.symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    for (let index = 0; index < 60; index += 1) {
      const date = new Date(Date.UTC(2026, 9, 7 - (59 - index) * 3)).toISOString().slice(0, 10);
      const drift = ((index * (seed % 7 + 3)) % 17 - 8) / 100;
      const wave = Math.sin((index + seed) / 3) * 0.012;
      let close = item.closePrice * (0.91 + index * 0.0015 + drift * 0.01 + wave);
      if (index === 58) close = item.closePrice / (1 + item.changePercent / 100);
      if (index === 59) close = item.closePrice;
      close = Math.round(close * 100) / 100;
      const turnover = Math.round(95_000_000_000 + (seed * 137 + index * 8_300_003) % 70_000_000_000);
      // Sample bars never overwrite real SSI prices for the same day.
      await client.query(`INSERT INTO daily_prices(symbol, trade_date, open, high, low, close, volume, turnover, source)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'demo-seed')
        ON CONFLICT (symbol, trade_date) DO UPDATE SET open=EXCLUDED.open, high=EXCLUDED.high,
          low=EXCLUDED.low, close=EXCLUDED.close, volume=EXCLUDED.volume, turnover=EXCLUDED.turnover,
          source=EXCLUDED.source
        WHERE daily_prices.source <> 'ssi'`,
      [item.symbol, date, close, close * 1.01, close * 0.99, close, 1_000_000 + index * 127, turnover]);
    }

    const news = [
      { suffix: '1', title: `${item.name}: cập nhật hoạt động kinh doanh`, summary: 'Tin mẫu để hoàn thiện luồng giao diện. Nội dung thực tế cần được cấp phép và xác minh nguồn.', publishedAt: '2026-10-07T09:30:00+07:00', sentiment: 'neutral' },
      { suffix: '2', title: `Diễn biến đáng chú ý quanh cổ phiếu ${item.symbol}`, summary: 'Bản tin minh họa; chưa phải dữ liệu tin tức thực tế.', publishedAt: '2026-10-06T14:15:00+07:00', sentiment: 'positive' },
    ];
    for (const article of news) {
      const insertedNews = await client.query(`INSERT INTO news_items(symbol, external_id, title, summary, source, published_at, sentiment, url)
        VALUES ($1, $2, $3, $4, 'StockSense Demo', $5, $6, NULL)
        ON CONFLICT (source, external_id) DO UPDATE SET title=EXCLUDED.title, summary=EXCLUDED.summary,
          published_at=EXCLUDED.published_at, sentiment=EXCLUDED.sentiment RETURNING id`,
      [item.symbol, `demo-${item.symbol}-${article.suffix}`, article.title, article.summary, article.publishedAt, article.sentiment]);
      await client.query(`INSERT INTO news_item_symbols(news_item_id, symbol, match_method)
        VALUES ($1, $2, 'demo_seed') ON CONFLICT DO NOTHING`, [insertedNews.rows[0].id, item.symbol]);
    }
  }

  // Symbols outside the tracked list are disabled (not deleted) so their price history and user data stay intact.
  const disabled = await client.query(`UPDATE symbols SET is_enabled=false, updated_at=now()
    WHERE is_enabled AND NOT (symbol = ANY($1::varchar[])) RETURNING symbol`, [TRACKED_SYMBOLS]);

  await client.query('COMMIT');
  console.info(`Seeded demo batch ${batchId} with ${marketMock.symbols.total} symbols${marketOnly ? ' (market only, demo accounts untouched)' : ''}.`);
  if (disabled.rowCount) console.info(`Disabled symbols outside the tracked list: ${disabled.rows.map((row) => row.symbol).join(', ')}.`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
