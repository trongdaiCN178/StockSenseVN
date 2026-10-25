import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE_LABELS, hasCapability } from '@stocksense/core/access';
import { navigate } from './navigation.js';

const navItems = [
  { label: 'Tổng quan', capability: 'market.read', icon: '⌂', path: '/overview' },
  { label: 'Watchlist & Cảnh báo', capability: 'watchlist.manage.self', icon: '☆', path: '/watchlist' },
  { label: 'Bộ lọc cổ phiếu', capability: 'screener.read', icon: '⌕', path: '/screener' },
  { label: 'Danh mục đầu tư', capability: 'portfolio.manage.self', icon: '▤', path: '/portfolio' },
  { label: 'Kế hoạch giao dịch', capability: 'plans.manage.self', icon: '◇', path: '/plans' },
  { label: 'Nhật ký giao dịch', capability: 'journal.read.self', icon: '▧', path: '/journal' },
  { label: 'Hồ sơ đầu tư', capability: 'profile.investment.manage.self', icon: '◉', path: '/settings/investment' },
  { label: 'Kênh thông báo', capability: 'notifications.channels.manage.self', icon: '♧', path: '/settings/notifications' },
  { label: 'Tài khoản & vai trò', capability: 'profile.role.manage.self', icon: '◈', path: '/settings/account' },
  { label: 'Đánh giá mô hình', capability: 'models.evaluation.read', icon: '▥' },
  { label: 'Trò chuyện', capability: 'chat.use.self', icon: '◌', path: '/chat' },
  { label: 'Quản trị', capability: 'admin.users.manage', icon: '⚙', path: '/admin/users' },
  { label: 'Yêu cầu nâng quyền', capability: 'admin.role-requests.manage', icon: '✦', path: '/admin/role-requests' },
  { label: 'Tác vụ dữ liệu', capability: 'admin.jobs.read', icon: '↻', path: '/admin/jobs' },
  { label: 'Nhật ký gửi thông báo', capability: 'admin.notifications.read', icon: '↗', path: '/admin/notifications' },
  { label: 'Sự kiện vận hành', capability: 'admin.ops-events.read', icon: '!', path: '/admin/ops-events' },
];

export function AppShell({ children }) {
  const { user, logout } = useAuth();
  const menu = navItems.filter((item) => hasCapability(user.role, item.capability));
  const pathname = window.location.pathname;
  const isMockMode = import.meta.env.VITE_API_MODE !== 'real';

  return (
    <div className="app">
      <aside className="side">
        <a className="brand" href="#overview" aria-label="StockSense VN, trang tổng quan">
          <span className="brand-mark">S</span>
          <span><b>StockSense VN</b><small>Hỗ trợ quyết định đầu tư</small></span>
        </a>
        <nav className="navgrp" aria-label="Điều hướng chính">
          <h3>Không gian làm việc</h3>
          {menu.map((item) => (
            <button className={`nav ${item.path === pathname || (item.path === '/overview' && pathname === '/') ? 'on' : ''}`} type="button" key={item.label}
              disabled={!item.path} onClick={() => item.path && navigate(item.path)} title={item.path ? '' : 'Sẽ được triển khai ở bước tiếp theo'}>
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              {!item.path && <span className="tag">Sắp có</span>}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <span>{ROLE_LABELS[user.role]}</span>
          {isMockMode && <span className="mock-label">Bản demo · dữ liệu mẫu</span>}
          <button className="text-button" type="button" onClick={() => navigate('/settings/password')}>Đổi mật khẩu</button>
          <button className="btn sm" type="button" onClick={logout}>Đăng xuất</button>
        </div>
      </aside>
      <main className="main">
        <header className="top">
          {isMockMode && <div className="datastat"><span className="dot" /><span>Đang xem dữ liệu demo</span></div>}
          <span className="grow" />
          <span className="user-email">{user.email}</span>
          <button className="btn sm top-logout" type="button" onClick={logout}>Đăng xuất</button>
        </header>
        {children}
      </main>
    </div>
  );
}
