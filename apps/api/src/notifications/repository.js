import { ApiError } from '../errors.js';
import { createHash } from 'node:crypto';

export function createNotificationPreferencesRepository(pool) {
  return {
    async get(userId, delivery) {
      const { rows } = await pool.query(`SELECT in_app_enabled,email_enabled,telegram_enabled,updated_at
        FROM notification_preferences WHERE user_id=$1`, [userId]);
      const row = rows[0] ?? { in_app_enabled: true, email_enabled: false, telegram_enabled: false, updated_at: null };
      return { preferences: row, delivery };
    },
    async save(userId, preferences, delivery) {
      const { rows } = await pool.query(`INSERT INTO notification_preferences(user_id,in_app_enabled,email_enabled,telegram_enabled)
        VALUES ($1,$2,$3,$4) ON CONFLICT (user_id) DO UPDATE SET
        in_app_enabled=EXCLUDED.in_app_enabled,email_enabled=EXCLUDED.email_enabled,
        telegram_enabled=EXCLUDED.telegram_enabled,updated_at=now()
        RETURNING in_app_enabled,email_enabled,telegram_enabled,updated_at`,
      [userId, preferences.in_app_enabled, preferences.email_enabled, preferences.telegram_enabled]);
      return { preferences: rows[0], delivery };
    },
  };
}

export function validateNotificationPreferences(input) {
  const keys = ['in_app_enabled', 'email_enabled', 'telegram_enabled'];
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== keys.length ||
      keys.some((key) => typeof input[key] !== 'boolean') || Object.keys(input).some((key) => !keys.includes(key))) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Provide boolean values for in_app_enabled, email_enabled, and telegram_enabled.');
  }
  return Object.fromEntries(keys.map((key) => [key, input[key]]));
}

export function hashVerificationCode(code) { return createHash('sha256').update(code).digest(); }

export function createNotificationChannelsRepository(pool) {
  return {
    async list(userId, accountEmail) {
      const { rows } = await pool.query('SELECT channel,destination,verified_at FROM notification_channels WHERE user_id=$1', [userId]);
      const channels = Object.fromEntries(rows.map((row) => [row.channel, { destination: row.destination, verified: Boolean(row.verified_at), verified_at: row.verified_at }]));
      return { email: channels.email ?? { destination: accountEmail, verified: false, verified_at: null }, telegram: channels.telegram ?? { destination: null, verified: false, verified_at: null } };
    },
    async issue(userId, channel, destination, hash, expiresAt) {
      const { rows } = await pool.query(`INSERT INTO notification_channels(user_id,channel,destination,challenge_hash,challenge_expires_at,last_challenge_at)
        VALUES ($1,$2,$3,$4,$5,now()) ON CONFLICT (user_id,channel) DO UPDATE SET
        destination=EXCLUDED.destination,verified_at=NULL,challenge_hash=EXCLUDED.challenge_hash,
        challenge_expires_at=EXCLUDED.challenge_expires_at,challenge_attempts=0,last_challenge_at=now(),updated_at=now()
        WHERE notification_channels.verified_at IS NULL AND
        (notification_channels.last_challenge_at IS NULL OR notification_channels.last_challenge_at < now()-interval '60 seconds')
        RETURNING channel`, [userId, channel, destination, hash, expiresAt]);
      if (rows[0]) return;
      const { rows: existing } = await pool.query('SELECT verified_at FROM notification_channels WHERE user_id=$1 AND channel=$2', [userId, channel]);
      if (existing[0]?.verified_at) throw new ApiError(409, 'CHANNEL_ALREADY_VERIFIED', 'Unlink this channel before changing its destination.');
      throw new ApiError(429, 'VERIFICATION_RATE_LIMITED', 'Wait at least 60 seconds before requesting another verification.');
    },
    async cancelChallenge(userId, channel, hash) {
      await pool.query(`DELETE FROM notification_channels WHERE user_id=$1 AND channel=$2 AND challenge_hash=$3 AND verified_at IS NULL`, [userId, channel, hash]);
    },
    async verifyEmail(userId, hash) {
      const { rows } = await pool.query(`UPDATE notification_channels SET verified_at=now(),challenge_hash=NULL,challenge_expires_at=NULL,
        challenge_attempts=0,updated_at=now() WHERE user_id=$1 AND channel='email' AND challenge_hash=$2 AND challenge_expires_at>now()
        AND challenge_attempts<5 RETURNING destination,verified_at`, [userId, hash]);
      if (!rows[0]) {
        await pool.query(`UPDATE notification_channels SET challenge_attempts=challenge_attempts+1 WHERE user_id=$1 AND channel='email'
          AND challenge_hash IS NOT NULL AND challenge_attempts<5`, [userId]);
        throw new ApiError(422, 'INVALID_VERIFICATION_CODE', 'Verification code is invalid or expired.');
      }
      return { channel: 'email', destination: rows[0].destination, verified: true, verified_at: rows[0].verified_at };
    },
    async consumeTelegramChallenge(hash, chatId) {
      try {
        const { rows } = await pool.query(`UPDATE notification_channels SET destination=$2,verified_at=now(),challenge_hash=NULL,
          challenge_expires_at=NULL,challenge_attempts=0,updated_at=now() WHERE channel='telegram' AND challenge_hash=$1 AND challenge_expires_at>now()
          AND challenge_attempts<5 RETURNING user_id`, [hash, String(chatId)]);
        return rows[0] ?? null;
      } catch (error) {
        if (error.code === '23505') throw new ApiError(409, 'TELEGRAM_ALREADY_LINKED', 'This Telegram chat is already linked to another account.');
        throw error;
      }
    },
    async verifiedDestination(userId, channel) {
      const { rows } = await pool.query('SELECT destination FROM notification_channels WHERE user_id=$1 AND channel=$2 AND verified_at IS NOT NULL', [userId, channel]);
      return rows[0]?.destination ?? null;
    },
    async claimTest(userId, channel) {
      const { rows } = await pool.query(`UPDATE notification_channels SET last_test_at=now(),updated_at=now()
        WHERE user_id=$1 AND channel=$2 AND verified_at IS NOT NULL
          AND (last_test_at IS NULL OR last_test_at < now()-interval '60 seconds') RETURNING destination`, [userId, channel]);
      if (rows[0]) return rows[0].destination;
      const { rows: existing } = await pool.query('SELECT verified_at FROM notification_channels WHERE user_id=$1 AND channel=$2', [userId, channel]);
      if (!existing[0]?.verified_at) throw new ApiError(409, 'CHANNEL_NOT_VERIFIED', 'Verify the channel before sending a test message.');
      throw new ApiError(429, 'CHANNEL_TEST_RATE_LIMITED', 'Wait at least 60 seconds before sending another test message.');
    },
    async unlink(userId, channel) {
      await pool.query('DELETE FROM notification_channels WHERE user_id=$1 AND channel=$2', [userId, channel]);
      if (channel === 'email') await pool.query('UPDATE notification_preferences SET email_enabled=false,updated_at=now() WHERE user_id=$1', [userId]);
      if (channel === 'telegram') await pool.query('UPDATE notification_preferences SET telegram_enabled=false,updated_at=now() WHERE user_id=$1', [userId]);
      return { channel, removed: true };
    },
  };
}

