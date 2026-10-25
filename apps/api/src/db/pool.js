import pg from 'pg';

const { Pool } = pg;
export const databaseEnabled = Boolean(process.env.DATABASE_URL);

export const pool = databaseEnabled
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    })
  : null;

if (pool) {
  pool.on('error', (error) => console.error('[StockSense API] idle PostgreSQL client error', error));
}
