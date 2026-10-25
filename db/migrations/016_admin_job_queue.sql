CREATE TABLE admin_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key text NOT NULL CHECK (job_key IN ('market.sync', 'news.sync', 'notifications.deliver')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'partial', 'failed')),
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  queued_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  lease_expires_at timestamptz,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_job_runs_recent_idx ON admin_job_runs(queued_at DESC, id DESC);
CREATE INDEX admin_job_runs_claim_idx ON admin_job_runs(status, queued_at, lease_expires_at);
CREATE UNIQUE INDEX admin_job_runs_one_active_per_job_idx ON admin_job_runs(job_key)
  WHERE status IN ('queued', 'running');
