import { useEffect, useState } from 'react';
import { useAuth } from './auth/AuthContext.jsx';
import { LoginPage } from './features/auth/LoginPage.jsx';
import { OverviewPage } from './features/market-overview/OverviewPage.jsx';
import { AppShell } from './app/AppShell.jsx';
import { RequireCapability } from './app/RequireCapability.jsx';
import { navigate } from './app/navigation.js';
import { SymbolDetailPage } from './features/symbol-detail/SymbolDetailPage.jsx';
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
    if (user && !user.must_change_password && ['/login', '/forgot-password', '/reset-password', '/register', '/verify-email'].includes(pathname)) navigate('/overview');
  }, [user, pathname]);

  if (loading) {
    return <main className="startup-state" aria-live="polite">Đang tải StockSense VN…</main>;
  }

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
  const isPasswordPage = pathname === '/settings/password';
  const isAdminUsers = pathname === '/admin/users';
  const isAdminJobs = pathname === '/admin/jobs';
  const isAdminNotifications = pathname === '/admin/notifications';
  const isAdminOpsEvents = pathname === '/admin/ops-events';
  const isWatchlist = pathname === '/watchlist';
  const isAlerts = pathname === '/alerts';
  const isScreener = pathname === '/screener';
  const isPortfolio = pathname === '/portfolio';
  const isPlans = pathname === '/plans';
  const isJournal = pathname === '/journal';
  const isInvestmentProfile = pathname === '/settings/investment';
  const isChat = pathname === '/chat';
  const isNotificationSettings = pathname === '/settings/notifications';
  const isAccount = pathname === '/settings/account';
  const isAdminRoleRequests = pathname === '/admin/role-requests';

  return (
    <AppShell>
      {symbolMatch ? (
        <RequireCapability capability="symbols.read"><SymbolDetailPage symbol={decodeURIComponent(symbolMatch[1]).toUpperCase()} /></RequireCapability>
      ) : isPasswordPage ? (
        <ChangePasswordPage />
      ) : isAdminUsers ? (
        <RequireCapability capability="admin.users.manage"><AdminUsersPage /></RequireCapability>
      ) : isAdminJobs ? (
        <RequireCapability capability="admin.jobs.read"><AdminJobsPage /></RequireCapability>
      ) : isAdminNotifications ? (
        <RequireCapability capability="admin.notifications.read"><AdminNotificationsPage /></RequireCapability>
      ) : isAdminOpsEvents ? (
        <RequireCapability capability="admin.ops-events.read"><AdminOpsEventsPage /></RequireCapability>
      ) : isAdminRoleRequests ? (
        <RequireCapability capability="admin.role-requests.manage"><AdminRoleRequestsPage /></RequireCapability>
      ) : isAccount ? (
        <RequireCapability capability="profile.role.manage.self"><AccountPage /></RequireCapability>
      ) : isWatchlist ? (
        <RequireCapability capability="watchlist.manage.self"><WatchlistPage /></RequireCapability>
      ) : isAlerts ? (
        <RequireCapability capability="alerts.manage.self"><WatchlistPage /></RequireCapability>
      ) : isScreener ? (
        <RequireCapability capability="screener.read"><ScreenerPage /></RequireCapability>
      ) : isPortfolio ? (
        <RequireCapability capability="portfolio.manage.self"><PortfolioPage /></RequireCapability>
      ) : isPlans ? (
        <RequireCapability capability="plans.manage.self"><PlansPage /></RequireCapability>
      ) : isJournal ? (
        <RequireCapability capability="journal.read.self"><JournalPage /></RequireCapability>
      ) : isInvestmentProfile ? (
        <RequireCapability capability="profile.investment.manage.self"><InvestmentProfilePage /></RequireCapability>
      ) : isChat ? (
        <RequireCapability capability="chat.use.self"><ChatPage /></RequireCapability>
      ) : isNotificationSettings ? (
        <RequireCapability capability="notifications.channels.manage.self"><NotificationSettingsPage /></RequireCapability>
      ) : isOverview ? (
        <RequireCapability capability="market.read"><OverviewPage /></RequireCapability>
      ) : <section className="content"><div className="card access-denied"><span className="access-denied-code">404</span><h1>Không tìm thấy trang</h1><a className="btn primary" href="/overview" onClick={(event) => { event.preventDefault(); navigate('/overview'); }}>Về tổng quan</a></div></section>}
    </AppShell>
  );
}
