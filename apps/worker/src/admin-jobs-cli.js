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
// FR-M7-07: in watch mode the daily pipeline is queued after the close (15:30 ICT) on trading days.
const DAILY_PIPELINE = ['market.sync', 'news.sync', 'notifications.deliver'];
const SCHEDULE_ENABLED = process.env.ADMIN_JOBS_SCHEDULE !== 'off';
const SCHEDULE_TIME = /^\d{2}:\d{2}$/.test(process.env.ADMIN_JOBS_SCHEDULE_TIME ?? '') ? process.env.ADMIN_JOBS_SCHEDULE_TIME : '15:30';
const RETRY_DELAY_MINUTES = 2;
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
          (status='queued' AND queued_at <= now()) OR (status='running' AND lease_expires_at<now())
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
    if (outcome.status === 'failed' && run.attempt_count < MAX_ATTEMPTS) {
      await pool.query(`UPDATE admin_job_runs SET status='queued',error_code=$2,lease_expires_at=NULL,
        queued_at=now()+($3 * interval '1 minute'),updated_at=now() WHERE id=$1 AND status='running'`,
      [run.id, outcome.errorCode, RETRY_DELAY_MINUTES * run.attempt_count]);
      console.warn(`[StockSense admin jobs] ${run.id} ${run.job_key}: failed (attempt ${run.attempt_count}); retrying.`);
      return;
    }
    await pool.query(`UPDATE admin_job_runs SET status=$2,error_code=$3,lease_expires_at=NULL,
      finished_at=now(),updated_at=now() WHERE id=$1 AND status='running'`, [run.id, outcome.status, outcome.errorCode]);
    if (outcome.status === 'failed') await notifyAdmins(run, outcome.errorCode);
    console.info(`[StockSense admin jobs] ${run.id} ${run.job_key}: ${outcome.status} (attempt ${run.attempt_count})`);
  } finally { activeJobKey = null; }
}

// FR-M7-08: after the last retry fails, every active admin gets an in-app alert (and email/Telegram when linked).
async function notifyAdmins(run, errorCode) {
  await pool.query(`WITH created AS (
      INSERT INTO user_alerts(user_id, symbol, trade_date, alert_type, title, message, payload)
      SELECT id, NULL, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'job_failed',
        'Tác vụ ' || $1 || ' thất bại sau ' || $3 || ' lần thử',
        'Mã lỗi: ' || COALESCE($2, 'WORKER_JOB_FAILED') || '. Xem chi tiết tại trang Sự kiện vận hành.',
        jsonb_build_object('job_run_id', $4::text, 'job_key', $1)
      FROM users WHERE role='admin' AND is_active
      RETURNING id, user_id
    )
    INSERT INTO notification_outbox(user_id,alert_id,channel)
    SELECT created.user_id, created.id, channels.channel FROM created
    JOIN notification_channels channels ON channels.user_id=created.user_id AND channels.verified_at IS NOT NULL
    ON CONFLICT (alert_id,channel) DO NOTHING`, [run.job_key, errorCode, String(run.attempt_count), run.id])
    .catch((error) => console.error('[StockSense admin jobs] could not notify admins:', error.message));
}

async function enqueueDailyPipeline() {
  const { rows } = await pool.query(`SELECT to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS today,
    to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI') AS clock,
    extract(isodow FROM now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::integer AS weekday,
    EXISTS (SELECT 1 FROM market_holidays WHERE holiday = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) AS holiday`);
  const { today, clock, weekday, holiday } = rows[0];
  // No session on weekends or exchange holidays, so there is nothing to sync.
  if (weekday > 5 || holiday || clock < SCHEDULE_TIME) return;
  for (const [index, jobKey] of DAILY_PIPELINE.entries()) {
    // ON CONFLICT also skips a day already scheduled and a job that an admin started manually.
    const inserted = await pool.query(`INSERT INTO admin_job_runs(job_key, scheduled_for, queued_at, payload)
      VALUES ($1, $2::date, now() + ($3 * interval '1 second'), jsonb_build_object('trigger', 'schedule'))
      ON CONFLICT DO NOTHING`, [jobKey, today, index]);
    if (inserted.rowCount) console.info(`[StockSense admin jobs] scheduled ${jobKey} for ${today}.`);
  }
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
    if (WATCH_MODE && SCHEDULE_ENABLED) await enqueueDailyPipeline();
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
