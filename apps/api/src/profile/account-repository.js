import { verifyPassword } from '../auth/password.js';
import { ApiError } from '../errors.js';

const EXPERIENCE_LEVELS = new Set(['under_1y', '1_3y', 'over_3y']);
const TRADER_PURPOSES = new Set(['personal', 'brokerage', 'portfolio_management']);
const CONSENT_VERSION = '2026-10-23';

function requestDto(row) {
  return {
    id: row.id,
    requested_role: row.requested_role,
    organization: row.organization,
    position: row.position,
    work_email: row.work_email,
    purpose: row.purpose,
    status: row.status,
    note: row.note,
    decided_at: row.decided_at?.toISOString() ?? null,
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
      throw error;
    } finally {
      client.release();
    }
  };
}

export function createAccountRepository(pool) {
  const upgradeToTrader = withTransaction(pool, async (client, userId, { experience, purpose }) => {
    const { rows } = await client.query('SELECT id, role FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const user = rows[0];
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản.');
    if (user.role !== 'retail') throw new ApiError(409, 'UPGRADE_NOT_ALLOWED', 'Chỉ tài khoản Nhà đầu tư cá nhân mới có thể tự nâng cấp lên Trader.');
    await client.query(`UPDATE users SET role = 'trader', updated_at = now() WHERE id = $1`, [userId]);
    await client.query(`INSERT INTO user_consent(user_id, doc_type, version, channel) VALUES ($1, 'trader_terms', $2, 'web')`, [userId, CONSENT_VERSION]);
    const revoked = await client.query(`UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
    await writeAudit(client, userId, userId, 'user.self_upgrade', { before: { role: 'retail' }, after: { role: 'trader' }, experience, purpose });
    return { role: 'trader', revoked_sessions: revoked.rowCount };
  });

  const downgradeToRetail = withTransaction(pool, async (client, userId) => {
    const { rows } = await client.query('SELECT id, role FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const user = rows[0];
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản.');
    if (user.role !== 'trader') throw new ApiError(409, 'DOWNGRADE_NOT_ALLOWED', 'Chỉ tài khoản Trader mới có thể tự hạ cấp về Nhà đầu tư cá nhân.');
    await client.query(`UPDATE users SET role = 'retail', updated_at = now() WHERE id = $1`, [userId]);
    const revoked = await client.query(`UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
    await writeAudit(client, userId, userId, 'user.self_downgrade', { before: { role: 'trader' }, after: { role: 'retail' } });
    return { role: 'retail', revoked_sessions: revoked.rowCount };
  });

  const requestAnalyst = withTransaction(pool, async (client, userId, { organization, position, workEmail, purpose }) => {
    const { rows } = await client.query('SELECT id, role FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const user = rows[0];
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản.');
    if (!['retail', 'trader'].includes(user.role)) throw new ApiError(409, 'ROLE_REQUEST_NOT_ALLOWED', 'Chỉ tài khoản Nhà đầu tư cá nhân hoặc Trader mới có thể gửi yêu cầu quyền Analyst.');

    const { rows: recentRejected } = await client.query(`SELECT decided_at FROM role_requests
      WHERE user_id = $1 AND status = 'rejected' AND decided_at > now() - interval '7 days'
      ORDER BY decided_at DESC LIMIT 1`, [userId]);
    if (recentRejected[0]) throw new ApiError(409, 'ROLE_REQUEST_COOLDOWN', 'Yêu cầu trước đã bị từ chối. Vui lòng nộp lại sau 7 ngày kể từ lúc bị từ chối.');

    try {
      const { rows: created } = await client.query(`INSERT INTO role_requests(user_id, requested_role, organization, position, work_email, purpose)
        VALUES ($1, 'analyst', $2, $3, $4, $5)
        RETURNING id, requested_role, organization, position, work_email, purpose, status, note, decided_at, created_at`,
      [userId, organization, position, workEmail, purpose]);
      return { request: requestDto(created[0]) };
    } catch (error) {
      if (error.code === '23505') throw new ApiError(409, 'ROLE_REQUEST_PENDING', 'Bạn đang có một yêu cầu nâng quyền chờ xử lý.');
      throw error;
    }
  });

  const listOwnRequests = async (userId) => {
    const { rows } = await pool.query(`SELECT id, requested_role, organization, position, work_email, purpose, status, note, decided_at, created_at
      FROM role_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [userId]);
    return { items: rows.map(requestDto) };
  };

  const listRequestsAdmin = async ({ status } = {}) => {
    const { rows } = await pool.query(`SELECT r.id, r.requested_role, r.organization, r.position, r.work_email, r.purpose,
      r.status, r.note, r.decided_at, r.created_at, u.email AS requester_email, u.role AS requester_role
      FROM role_requests r JOIN users u ON u.id = r.user_id
      WHERE $1::text IS NULL OR r.status = $1
      ORDER BY r.created_at DESC LIMIT 100`, [status ?? null]);
    return { items: rows.map((row) => ({ ...requestDto(row), requester_email: row.requester_email, requester_role: row.requester_role })) };
  };

  const decideRequest = withTransaction(pool, async (client, actorId, requestId, decision, note) => {
    const { rows } = await client.query(`SELECT id, user_id, requested_role, status FROM role_requests WHERE id = $1 FOR UPDATE`, [requestId]);
    const request = rows[0];
    if (!request) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy yêu cầu nâng quyền.');
    if (request.status !== 'pending_review') throw new ApiError(409, 'ROLE_REQUEST_ALREADY_DECIDED', 'Yêu cầu này đã được xử lý.');
    if (request.user_id === actorId) throw new ApiError(409, 'SELF_APPROVAL_BLOCKED', 'Không thể tự duyệt yêu cầu của chính mình.');

    if (decision === 'approve') {
      const { rows: userRows } = await client.query('SELECT id, role FROM users WHERE id = $1 FOR UPDATE', [request.user_id]);
      if (!userRows[0]) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản của người yêu cầu.');
      await client.query(`UPDATE users SET role = $2, updated_at = now() WHERE id = $1`, [request.user_id, request.requested_role]);
      const revoked = await client.query(`UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [request.user_id]);
      await client.query(`UPDATE role_requests SET status = 'approved', decided_by = $2, decided_at = now() WHERE id = $1`, [requestId, actorId]);
      await writeAudit(client, actorId, request.user_id, 'user.role_request_approved', { before: { role: userRows[0].role }, after: { role: request.requested_role }, revoked_sessions: revoked.rowCount });
      return { status: 'approved' };
    }

    if (!note || !note.trim()) throw new ApiError(422, 'VALIDATION_ERROR', 'Cần nêu lý do khi từ chối yêu cầu.');
    await client.query(`UPDATE role_requests SET status = 'rejected', decided_by = $2, decided_at = now(), note = $3 WHERE id = $1`, [requestId, actorId, note.trim()]);
    await writeAudit(client, actorId, request.user_id, 'user.role_request_rejected', { note: note.trim() });
    return { status: 'rejected' };
  });

  const listConsents = async (userId) => {
    const { rows } = await pool.query(`SELECT doc_type, version, channel, accepted_at FROM user_consent
      WHERE user_id = $1 ORDER BY accepted_at DESC`, [userId]);
    return { items: rows.map((row) => ({ doc_type: row.doc_type, version: row.version, channel: row.channel, accepted_at: row.accepted_at.toISOString() })) };
  };

  const deleteSelf = withTransaction(pool, async (client, userId, password) => {
    const { rows } = await client.query('SELECT id, role, password_hash FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) throw new ApiError(422, 'CURRENT_PASSWORD_INVALID', 'Mật khẩu hiện tại không đúng.');
    if (user.role === 'admin') throw new ApiError(409, 'ADMIN_SELF_DELETE_BLOCKED', 'Tài khoản quản trị viên không thể tự xóa qua chức năng này.');
    await writeAudit(client, userId, userId, 'user.self_deleted', {});
    await client.query('DELETE FROM users WHERE id = $1', [userId]);
    return { deleted: true };
  });

  return {
    upgradeToTrader: (userId, body) => {
      if (!EXPERIENCE_LEVELS.has(body?.experience) || !TRADER_PURPOSES.has(body?.purpose) || body?.acknowledged !== true) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Vui lòng khai kinh nghiệm, mục đích và xác nhận trách nhiệm trước khi nâng cấp.');
      }
      return upgradeToTrader(userId, body);
    },
    downgradeToRetail,
    requestAnalyst: (userId, body) => {
      const organization = typeof body?.organization === 'string' ? body.organization.trim() : '';
      const position = typeof body?.position === 'string' ? body.position.trim() : '';
      const workEmail = typeof body?.work_email === 'string' ? body.work_email.trim() : '';
      const purpose = typeof body?.purpose === 'string' ? body.purpose.trim() : '';
      if (!organization || organization.length > 200 || !position || position.length > 200 ||
          !workEmail || workEmail.length > 254 || !/^\S+@\S+\.\S+$/.test(workEmail) ||
          !purpose || purpose.length > 1000) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Vui lòng nhập đầy đủ tổ chức, chức danh, email cơ quan hợp lệ và mục đích sử dụng.');
      }
      return requestAnalyst(userId, { organization, position, workEmail, purpose });
    },
    listOwnRequests,
    listRequestsAdmin,
    approveRequest: (actorId, requestId) => decideRequest(actorId, requestId, 'approve', null),
    rejectRequest: (actorId, requestId, note) => decideRequest(actorId, requestId, 'reject', note),
    listConsents,
    deleteSelf: (userId, password) => {
      if (typeof password !== 'string' || !password) throw new ApiError(422, 'VALIDATION_ERROR', 'Cần nhập mật khẩu hiện tại để xác nhận xóa tài khoản.');
      return deleteSelf(userId, password);
    },
  };
}
