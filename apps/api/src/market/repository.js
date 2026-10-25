import { marketMock } from '../../../../mocks/market.js';

const number = (value) => value === null || value === undefined ? null : Number(value);

export function createFixtureMarketRepository() {
  const bySymbol = (symbol) => marketMock.symbols.items.find((item) => item.symbol === symbol.toUpperCase());
  return {
    async status() { return structuredClone(marketMock.status); },
    async summary() { return structuredClone(marketMock.summary); },
    async symbols({ q = '', exchange = '' } = {}) {
      const needle = q.trim().toUpperCase();
      const items = marketMock.symbols.items.filter((item) =>
        (!needle || item.symbol.includes(needle) || item.name.toUpperCase().includes(needle)) &&
        (!exchange || item.exchange === exchange));
      return { total: items.length, items: structuredClone(items) };
    },
    async screener(filters = {}) {
      const { items } = await this.symbols({ exchange: filters.exchange ?? '' });
      const matches = items.filter((item) =>
        (!filters.industry || item.industry === filters.industry) &&
        (filters.minPrice == null || item.closePrice >= filters.minPrice) &&
        (filters.maxPrice == null || item.closePrice <= filters.maxPrice) &&
        (filters.minChange == null || item.changePercent >= filters.minChange) &&
        (filters.maxChange == null || item.changePercent <= filters.maxChange) &&
        (filters.minTurnover == null || item.averageTurnover20d >= filters.minTurnover));
      return { total: matches.length, items: sortScreener(matches, filters) };
    },
    async industries() { return { items: [...new Set(marketMock.symbols.items.map((item) => item.industry).filter(Boolean))].sort() }; },
    async symbol(symbol) { return structuredClone(bySymbol(symbol) ?? null); },
    async prices(symbol, range = '3m') {
      const item = bySymbol(symbol);
      if (!item) return null;
      const count = range === '1m' ? 10 : range === '6m' ? 60 : 30;
      const seed = [...symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const items = Array.from({ length: count }, (_, index) => {
        const drift = ((index * (seed % 7 + 3)) % 17 - 8) / 100;
        const wave = Math.sin((index + seed) / 3) * 0.012;
        const close = Math.round(item.closePrice * (0.91 + index * 0.003 + drift * 0.01 + wave));
        return { date: new Date(Date.UTC(2026, 9, 7 - (count - 1 - index) * 3)).toISOString().slice(0, 10), close, volume: 1_000_000 + index * 127 };
      });
      items.at(-1).close = item.closePrice;
        return { symbol: symbol.toUpperCase(), currency: 'VND', interval: '1d', sourceStatus: 'demo', latestDate: items.at(-1).date, items };
    },
    async news(symbol) {
      const item = bySymbol(symbol);
      if (!item) return null;
      return { items: [
        { id: `${item.symbol}-news-1`, title: `${item.name}: cập nhật hoạt động kinh doanh`, summary: 'Tin mẫu để hoàn thiện luồng giao diện. Nội dung thực tế cần được cấp phép và xác minh nguồn.', source: 'StockSense Demo', publishedAt: '2026-10-07T09:30:00+07:00', sentiment: 'neutral', url: null },
        { id: `${item.symbol}-news-2`, title: `Diễn biến đáng chú ý quanh cổ phiếu ${item.symbol}`, summary: 'Bản tin minh họa; chưa phải dữ liệu tin tức thực tế.', source: 'StockSense Demo', publishedAt: '2026-10-06T14:15:00+07:00', sentiment: 'positive', url: null },
      ] };
    },
  };
}

export function createPostgresMarketRepository(pool) {
  async function latestBatch(client = pool) {
    const { rows } = await client.query(`SELECT id, to_char(data_date, 'YYYY-MM-DD') AS data_date,
      batch_completed_at, model_version, state, source_status
      FROM market_batches ORDER BY data_date DESC, id DESC LIMIT 1`);
    return rows[0] ?? null;
  }

  async function readSymbol(symbol) {
    const { rows } = await pool.query(`${symbolSelect}
      WHERE price.close_price IS NOT NULL AND s.symbol = $1 AND s.is_enabled = true LIMIT 1`, [symbol.toUpperCase()]);
    return rows[0] ? mapSymbol(rows[0]) : null;
  }

  return {
    async status() {
      const batch = await latestBatch();
      if (!batch) return null;
      return {
        dataDate: batch.data_date,
        batchCompletedAt: batch.batch_completed_at?.toISOString() ?? null,
        modelVersion: batch.model_version,
        state: batch.state,
        sourceStatus: batch.source_status,
      };
    },
    async summary() {
      const batch = await latestBatch();
      if (!batch) return null;
      const [indicesResult, summaryResult] = await Promise.all([
        pool.query(`SELECT code, label, value, change_points, change_percent FROM market_indices WHERE batch_id = $1 ORDER BY code`, [batch.id]),
        pool.query(`SELECT advances, nochanges, declines, labels_up, labels_hold, labels_down FROM market_summary WHERE batch_id = $1`, [batch.id]),
      ]);
      const summary = summaryResult.rows[0];
      if (!summary) return null;
      return {
        indices: indicesResult.rows.map((row) => ({ code: row.code, label: row.label, value: number(row.value), changePoints: number(row.change_points), changePercent: number(row.change_percent) })),
        breadth: { advances: summary.advances, nochanges: summary.nochanges, declines: summary.declines },
        labelDistribution: { up: summary.labels_up, hold: summary.labels_hold, down: summary.labels_down },
      };
    },
    async symbols({ q = '', exchange = '' } = {}) {
      const batch = await latestBatch();
      if (!batch) return { total: 0, items: [] };
      const { rows } = await pool.query(`${symbolSelect}
        WHERE price.close_price IS NOT NULL AND s.is_enabled = true AND ($1 = '' OR s.exchange = $1)
          AND ($2 = '' OR position($2 in upper(s.symbol)) > 0 OR position($2 in upper(s.name)) > 0)
        ORDER BY s.symbol`, [exchange, q.trim().toUpperCase()]);
      const items = rows.map(mapSymbol);
      return { total: items.length, items };
    },
    async screener(filters = {}) {
      const { rows } = await pool.query(`SELECT s.symbol, s.name, s.exchange, s.industry,
          price.close_price, price.change_percent, price.average_turnover_20d,
          price.trade_date::text AS price_date, price.source AS price_source
        FROM symbols s
        LEFT JOIN LATERAL (
          SELECT p.close AS close_price, p.trade_date, p.source,
            CASE WHEN previous.close IS NULL OR previous.close=0 THEN 0
              ELSE round(((p.close-previous.close)/previous.close*100)::numeric, 4) END AS change_percent,
            turnover.average_turnover_20d
          FROM daily_prices p
          LEFT JOIN LATERAL (SELECT close FROM daily_prices WHERE symbol=p.symbol AND trade_date<p.trade_date ORDER BY trade_date DESC LIMIT 1) previous ON true
          LEFT JOIN LATERAL (SELECT avg(turnover) AS average_turnover_20d FROM (
            SELECT turnover FROM daily_prices WHERE symbol=p.symbol AND turnover IS NOT NULL AND trade_date<=p.trade_date ORDER BY trade_date DESC LIMIT 20
          ) recent) turnover ON true
          WHERE p.symbol=s.symbol ORDER BY p.trade_date DESC LIMIT 1
        ) price ON true
        WHERE s.is_enabled=true AND price.close_price IS NOT NULL
          AND ($1 = '' OR s.exchange = $1)
          AND ($2::numeric IS NULL OR price.close_price >= $2)
          AND ($3::numeric IS NULL OR price.close_price <= $3)
          AND ($4::numeric IS NULL OR price.change_percent >= $4)
          AND ($5::numeric IS NULL OR price.change_percent <= $5)
          AND ($6::numeric IS NULL OR price.average_turnover_20d >= $6)
          AND ($7 = '' OR s.industry = $7)
        ORDER BY s.symbol LIMIT 1000`, [filters.exchange ?? '', filters.minPrice ?? null,
        filters.maxPrice ?? null, filters.minChange ?? null, filters.maxChange ?? null,
        filters.minTurnover ?? null, filters.industry ?? '']);
      const items = rows.map((row) => ({
        symbol: row.symbol, name: row.name, exchange: row.exchange, industry: row.industry,
        closePrice: number(row.close_price), changePercent: number(row.change_percent) ?? 0,
        averageTurnover20d: number(row.average_turnover_20d) ?? 0,
        priceDate: row.price_date, priceDataStatus: row.price_source === 'ssi' ? 'live' : 'demo',
      }));
      return { total: items.length, items: sortScreener(items, filters) };
    },
    async industries() {
      const { rows } = await pool.query('SELECT DISTINCT industry FROM symbols WHERE is_enabled=true AND industry IS NOT NULL ORDER BY industry');
      return { items: rows.map((row) => row.industry) };
    },
    symbol: readSymbol,
    async prices(symbol, range = '3m') {
      const monthCount = range === '1m' ? 1 : range === '6m' ? 6 : 3;
      const { rows } = await pool.query(`SELECT p.symbol, p.trade_date::text AS date, p.close, p.volume, p.source
        FROM daily_prices p
        WHERE p.symbol = $1 AND p.trade_date >= (timezone('Asia/Ho_Chi_Minh', now())::date - ($2::integer * interval '1 month'))::date
          -- Once real SSI bars exist for a symbol, seeded demo bars are hidden so the chart never mixes price scales.
          AND (p.source = 'ssi' OR NOT EXISTS (SELECT 1 FROM daily_prices real WHERE real.symbol = p.symbol AND real.source = 'ssi'))
        ORDER BY p.trade_date`, [symbol.toUpperCase(), monthCount]);
      if (!rows.length) return null;
      const sources = new Set(rows.map((row) => row.source));
      const sourceStatus = sources.size > 1 ? 'mixed' : sources.has('ssi') ? 'live' : 'demo';
      return {
        symbol: rows[0].symbol, currency: 'VND', interval: '1d', sourceStatus,
        latestDate: rows.at(-1).date,
        items: rows.map((row) => ({ date: row.date, close: number(row.close), volume: number(row.volume) })),
      };
    },
    async news(symbol) {
      const { rows } = await pool.query(`SELECT n.id::text, n.title, n.summary, n.source,
        n.published_at, n.sentiment, n.url
        FROM news_items n JOIN news_item_symbols link ON link.news_item_id = n.id
        JOIN symbols s ON s.symbol = link.symbol
        WHERE link.symbol = $1 AND s.is_enabled = true ORDER BY n.published_at DESC LIMIT 50`, [symbol.toUpperCase()]);
      if (!rows.length) {
        const { rowCount } = await pool.query('SELECT 1 FROM symbols WHERE symbol = $1 AND is_enabled = true', [symbol.toUpperCase()]);
        return rowCount ? { items: [] } : null;
      }
      return { items: rows.map((row) => ({ id: row.id, title: row.title, summary: row.summary, source: row.source, publishedAt: row.published_at.toISOString(), sentiment: row.sentiment, url: row.url })) };
    },
  };
}

const symbolSelect = `WITH latest AS (SELECT id FROM market_batches ORDER BY data_date DESC, id DESC LIMIT 1)
  SELECT s.symbol, s.name, s.exchange, s.industry, latest.id AS batch_id,
    f2.label AS t2_label, f2.probability_up AS t2_up, f2.probability_hold AS t2_hold, f2.probability_down AS t2_down, f2.confidence AS t2_confidence,
    f5.label AS t5_label, f5.probability_up AS t5_up, f5.probability_hold AS t5_hold, f5.probability_down AS t5_down, f5.confidence AS t5_confidence,
    price.close_price, price.price_date, price.price_source, price.change_percent, price.average_turnover_20d
  FROM symbols s CROSS JOIN latest
  JOIN forecasts f2 ON f2.symbol = s.symbol AND f2.batch_id = latest.id AND f2.horizon = 't2'
  JOIN forecasts f5 ON f5.symbol = s.symbol AND f5.batch_id = latest.id AND f5.horizon = 't5'
  LEFT JOIN LATERAL (
    SELECT p.close AS close_price, p.trade_date::text AS price_date, p.source AS price_source,
      CASE WHEN previous.close IS NULL OR previous.close = 0 THEN 0
        ELSE round(((p.close - previous.close) / previous.close * 100)::numeric, 4) END AS change_percent,
      turnover.average_turnover_20d
    FROM daily_prices p
    LEFT JOIN LATERAL (SELECT close FROM daily_prices WHERE symbol = p.symbol AND trade_date < p.trade_date ORDER BY trade_date DESC LIMIT 1) previous ON true
    LEFT JOIN LATERAL (SELECT avg(turnover) AS average_turnover_20d FROM (
      SELECT turnover FROM daily_prices WHERE symbol = p.symbol AND turnover IS NOT NULL AND trade_date <= p.trade_date ORDER BY trade_date DESC LIMIT 20
    ) last_twenty) turnover ON true
    WHERE p.symbol = s.symbol ORDER BY p.trade_date DESC LIMIT 1
  ) price ON true`;

function mapSymbol(row) {
  return {
    symbol: row.symbol, name: row.name, exchange: row.exchange, industry: row.industry,
    closePrice: number(row.close_price) ?? 0,
    priceDate: row.price_date ?? null,
    priceDataStatus: row.price_source === 'ssi' ? 'live' : row.price_source ? 'demo' : 'unavailable',
    changePercent: number(row.change_percent) ?? 0,
    averageTurnover20d: number(row.average_turnover_20d) ?? 0,
    dataStatus: 'complete',
    forecasts: {
      t2: { label: row.t2_label, probabilities: { up: number(row.t2_up), hold: number(row.t2_hold), down: number(row.t2_down) }, confidence: row.t2_confidence },
      t5: { label: row.t5_label, probabilities: { up: number(row.t5_up), hold: number(row.t5_hold), down: number(row.t5_down) }, confidence: row.t5_confidence },
    },
  };
}

// FR-M8-02: screener results can be ordered by price change, liquidity or price.
const SCREENER_SORTS = { changePercent: 'changePercent', turnover: 'averageTurnover20d', price: 'closePrice', symbol: 'symbol' };
function sortScreener(items, { sort = 'symbol', direction = 'asc' } = {}) {
  const key = SCREENER_SORTS[sort] ?? 'symbol';
  const factor = direction === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => factor * (key === 'symbol' ? a.symbol.localeCompare(b.symbol) : (a[key] ?? 0) - (b[key] ?? 0)));
}
