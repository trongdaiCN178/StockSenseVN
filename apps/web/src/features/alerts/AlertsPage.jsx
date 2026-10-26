import { useEffect, useState } from 'react';
import { api } from '../../api/index.js';
import { navigate } from '../../app/navigation.js';

const dateTime = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
const TYPE_LABELS = {
  price_crossed_above: 'Giá vượt ngưỡng', price_crossed_below: 'Giá giảm dưới ngưỡng',
  plan_entry_reached: 'Trade Plan · vùng vào', plan_stop_hit: 'Trade Plan · cắt lỗ', plan_target_hit: 'Trade Plan · mục tiêu',
  plan_expired: 'Trade Plan · hết hạn', job_failed: 'Pipeline lỗi',
};

// Tells the bell in the app header to refresh its unread counter.
export function notifyAlertsChanged() { window.dispatchEvent(new Event('stocksense:alerts-changed')); }

function targetOf(alert) {
  if (alert.plan_id) return '/plans';
  if (alert.alert_type === 'job_failed') return '/admin/ops-events';
  return alert.symbol ? `/symbols/${alert.symbol}` : null;
}

export function AlertInbox() {
  const [alerts, setAlerts] = useState([]);
  const [retentionDays, setRetentionDays] = useState(90);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function refresh() {
    const result = await api.alerts.list();
    setAlerts(result.items); setRetentionDays(result.retention_days ?? 90);
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message || 'Không tải được cảnh báo.')).finally(() => setLoading(false));
    window.addEventListener('stocksense:alerts-changed', refresh);
    return () => window.removeEventListener('stocksense:alerts-changed', refresh);
  }, []);

  async function readAll() {
    try { await api.alerts.markAllRead(); notifyAlertsChanged(); } catch (e) { setError(e.message || 'Thao tác không thành công.'); }
  }
  async function open(alert) {
    try { if (!alert.read_at) { await api.alerts.markRead(alert.id); notifyAlertsChanged(); } } catch { /* opening still works */ }
    const target = targetOf(alert);
    if (target) navigate(target);
  }

  const unread = alerts.filter((alert) => !alert.read_at).length;
  const shown = onlyUnread ? alerts.filter((alert) => !alert.read_at) : alerts;
  return <section className="card">
    <div className="card-h"><h2>Lịch sử cảnh báo · {retentionDays} ngày</h2>
      <div className="actions"><div className="seg"><button type="button" className={onlyUnread ? '' : 'on'} onClick={() => setOnlyUnread(false)}>Tất cả</button><button type="button" className={onlyUnread ? 'on' : ''} onClick={() => setOnlyUnread(true)}>Chưa đọc ({unread})</button></div>
        <button className="btn sm" type="button" disabled={!unread} onClick={readAll}>Đánh dấu đã đọc</button></div></div>
    {error && <div className="note bad" role="alert">{error}</div>}
    {loading ? <p className="muted">Đang tải cảnh báo…</p> : shown.map((alert) => <div key={alert.id} role="button" tabIndex={0} onClick={() => open(alert)} onKeyDown={(event) => { if (event.key === 'Enter') open(alert); }}
      style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--line)', cursor: 'pointer' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 7, flex: 'none', background: alert.read_at ? 'var(--line)' : 'var(--accent)' }} />
      <div style={{ flex: 1, minWidth: 0 }}><div style={alert.read_at ? undefined : { fontWeight: 600 }}>{alert.title}</div>
        <div className="small muted">{alert.message}</div>
        <div className="small muted num">{dateTime.format(new Date(alert.created_at))} · {TYPE_LABELS[alert.alert_type] ?? alert.alert_type}</div></div>
    </div>)}
    {!loading && !shown.length && <p className="muted">{onlyUnread ? 'Không có cảnh báo chưa đọc.' : 'Chưa có cảnh báo nào.'}</p>}
  </section>;
}

export function AlertsPage() {
  return <main className="content">
    <div className="pagehead"><div><h1>Cảnh báo</h1><p>Cảnh báo giá, cảnh báo Trade Plan và thông báo hệ thống của tài khoản hiện tại.</p></div></div>
    <AlertInbox />
  </main>;
}
