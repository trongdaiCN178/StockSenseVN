import { createHash, randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword } from './password.js';
import { ApiError } from '../errors.js';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_FAILED_LOGINS = 5;
const dummyPasswordHash = await hashPassword('not-a-valid-user-password');

function sessionTokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function mapUser(row) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    must_change_password: row.must_change_password,
    full_name: row.full_name ?? null,
  };
}

export function createPostgresAuthRepository(pool) {
  return {
    async login(email, password) {
      const normalizedEmail = email.trim().toLowerCase();
      await pool.query(`DELETE FROM auth_sessions
        WHERE expires_at <= now() OR revoked_at < now() - interval '90 days'`);
      const { rows } = await pool.query(`SELECT id, email, role, password_hash, must_change_password,
        is_active, failed_login_count, locked_until, email_verified_at, full_name
        FROM users WHERE email = $1 LIMIT 1`, [normalizedEmail]);
      const row = rows[0];

      if (!row) {
        await verifyPassword(password, dummyPasswordHash);
        return null;
      }
      if (!row.is_active || (row.locked_until && new Date(row.locked_until).getTime() > Date.now())) {
        await verifyPassword(password, row.password_hash);
        return null;
      }

      const passwordMatches = await verifyPassword(password, row.password_hash);
      if (!passwordMatches) {
        await pool.query(`UPDATE users SET
          failed_login_count = failed_login_count + 1,
          locked_until = CASE WHEN failed_login_count + 1 >= $2 THEN now() + interval '15 minutes' ELSE locked_until END,
          updated_at = now()
          WHERE id = $1`, [row.id, MAX_FAILED_LOGINS]);
        return null;
      }

      if (!row.email_verified_at) return { emailUnverified: true };

      const token = randomBytes(32).toString('base64url');
      const tokenHash = sessionTokenHash(token);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const updated = await client.query(`UPDATE users SET failed_login_count = 0, locked_until = NULL, updated_at = now()
          WHERE id = $1 AND is_active = true AND (locked_until IS NULL OR locked_until <= now())
          RETURNING id, email, role, must_change_password, full_name`, [row.id]);
        if (!updated.rowCount) {
          await client.query('ROLLBACK');
          return null;
        }
        await client.query(`INSERT INTO auth_sessions(user_id, token_hash, expires_at)
          VALUES ($1, $2, now() + ($3 * interval '1 millisecond'))`, [row.id, tokenHash, TOKEN_TTL_MS]);
        await client.query('COMMIT');
        return { token, user: mapUser(updated.rows[0]), maxAgeSeconds: TOKEN_TTL_MS / 1000 };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async findUserByToken(token) {
      if (!token || token.length > 128) return null;
      const tokenHash = sessionTokenHash(token);
      const { rows } = await pool.query(`SELECT s.id AS session_id, u.id, u.email, u.role, u.must_change_password, u.full_name
        FROM auth_sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.is_active = true
        LIMIT 1`, [tokenHash]);
      const row = rows[0];
      if (!row) return null;
      await pool.query(`UPDATE auth_sessions SET last_seen_at = now()
        WHERE id = $1 AND last_seen_at < now() - interval '5 minutes'`, [row.session_id]);
      return mapUser(row);
    },

    async revokeToken(token) {
      if (!token || token.length > 128) return;
      await pool.query(`UPDATE auth_sessions SET revoked_at = now()
        WHERE token_hash = $1 AND revoked_at IS NULL`, [sessionTokenHash(token)]);
    },

    async changePassword(userId, currentToken, currentPassword, newPassword) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(`SELECT id, password_hash FROM users
          WHERE id = $1 AND is_active = true FOR UPDATE`, [userId]);
        const user = rows[0];
        if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
          throw new ApiError(422, 'CURRENT_PASSWORD_INVALID', 'Mật khẩu hiện tại không đúng.');
        }
        if (await verifyPassword(newPassword, user.password_hash)) {
          throw new ApiError(422, 'PASSWORD_UNCHANGED', 'Mật khẩu mới phải khác mật khẩu hiện tại.');
        }
        const newHash = await hashPassword(newPassword);
        await client.query(`UPDATE users SET password_hash = $2, must_change_password = false,
          failed_login_count = 0, locked_until = NULL, updated_at = now() WHERE id = $1`, [userId, newHash]);
        const currentHash = sessionTokenHash(currentToken);
        await client.query(`UPDATE auth_sessions SET revoked_at = now()
          WHERE user_id = $1 AND token_hash <> $2 AND revoked_at IS NULL`, [userId, currentHash]);
        await client.query('COMMIT');
        return { user: { id: user.id, must_change_password: false } };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
