import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/index.js';

const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });
const STATUS_LABELS = { pending_review: 'Đang chờ', approved: 'Đã duyệt', rejected: 'Đã từ chối' };

export function AdminRoleRequestsPage() {
  const [status, setStatus] = useState('pending_review');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [rejectNotes, setRejectNotes] = useState({});

  const refresh = useCallback(async () => {
    const result = await api.admin.roleRequests.list(status);
    setItems(result.items);
  }, [status]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    refresh().catch((requestError) => { if (active) setError(requestError.message || 'Không tải được danh sách yêu cầu.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  async function approve(id) {
    if (!window.confirm('Duyệt yêu cầu này? Vai trò của người dùng sẽ đổi thành Analyst và các phiên đăng nhập hiện tại sẽ bị thu hồi.')) return;
    setBusy(id); setError(''); setNotice('');
    try {
      await api.admin.roleRequests.approve(id);
      setNotice('Đã duyệt yêu cầu.');
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Không thể duyệt yêu cầu.');
    } finally { setBusy(''); }
  }

  async function reject(id) {
    const note = rejectNotes[id]?.trim();
    if (!note) { setError('Cần nêu lý do khi từ chối yêu cầu.'); return; }
    setBusy(id); setError(''); setNotice('');
    try {
      await api.admin.roleRequests.reject(id, note);
      setNotice('Đã từ chối yêu cầu.');
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Không thể từ chối yêu cầu.');
    } finally { setBusy(''); }
  }

  return <section className="content admin-role-requests-page">
    <header className="pagehead"><div><span className="eyebrow">QUẢN TRỊ · PHÂN QUYỀN</span><h1>Yêu cầu nâng quyền Analyst</h1><p>Đối chiếu tên miền email cơ quan với tổ chức trước khi duyệt.</p></div></header>
    {error && <div className="note bad" role="alert">{error}</div>}
    {notice && <div className="note info" role="status">{notice}</div>}

    <label className="field small"><span>Trạng thái</span>
      <select value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="pending_review">Đang chờ</option>
        <option value="approved">Đã duyệt</option>
        <option value="rejected">Đã từ chối</option>
      </select>
    </label>

    {loading ? <p className="loading-card">Đang tải…</p> : !items.length ? <p className="small muted">Không có yêu cầu nào.</p> : <div className="tw">
      <table className="admin-users-table"><thead><tr><th>Người yêu cầu</th><th>Tổ chức / Chức danh</th><th>Email cơ quan</th><th>Mục đích</th><th>Ngày gửi</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
        <tbody>{items.map((item) => <tr key={item.id}>
          <td>{item.requester_email}<br /><span className="small muted">{item.requester_role}</span></td>
          <td>{item.organization}<br /><span className="small muted">{item.position}</span></td>
          <td>{item.work_email}</td>
          <td className="small">{item.purpose}</td>
          <td className="small">{dateTime.format(new Date(item.created_at))}</td>
          <td><span className={`chip ${item.status === 'approved' ? 'up' : item.status === 'rejected' ? 'down' : 'warn'}`}>{STATUS_LABELS[item.status]}</span>{item.note && <div className="small muted">{item.note}</div>}</td>
          <td>{item.status === 'pending_review' && <div className="admin-row-actions">
            <button className="btn sm" type="button" disabled={busy === item.id} onClick={() => approve(item.id)}>Duyệt</button>
            <input className="small" type="text" placeholder="Lý do từ chối" value={rejectNotes[item.id] ?? ''} onChange={(event) => setRejectNotes({ ...rejectNotes, [item.id]: event.target.value })} />
            <button className="btn sm bad" type="button" disabled={busy === item.id} onClick={() => reject(item.id)}>Từ chối</button>
          </div>}</td>
        </tr>)}</tbody>
      </table>
    </div>}
  </section>;
}
