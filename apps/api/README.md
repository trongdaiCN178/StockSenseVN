# StockSense API bootstrap

This Fastify app implements the first `/api/v1` slice in `../../openapi.yaml`: development login/session, market status and summary, symbol list/detail, prices and news.

## Run locally

```sh
npm install
npm run dev:api
```

In another terminal, copy `apps/web/.env.real.example` to `apps/web/.env.local` and run `npm run dev:web`. Vite proxies `/api` to `http://127.0.0.1:3000`, so the session cookie stays same-site.

Development accounts (password follows `{role}12345678`):

| Email | Role | Password |
|---|---|---|
| `retail@stocksense.vn` | retail | `retail12345678` |
| `trader@stocksense.vn` | trader | `trader12345678` |
| `analyst@stocksense.vn` | analyst | `analyst12345678` |
| `admin@stocksense.vn` | admin | `admin12345678` |

The API intentionally exits when `NODE_ENV=production`: identities are development-only and market/price/news content is sample data even when PostgreSQL stores it. Fixture mode stores sessions in memory; DB mode hashes passwords and stores only a hash of each random session token in an HttpOnly cookie-backed `auth_sessions` record. Set `COOKIE_SECURE=true` behind HTTPS. Replace demo identities and demo market data before any deployment.

## PostgreSQL-backed market endpoints

Copy the root `.env.example` to `.env`, start the local database using `docker compose up -d db`, then run:

```sh
npm run db:migrate
npm run db:seed:demo
npm run dev:api
```

When `DATABASE_URL` is set, the API selects the PostgreSQL repositories for authentication and market data. Run migrations before starting the API. The repeatable seed writes demo users plus sample companies, forecasts, index summaries, daily prices and news. Demo users are `retail@stocksense.vn`, `trader@stocksense.vn`, `analyst@stocksense.vn`, and `admin@stocksense.vn`; each password follows `{role}12345678` (e.g. `admin12345678`). Re-running the seed resets those reserved demo accounts' password and lock state. Set `DATABASE_URL` to an empty value to use the fixture repository again. `PG_POOL_MAX` controls the node-postgres connection pool size.

Schema changes are immutable migrations under `db/migrations/`; the runner records SHA-256 checksums and rejects edits to migrations already applied. Tables cover users and sessions, symbols, market batches/summary/indices, forecasts, daily prices, news, and worker ingestion runs. PostgreSQL authentication uses `scrypt` password hashes, eight-hour expiring sessions with hashed random tokens, account lock after repeated failed logins, and session revocation at logout. Admins can read recent worker runs at `GET /api/v1/admin/ingestion-runs`.

The admin API and `/admin/users` page can create accounts, change role/status, issue a one-time temporary password, revoke sessions and review audit events. A temporary password is returned once in the admin response and must be delivered out of band. Users with a temporary password can only read their session, log out or change that password. Self-service email recovery (`/api/v1/auth/forgot-password`, `/api/v1/auth/reset-password`) is gated behind `PASSWORD_RESET_ENABLED=true`, a 32+ character `AUTH_RATE_LIMIT_SECRET`, and `PUBLIC_APP_URL`; it also needs the SMTP setup below configured, or the API returns `PASSWORD_RESET_UNAVAILABLE`.

Role checks use `packages/core/src/access/roles.js` for UI/API consistency. Those checks are enforced by API pre-handlers; the web guards are not the security boundary.

Migration `005_watchlist_alerts.sql` adds user-owned watchlists, price threshold rules, and an in-app alert inbox. The API derives ownership from the authenticated session and enforces a 10-symbol watchlist limit. Rules currently support only SSI close-price crossings (`price_above` / `price_below`); the market worker creates at most one alert per rule per trading day. Forecast-based alert rules are not implemented. Email/Telegram verification, test, and unlink routes are implemented behind explicit provider configuration and per-user verification.

Email channel verification/test delivery uses `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`. Telegram linking/test delivery uses `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, and `TELEGRAM_WEBHOOK_SECRET`; configure the bot webhook to `POST /api/v1/notify/telegram/webhook` with Telegram's `secret_token` set to the same secret. Do not commit these values. The API stores only hashed verification challenges; it does not store the bot token or SMTP credentials in PostgreSQL.

Provider delivery from the price-alert worker is implemented via the notification outbox: each alert queues one outbox row per enabled, verified channel, and `npm run worker:notifications:deliver` (see `apps/worker/README.md`) claims and sends pending rows with retry up to five attempts. That delivery command is not scheduled by anything in this repo yet (`docker-compose.yml` only runs PostgreSQL); run it on a recurring schedule (cron, Windows Task Scheduler, or a container) after `worker:market:sync` for alerts to actually reach Email or Telegram.
