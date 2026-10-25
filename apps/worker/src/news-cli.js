import pg from 'pg';
import { createNewsProvider } from './providers/news.js';
import { syncNews } from './jobs/sync-news.js';

const config = getConfig();
const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: config.poolMax,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});
pool.on('error', (error) => console.error('[StockSense news worker] idle PostgreSQL client error', error));

try {
  const result = await syncNews({
    pool,
    provider: createNewsProvider({ timeoutMs: config.timeoutMs }),
    startDate: config.startDate,
    endDate: config.endDate,
  });
  console.info('[StockSense news worker] run result:', result);
  if (result.status === 'partial') process.exitCode = 2;
  else if (result.status === 'failed') process.exitCode = 1;
} catch (error) {
  console.error('[StockSense news worker] run failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

function getConfig(env = process.env, args = process.argv.slice(2)) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required to run the news worker.');
  const values = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!['--from', '--to'].includes(key) || !args[index + 1] || args[index + 1].startsWith('--')) {
      throw new Error('Usage: news:sync [--from YYYY-MM-DD] [--to YYYY-MM-DD].');
    }
    values.set(key, args[index + 1]);
    index += 1;
  }
  const endDate = values.get('--to') ?? localToday();
  const lookback = Number(env.NEWS_SYNC_LOOKBACK_DAYS || 7);
  if (!Number.isInteger(lookback) || lookback < 0 || lookback > 3650) throw new Error('NEWS_SYNC_LOOKBACK_DAYS must be from 0 to 3650.');
  const startDate = values.get('--from') ?? addDays(endDate, -lookback);
  if (!isDate(startDate) || !isDate(endDate) || startDate > endDate) throw new Error('Use valid YYYY-MM-DD dates with --from <= --to.');
  const timeoutMs = Number(env.NEWS_TIMEOUT_MS || 20_000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120_000) throw new Error('NEWS_TIMEOUT_MS must be between 1000 and 120000.');
  return { databaseUrl: env.DATABASE_URL, poolMax: Number(env.PG_POOL_MAX || 4), timeoutMs, startDate, endDate };
}

function localToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function addDays(value, days) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
