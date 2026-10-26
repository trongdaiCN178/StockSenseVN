import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE_LABELS, hasCapability } from '@stocksense/core/access';
import { navigate } from './navigation.js';

export function RequireCapability({ capability, children }) {
  const { user } = useAuth();
  if (!hasCapability(user?.role, capability)) {
    const home = user?.role === 'admin' ? '/admin' : '/overview';
    return (
      <section className="content">
        <div className="empty403" role="alert">
          <div className="code">403</div>
          <h2>Vai trò {ROLE_LABELS[user?.role] ?? user?.role} không mở được trang này</h2>
          <p className="muted" style={{ maxWidth: '52ch' }}>{user?.role === 'admin'
            ? 'Admin không có quyền đọc dữ liệu cá nhân và dự báo dành cho người dùng cuối.'
            : 'Trang này dành cho vai trò khác. Nâng cấp vai trò trong Cài đặt nếu bạn cần dùng chức năng này.'}</p>
          <button className="btn pri" type="button" onClick={() => navigate(home)}>Về trang chính</button>
        </div>
      </section>
    );
  }
  return children;
}
