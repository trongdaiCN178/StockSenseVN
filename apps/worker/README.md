# StockSense Node.js worker

## Daily OHLCV sync

The first worker job ports the old project's `etl/prices.py` data flow to JavaScript. It fetches SSI daily history (not the old CafeF intraday board feed), validates and normalizes each row, then upserts prices only for enabled symbols already configured in `symbols`. Re-running a date range is safe. The worker records each run in `data_ingestion_runs` and uses a PostgreSQL advisory lock to prevent overlapping syncs.

Requirements: Node.js 22.12+, PostgreSQL migrations applied, `DATABASE_URL` in the repository `.env`, and `npm install`. The news sync needs migration `004_news_symbols.sql`; price crossing alerts need `005_watchlist_alerts.sql`; Email/Telegram delivery also needs migrations `012_notification_preferences.sql`, `013_notification_channels.sql`, and `014_notification_outbox.sql`.

```powershell
npm run db:migrate
npm run db:seed:demo # development only; configures demo symbols
npm run worker:market:sync
npm run worker:market:sync -- --from 2026-10-01 --to 2026-10-20
```

Run the demo seeder before importing real prices only in a development database. For a non-demo environment, provision the approved symbol universe through the normal symbol-management process instead of seeding demo accounts and market forecasts.

By default the job covers `MARKET_SYNC_LOOKBACK_DAYS` (5) through today's date in `Asia/Ho_Chi_Minh`; weekends/holidays naturally return no SSI rows. For the initial historical chart fill, run it once with `--from` set to the start of the desired history (for example, `npm run worker:market:sync -- --from 2026-07-20`). Then use the default short lookback in an OS/container scheduler after the Vietnam market close. Configure `SSI_TIMEOUT_MS` for the upstream request timeout.

After each sync, the worker evaluates each user's active `price_above`/`price_below` rules against the newest SSI close and its previous SSI close. It creates one in-app alert per rule per trading day only on a threshold crossing; it never uses demo prices or forecasts.

The price alert and its external-delivery outbox rows are inserted atomically. Rows are queued only for channels that were enabled and verified when the alert was created. To deliver the pending batch, run `npm run worker:notifications:deliver` after the market sync; schedule it separately for automatic operation. The delivery worker claims rows with `SKIP LOCKED`, rechecks the current preference and verification state, and skips channels that have since been disabled or unlinked. Provider failures retry with exponential delay up to five attempts, then remain `failed` for operator review. Outbox delivery is at-least-once: a process crash after provider acceptance but before the DB update can cause a duplicate on retry.

The notifier uses the same `SMTP_*` and `TELEGRAM_BOT_TOKEN` variables described in the root `.env.example`. If a provider is not configured, its queue remains pending and is not counted as a failed attempt. Logs include outbox IDs and sanitized error codes, never alert text, email addresses, or provider credentials.

The job does not infer forecasts or write `market_batches`: those rows represent forecast batches, and should only be completed after model inference succeeds. SSI may block some hosting networks; errors are recorded per symbol and the run is marked `partial` or `failed` so operations can detect it. On a failed/partial run, fix upstream reachability and rerun the same date range.

Admins can inspect recent runs in the web app at `/admin/jobs`; the page reads the authenticated `GET /api/v1/admin/ingestion-runs` endpoint.

Administrators can enqueue the allowlisted `market.sync`, `news.sync`, and `notifications.deliver` jobs from `/admin/jobs`. The API requires migrations `016_admin_job_queue.sql` and `017_admin_worker_heartbeat.sql`; it only creates a durable `admin_job_runs` row. Run `npm run worker:admin-jobs:run` once from a scheduler, or keep `npm run worker:admin-jobs:watch` running as a service; watch mode polls every 10 seconds while idle, writes a heartbeat every 15 seconds, and stops after the current job on SIGINT/SIGTERM. The Admin page marks a worker offline after 45 seconds without a heartbeat. Each invocation consumes up to 10 jobs. The worker claims queued rows with `SKIP LOCKED`, uses a 45-minute lease, retries expired runs up to three attempts, and refuses concurrent active runs for the same job. Model inference is deliberately not in this allowlist.

## Next worker stages

Run `npm run worker:news:sync` to ingest recent CafeF category headlines and the two VnExpress RSS feeds used by the old web. `--from` and `--to` accept the same ISO date range as the price worker. The worker stores one article once and links it to each enabled ticker found in its title or summary. It labels sentiment `neutral` because this ingestion step does not run a sentiment model. Admins can review the run at `/admin/jobs`.

The next worker stage is feature generation and ONNX Runtime JS inference that creates forecast batches. Keep those stages separate so raw source data can be repaired/replayed without silently fabricating forecasts.
