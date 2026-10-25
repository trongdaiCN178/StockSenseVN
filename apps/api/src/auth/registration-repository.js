import { createHash, createHmac, randomBytes } from 'node:crypto';
import { hashPassword } from './password.js';
import { ApiError } from '../errors.js';

const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
const CONSENT_VERSION = '2026-10-23';

function rateKey(value) {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32) throw new ApiError(503, 'REGISTRATION_NOT_CONFIGURED', 'Registration security configuration is unavailable.');
  return createHmac('sha256', secret).update(value).digest('hex');
}

async function withinLimit(client, emailKey, ipKey, kind, { emailLimit, ipLimit, windowInterval }) {
  const { rows: counts } = await client.query(`SELECT
    count(*) FILTER (WHERE email_key=$1)::integer AS email_count,
    count(*) FILTER (WHERE ip_key=$2)::integer AS ip_count
    FROM registration_requests WHERE kind=$3 AND created_at > now() - $4::interval`, [emailKey, ipKey, kind, windowInterval]);
  if (counts[0].email_count >= emailLimit || counts[0].ip_count >= ipLimit) return false;
  await client.query('INSERT INTO registration_requests(email_key,ip_key,kind) VALUES ($1,$2,$3)', [emailKey, ipKey, kind]);
  return true;
}

export function createRegistrationRepository(pool) {
  return {
    async register(email, password, fullName, ip) {
      const normalizedEmail = email.trim().toLowerCase();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const emailKey = rateKey(`email:${normalizedEmail}`);
        const ipKey = rateKey(`ip:${ip}`);
        for (const key of [emailKey, ipKey].sort()) await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);

        await client.query('DELETE FROM registration_requests WHERE created_at < now() - interval \'24 hours\'');
        await client.query(`DELETE FROM email_verification_tokens
          WHERE (consumed_at IS NOT NULL AND consumed_at < now() - interval '24 hours')
             OR expires_at < now() - interval '24 hours'`);
        await client.query(`DELETE FROM users WHERE created_via='self_register' AND email_verified_at IS NULL
          AND created_at < now() - interval '7 days'`);

        const allowed = await withinLimit(client, emailKey, ipKey, 'register', { emailLimit: 5, ipLimit: 5, windowInterval: '1 hour' });
        if (!allowed) {
          await client.query('COMMIT');
          return null;
        }

        const { rows: existingRows } = await client.query('SELECT id, email FROM users WHERE email=$1 FOR UPDATE', [normalizedEmail]);
        if (existingRows[0]) {
          await client.query('COMMIT');
          return { alreadyExists: true, email: existingRows[0].email };
        }

        const passwordHash = await hashPassword(password);
        const { rows } = await client.query(`INSERT INTO users(email, password_hash, role, full_name, created_via, age_confirmed_at)
          VALUES ($1, $2, 'retail', $3, 'self_register', now())
          RETURNING id, email`, [normalizedEmail, passwordHash, fullName?.trim() || null]);
        const user = rows[0];

        await client.query(`INSERT INTO user_consent(user_id, doc_type, version, channel) VALUES
          ($1, 'terms_of_service', $2, 'web'), ($1, 'privacy_notice', $2, 'web')`, [user.id, CONSENT_VERSION]);

        const token = randomBytes(32).toString('base64url');
        await client.query(`INSERT INTO email_verification_tokens(user_id, token_hash, expires_at)
          VALUES ($1, $2, now() + interval '24 hours')`, [user.id, tokenHash(token)]);

        await client.query('COMMIT');
        return { created: true, userId: user.id, email: user.email, token };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        if (error.code === '23505') return { alreadyExists: true, email: normalizedEmail };
        throw error;
      } finally {
        client.release();
      }
    },

    async resend(email, ip) {
      const normalizedEmail = email.trim().toLowerCase();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const emailKey = rateKey(`email:${normalizedEmail}`);
        const ipKey = rateKey(`ip:${ip}`);
        for (const key of [emailKey, ipKey].sort()) await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);

        const allowed = await withinLimit(client, emailKey, ipKey, 'resend', { emailLimit: 5, ipLimit: 10, windowInterval: '24 hours' });
        if (!allowed) {
          await client.query('COMMIT');
          return null;
        }

        const { rows } = await client.query(`SELECT id, email FROM users
          WHERE email=$1 AND email_verified_at IS NULL FOR UPDATE`, [normalizedEmail]);
        const user = rows[0];
        if (!user) {
          await client.query('COMMIT');
          return null;
        }

        const { rows: recent } = await client.query(`SELECT created_at FROM email_verification_tokens
          WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [user.id]);
        if (recent[0] && Date.now() - new Date(recent[0].created_at).getTime() < 60_000) {
          await client.query('COMMIT');
          return null;
        }

        await client.query('UPDATE email_verification_tokens SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL', [user.id]);
        const token = randomBytes(32).toString('base64url');
        await client.query(`INSERT INTO email_verification_tokens(user_id, token_hash, expires_at)
          VALUES ($1, $2, now() + interval '24 hours')`, [user.id, tokenHash(token)]);
        await client.query('COMMIT');
        return { userId: user.id, email: user.email, token };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },

    async cancelVerification(token) {
      await pool.query('UPDATE email_verification_tokens SET consumed_at=now() WHERE token_hash=$1 AND consumed_at IS NULL', [tokenHash(token)]);
    },

    async verifyEmail(token) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(`SELECT t.id AS token_id, t.user_id
          FROM email_verification_tokens t JOIN users u ON u.id = t.user_id
          WHERE t.token_hash=$1 AND t.consumed_at IS NULL AND t.expires_at>now() AND u.is_active=true
          FOR UPDATE OF t`, [tokenHash(token)]);
        const record = rows[0];
        if (!record) throw new ApiError(422, 'EMAIL_VERIFICATION_TOKEN_INVALID', 'Liên kết xác thực không hợp lệ hoặc đã hết hạn.');
        await client.query('UPDATE users SET email_verified_at=now(), updated_at=now() WHERE id=$1 AND email_verified_at IS NULL', [record.user_id]);
        await client.query('UPDATE email_verification_tokens SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL', [record.user_id]);
        await client.query(`INSERT INTO admin_audit_log(actor_user_id,target_user_id,event_type,details)
          VALUES (NULL,$1,'auth.email_verified','{"source":"self_register"}'::jsonb)`, [record.user_id]);
        await client.query('COMMIT');
        return { verified: true };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
