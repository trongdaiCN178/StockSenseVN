import pg from 'pg';
import { processNotificationOutbox } from './jobs/notification-delivery.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to run the notification delivery worker.');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.PG_POOL_MAX || 4),
  connectionTimeoutMillis: 5_000, idleTimeoutMillis: 30_000 });
pool.on('error', (error) => console.error('[StockSense notifier] idle PostgreSQL client error', error));

try {
  const result = await processNotificationOutbox({ pool });
  console.info('[StockSense notifier] run result:', result);
  if (result.waiting_for_provider || result.retrying || result.failed) process.exitCode = 2;
} catch (error) {
  console.error('[StockSense notifier] run failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
