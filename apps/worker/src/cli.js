import pg from 'pg';
import { getConfig } from './config.js';
import { syncMarketData } from './jobs/sync-market-data.js';
import { createSsiProvider } from './providers/ssi.js';

const config = getConfig();
const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: config.poolMax,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});
pool.on('error', (error) => console.error('[StockSense worker] idle PostgreSQL client error', error));

try {
  const result = await syncMarketData({
    pool,
    provider: createSsiProvider({ timeoutMs: config.timeoutMs }),
    startDate: config.startDate,
    endDate: config.endDate,
  });
  console.info('[StockSense worker] run result:', result);
  if (result.status === 'partial') process.exitCode = 2;
  else if (result.status === 'failed') process.exitCode = 1;
} catch (error) {
  console.error('[StockSense worker] run failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
