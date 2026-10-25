import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to run the admin job worker.');

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.PG_POOL_MAX || 4),
  connectionTimeoutMillis: 5_000, idleTimeoutMillis: 30_000 });
const scripts = {
  'market.sync': './cli.js',
  'news.sync': './news-cli.js',
  'notifications.deliver': './notification-cli.js',
};
const MAX_ATTEMPTS = 3;
const LEASE_MINUTES = 45;
const RUN_TIMEOUT_MS = 40 * 60_000;
const IDLE_POLL_MS = 10_000;
const HEARTBEAT_INTERVAL_MS = 15_000;
const WATCH_MODE = process.argv.includes('--watch');
const workerId = randomUUID();
let stopping = false;
let activeJobKey = null;
let heartbeatTimer;

if (WATCH_MODE) {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => { stopping = true; console.info(`[StockSense admin jobs] received ${signal}; stopping after the current job.`); });
  }
}

async function claimNext() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE admin_job_runs SET status='failed',error_code='WORKER_LEASE_EXPIRED',
      lease_expires_at=NULL,finished_at=now(),updated_at=now()
      WHERE status='running' AND lease_expires_at<now() AND attempt_count >= $1`, [MAX_ATTEMPTS]);
    const { rows } = await client.query(`WITH candidate AS (
        SELECT id FROM admin_job_runs WHERE attempt_count < $1 AND (
          status='queued' OR (status='running' AND lease_expires_at<now())
        ) ORDER BY queued_at,id FOR UPDATE SKIP LOCKED LIMIT 1
      ) UPDATE admin_job_runs j SET status='running',attempt_count=j.attempt_count+1,
        started_at=COALESCE(j.started_at,now()),lease_expires_at=now()+($2 * interval '1 minute'),
        error_code=NULL,updated_at=now()
        FROM candidate WHERE j.id=candidate.id
        RETURNING j.id::text,j.job_key,j.attempt_count`, [MAX_ATTEMPTS, LEASE_MINUTES]);
    await client.query('COMMIT');
    return rows[0] ?? null;
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}

function execute(jobKey) {
  const script = scripts[jobKey];
  if (!script) return Promise.reject(new Error('Unsupported queued job.'));
  const child = spawn(process.execPath, [fileURLToPath(new URL(script, import.meta.url))], {
    cwd: path.dirname(fileURLToPath(import.meta.url)), env: process.env, stdio: 'inherit', windowsHide: true,
  });
  return new Promise((resolve) => {
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, RUN_TIMEOUT_MS);
    child.once('error', () => { clearTimeout(timeout); resolve({ status: 'failed', errorCode: 'WORKER_LAUNCH_FAILED' }); });
    child.once('close', (code) => {
      clearTimeout(timeout);
      const status = timedOut || code === 1 || code == null ? 'failed' : code === 2 ? 'partial' : code === 0 ? 'succeeded' : 'failed';
      resolve({ status, errorCode: timedOut ? 'WORKER_TIMEOUT' : status === 'failed' ? 'WORKER_PROCESS_FAILED' : null });
    });
  });
}

async function processRun(run) {
  activeJobKey = run.job_key;
  try {
    const outcome = await execute(run.job_key);
    await pool.query(`UPDATE admin_job_runs SET status=$2,error_code=$3,lease_expires_at=NULL,
      finished_at=now(),updated_at=now() WHERE id=$1 AND status='running'`, [run.id, outcome.status, outcome.errorCode]);
    console.info(`[StockSense admin jobs] ${run.id} ${run.job_key}: ${outcome.status} (attempt ${run.attempt_count})`);
  } finally { activeJobKey = null; }
}

try {
  await pool.query("DELETE FROM admin_worker_instances WHERE heartbeat_at < now() - interval '30 days'");
  await pool.query('INSERT INTO admin_worker_instances(worker_id,mode) VALUES ($1,$2)', [workerId, WATCH_MODE ? 'watch' : 'once']);
  heartbeatTimer = setInterval(() => {
    pool.query(`UPDATE admin_worker_instances SET heartbeat_at=now(),active_job_key=$2
      WHERE worker_id=$1 AND stopped_at IS NULL`, [workerId, activeJobKey])
      .catch((error) => console.error('[StockSense admin jobs] heartbeat update failed:', error.message));
  }, HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref();
  while (!stopping) {
    let processed = 0;
    while (!stopping && processed < 10) {
      const run = await claimNext();
      if (!run) break;
      await processRun(run);
      processed += 1;
    }
    console.info(`[StockSense admin jobs] processed ${processed} job(s).`);
    if (!WATCH_MODE || stopping) break;
    if (processed === 0) await new Promise((resolve) => setTimeout(resolve, IDLE_POLL_MS));
  }
} catch (error) {
  console.error('[StockSense admin jobs] queue processing failed:', error.message);
  process.exitCode = 1;
} finally {
  clearInterval(heartbeatTimer);
  await pool.query(`UPDATE admin_worker_instances SET heartbeat_at=now(),active_job_key=NULL,stopped_at=now()
    WHERE worker_id=$1 AND stopped_at IS NULL`, [workerId]).catch(() => {});
  await pool.end();
}
