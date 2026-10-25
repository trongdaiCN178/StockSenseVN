import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { api } from '../../api/index.js';

const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });

const EXPERIENCE_LABELS = { under_1y: 'Dưới 1 năm', '1_3y': '1-3 năm', over_3y: 'Trên 3 năm' };
const PURPOSE_LABELS = { personal: 'Cá nhân', brokerage: 'Môi giới', portfolio_management: 'Quản lý danh mục' };
const REQUEST_STATUS_LABELS = { pending_review: 'Đang chờ Admin duyệt', approved: 'Đã duyệt', rejected: 'Đã từ chối' };
const CONSENT_LABELS = { terms_of_service: 'Điều khoản sử dụng', privacy_notice: 'Thông báo xử lý dữ liệu cá nhân', trader_terms: 'Điều khoản sử dụng chuyên nghiệp (Trader)' };

function endSession() {
  window.dispatchEvent(new Event('stocksense:unauthorized'));
}

export function AccountPage() {
  const { user } = useAuth();
  const [roleRequests, setRoleRequests] = useState([]);
  const [consents, setConsents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');

  const [upgradeForm, setUpgradeForm] = useState({ experience: '1_3y', purpose: 'personal', acknowledged: false });
  const [analystForm, setAnalystForm] = useState({ organization: '', position: '', work_email: '', purpose: '', acknowledged: false });
  const [deletePassword, setDeletePassword] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const refresh = useCallback(async () => {
    const [requestsResult, consentsResult] = await Promise.allSettled([api.account.myRoleRequests(), api.account.consents()]);
    setRoleRequests(requestsResult.status === 'fulfilled' ? requestsResult.value.items : []);
    setConsents(consentsResult.status === 'fulfilled' ? consentsResult.value.items : []);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    refresh().catch((requestError) => { if (active) setError(requestError.message || 'Không tải được dữ liệu tài khoản.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  const hasPendingRequest = roleRequests.some((item) => item.status === 'pending_review');

  async function upgradeToTrader(event) {
    event.preventDefault();
    if (!upgradeForm.acknowledged) { setError('Vui lòng xác nhận trách nhiệm trước khi nâng cấp.'); return; }
    setBusy('upgrade'); setError(''); setNotice('');
    try {
      await api.account.upgradeToTrader(upgradeForm);
      setNotice('Đã nâng cấp lên Trader. Bạn sẽ cần đăng nhập lại để tiếp tục.');
      window.setTimeout(endSession, 2000);
    } catch (requestError) {
      setError(requestError.message || 'Không thể nâng cấp.');
    } finally { setBusy(''); }
  }

  async function downgradeToRetail() {
    if (!window.confirm('Hạ cấp về Nhà đầu tư cá nhân? Các công cụ Trader sẽ bị ẩn, dữ liệu đã nhập vẫn được giữ.')) return;
    setBusy('downgrade'); setError(''); setNotice('');
    try {
      await api.account.downgradeToRetail();
      setNotice('Đã hạ cấp về Nhà đầu tư cá nhân. Bạn sẽ cần đăng nhập lại để tiếp tục.');
      window.setTimeout(endSession, 2000);
    } catch (requestError) {
      setError(requestError.message || 'Không thể hạ cấp.');
    } finally { setBusy(''); }
  }

  async function submitAnalystRequest(event) {
    event.preventDefault();
    if (!analystForm.acknowledged) { setError('Vui lòng đồng ý Điều khoản dành cho Analyst trước khi gửi yêu cầu.'); return; }
    setBusy('analyst'); setError(''); setNotice('');
    try {
      await api.account.requestAnalyst(analystForm);
      setNotice('Đã gửi yêu cầu quyền Analyst. Admin sẽ xem xét và phản hồi.');
      setAnalystForm({ organization: '', position: '', work_email: '', purpose: '', acknowledged: false });
      await refresh();
    } catch (requestError) {
      setError(requestError.message || 'Không thể gửi yêu cầu.');
    } finally { setBusy(''); }
  }

  async function deleteAccount(event) {
    event.preventDefault();
    setBusy('delete'); setError('');
    try {
      await api.account.deleteAccount(deletePassword);
      endSession();
    } catch (requestError) {
      setError(requestError.message || 'Không thể xóa tài khoản.');
      setBusy('');
    }
  }

  if (loading) return <section className="content"><p className="loading-card">Đang tải…</p></section>;

  return <section className="content account-page">
    <header className="pagehead"><div><span className="eyebrow">TÀI KHOẢN</span><h1>Nâng cấp quyền & quản lý tài khoản</h1><p>Vai trò hiện tại: <strong>{user.role}</strong></p></div></header>
    {error && <div className="note bad" role="alert">{error}</div>}
    {notice && <div className="note info" role="status">{notice}</div>}

    {user.role === 'retail' && <section className="card">
      <div className="card-h"><div><h2>Nâng cấp lên Trader</h2><p className="small muted">Mở thêm: tính khối lượng theo vốn/rủi ro, import CSV, tổng quan danh mục, lưu bộ lọc, Journal thủ công.</p></div></div>
      <form onSubmit={upgradeToTrader}>
        <label className="field"><span>Kinh nghiệm giao dịch</span>
          <select value={upgradeForm.experience} onChange={(event) => setUpgradeForm({ ...upgradeForm, experience: event.target.value })}>
            {Object.entries(EXPERIENCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="field"><span>Mục đích sử dụng</span>
          <select value={upgradeForm.purpose} onChange={(event) => setUpgradeForm({ ...upgradeForm, purpose: event.target.value })}>
            {Object.entries(PURPOSE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <input type="checkbox" checked={upgradeForm.acknowledged} onChange={(event) => setUpgradeForm({ ...upgradeForm, acknowledged: event.target.checked })} />
          <span>Tôi hiểu dự báo chỉ để tham khảo và tôi tự chịu trách nhiệm quyết định đầu tư. Nếu dùng cho mục đích môi giới hoặc quản lý danh mục, tôi không dùng dự báo như khuyến nghị mua/bán gửi khách hàng.</span>
        </label>
        <button className="btn pri" type="submit" disabled={busy === 'upgrade'}>{busy === 'upgrade' ? 'Đang xử lý…' : 'Nâng cấp lên Trader'}</button>
      </form>
    </section>}

    {user.role === 'trader' && <section className="card">
      <div className="card-h"><div><h2>Hạ cấp về Nhà đầu tư cá nhân</h2><p className="small muted">Dữ liệu đã nhập được giữ lại; các công cụ Trader sẽ bị ẩn.</p></div></div>
      <button className="btn" type="button" disabled={busy === 'downgrade'} onClick={downgradeToRetail}>{busy === 'downgrade' ? 'Đang xử lý…' : 'Hạ cấp về Nhà đầu tư cá nhân'}</button>
    </section>}

    {['retail', 'trader'].includes(user.role) && <section className="card">
      <div className="card-h"><div><h2>Yêu cầu quyền Analyst</h2><p className="small muted">Cần Admin duyệt. Mục tiêu xử lý trong 3 ngày làm việc.</p></div></div>
      {hasPendingRequest
        ? <div className="note info">Bạn đang có một yêu cầu đang chờ xử lý.</div>
        : <form onSubmit={submitAnalystRequest}>
          <label className="field"><span>Tổ chức</span><input type="text" maxLength="200" required value={analystForm.organization} onChange={(event) => setAnalystForm({ ...analystForm, organization: event.target.value })} /></label>
          <label className="field"><span>Chức danh</span><input type="text" maxLength="200" required value={analystForm.position} onChange={(event) => setAnalystForm({ ...analystForm, position: event.target.value })} /></label>
          <label className="field"><span>Email cơ quan</span><input type="email" maxLength="254" required value={analystForm.work_email} onChange={(event) => setAnalystForm({ ...analystForm, work_email: event.target.value })} /></label>
          <label className="field"><span>Mục đích sử dụng</span><textarea maxLength="1000" required value={analystForm.purpose} onChange={(event) => setAnalystForm({ ...analystForm, purpose: event.target.value })} /></label>
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <input type="checkbox" checked={analystForm.acknowledged} onChange={(event) => setAnalystForm({ ...analystForm, acknowledged: event.target.checked })} />
            <span>Tôi đồng ý Điều khoản dành cho Analyst: không phát tán dữ liệu truy vết, không dùng dữ liệu tin tức ngoài mục đích nghiên cứu.</span>
          </label>
          <button className="btn pri" type="submit" disabled={busy === 'analyst'}>{busy === 'analyst' ? 'Đang gửi…' : 'Gửi yêu cầu'}</button>
        </form>}
      {!!roleRequests.length && <div className="tw"><table className="admin-users-table"><thead><tr><th>Trạng thái</th><th>Tổ chức</th><th>Ngày gửi</th><th>Ghi chú</th></tr></thead>
        <tbody>{roleRequests.map((item) => <tr key={item.id}>
          <td><span className={`chip ${item.status === 'approved' ? 'up' : item.status === 'rejected' ? 'down' : 'warn'}`}>{REQUEST_STATUS_LABELS[item.status]}</span></td>
          <td>{item.organization}</td>
          <td className="small">{dateTime.format(new Date(item.created_at))}</td>
          <td className="small muted">{item.note || '—'}</td>
        </tr>)}</tbody></table></div>}
    </section>}

    <section className="card">
      <div className="card-h"><div><h2>Đồng ý đã lưu</h2><p className="small muted">Lịch sử đồng ý điều khoản và chính sách dữ liệu cá nhân.</p></div></div>
      {!consents.length ? <p className="small muted">Chưa có bản ghi đồng ý.</p> : <ul>{consents.map((item, index) => (
        <li key={index} className="small">{CONSENT_LABELS[item.doc_type] || item.doc_type} · phiên bản {item.version} · {dateTime.format(new Date(item.accepted_at))}</li>
      ))}</ul>}
    </section>

    {user.role !== 'admin' && <section className="card danger-zone">
      <div className="card-h"><div><h2>Xóa tài khoản</h2><p className="small muted">Xóa toàn bộ watchlist, danh mục, kế hoạch giao dịch, nhật ký, phiên chat và kênh thông báo. Không thể hoàn tác.</p></div></div>
      {!confirmingDelete
        ? <button className="btn bad" type="button" onClick={() => setConfirmingDelete(true)}>Xóa tài khoản của tôi</button>
        : <form onSubmit={deleteAccount}>
          <label className="field"><span>Nhập mật khẩu để xác nhận</span><input type="password" autoComplete="current-password" required value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} /></label>
          <div className="admin-row-actions">
            <button className="btn bad" type="submit" disabled={busy === 'delete'}>{busy === 'delete' ? 'Đang xóa…' : 'Xác nhận xóa vĩnh viễn'}</button>
            <button className="btn" type="button" onClick={() => { setConfirmingDelete(false); setDeletePassword(''); }}>Hủy</button>
          </div>
        </form>}
    </section>}
  </section>;
}
