import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { navigate } from '../../app/navigation.js';

export function LoginPage() {
  const { login } = useAuth();
  const isMockMode = import.meta.env.VITE_API_MODE !== 'real';
  const [form, setForm] = useState({ email: '', password: '' });
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
    <div className="login">
      <div className="login-l">
        <div className="brand"><div className="brand-mark" style={{ background: 'var(--accent-ink)', color: 'var(--accent)' }}>SS</div><div><b>StockSense VN</b></div></div>
        <div>
          <h1>Dự báo xu hướng T+2 và T+5 cho cổ phiếu HOSE, HNX</h1>
          <p style={{ marginTop: 12, opacity: 0.85, maxWidth: '44ch' }}>Kết hợp chỉ báo tài chính, kỹ thuật và cảm xúc tin tức. Cập nhật mỗi ngày sau 15:30, kèm giải thích cho từng dự báo.</p>
        </div>
        <div className="small" style={{ opacity: 0.8 }}>Dự báo chỉ mang tính tham khảo, không phải khuyến nghị đầu tư.</div>
      </div>
      <div className="login-r">
        <form className="login-form" onSubmit={handleSubmit}>
          <h1>Đăng nhập</h1>
          <div className="field">
            <label htmlFor="lg-e">Email</label>
            <input id="lg-e" type="email" placeholder="ban@example.com" autoComplete="username" required
              value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="lg-p">Mật khẩu</label>
            <input id="lg-p" type="password" autoComplete="current-password" required
              value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </div>
          {error && <div className="note bad" role="alert">{error}</div>}
          <button className="btn pri" type="submit" style={{ justifyContent: 'center', padding: 10 }} disabled={submitting}>
            {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
          {!isMockMode && <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            {import.meta.env.VITE_PASSWORD_RESET_ENABLED === 'true' && <button className="text-button" type="button" onClick={() => navigate('/forgot-password')}>Quên mật khẩu?</button>}
            <button className="text-button" type="button" onClick={() => navigate('/register')}>Chưa có tài khoản? Đăng ký</button>
          </div>}
        </form>
      </div>
    </div>
  );
}
