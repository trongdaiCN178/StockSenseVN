import { createPriceCrossingAlerts, createTradePlanAlerts, expireTradePlans, pruneAlertHistory } from './price-alerts.js';

const LOCK_KEY = 'stocksense:daily-prices:ssi:v1';
const MARKET_INDICES = ['VNINDEX', 'HNXINDEX', 'VN30'];

export async function syncMarketData({ pool, provider, startDate, endDate, logger = console }) {
  const client = await pool.connect();
  let lock;
  try {
    lock = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS acquired', [LOCK_KEY]);
  } catch (error) {
    client.release();
    throw error;
  }
  if (!lock.rows[0].acquired) {
    logger.info('[StockSense worker] skipped: another market sync is running.');
    client.release();
    return { skipped: true };
  }

  let runId;
  let status = 'succeeded';
  let symbolsTotal = 0;
  let symbolsSucceeded = 0;
  let rowsUpserted = 0;
  const errors = [];

  try {
    const symbols = await client.query('SELECT symbol FROM symbols WHERE is_enabled = true ORDER BY symbol');
    symbolsTotal = symbols.rowCount;
    const run = await client.query(`INSERT INTO data_ingestion_runs
      (source, dataset, status, range_start, range_end, symbols_total)
      VALUES ('ssi', 'daily_prices', 'running', $1, $2, $3) RETURNING id`,
    [startDate, endDate, symbolsTotal]);
    runId = run.rows[0].id;
    if (symbolsTotal === 0) throw new Error('No enabled symbols are configured in the symbols table.');

    for (const { symbol } of symbols.rows) {
      try {
        const records = await provider.fetchHistory(symbol, startDate, endDate);
        const written = await upsertRecords(client, records, symbol, startDate, endDate);
        await createPriceCrossingAlerts(client, symbol);
        await createTradePlanAlerts(client, symbol);
        symbolsSucceeded += 1;
        rowsUpserted += written;
        logger.info(`[StockSense worker] ${symbol}: ${written} OHLCV rows upserted.`);
      } catch (error) {
        errors.push(`${symbol}: ${safeMessage(error)}`);
        logger.error(`[StockSense worker] ${symbol}: ${safeMessage(error)}`);
      }
    }

    // FR-M1-06: market indices for the overview strip; an index failure only makes the run partial.
    if (provider.fetchIndexHistory) {
      for (const code of MARKET_INDICES) {
        try {
          const records = await provider.fetchIndexHistory(code, startDate, endDate);
          const written = await upsertIndexRecords(client, records, code);
          logger.info(`[StockSense worker] ${code}: ${written} index rows upserted.`);
        } catch (error) {
          errors.push(`${code}: ${safeMessage(error)}`);
          logger.error(`[StockSense worker] ${code}: ${safeMessage(error)}`);
        }
      }
    }

    await expireTradePlans(client);
    await pruneAlertHistory(client);

    if (errors.length && symbolsSucceeded === 0 && symbolsTotal > 0) status = 'failed';
    else if (errors.length) status = 'partial';

    await client.query(`UPDATE data_ingestion_runs SET status=$2, symbols_succeeded=$3,
      rows_upserted=$4, error_message=$5, completed_at=now() WHERE id=$1`,
    [runId, status, symbolsSucceeded, rowsUpserted, errors.length ? errors.join('\n').slice(0, 4000) : null]);
    if (status === 'failed') throw new Error(`Market sync failed for all ${symbolsTotal} enabled symbols.`);

    return { runId, status, symbolsTotal, symbolsSucceeded, rowsUpserted };
  } catch (error) {
    if (runId) {
      await client.query(`UPDATE data_ingestion_runs SET status='failed', symbols_succeeded=$2,
        rows_upserted=$3, error_message=$4, completed_at=now() WHERE id=$1`,
      [runId, symbolsSucceeded, rowsUpserted, safeMessage(error).slice(0, 4000)]);
    }
    throw error;
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_KEY]);
    } finally {
      client.release();
    }
  }
}

async function upsertRecords(client, records, symbol, startDate, endDate) {
  let count = 0;
  for (let offset = 0; offset < records.length; offset += 250) {
    const chunk = records.slice(offset, offset + 250);
    if (!chunk.length) continue;
    const values = [];
    const params = [];
    for (const row of chunk) {
      if (row.symbol !== symbol || row.tradeDate < startDate || row.tradeDate > endDate) {
        throw new Error(`SSI returned an out-of-range or mismatched row for ${symbol}.`);
      }
      const base = params.length;
      params.push(row.symbol, row.tradeDate, row.open, row.high, row.low, row.close, row.volume, row.turnover);
      values.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},'ssi')`);
    }
    const result = await client.query(`INSERT INTO daily_prices
      (symbol, trade_date, open, high, low, close, volume, turnover, source)
      VALUES ${values.join(',')}
      ON CONFLICT (symbol, trade_date) DO UPDATE SET open=EXCLUDED.open, high=EXCLUDED.high,
        low=EXCLUDED.low, close=EXCLUDED.close, volume=EXCLUDED.volume,
        turnover=EXCLUDED.turnover, source=EXCLUDED.source`, params);
    count += result.rowCount;
  }
  return count;
}

async function upsertIndexRecords(client, records, code) {
  let count = 0;
  for (const row of records) {
    if (row.code !== code) throw new Error(`SSI returned a mismatched index row for ${code}.`);
    const result = await client.query(`INSERT INTO market_index_daily
      (code, trade_date, open, high, low, close, change_points, change_percent, volume, turnover, source)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ssi')
      ON CONFLICT (code, trade_date) DO UPDATE SET open=EXCLUDED.open, high=EXCLUDED.high, low=EXCLUDED.low,
        close=EXCLUDED.close, change_points=EXCLUDED.change_points, change_percent=EXCLUDED.change_percent,
        volume=EXCLUDED.volume, turnover=EXCLUDED.turnover, source=EXCLUDED.source`,
    [row.code, row.tradeDate, row.open, row.high, row.low, row.close, row.changePoints, row.changePercent, row.volume, row.turnover]);
    count += result.rowCount;
  }
  return count;
}

function safeMessage(error) {
  return error instanceof Error ? error.message : 'Unknown upstream or database error.';
}
