import pg from 'pg';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to run migrations.');

const migrationDir = fileURLToPath(new URL('./migrations/', import.meta.url));
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query('SELECT pg_advisory_lock($1)', [94127031]);
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);

  const filenames = (await readdir(migrationDir)).filter((name) => name.endsWith('.sql')).sort();
  for (const filename of filenames) {
    const sql = await readFile(path.join(migrationDir, filename), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const result = await client.query('SELECT checksum FROM schema_migrations WHERE version = $1', [filename]);
    if (result.rowCount) {
      if (result.rows[0].checksum !== checksum) throw new Error(`Applied migration ${filename} was changed; create a new migration instead.`);
      console.info(`Already applied: ${filename}`);
      continue;
    }

    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(version, checksum) VALUES ($1, $2)', [filename, checksum]);
      await client.query('COMMIT');
      console.info(`Applied: ${filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  await client.query('SELECT pg_advisory_unlock($1)', [94127031]).catch(() => {});
  client.release();
  await pool.end();
}
