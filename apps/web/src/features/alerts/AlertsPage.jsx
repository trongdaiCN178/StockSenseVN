import { useEffect, useState } from 'react';
import { api } from '../../api/index.js';
import { navigate } from '../../app/navigation.js';

const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });
const TYPE_LABELS = {
  price_crossed_above: 'Giá vượt ngưỡng', price_crossed_below: 'Giá giảm dưới ngưỡng',
  plan_entry_reached: 'Trade Plan · vùng vào', plan_stop_hit: 'Trade Plan · cắt lỗ', plan_target_hit: 'Trade Plan · mục tiêu',
  plan_expired: 'Trade Plan · hết hạn', job_failed: 'Pipeline lỗi',
};

// Tells the bell in the app header to refresh its unread counter.
export function notifyAlertsChanged() { window.dispatchEvent(new Event('stocksense:alerts-changed')); }

export function AlertInbox() {
  const [alerts, setAlerts] = useState([]);
  const [retentionDays, setRetentionDays] = useState(90);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    const result = await api.alerts.list();
    setAlerts(result.items); setRetentionDays(result.retention_days ?? 90);
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message || 'Không tải được cảnh báo.')).finally(() => setLoading(false));
  }, []);

  async function perform(action) {
    setBusy(true); setError('');
    try { await action(); await refresh(); notifyAlertsChanged(); }
    catch (e) { setError(e.message || 'Thao tác không thành công.'); }
    finally { setBusy(false); }
  }

  const unread = alerts.filter((alert) => !alert.read_at).length;
  const shown = filter === 'unread' ? alerts.filter((alert) => !alert.read_at) : alerts;
  return <section className="card">
    <div className="card-h"><div><h2>Lịch sử cảnh báo</h2><p className="small muted">Lưu {retentionDays} ngày gần nhất · {unread} chưa đọc.</p></div>
      <div className="watchlist-actions">
        <div className="seg" role="group" aria-label="Lọc cảnh báo"><button type="button" className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>Tất cả</button><button type="button" className={filter === 'unread' ? 'on' : ''} onClick={() => setFilter('unread')}>Chưa đọc</button></div>
        <button className="btn sm" type="button" disabled={busy || !unread} onClick={() => perform(() => api.alerts.markAllRead())}>Đánh dấu tất cả đã đọc</button>
      </div></div>
    {error && <div className="note bad" role="alert">{error}</div>}
    {loading ? <p className="empty-row">Đang tải cảnh báo…</p> : <div className="alert-inbox">{shown.map((alert) => <article className={`alert-inbox-row ${alert.read_at ? 'read' : ''}`} key={alert.id}>
      <div><span className="chip neutral">{TYPE_LABELS[alert.alert_type] ?? alert.alert_type}</span> <b>{alert.title}</b><p>{alert.message}</p>
        <small className="muted">{alert.symbol ? `${alert.symbol} · ` : ''}{dateTime.format(new Date(alert.created_at))}</small></div>
      <div className="watchlist-actions">
        {alert.plan_id && <button className="btn sm" type="button" onClick={() => navigate('/plans')}>Xem kế hoạch</button>}
        {alert.alert_type === 'job_failed' && <button className="btn sm" type="button" onClick={() => navigate('/admin/ops-events')}>Xem sự kiện</button>}
        {!alert.read_at && <button className="btn sm" type="button" disabled={busy} onClick={() => perform(() => api.alerts.markRead(alert.id))}>Đã đọc</button>}
      </div>
    </article>)}{!shown.length && <p className="empty-row">Không có cảnh báo nào.</p>}</div>}
  </section>;
}

export function AlertsPage() {
  return <section className="content watchlist-page">
    <header className="pagehead"><div><span className="eyebrow">THÔNG BÁO CỦA BẠN</span><h1>Cảnh báo</h1><p>Cảnh báo giá, cảnh báo Trade Plan và thông báo hệ thống của tài khoản hiện tại.</p></div></header>
    <AlertInbox />
  </section>;
}
