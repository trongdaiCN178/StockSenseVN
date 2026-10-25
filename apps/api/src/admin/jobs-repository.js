import { ApiError } from '../errors.js';

const JOBS = Object.freeze([
  { key: 'market.sync', label: 'Sync SSI market data', description: 'Load daily OHLCV for enabled symbols.' },
  { key: 'news.sync', label: 'Sync news', description: 'Load headlines and link them to symbols.' },
  { key: 'notifications.deliver', label: 'Deliver pending notifications', description: 'Send queued email and Telegram notifications.' },
]);

export function createAdminJobsRepository(pool) {
  return {
    async list() {
      const [runsResult, workersResult] = await Promise.all([
        pool.query(`SELECT id::text, job_key, status, attempt_count, queued_at, started_at,
          finished_at, error_code FROM admin_job_runs ORDER BY queued_at DESC, id DESC LIMIT 50`),
        pool.query(`SELECT worker_id, mode, started_at, heartbeat_at, active_job_key, stopped_at,
          stopped_at IS NULL AND heartbeat_at > now() - interval '45 seconds' AS online
          FROM admin_worker_instances ORDER BY heartbeat_at DESC LIMIT 10`),
      ]);
      return { jobs: JOBS, runs: runsResult.rows, workers: workersResult.rows };
    },
    async enqueue(jobKey, requestedBy) {
      if (!JOBS.some((job) => job.key === jobKey)) throw new ApiError(404, 'JOB_NOT_FOUND', 'This worker job is not available.');
      try {
        const { rows } = await pool.query(`INSERT INTO admin_job_runs(job_key,requested_by)
          VALUES ($1,$2) RETURNING id::text,job_key,status,attempt_count,queued_at,started_at,finished_at,error_code`, [jobKey, requestedBy]);
        return rows[0];
      } catch (error) {
        if (error.code === '23505') throw new ApiError(409, 'JOB_ALREADY_ACTIVE', 'A run for this job is already queued or running.');
        throw error;
      }
    },
    async listNotifications(limit = 50) {
      const { rows } = await pool.query(`SELECT id::text, channel, status, attempt_count, next_attempt_at,
        sent_at, last_error_code, created_at FROM notification_outbox
        ORDER BY created_at DESC, id DESC LIMIT $1`, [limit]);
      return { items: rows };
    },
    async listOpsEvents(limit = 50) {
      const { rows } = await pool.query(`
        SELECT event_id,event_type,severity,source,status,reference_id,error_code,occurred_at,context
        FROM (
          SELECT 'ingestion:' || id::text AS event_id,
            CASE status WHEN 'failed' THEN 'ingestion.failed' ELSE 'ingestion.partial' END AS event_type,
            CASE status WHEN 'failed' THEN 'error' ELSE 'warning' END AS severity,
            source,status,id::text AS reference_id,
            CASE status WHEN 'failed' THEN 'INGESTION_FAILED' ELSE 'INGESTION_PARTIAL' END AS error_code,
            COALESCE(completed_at,started_at) AS occurred_at,
            jsonb_build_object('dataset',dataset,'units_total',symbols_total,
              'units_succeeded',symbols_succeeded,'rows_upserted',rows_upserted) AS context
          FROM data_ingestion_runs WHERE status IN ('partial','failed')
          UNION ALL
          SELECT 'job:' || id::text AS event_id,
            CASE status WHEN 'failed' THEN 'worker_job.failed' ELSE 'worker_job.partial' END AS event_type,
            CASE status WHEN 'failed' THEN 'error' ELSE 'warning' END AS severity,
            'admin_worker' AS source,status,id::text AS reference_id,
            COALESCE(error_code,CASE status WHEN 'failed' THEN 'WORKER_JOB_FAILED' ELSE 'WORKER_JOB_PARTIAL' END) AS error_code,
            COALESCE(finished_at,updated_at) AS occurred_at,
            jsonb_build_object('job_key',job_key,'attempt_count',attempt_count) AS context
          FROM admin_job_runs WHERE status IN ('partial','failed')
          UNION ALL
          SELECT 'notification:' || id::text AS event_id,'notification.delivery_failed' AS event_type,
            'error' AS severity,'notification_worker' AS source,status,id::text AS reference_id,
            COALESCE(last_error_code,'NOTIFICATION_DELIVERY_FAILED') AS error_code,
            updated_at AS occurred_at,
            jsonb_build_object('channel',channel,'attempt_count',attempt_count) AS context
          FROM notification_outbox WHERE status='failed'
        ) events ORDER BY occurred_at DESC,event_id LIMIT $1`, [limit]);
      return { items: rows };
    },
  };
}
