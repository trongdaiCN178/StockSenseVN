import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { api } from '../api/index.js';
import { ROLE_LABELS, hasCapability } from '@stocksense/core/access';
import { navigate } from './navigation.js';
import { Icon } from './icons.jsx';

const ADMIN_CAPABILITIES = ['admin.users.manage', 'admin.jobs.read', 'admin.notifications.read', 'admin.ops-events.read', 'admin.role-requests.manage'];
const canAdmin = (role) => ADMIN_CAPABILITIES.some((capability) => hasCapability(role, capability));

// Navigation grouped as in the HTML prototype. `match` lists the routes that keep the item highlighted.
const NAV = [
  { group: 'Thị trường', label: 'Tổng quan', icon: 'home', path: '/overview', match: ['/', '/overview', '/symbols/'], allow: (role) => hasCapability(role, 'symbols.read') },
  { group: 'Thị trường', label: 'Screener', icon: 'filter', path: '/screener', allow: (role) => hasCapability(role, 'screener.read') },
  { group: 'Thị trường', label: 'Watchlist & cảnh báo', icon: 'star', path: '/watchlist', match: ['/watchlist', '/alerts'], allow: (role) => hasCapability(role, 'watchlist.manage.self') },
  { group: 'Của tôi', label: 'Portfolio', icon: 'pie', path: '/portfolio', allow: (role) => hasCapability(role, 'portfolio.manage.self') },
  { group: 'Của tôi', label: 'Trade Plan', icon: 'target', path: '/plans', allow: (role) => hasCapability(role, 'plans.manage.self') },
  { group: 'Của tôi', label: 'Journal', icon: 'book', path: '/journal', allow: (role) => hasCapability(role, 'journal.read.self') },
  { group: 'Hỗ trợ', label: 'Chat hỏi đáp', icon: 'chat', path: '/chat', allow: (role) => hasCapability(role, 'chat.use.self') },
  { group: 'Hỗ trợ', label: 'Đánh giá mô hình', icon: 'gauge', path: null, tag: 'Sắp có', allow: (role) => hasCapability(role, 'models.summary.read') },
  { group: 'Hệ thống', label: 'Quản trị', icon: 'shield', path: '/admin', match: ['/admin'], allow: canAdmin },
  { group: 'Hệ thống', label: 'Cài đặt', icon: 'gear', path: '/settings', match: ['/settings'], allow: () => true },
];

const dateTime = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
const isActive = (item, pathname) => (item.match ?? [item.path]).some((prefix) => prefix === pathname || (prefix.length > 1 && pathname.startsWith(prefix)));
const formatDate = (value) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');

function DataStatus() {
  const [status, setStatus] = useState(null);
  useEffect(() => { api.market.status().then(setStatus).catch(() => {}); }, []);
  if (!status) return <div className="datastat"><span className="dot" /><span>Đang tải trạng thái dữ liệu…</span></div>;
  const batchTime = status.batchCompletedAt ? new Date(status.batchCompletedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) : '—';
  const forecastLabel = status.state === 'demo' ? 'dự báo mẫu' : 'dự báo';
  if (status.latestPriceDate) {
    return <div className="datastat"><span className="dot" /><span>Giá SSI đến <b className="num" style={{ color: 'var(--ink)' }}>{formatDate(status.latestPriceDate)}</b><span className="hide-sm"> · {forecastLabel} ngày {formatDate(status.dataDate)} · mô hình <span className="num">{status.modelVersion}</span></span></span></div>;
  }
  return <div className="datastat"><span className="dot" /><span>Dữ liệu ngày <b className="num" style={{ color: 'var(--ink)' }}>{formatDate(status.dataDate)}</b><span className="hide-sm"> · cập nhật {batchTime} · mô hình <span className="num">{status.modelVersion}</span></span></span></div>;
}

// FR-M5-05: bell with unread counter and a popover of the latest alerts.
function AlertBell() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const ref = useRef(null);
  useEffect(() => {
    let active = true;
    const load = () => api.alerts.unreadCount().then((result) => { if (active) setUnread(result.unread); }).catch(() => {});
    load();
    const timer = window.setInterval(load, 60_000);
    window.addEventListener('stocksense:alerts-changed', load);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('stocksense:alerts-changed', load); };
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    api.alerts.list().then((result) => setItems(result.items.slice(0, 5))).catch(() => setItems([]));
    const close = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const changed = () => window.dispatchEvent(new Event('stocksense:alerts-changed'));
  async function readAll() { await api.alerts.markAllRead().catch(() => {}); setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() }))); changed(); }
  async function openAlert(alert) {
    if (!alert.read_at) await api.alerts.markRead(alert.id).catch(() => {});
    changed(); setOpen(false);
    navigate(alert.plan_id ? '/plans' : alert.alert_type === 'job_failed' ? '/admin/ops-events' : alert.symbol ? `/symbols/${alert.symbol}` : '/alerts');
  }
  return <div style={{ position: 'relative' }} ref={ref}>
    <button className="iconbtn" type="button" onClick={() => setOpen(!open)} aria-label={`Thông báo, ${unread} chưa đọc`} aria-expanded={open}><Icon name="bell" />{unread > 0 && <span className="badge">{unread > 99 ? '99+' : unread}</span>}</button>
    {open && <div className="pop" role="dialog" aria-label="Cảnh báo">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px' }}><b>Cảnh báo</b><button className="btn sm" type="button" disabled={!unread} onClick={readAll}>Đánh dấu đã đọc</button></div>
      {items.map((alert) => <div className={`it ${alert.read_at ? '' : 'unread'}`} key={alert.id} role="button" tabIndex={0} onClick={() => openAlert(alert)} onKeyDown={(event) => { if (event.key === 'Enter') openAlert(alert); }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, flex: 'none', background: alert.read_at ? 'transparent' : 'var(--accent)' }} />
        <div><div>{alert.title}</div><div className="small muted num">{dateTime.format(new Date(alert.created_at))}</div></div>
      </div>)}
      {!items.length && <p className="small muted" style={{ padding: '6px 10px' }}>Chưa có cảnh báo nào.</p>}
      <div style={{ padding: '6px 10px' }}><button className="btn sm" type="button" onClick={() => { setOpen(false); navigate('/alerts'); }}>Xem tất cả và quy tắc</button></div>
    </div>}
  </div>;
}

function SymbolSearch() {
  const [value, setValue] = useState('');
  function submit(event) {
    if (event.key !== 'Enter') return;
    const symbol = value.trim().toUpperCase();
    if (/^[A-Z0-9.-]{1,12}$/.test(symbol)) { navigate(`/symbols/${symbol}`); setValue(''); }
  }
  return <label className="search"><Icon name="search" /><input id="q" value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={submit} placeholder="Tìm mã, ví dụ FPT" autoComplete="off" aria-label="Tìm mã cổ phiếu" /></label>;
}

export function AppShell({ children }) {
  const { user, logout } = useAuth();
  const [more, setMore] = useState(false);
  const pathname = window.location.pathname;
  const items = NAV.filter((item) => item.allow(user.role));
  const groups = [...new Set(items.map((item) => item.group))];
  const admin = !hasCapability(user.role, 'symbols.read');
  const tabs = admin
    ? [['/admin', 'Quản trị', 'shield'], ['/settings', 'Cài đặt', 'gear']]
    : [['/overview', 'Tổng quan', 'home'], ['/watchlist', 'Watchlist', 'star'], ['/portfolio', 'Portfolio', 'pie'], ['/plans', 'Trade Plan', 'target'], [null, 'Thêm', 'more']];
  const go = (path) => { setMore(false); navigate(path); window.scrollTo(0, 0); };

  return <>
    <div className="app">
      <aside className="side">
        <a className="brand" href="/overview" onClick={(event) => { event.preventDefault(); go(admin ? '/admin' : '/overview'); }} aria-label="StockSense VN, trang chính">
          <div className="brand-mark">SS</div><div><b>StockSense VN</b><small>IDSS · dự báo T+2 / T+5</small></div>
        </a>
        {groups.map((group) => <div className="navgrp" key={group}><h3>{group}</h3>
          {items.filter((item) => item.group === group).map((item) => <button key={item.label} type="button" className={`nav ${item.path && isActive(item, pathname) ? 'on' : ''}`}
            disabled={!item.path} title={item.path ? '' : 'Cần mô hình AI, sẽ triển khai ở giai đoạn sau'} onClick={() => item.path && go(item.path)}>
            <Icon name={item.icon} /><span>{item.label}</span>{item.tag && <span className="tag">{item.tag}</span>}
          </button>)}
        </div>)}
        <div className="side-foot">
          <div><b style={{ color: 'var(--ink)' }}>{user.full_name || user.email}</b><br />{ROLE_LABELS[user.role]}</div>
          <button className="btn sm" type="button" onClick={logout}>Đăng xuất</button>
        </div>
      </aside>
      <div className="main">
        <header className="top">
          <DataStatus />
          <div className="grow" />
          {hasCapability(user.role, 'symbols.read') && <SymbolSearch />}
          {hasCapability(user.role, 'alerts.inbox.read.self') && <AlertBell />}
        </header>
        {children}
      </div>
    </div>
    <div className={`more-sheet ${more ? 'open' : ''}`}>
      {items.filter((item) => item.path && !['/overview', '/watchlist', '/portfolio', '/plans'].includes(item.path)).map((item) => <button key={item.label} className="nav" type="button" onClick={() => go(item.path)}><Icon name={item.icon} /><span>{item.label}</span></button>)}
      <button className="nav" type="button" onClick={logout}>Đăng xuất</button>
    </div>
    <nav className="bottombar" style={admin ? { gridTemplateColumns: '1fr 1fr' } : undefined} aria-label="Điều hướng nhanh">
      {tabs.map(([path, label, icon]) => <button key={label} type="button" className={path && (pathname === path || pathname.startsWith(`${path}/`)) ? 'on' : ''} onClick={() => (path ? go(path) : setMore(!more))}><Icon name={icon} /><span>{label}</span></button>)}
    </nav>
  </>;
}
