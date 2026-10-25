import { emailProviderConfigured, sendNotificationEmail, sendTelegramMessage } from '../providers/notifications.js';

const DELIVERY_LOCK_KEY = 'stocksense:notification-outbox:v1';
const MAX_ATTEMPTS = 5;

export async function processNotificationOutbox({ pool, batchSize = 25, logger = console }) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) throw new Error('batchSize must be from 1 to 100.');
  const emailReady = emailProviderConfigured();
  const telegramReady = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  if (!emailReady && !telegramReady) return { claimed: 0, sent: 0, skipped: 0, retrying: 0, failed: 0, waiting_for_provider: true };

  const client = await pool.connect();
  let locked = false;
  let rows = [];
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS acquired', [DELIVERY_LOCK_KEY]);
    locked = lock.rows[0].acquired;
    if (!locked) return { claimed: 0, sent: 0, skipped: 0, retrying: 0, failed: 0, skipped_locked: true };

    await client.query('BEGIN');
    await client.query(`UPDATE notification_outbox SET status='failed',locked_at=NULL,updated_at=now(),last_error_code='WORKER_LEASE_EXPIRED'
      WHERE status='processing' AND attempt_count >= $1 AND locked_at < now()-interval '10 minutes'`, [MAX_ATTEMPTS]);
    const claimed = await client.query(`WITH candidates AS (
        SELECT id FROM notification_outbox
        WHERE attempt_count < $3 AND (
          (status='pending' AND next_attempt_at<=now()) OR
          (status='processing' AND locked_at < now()-interval '10 minutes')
        ) AND (($1 AND channel='email') OR ($2 AND channel='telegram'))
        ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT $4
      ), updated AS (
        UPDATE notification_outbox o SET status='processing',attempt_count=o.attempt_count+1,
          locked_at=now(),updated_at=now()
        FROM candidates c WHERE o.id=c.id RETURNING o.id,o.user_id,o.alert_id,o.channel,o.attempt_count
      )
      SELECT u.*,a.title,a.message,p.email_enabled,p.telegram_enabled,n.destination,n.verified_at
      FROM updated u JOIN user_alerts a ON a.id=u.alert_id AND a.user_id=u.user_id
      LEFT JOIN notification_preferences p ON p.user_id=u.user_id
      LEFT JOIN notification_channels n ON n.user_id=u.user_id AND n.channel=u.channel`,
    [emailReady, telegramReady, MAX_ATTEMPTS, batchSize]);
    rows = claimed.rows;
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock(hashtext($1))', [DELIVERY_LOCK_KEY]).catch(() => {});
    client.release();
  }

  const summary = { claimed: rows.length, sent: 0, skipped: 0, retrying: 0, failed: 0 };
  for (const row of rows) {
    const enabled = row.channel === 'email' ? row.email_enabled : row.telegram_enabled;
    if (!enabled || !row.verified_at || !row.destination) {
      await pool.query(`UPDATE notification_outbox SET status='skipped',locked_at=NULL,updated_at=now(),last_error_code='CHANNEL_DISABLED'
        WHERE id=$1 AND status='processing'`, [row.id]);
      summary.skipped += 1;
      continue;
    }
    try {
      const text = `${row.title}\n${row.message}\n\nStockSense VN — thông tin tham khảo, không phải khuyến nghị đầu tư.`;
      if (row.channel === 'email') await sendNotificationEmail(row.destination, row.title, text);
      else await sendTelegramMessage(row.destination, text);
      await pool.query(`UPDATE notification_outbox SET status='sent',sent_at=now(),locked_at=NULL,updated_at=now(),last_error_code=NULL
        WHERE id=$1 AND status='processing'`, [row.id]);
      summary.sent += 1;
    } catch (error) {
      const terminal = row.attempt_count >= MAX_ATTEMPTS;
      const delaySeconds = Math.min(3600, 60 * (2 ** Math.max(0, row.attempt_count - 1)));
      const errorCode = /^[A-Z0-9_]{1,80}$/.test(String(error?.code ?? '')) ? error.code : 'DELIVERY_FAILED';
      await pool.query(`UPDATE notification_outbox SET status=$2,locked_at=NULL,
        next_attempt_at=now()+($3::text || ' seconds')::interval,updated_at=now(),last_error_code=$4
        WHERE id=$1 AND status='processing'`, [row.id, terminal ? 'failed' : 'pending', delaySeconds, errorCode]);
      if (terminal) summary.failed += 1; else summary.retrying += 1;
      logger.warn(`[StockSense notifier] delivery ${row.id} (${row.channel}) ${terminal ? 'failed permanently' : 'scheduled for retry'}: ${errorCode}`);
    }
  }
  return summary;
}

