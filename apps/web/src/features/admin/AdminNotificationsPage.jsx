import { useEffect, useState } from 'react';
import { api } from '../../api/index.js';

const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });
const statusClass = { pending: 'info', processing: 'hold', sent: 'up', skipped: 'neutral', failed: 'down' };
const statusLabels = { pending: 'Đang chờ', processing: 'Đang xử lý', sent: 'Đã gửi', skipped: 'Đã bỏ qua', failed: 'Thất bại' };
const channelLabels = { email: 'Email', telegram: 'Telegram' };

export function AdminNotificationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const result = await api.admin.notifications();
        if (active) { setItems(result.items); setError(''); }
      } catch (requestError) {
        if (active) setError(requestError.message || 'Không tải được lịch sử gửi thông báo.');
      } finally { if (active) setLoading(false); }
    }
    refresh();
    const timer = window.setInterval(refresh, 10_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  return <section className="content admin-users-page">
    <header className="pagehead"><div><span className="eyebrow">QUẢN TRỊ | GỬI THÔNG BÁO</span><h1>Nhật ký gửi thông báo</h1>
      <p>Trạng thái gửi và dữ liệu thử lại gần đây. Người nhận và nội dung cảnh báo không bao giờ được hiển thị.</p></div>
      <span className="chip info">ẨN DỮ LIỆU RIÊNG TƯ</span></header>
    {error && <div className="note bad" role="alert">{error}</div>}
    <section className="card">
      <div className="card-h"><div><h2>Lượt gửi gần đây</h2><p className="small muted">50 lượt gửi email và Telegram gần nhất.</p></div></div>
      {loading ? <p className="loading-card">Đang tải lịch sử thông báo...</p> : <div className="tw"><table><thead><tr>
        <th>Kênh</th><th>Trạng thái</th><th>Thời điểm xếp hàng</th><th>Số lần thử</th><th>Lần thử kế tiếp</th><th>Đã gửi</th><th>Mã lỗi</th>
      </tr></thead><tbody>{items.map((item) => <tr key={item.id}>
        <td>{channelLabels[item.channel] ?? item.channel}</td><td><span className={`chip ${statusClass[item.status] ?? 'neutral'}`}>{statusLabels[item.status] ?? item.status}</span></td>
        <td>{dateTime.format(new Date(item.created_at))}</td><td>{item.attempt_count}</td>
        <td>{item.status === 'pending' ? dateTime.format(new Date(item.next_attempt_at)) : '-'}</td>
        <td>{item.sent_at ? dateTime.format(new Date(item.sent_at)) : '-'}</td><td>{item.last_error_code ?? '-'}</td>
      </tr>)}{!items.length && <tr><td colSpan="7" className="empty-row">Chưa có dữ liệu gửi thông báo.</td></tr>}
      </tbody></table></div>}
    </section>
  </section>;
}
