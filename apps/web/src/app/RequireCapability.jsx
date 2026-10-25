import { useAuth } from '../auth/AuthContext.jsx';
import { hasCapability } from '@stocksense/core/access';

export function RequireCapability({ capability, children }) {
  const { user } = useAuth();
  if (!hasCapability(user?.role, capability)) {
    return (
      <section className="content">
        <div className="card access-denied" role="alert">
          <span className="access-denied-code">403</span>
          <h1>Bạn chưa được cấp quyền</h1>
          <p className="muted">Tài khoản hiện tại không có quyền xem nội dung này.</p>
        </div>
      </section>
    );
  }
  return children;
}
