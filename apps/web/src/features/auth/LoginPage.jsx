import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ROLE_LABELS, ROLES } from '@stocksense/core/access';
import { navigate } from '../../app/navigation.js';

export function LoginPage() {
  const { login } = useAuth();
  const isMockMode = import.meta.env.VITE_API_MODE !== 'real';
  const [form, setForm] = useState({ email: isMockMode ? 'retail@stocksense.vn' : '', password: isMockMode ? `${ROLES.RETAIL}12345678` : '', role: ROLES.RETAIL });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(form);
    } catch (loginError) {
      setError(loginError.message || 'Không thể đăng nhập.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="brand brand-inverse">
          <span className="brand-mark">S</span>
          <span><b>StockSense VN</b><small>Hệ thống hỗ trợ quyết định đầu tư</small></span>
        </div>
        <div className="login-intro">
          <span className="eyebrow">TỔNG QUAN THỊ TRƯỜNG · T+2 / T+5</span>
          <h1>Dữ liệu rõ ràng cho quyết định có kỷ luật.</h1>
          <p>Xem dự báo, xác suất và lý do trong một giao diện thống nhất.</p>
        </div>
        <p className="login-footnote">StockSense VN là công cụ tham khảo và nghiên cứu, không phải dịch vụ tư vấn đầu tư.</p>
      </section>

      <section className="login-form-panel">
        <form className="login-form" onSubmit={handleSubmit}>
          <div>
            <span className="eyebrow">CHÀO MỪNG BẠN</span>
            <h2>Đăng nhập</h2>
            <p className="muted">{isMockMode ? 'Dùng tài khoản demo để xem giao diện.' : 'Dùng tài khoản đã được cấp để đăng nhập.'}</p>
          </div>
          {isMockMode && <div className="note info" role="note">
            Đây là đăng nhập mock cho giai đoạn dựng giao diện. Chưa xác thực với backend.
            <br />Mật khẩu demo: <strong className="num">{form.role}12345678</strong> (ví dụ: <strong className="num">admin12345678</strong>)
          </div>}
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Mật khẩu</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </label>
          {isMockMode && <label className="field">
            <span>Vai trò demo</span>
            <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value, email: `${event.target.value}@stocksense.vn`, password: `${event.target.value}12345678` })}>
              {Object.values(ROLES).map((role) => <option value={role} key={role}>{ROLE_LABELS[role]}</option>)}
            </select>
          </label>}
          {error && <div className="note bad" role="alert">{error}</div>}
          <button className="btn pri login-submit" type="submit" disabled={submitting}>
            {submitting ? 'Đang đăng nhập…' : isMockMode ? 'Đăng nhập demo' : 'Đăng nhập'}
          </button>
          {!isMockMode && import.meta.env.VITE_PASSWORD_RESET_ENABLED === 'true' && <button className="text-button" type="button" onClick={() => navigate('/forgot-password')}>Quên mật khẩu?</button>}
          {isMockMode && <p className="small muted">Vai trò được chọn chỉ phục vụ xem thử các menu theo quyền.</p>}
        </form>
      </section>
    </main>
  );
}
