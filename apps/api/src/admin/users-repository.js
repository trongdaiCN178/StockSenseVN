import { randomBytes } from 'node:crypto';
import { hashPassword } from '../auth/password.js';
import { ApiError } from '../errors.js';

const roles = new Set(['retail', 'trader', 'analyst', 'admin']);
const temporaryPassword = () => randomBytes(18).toString('base64url');

function decodeAuditCursor(cursor) {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'string' || !/^[1-9]\d*$/.test(String(value[1]))) throw new Error('invalid');
    const createdAt = new Date(value[0]);
    if (Number.isNaN(createdAt.getTime()) || createdAt.toISOString() !== value[0]) throw new Error('invalid');
    return { createdAt: value[0], id: String(value[1]) };
  } catch {
    throw new ApiError(422, 'INVALID_AUDIT_CURSOR', 'The audit cursor is invalid.');
  }
}

function userDto(row) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    is_active: row.is_active,
    must_change_password: row.must_change_password,
    failed_login_count: row.failed_login_count,
    locked_until: row.locked_until?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
  };
}

async function writeAudit(client, actorId, targetId, eventType, details = {}) {
  await client.query(`INSERT INTO admin_audit_log(actor_user_id, target_user_id, event_type, details)
    VALUES ($1, $2, $3, $4::jsonb)`, [actorId, targetId, eventType, JSON.stringify(details)]);
}

function withTransaction(pool, work) {
  return async (...args) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client, ...args);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (error.code === '23505') throw new ApiError(409, 'EMAIL_EXISTS', 'Email này đã được sử dụng.');
      throw error;
    } finally {
      client.release();
    }
  };
}

export function createAdminUsersRepository(pool) {
  const list = async ({ q = '' } = {}) => {
    const needle = q.trim().toLowerCase();
    const [countResult, usersResult] = await Promise.all([
      pool.query(`SELECT count(*)::integer AS total FROM users WHERE $1 = '' OR position($1 in lower(email)) > 0`, [needle]),
      pool.query(`SELECT id, email, role, is_active, must_change_password, failed_login_count, locked_until, created_at
        FROM users WHERE $1 = '' OR position($1 in lower(email)) > 0
        ORDER BY created_at DESC, email LIMIT 100`, [needle]),
    ]);
    return { total: countResult.rows[0].total, items: usersResult.rows.map(userDto) };
  };

  const create = withTransaction(pool, async (client, actorId, { email, role }) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Địa chỉ email không hợp lệ.');
    }
    if (!roles.has(role)) throw new ApiError(422, 'VALIDATION_ERROR', 'Vai trò không hợp lệ.');
    const password = temporaryPassword();
    const passwordHash = await hashPassword(password);
    const { rows } = await client.query(`INSERT INTO users(email, password_hash, role, must_change_password, email_verified_at, created_via)
      VALUES ($1, $2, $3, true, now(), 'admin')
      RETURNING id, email, role, is_active, must_change_password, failed_login_count, locked_until, created_at`,
    [normalizedEmail, passwordHash, role]);
    const user = rows[0];
    await writeAudit(client, actorId, user.id, 'user.created', { role });
    return { user: userDto(user), temporary_password: password };
  });

  const update = withTransaction(pool, async (client, actorId, targetId, changes) => {
    if (targetId === actorId) throw new ApiError(409, 'SELF_MODIFICATION_BLOCKED', 'Không thể thay đổi vai trò hoặc trạng thái tài khoản đang sử dụng.');
    const keys = Object.keys(changes ?? {});
    if (!keys.length || keys.some((key) => !['role', 'is_active'].includes(key))) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Chỉ được cập nhật role hoặc is_active.');
    }
    if (Object.hasOwn(changes, 'role') && !roles.has(changes.role)) throw new ApiError(422, 'VALIDATION_ERROR', 'Vai trò không hợp lệ.');
    if (Object.hasOwn(changes, 'is_active') && typeof changes.is_active !== 'boolean') throw new ApiError(422, 'VALIDATION_ERROR', 'is_active phải là boolean.');

    await client.query('SELECT pg_advisory_xact_lock($1)', [94127032]);
    const targetResult = await client.query(`SELECT id, email, role, is_active, must_change_password, failed_login_count, locked_until, created_at
      FROM users WHERE id = $1 FOR UPDATE`, [targetId]);
    const previous = targetResult.rows[0];
    if (!previous) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản.');
    const nextRole = changes.role ?? previous.role;
    const nextActive = changes.is_active ?? previous.is_active;
    const removingActiveAdmin = previous.role === 'admin' && previous.is_active && (nextRole !== 'admin' || !nextActive);
    if (removingActiveAdmin) {
      const { rows } = await client.query(`SELECT count(*)::integer AS count FROM users WHERE role = 'admin' AND is_active = true`);
      if (rows[0].count <= 1) throw new ApiError(409, 'LAST_ADMIN', 'Phải luôn còn ít nhất một quản trị viên đang hoạt động.');
    }

    const { rows } = await client.query(`UPDATE users SET role = $2, is_active = $3, updated_at = now()
      WHERE id = $1
      RETURNING id, email, role, is_active, must_change_password, failed_login_count, locked_until, created_at`,
    [targetId, nextRole, nextActive]);
    const changedAccess = nextRole !== previous.role || nextActive !== previous.is_active;
    let revokedSessions = 0;
    if (changedAccess) {
      const revoked = await client.query(`UPDATE auth_sessions SET revoked_at = now()
        WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()`, [targetId]);
      revokedSessions = revoked.rowCount;
    }
    await writeAudit(client, actorId, targetId, 'user.updated', {
      before: { role: previous.role, is_active: previous.is_active },
      after: { role: nextRole, is_active: nextActive }, revoked_sessions: revokedSessions,
    });
    return { user: userDto(rows[0]), revoked_sessions: revokedSessions };
  });

  const resetPassword = withTransaction(pool, async (client, actorId, targetId) => {
    if (targetId === actorId) throw new ApiError(409, 'SELF_RESET_BLOCKED', 'Dùng chức năng đổi mật khẩu cho tài khoản đang đăng nhập.');
    const password = temporaryPassword();
    const passwordHash = await hashPassword(password);
    const { rows } = await client.query(`UPDATE users SET password_hash = $2, must_change_password = true,
      failed_login_count = 0, locked_until = NULL, updated_at = now()
      WHERE id = $1
      RETURNING id, email, role, is_active, must_change_password, failed_login_count, locked_until, created_at`,
    [targetId, passwordHash]);
    if (!rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản.');
    const revoked = await client.query(`UPDATE auth_sessions SET revoked_at = now()
      WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()`, [targetId]);
    await writeAudit(client, actorId, targetId, 'user.password_reset', { revoked_sessions: revoked.rowCount });
    return { user: userDto(rows[0]), temporary_password: password, revoked_sessions: revoked.rowCount };
  });

  const revokeSessions = withTransaction(pool, async (client, actorId, targetId) => {
    if (targetId === actorId) throw new ApiError(409, 'SELF_REVOKE_BLOCKED', 'Không thể thu hồi phiên của tài khoản đang thực hiện thao tác.');
    const { rowCount: userCount } = await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [targetId]);
    if (!userCount) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản.');
    const revoked = await client.query(`UPDATE auth_sessions SET revoked_at = now()
      WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()`, [targetId]);
    await writeAudit(client, actorId, targetId, 'user.sessions_revoked', { revoked_sessions: revoked.rowCount });
    return { revoked_sessions: revoked.rowCount };
  });

  // FR-M7-11: filter by time range (ICT dates), actor, action type and target account.
  const audit = async ({ limit = 50, cursor, eventType, from, to, actor, target } = {}) => {
    const after = decodeAuditCursor(cursor);
    const result = await pool.query(`SELECT a.id::text, a.event_type, a.details, a.created_at,
      actor.email AS actor_email, target.email AS target_email
      FROM admin_audit_log a LEFT JOIN users actor ON actor.id = a.actor_user_id
      LEFT JOIN users target ON target.id = a.target_user_id
      WHERE ($1::text IS NULL OR a.event_type = $1)
        AND ($2::timestamptz IS NULL OR (a.created_at,a.id) < ($2::timestamptz,$3::bigint))
        AND ($5::date IS NULL OR a.created_at >= ($5::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
        AND ($6::date IS NULL OR a.created_at < (($6::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
        AND ($7::text IS NULL OR actor.email ILIKE '%' || $7 || '%')
        AND ($8::text IS NULL OR target.email ILIKE '%' || $8 || '%')
      ORDER BY a.created_at DESC, a.id DESC LIMIT $4`,
    [eventType ?? null, after?.createdAt ?? null, after?.id ?? null, Math.min(Math.max(Number(limit) || 50, 1), 100) + 1,
      from ?? null, to ?? null, actor || null, target || null]);
    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    const items = rows.map((row) => ({ id: row.id, event_type: row.event_type, details: row.details,
      created_at: row.created_at.toISOString(), actor_email: row.actor_email, target_email: row.target_email }));
    const last = rows.at(-1);
    const nextCursor = hasMore && last ? Buffer.from(JSON.stringify([last.created_at.toISOString(), last.id])).toString('base64url') : null;
    return { items, next_cursor: nextCursor };
  };

  return { list, create, update, resetPassword, revokeSessions, audit };
}
