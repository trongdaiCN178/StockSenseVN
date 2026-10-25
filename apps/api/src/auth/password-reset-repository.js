import { createHash, createHmac, randomBytes } from 'node:crypto';
import { hashPassword } from './password.js';
import { ApiError } from '../errors.js';

const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
function rateKey(value) {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32) throw new ApiError(503, 'PASSWORD_RESET_NOT_CONFIGURED', 'Password reset security configuration is unavailable.');
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function createPasswordResetRepository(pool) {
  return {
    async issue(email, ip) {
      const normalizedEmail = email.trim().toLowerCase();
      const emailKey = rateKey(`email:${normalizedEmail}`);
      const ipKey = rateKey(`ip:${ip}`);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const key of [emailKey, ipKey].sort()) await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
        await client.query('DELETE FROM password_reset_requests WHERE created_at < now() - interval \'24 hours\'');
        await client.query(`DELETE FROM password_reset_tokens
          WHERE (consumed_at IS NOT NULL AND consumed_at < now() - interval '24 hours')
             OR expires_at < now() - interval '24 hours'`);
        const { rows: counts } = await client.query(`SELECT
          count(*) FILTER (WHERE email_key=$1)::integer AS email_count,
          count(*) FILTER (WHERE ip_key=$2)::integer AS ip_count
          FROM password_reset_requests WHERE created_at > now() - interval '1 hour'`, [emailKey, ipKey]);
        if (counts[0].email_count >= 3 || counts[0].ip_count >= 10) {
          await client.query('COMMIT');
          return null;
        }
        await client.query('INSERT INTO password_reset_requests(email_key,ip_key) VALUES ($1,$2)', [emailKey, ipKey]);

        const { rows } = await client.query('SELECT id,email FROM users WHERE email=$1 AND is_active=true FOR UPDATE', [normalizedEmail]);
        const user = rows[0];
        if (!user) {
          await client.query('COMMIT');
          return null;
        }
        const token = randomBytes(32).toString('base64url');
        await client.query('UPDATE password_reset_tokens SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL', [user.id]);
        await client.query(`INSERT INTO password_reset_tokens(user_id,token_hash,expires_at)
          VALUES ($1,$2,now()+interval '30 minutes')`, [user.id, tokenHash(token)]);
        await client.query('COMMIT');
        return { userId: user.id, email: user.email, token };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally { client.release(); }
    },

    async cancel(token) {
      await pool.query('UPDATE password_reset_tokens SET consumed_at=now() WHERE token_hash=$1 AND consumed_at IS NULL', [tokenHash(token)]);
    },

    async reset(token, password) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(`SELECT t.id AS token_id,t.user_id,u.password_hash
          FROM password_reset_tokens t JOIN users u ON u.id=t.user_id
          WHERE t.token_hash=$1 AND t.consumed_at IS NULL AND t.expires_at>now() AND u.is_active=true
          FOR UPDATE OF t,u`, [tokenHash(token)]);
        const record = rows[0];
        if (!record) throw new ApiError(422, 'RESET_TOKEN_INVALID', 'This password reset link is invalid or expired.');
        const passwordHash = await hashPassword(password);
        await client.query(`UPDATE users SET password_hash=$2,must_change_password=false,
          failed_login_count=0,locked_until=NULL,updated_at=now() WHERE id=$1`, [record.user_id,passwordHash]);
        await client.query('UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [record.user_id]);
        await client.query('UPDATE password_reset_tokens SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL', [record.user_id]);
        await client.query(`INSERT INTO admin_audit_log(actor_user_id,target_user_id,event_type,details)
          VALUES (NULL,$1,'auth.password_reset','{"source":"self_service"}'::jsonb)`, [record.user_id]);
        await client.query('COMMIT');
        return { reset: true };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally { client.release(); }
    },
  };
}
