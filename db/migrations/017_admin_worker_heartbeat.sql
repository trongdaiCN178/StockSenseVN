CREATE TABLE admin_worker_instances (
  worker_id text PRIMARY KEY,
  mode text NOT NULL CHECK (mode IN ('once', 'watch')),
  started_at timestamptz NOT NULL DEFAULT now(),
  heartbeat_at timestamptz NOT NULL DEFAULT now(),
  active_job_key text CHECK (active_job_key IN ('market.sync', 'news.sync', 'notifications.deliver')),
  stopped_at timestamptz
);
CREATE INDEX admin_worker_instances_heartbeat_idx ON admin_worker_instances(heartbeat_at DESC);
