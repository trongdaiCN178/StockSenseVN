import { useCallback, useEffect, useState } from 'react';
import { ROLE_LABELS, ROLES } from '@stocksense/core/access';
import { api } from '../../api/index.js';

const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });

export function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [auditNextCursor, setAuditNextCursor] = useState(null);
  const [auditEventType, setAuditEventType] = useState('');
  const [auditFilters, setAuditFilters] = useState({ from: '', to: '', actor: '', target: '' });
  const [appliedAuditFilters, setAppliedAuditFilters] = useState({ from: '', to: '', actor: '', target: '' });
  const [auditLoadingMore, setAuditLoadingMore] = useState(false);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ email: '', role: ROLES.RETAIL });
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const refresh = useCallback(async () => {
    const [userResult, auditResult] = await Promise.allSettled([
      api.admin.users.list({ q: query }),
      api.admin.audit({ eventType: auditEventType || undefined, ...appliedAuditFilters }),
    ]);
    if (userResult.status === 'rejected') throw userResult.reason;
    setUsers(userResult.value.items);
    setAudit(auditResult.status === 'fulfilled' ? auditResult.value.items : []);
    setAuditNextCursor(auditResult.status === 'fulfilled' ? auditResult.value.next_cursor : null);
  }, [query, auditEventType, appliedAuditFilters]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    refresh().catch((requestError) => { if (active) setError(requestError.message || 'Không tải được tài khoản.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  async function runAction(key, action, successMessage) {
    setBusy(key); setError(''); setNotice(null);
    try {
      const result = await action();
      setNotice({ text: successMessage, password: result?.temporary_password });
      await refresh();
      return true;
    } catch (requestError) {
      setError(requestError.message || 'Thao tác không thành công.');
      return false;
    } finally { setBusy(''); }
  }

  async function createUser(event) {
    event.preventDefault();
    const created = await runAction('create', () => api.admin.users.create(form), 'Đã tạo tài khoản. Gửi mật khẩu tạm cho người dùng qua kênh an toàn.');
    if (created) setForm({ ...form, email: '' });
  }

  async function loadMoreAudit() {
    if (!auditNextCursor || auditLoadingMore) return;
    setAuditLoadingMore(true);
    try {
      const page = await api.admin.audit({ eventType: auditEventType || undefined, ...appliedAuditFilters, cursor: auditNextCursor });
      setAudit((current) => [...current, ...page.items]);
      setAuditNextCursor(page.next_cursor);
    } catch (requestError) { setError(requestError.message || 'Không tải được thêm sự kiện audit.'); }
    finally { setAuditLoadingMore(false); }
  }

  return <section className="content admin-users-page">
    <header className="pagehead"><div><span className="eyebrow">QUẢN TRỊ · TÀI KHOẢN</span><h1>Người dùng và phân quyền</h1><p>Quản lý vai trò, trạng thái đăng nhập và phiên hoạt động.</p></div><span className="chip info">ADMIN</span></header>
    <div className="note warn"><strong>Lưu ý:</strong> mật khẩu tạm chỉ hiển thị sau khi tạo hoặc đặt lại. Hãy chuyển cho người dùng qua kênh riêng; lần đăng nhập kế tiếp sẽ buộc đổi mật khẩu.</div>
    {error && <div className="note bad" role="alert">{error}</div>}
    {notice && <div className="note info" role="status"><strong>{notice.text}</strong>{notice.password && <div className="temporary-password"><code>{notice.password}</code><button type="button" className="text-button" onClick={() => navigator.clipboard?.writeText(notice.password)}>Sao chép</button></div>}</div>}

    <section className="card">
      <div className="card-h"><div><h2>Tạo tài khoản</h2><p className="small muted">Tài khoản mới được yêu cầu đổi mật khẩu tạm.</p></div></div>
      <form className="admin-create-form" onSubmit={createUser}>
        <label className="field"><span>Email</span><input type="email" maxLength={254} required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label className="field"><span>Vai trò</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>{Object.values(ROLES).map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label>
        <button className="btn pri" type="submit" disabled={busy === 'create'}>{busy === 'create' ? 'Đang tạo…' : 'Tạo tài khoản'}</button>
      </form>
    </section>

    <section className="card">
      <div className="card-h admin-users-toolbar"><div><h2>Tài khoản</h2><p className="small muted">Tối đa 100 kết quả, sắp xếp theo ngày tạo.</p></div><label className="search admin-user-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo email" aria-label="Tìm người dùng theo email" /></label></div>
      {loading ? <p className="loading-card">Đang tải danh sách…</p> : <div className="tw"><table className="admin-users-table"><thead><tr><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Bảo mật</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead>
        <tbody>{users.map((user) => <tr key={user.id}>
          <td>{user.email}</td>
          <td><select aria-label={`Vai trò ${user.email}`} value={user.role} disabled={busy === user.id} onChange={(event) => runAction(user.id, () => api.admin.users.update(user.id, { role: event.target.value }), 'Đã cập nhật vai trò; các phiên cũ đã bị thu hồi.')}>{Object.values(ROLES).map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></td>
          <td><span className={`chip ${user.is_active ? 'up' : 'down'}`}>{user.is_active ? 'Hoạt động' : 'Đã khóa'}</span></td>
          <td>{user.must_change_password ? <span className="chip warn">Cần đổi mật khẩu</span> : user.locked_until && new Date(user.locked_until) > new Date() ? <span className="chip down">Đang khóa đăng nhập</span> : <span className="small muted">Bình thường</span>}</td>
          <td className="small">{dateTime.format(new Date(user.created_at))}</td>
          <td><div className="admin-row-actions">
            <button className="btn sm" type="button" disabled={busy === user.id} onClick={() => runAction(user.id, () => api.admin.users.update(user.id, { is_active: !user.is_active }), user.is_active ? 'Đã khóa tài khoản và thu hồi phiên.' : 'Đã mở khóa tài khoản.')}>{user.is_active ? 'Khóa' : 'Mở khóa'}</button>
            <button className="btn sm" type="button" disabled={busy === user.id} onClick={() => { if (window.confirm(`Đặt lại mật khẩu cho ${user.email}?`)) runAction(user.id, () => api.admin.users.resetPassword(user.id), 'Đã đặt lại mật khẩu và thu hồi các phiên.'); }}>Đặt lại mật khẩu</button>
            <button className="btn sm" type="button" disabled={busy === user.id || !user.is_active} onClick={() => { if (window.confirm(`Thu hồi tất cả phiên của ${user.email}?`)) runAction(user.id, () => api.admin.users.revokeSessions(user.id), 'Đã thu hồi các phiên đang hoạt động.'); }}>Thu hồi phiên</button>
          </div></td>
        </tr>)}{!users.length && <tr><td colSpan="6" className="empty-row">Không tìm thấy tài khoản.</td></tr>}</tbody></table></div>}
    </section>

    <section className="card">
      <div className="card-h"><div><h2>Audit gần đây</h2><p className="small muted">Lịch sử thao tác quản trị; không lưu mật khẩu hoặc session token.</p></div></div>
      <label className="field small"><span>Lọc theo sự kiện</span><select value={auditEventType} onChange={(event) => setAuditEventType(event.target.value)}><option value="">Tất cả sự kiện</option><option value="user.created">Tạo tài khoản</option><option value="user.updated">Cập nhật tài khoản</option><option value="user.password_reset">Đặt lại mật khẩu</option><option value="user.sessions_revoked">Thu hồi phiên</option><option value="user.role_request_approved">Duyệt quyền Analyst</option><option value="user.role_request_rejected">Từ chối quyền Analyst</option><option value="user.self_upgrade">Tự nâng cấp Trader</option><option value="user.self_downgrade">Tự hạ cấp</option><option value="user.self_deleted">Tự xóa tài khoản</option><option value="job.enqueued">Chạy tác vụ dữ liệu</option></select></label>
      <form className="audit-filter-form" onSubmit={(event) => { event.preventDefault(); setAppliedAuditFilters(auditFilters); }}>
        <label className="field small"><span>Từ ngày</span><input type="date" value={auditFilters.from} onChange={(event) => setAuditFilters({ ...auditFilters, from: event.target.value })} /></label>
        <label className="field small"><span>Đến ngày</span><input type="date" value={auditFilters.to} onChange={(event) => setAuditFilters({ ...auditFilters, to: event.target.value })} /></label>
        <label className="field small"><span>Người thực hiện (email)</span><input maxLength="254" value={auditFilters.actor} onChange={(event) => setAuditFilters({ ...auditFilters, actor: event.target.value })} /></label>
        <label className="field small"><span>Tài khoản bị tác động (email)</span><input maxLength="254" value={auditFilters.target} onChange={(event) => setAuditFilters({ ...auditFilters, target: event.target.value })} /></label>
        <div className="watchlist-actions"><button className="btn sm pri" type="submit">Lọc audit</button><button className="btn sm" type="button" onClick={() => { const empty = { from: '', to: '', actor: '', target: '' }; setAuditFilters(empty); setAppliedAuditFilters(empty); }}>Bỏ lọc</button></div>
      </form>
      {!audit.length ? <p className="small muted">Chưa có sự kiện.</p> : <div className="audit-list">{audit.map((item) => <article className="audit-row" key={item.id}><div><b>{auditLabel(item.event_type)}</b><span className="small muted">{item.event_type === 'job.enqueued' ? `Tác vụ ${item.details?.job_key ?? ''}` : item.target_email || 'Tài khoản đã xóa'} · bởi {item.actor_email || 'người dùng đã xóa'}</span></div><time className="small muted">{dateTime.format(new Date(item.created_at))}</time></article>)}</div>}
      {auditNextCursor && <button className="btn sm" type="button" disabled={auditLoadingMore} onClick={loadMoreAudit}>{auditLoadingMore ? 'Đang tải...' : 'Tải thêm sự kiện audit'}</button>}
    </section>
  </section>;
}

function auditLabel(event) {
  return ({ 'user.created': 'Tạo tài khoản', 'user.updated': 'Cập nhật tài khoản', 'user.password_reset': 'Đặt lại mật khẩu', 'user.sessions_revoked': 'Thu hồi phiên',
    'user.role_request_approved': 'Duyệt quyền Analyst', 'user.role_request_rejected': 'Từ chối quyền Analyst', 'user.self_upgrade': 'Tự nâng cấp Trader',
    'user.self_downgrade': 'Tự hạ cấp', 'user.self_deleted': 'Tự xóa tài khoản', 'job.enqueued': 'Chạy tác vụ dữ liệu' })[event] || event;
}
