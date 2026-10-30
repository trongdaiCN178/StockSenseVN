import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuth } from './auth/AuthContext.jsx';
import { LoginPage } from './features/auth/LoginPage.jsx';
import { OverviewPage } from './features/market-overview/OverviewPage.jsx';
import { AppShell } from './app/AppShell.jsx';
import { RequireCapability } from './app/RequireCapability.jsx';
import { navigate } from './app/navigation.js';
// The candlestick chart library is only loaded when a symbol page is opened.
const SymbolDetailPage = lazy(() => import('./features/symbol-detail/SymbolDetailPage.jsx').then((module) => ({ default: module.SymbolDetailPage })));
import { PriceBoardPage } from './features/price-board/PriceBoardPage.jsx';
import { ChangePasswordPage } from './features/auth/ChangePasswordPage.jsx';
import { AdminUsersPage } from './features/admin/AdminUsersPage.jsx';
import { AdminJobsPage } from './features/admin/AdminJobsPage.jsx';
import { AdminNotificationsPage } from './features/admin/AdminNotificationsPage.jsx';
import { AdminOpsEventsPage } from './features/admin/AdminOpsEventsPage.jsx';
import { WatchlistPage } from './features/watchlist/WatchlistPage.jsx';
import { ScreenerPage } from './features/screener/ScreenerPage.jsx';
import { PortfolioPage } from './features/portfolio/PortfolioPage.jsx';
import { PlansPage } from './features/plans/PlansPage.jsx';
import { JournalPage } from './features/journal/JournalPage.jsx';
import { InvestmentProfilePage } from './features/settings/InvestmentProfilePage.jsx';
import { ChatPage } from './features/chat/ChatPage.jsx';
import { NotificationSettingsPage } from './features/settings/NotificationSettingsPage.jsx';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage.jsx';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage.jsx';
import { RegisterPage } from './features/auth/RegisterPage.jsx';
import { VerifyEmailPage } from './features/auth/VerifyEmailPage.jsx';
import { AccountPage } from './features/settings/AccountPage.jsx';
import { AdminRoleRequestsPage } from './features/admin/AdminRoleRequestsPage.jsx';
import { AlertsPage } from './features/alerts/AlertsPage.jsx';
import { TabbedHub } from './app/TabbedHub.jsx';

const SETTINGS_TABS = [
  { path: '/settings/notifications', label: 'Kênh thông báo', capability: 'notifications.channels.manage.self', component: NotificationSettingsPage },
  { path: '/settings/investment', label: 'Hồ sơ đầu tư', capability: 'profile.investment.manage.self', component: InvestmentProfilePage },
  { path: '/settings/account', label: 'Tài khoản & vai trò', capability: 'account.manage.self', component: AccountPage },
  { path: '/settings/password', label: 'Đổi mật khẩu', capability: null, component: ChangePasswordPage },
];
const ADMIN_TABS = [
  { path: '/admin/users', label: 'Người dùng & audit', capability: 'admin.users.manage', component: AdminUsersPage },
  { path: '/admin/role-requests', label: 'Yêu cầu nâng quyền', capability: 'admin.role-requests.manage', component: AdminRoleRequestsPage },
  { path: '/admin/jobs', label: 'Nguồn dữ liệu & job', capability: 'admin.jobs.read', component: AdminJobsPage },
  { path: '/admin/notifications', label: 'Nhật ký thông báo', capability: 'admin.notifications.read', component: AdminNotificationsPage },
  { path: '/admin/ops-events', label: 'Sự kiện vận hành', capability: 'admin.ops-events.read', component: AdminOpsEventsPage },
];

function usePathname() {
  const [pathname, setPathname] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  return pathname;
}

export function App() {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (user && !user.must_change_password && ['/login', '/forgot-password', '/register'].includes(pathname)) navigate(user.role === 'admin' ? '/admin' : '/overview');
  }, [user, pathname]);

  if (loading) {
    return <main className="startup-state" aria-live="polite">Đang tải StockSense VN…</main>;
  }

  // Links from emails must work even when this browser is already signed in to another account;
  // otherwise the token would be dropped by the redirect above.
  if (pathname === '/verify-email') return <VerifyEmailPage />;
  if (pathname === '/reset-password') return <ResetPasswordPage />;

  if (!user) {
    if (pathname === '/forgot-password') return <ForgotPasswordPage />;
    if (pathname === '/reset-password') return <ResetPasswordPage />;
    if (pathname === '/register') return <RegisterPage />;
    if (pathname === '/verify-email') return <VerifyEmailPage />;
    return <LoginPage />;
  }

  if (user.must_change_password) return <ChangePasswordPage mandatory />;
  if (['/forgot-password', '/reset-password', '/register', '/verify-email', '/login'].includes(pathname)) {
    return <main className="startup-state" aria-live="polite">Đang chuyển tới trang chính…</main>;
  }

  const symbolMatch = pathname.match(/^\/symbols\/([A-Za-z0-9.-]+)\/?$/);
  const isOverview = pathname === '/' || pathname === '/overview';
  const routes = {
    '/board': ['symbols.read', PriceBoardPage],
    '/watchlist': ['watchlist.manage.self', WatchlistPage],
    '/alerts': ['alerts.inbox.read.self', AlertsPage],
    '/screener': ['screener.read', ScreenerPage],
    '/portfolio': ['portfolio.manage.self', PortfolioPage],
    '/plans': ['plans.manage.self', PlansPage],
    '/journal': ['journal.read.self', JournalPage],
    '/chat': ['chat.use.self', ChatPage],
  };
  const route = routes[pathname];
  const Page = route?.[1];

  return (
    <AppShell>
      {symbolMatch ? (
        <RequireCapability capability="symbols.read"><Suspense fallback={<main className="content"><div className="card muted">Đang tải…</div></main>}><SymbolDetailPage symbol={decodeURIComponent(symbolMatch[1]).toUpperCase()} /></Suspense></RequireCapability>
      ) : pathname === '/settings' || pathname.startsWith('/settings/') ? (
        <TabbedHub title="Cài đặt" description="Kênh nhận cảnh báo, hồ sơ đầu tư và tài khoản của bạn." tabs={SETTINGS_TABS} pathname={pathname} />
      ) : pathname === '/admin' || pathname.startsWith('/admin/') ? (
        <TabbedHub title="Quản trị" description="Người dùng, nguồn dữ liệu, thông báo và nhật ký vận hành." tabs={ADMIN_TABS} pathname={pathname} />
      ) : route ? (
        <RequireCapability capability={route[0]}><Page /></RequireCapability>
      ) : isOverview ? (
        <RequireCapability capability="market.read"><OverviewPage /></RequireCapability>
      ) : <section className="content"><div className="empty403"><div className="code">404</div><h2>Không tìm thấy trang</h2><button className="btn pri" type="button" onClick={() => navigate('/overview')}>Về trang chính</button></div></section>}
    </AppShell>
  );
}
