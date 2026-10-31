import { marketMock } from '../../../../mocks/market.js';
import { buildBoardQuote } from '@stocksense/core/price-board';

const number = (value) => value === null || value === undefined ? null : Number(value);
// Months of daily bars returned for each chart range.
const RANGE_MONTHS = { '1m': 1, '3m': 3, '6m': 6, '1y': 12, all: 600 };
export const PRICE_RANGES = Object.keys(RANGE_MONTHS);
// SSI index code -> code and label used by the web overview strip.
const INDEX_CODES = { VNINDEX: ['VNINDEX', 'VN-Index'], HNXINDEX: ['HNX', 'HNX-Index'], VN30: ['VN30', 'VN30'] };

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
    // End-of-day board built from the fixture close and change (no previous bar in fixtures).
    async board() {
      const items = marketMock.symbols.items.map((item) => {
        const previousClose = Math.round(item.closePrice / (1 + item.changePercent / 100));
        const latest = { date: marketMock.status.dataDate, open: previousClose, high: Math.max(previousClose, item.closePrice),
          low: Math.min(previousClose, item.closePrice), close: item.closePrice, volume: null, turnover: null };
        return { symbol: item.symbol, name: item.name, exchange: item.exchange, industry: item.industry,
          ...buildBoardQuote(item.exchange, latest, { close: previousClose }),
          forecasts: { t2: item.forecasts?.t2 ?? null, t5: item.forecasts?.t5 ?? null }, priceDataStatus: 'demo' };
      });
      return { date: marketMock.status.dataDate, items };
    },
    async prices(symbol, range = '3m') {
      const item = bySymbol(symbol);
      if (!item) return null;
      const count = Math.min(RANGE_MONTHS[range] ?? 3, 12) * 20;
      const seed = [...symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const items = Array.from({ length: count }, (_, index) => {
        const drift = ((index * (seed % 7 + 3)) % 17 - 8) / 100;
        const wave = Math.sin((index + seed) / 3) * 0.012;
        const close = Math.round(item.closePrice * (0.91 + index * 0.003 + drift * 0.01 + wave));
        return { date: new Date(Date.UTC(2026, 9, 7 - (count - 1 - index))).toISOString().slice(0, 10), close, volume: 1_000_000 + index * 127 };
      });
      items.at(-1).close = item.closePrice;
      items.forEach((bar, index) => {
        bar.open = index ? items[index - 1].close : bar.close;
        bar.high = Math.max(bar.open, bar.close);
        bar.low = Math.min(bar.open, bar.close);
        bar.turnover = bar.close * bar.volume;
        Object.assign(bar, { adjOpen: bar.open, adjHigh: bar.high, adjLow: bar.low, adjClose: bar.close });
      });
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

  // FR-M2-07: a symbol's data is "stale" when its last bar is older than the market's last session,
  // and "missing news" when no article was linked in the last 7 days.
  async function readSymbol(symbol) {
    const { rows } = await pool.query(`${symbolSelect}
      WHERE price.close_price IS NOT NULL AND s.symbol = $1 AND s.is_enabled = true LIMIT 1`, [symbol.toUpperCase()]);
    if (!rows[0]) return null;
    const item = mapSymbol(rows[0]);
    const { rows: flags } = await pool.query(`SELECT
        (SELECT max(trade_date)::text FROM daily_prices WHERE source = 'ssi') AS market_date,
        (SELECT count(*)::integer FROM news_item_symbols l JOIN news_items n ON n.id = l.news_item_id
          WHERE l.symbol = $1 AND n.published_at >= now() - interval '7 days') AS recent_news`, [item.symbol]);
    const stalePrice = Boolean(flags[0].market_date && item.priceDate && item.priceDate < flags[0].market_date);
    const missingNews = flags[0].recent_news === 0;
    return { ...item, dataFlags: { stalePrice, missingNews }, dataStatus: stalePrice ? 'stale' : missingNews ? 'missing_news' : 'complete' };
  }

  return {
    async status() {
      const batch = await latestBatch();
      if (!batch) return null;
      // Daily prices are synced from SSI independently of the forecast batch, so report both dates.
      const [{ rows }, holidays] = await Promise.all([
        pool.query(`SELECT max(trade_date)::text AS latest_price_date FROM daily_prices WHERE source='ssi'`),
        pool.query(`SELECT holiday::text FROM market_holidays
          WHERE holiday BETWEEN (timezone('Asia/Ho_Chi_Minh', now())::date - 60) AND (timezone('Asia/Ho_Chi_Minh', now())::date + 90)
          ORDER BY holiday`),
      ]);
      return {
        dataDate: batch.data_date,
        latestPriceDate: rows[0]?.latest_price_date ?? null,
        batchCompletedAt: batch.batch_completed_at?.toISOString() ?? null,
        modelVersion: batch.model_version,
        state: batch.state,
        sourceStatus: batch.source_status,
        holidays: holidays.rows.map((row) => row.holiday),
      };
    },
    // FR-M1-06: real SSI indices and breadth of the tracked symbols; label shares still come from the forecast batch.
    async summary() {
      const batch = await latestBatch();
      const [indexResult, summaryResult, board] = await Promise.all([
        pool.query(`SELECT DISTINCT ON (code) code, trade_date::text AS date, close, change_points, change_percent
          FROM market_index_daily ORDER BY code, trade_date DESC`),
        batch ? pool.query(`SELECT advances, nochanges, declines, labels_up, labels_hold, labels_down FROM market_summary WHERE batch_id = $1`, [batch.id]) : { rows: [] },
        this.board(),
      ]);
      const summary = summaryResult.rows[0];
      let indices;
      if (indexResult.rows.length) {
        indices = indexResult.rows.map((row) => ({ code: INDEX_CODES[row.code]?.[0] ?? row.code, label: INDEX_CODES[row.code]?.[1] ?? row.code,
          value: number(row.close), changePoints: number(row.change_points), changePercent: number(row.change_percent), date: row.date, source: 'ssi' }));
      } else if (batch) {
        const { rows } = await pool.query(`SELECT code, label, value, change_points, change_percent FROM market_indices WHERE batch_id = $1 ORDER BY code`, [batch.id]);
        indices = rows.map((row) => ({ code: row.code, label: row.label, value: number(row.value), changePoints: number(row.change_points), changePercent: number(row.change_percent), source: 'demo' }));
      } else return null;
      const tone = (item) => item.tones.close;
      const breadth = board.items.length
        ? { advances: board.items.filter((item) => ['up', 'ceiling'].includes(tone(item))).length,
          nochanges: board.items.filter((item) => tone(item) === 'ref').length,
          declines: board.items.filter((item) => ['down', 'floor'].includes(tone(item))).length,
          scope: 'tracked', total: board.items.length, date: board.date }
        : { advances: summary?.advances ?? 0, nochanges: summary?.nochanges ?? 0, declines: summary?.declines ?? 0, scope: 'demo' };
      return {
        indices,
        breadth,
        labelDistribution: summary ? { up: summary.labels_up, hold: summary.labels_hold, down: summary.labels_down } : null,
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
    // End-of-day price board: last two bars per enabled symbol give reference, ceiling and floor.
    async board() {
      const { rows } = await pool.query(`WITH latest AS (SELECT id FROM market_batches ORDER BY data_date DESC, id DESC LIMIT 1)
        SELECT s.symbol, s.name, s.exchange, s.industry, bars.items AS bars,
          f2.label AS t2_label, f2.probability_up AS t2_up, f2.probability_hold AS t2_hold, f2.probability_down AS t2_down, f2.confidence AS t2_confidence,
          f5.label AS t5_label, f5.probability_up AS t5_up, f5.probability_hold AS t5_hold, f5.probability_down AS t5_down, f5.confidence AS t5_confidence
        FROM symbols s
        LEFT JOIN latest ON true
        LEFT JOIN forecasts f2 ON f2.symbol = s.symbol AND f2.batch_id = latest.id AND f2.horizon = 't2'
        LEFT JOIN forecasts f5 ON f5.symbol = s.symbol AND f5.batch_id = latest.id AND f5.horizon = 't5'
        LEFT JOIN LATERAL (
          SELECT json_agg(bar ORDER BY bar.date DESC) AS items FROM (
            SELECT p.trade_date::text AS date, p.open, p.high, p.low, p.close, p.volume, p.turnover, p.adj_close, p.source
            FROM daily_prices p
            WHERE p.symbol = s.symbol
              AND (p.source = 'ssi' OR NOT EXISTS (SELECT 1 FROM daily_prices real WHERE real.symbol = p.symbol AND real.source = 'ssi'))
            ORDER BY p.trade_date DESC LIMIT 2
          ) bar
        ) bars ON true
        WHERE s.is_enabled = true AND bars.items IS NOT NULL
        ORDER BY s.symbol`);
      const toBar = (bar) => bar && { date: bar.date, open: number(bar.open), high: number(bar.high), low: number(bar.low),
        close: number(bar.close), volume: number(bar.volume), turnover: number(bar.turnover), adjClose: number(bar.adj_close) };
      const forecast = (row, h) => (row[`${h}_label`] ? { label: row[`${h}_label`], confidence: row[`${h}_confidence`],
        probabilities: { up: number(row[`${h}_up`]), hold: number(row[`${h}_hold`]), down: number(row[`${h}_down`]) } } : null);
      const items = rows.map((row) => ({
        symbol: row.symbol, name: row.name, exchange: row.exchange, industry: row.industry,
        ...buildBoardQuote(row.exchange, toBar(row.bars[0]), toBar(row.bars[1])),
        forecasts: { t2: forecast(row, 't2'), t5: forecast(row, 't5') },
        priceDataStatus: row.bars[0].source === 'ssi' ? 'live' : 'demo',
      }));
      const date = items.reduce((max, item) => (item.date && item.date > max ? item.date : max), '');
      return { date: date || null, items };
    },
    async prices(symbol, range = '3m') {
      const monthCount = RANGE_MONTHS[range] ?? 3;
      const { rows } = await pool.query(`SELECT p.symbol, p.trade_date::text AS date, p.open, p.high, p.low, p.close, p.volume, p.turnover, p.source,
          p.adj_open, p.adj_high, p.adj_low, p.adj_close
        FROM daily_prices p JOIN symbols s ON s.symbol = p.symbol AND s.is_enabled = true
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
        // Traded prices plus back-adjusted prices (falling back to traded prices for bars without adjustment data).
        items: rows.map((row) => ({ date: row.date, open: number(row.open), high: number(row.high), low: number(row.low),
          close: number(row.close), volume: number(row.volume), turnover: number(row.turnover),
          adjOpen: number(row.adj_open ?? row.open), adjHigh: number(row.adj_high ?? row.high),
          adjLow: number(row.adj_low ?? row.low), adjClose: number(row.adj_close ?? row.close) })),
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
