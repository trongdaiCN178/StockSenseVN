import { useEffect, useState } from 'react';
import { api } from '../../api/index.js';

const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });
const severityClass = { error: 'down', warning: 'hold' };
const severityLabels = { error: 'Lỗi', warning: 'Cảnh báo' };

export function AdminOpsEventsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const result = await api.admin.opsEvents();
        if (active) { setItems(result.items); setError(''); }
      } catch (requestError) {
        if (active) setError(requestError.message || 'Không tải được danh sách sự kiện vận hành.');
      } finally { if (active) setLoading(false); }
    }
    refresh();
    const timer = window.setInterval(refresh, 15_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  return <section className="content admin-users-page">
    <header className="pagehead"><div><span className="eyebrow">QUẢN TRỊ | VẬN HÀNH</span><h1>Sự kiện vận hành</h1>
      <p>Các lượt chạy pipeline, worker và thông báo gần đây bị lỗi hoặc một phần.</p></div>
      <span className="chip info">KHÔNG CHỨA DỮ LIỆU CÁ NHÂN</span></header>
    <div className="note info">Sự kiện được suy ra từ các lượt nạp dữ liệu, tác vụ worker đã hoàn tất và các lỗi thông báo cuối cùng. Thông báo lỗi thô và dữ liệu thuộc về người dùng đều bị loại trừ.</div>
    {error && <div className="note bad" role="alert">{error}</div>}
    <section className="card">
      <div className="card-h"><div><h2>Sự kiện gần đây</h2><p className="small muted">50 sự kiện gần nhất; cảnh báo cho lượt chạy một phần, lỗi cho lượt chạy thất bại.</p></div></div>
      {loading ? <p className="loading-card">Đang tải sự kiện vận hành...</p> : <div className="tw"><table><thead><tr>
        <th>Thời gian</th><th>Mức độ</th><th>Sự kiện</th><th>Nguồn</th><th>Mã lỗi</th><th>Bối cảnh</th>
      </tr></thead><tbody>{items.map((item) => <tr key={item.event_id}>
        <td>{dateTime.format(new Date(item.occurred_at))}</td>
        <td><span className={`chip ${severityClass[item.severity] ?? 'neutral'}`}>{severityLabels[item.severity] ?? item.severity}</span></td>
        <td>{item.event_type}</td><td>{item.source}</td><td>{item.error_code}</td>
        <td className="small">{Object.entries(item.context ?? {}).map(([key, value]) => `${key}: ${value}`).join(' | ')}</td>
      </tr>)}{!items.length && <tr><td colSpan="6" className="empty-row">Chưa có sự kiện vận hành nào.</td></tr>}
      </tbody></table></div>}
    </section>
  </section>;
}
