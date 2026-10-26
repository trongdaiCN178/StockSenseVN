import { useState } from 'react';
import { api } from '../../api/index.js';
import { navigate } from '../../app/navigation.js';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_POLICY_TEXT } from '@stocksense/core/password';
import { AuthLayout } from './AuthLayout.jsx';

export function RegisterPage() {
  const [form, setForm] = useState({ email: '', fullName: '', password: '', confirmPassword: '' });
  const [consents, setConsents] = useState({ age: false, terms: false, privacy: false });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (!consents.age || !consents.terms || !consents.privacy) {
      setError('Vui lòng xác nhận đủ các điều kiện bắt buộc trước khi đăng ký.');
      return;
    }
    setBusy(true);
    try {
      const result = await api.auth.register({
        email: form.email.trim(),
        password: form.password,
        full_name: form.fullName.trim() || undefined,
        age_confirmed: consents.age,
        terms_accepted: consents.terms,
        privacy_accepted: consents.privacy,
      });
      setMessage(result.message);
    } catch (requestError) {
      setError(requestError.message || 'Không thể gửi yêu cầu đăng ký.');
    } finally {
      setBusy(false);
    }
  }

  return <AuthLayout><form className="card public-auth-card" onSubmit={submit}>
    <span className="eyebrow">STOCKSENSE VN</span>
    <h1>Đăng ký tài khoản</h1>
    <p className="muted">Tài khoản mới ở vai trò Nhà đầu tư cá nhân. Bạn có thể nâng cấp quyền sau khi xác thực email.</p>
    {message
      ? <div className="note info" role="status">{message}</div>
      : <>
        <label className="field"><span>Email</span>
          <input type="email" autoComplete="email" maxLength="254" required disabled={busy}
            value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </label>
        <label className="field"><span>Tên hiển thị (không bắt buộc)</span>
          <input type="text" autoComplete="name" maxLength="100" disabled={busy}
            value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
        </label>
        <label className="field"><span>Mật khẩu</span>
          <input type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} required disabled={busy}
            value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        </label>
        <label className="field"><span>Nhập lại mật khẩu</span>
          <input type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} required disabled={busy}
            value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} />
        </label>
        <p className="small muted">{PASSWORD_POLICY_TEXT}</p>

        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <input type="checkbox" checked={consents.age} disabled={busy}
            onChange={(event) => setConsents({ ...consents, age: event.target.checked })} />
          <span>Tôi xác nhận đã đủ 18 tuổi.</span>
        </label>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <input type="checkbox" checked={consents.terms} disabled={busy}
            onChange={(event) => setConsents({ ...consents, terms: event.target.checked })} />
          <span>Tôi đồng ý Điều khoản sử dụng và hiểu StockSense VN không phải dịch vụ tư vấn đầu tư.</span>
        </label>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <input type="checkbox" checked={consents.privacy} disabled={busy}
            onChange={(event) => setConsents({ ...consents, privacy: event.target.checked })} />
          <span>Tôi đã đọc Thông báo xử lý dữ liệu cá nhân và đồng ý để StockSense VN xử lý email, mật khẩu đã băm và dữ liệu tôi nhập nhằm cung cấp dịch vụ.</span>
        </label>

        {error && <div className="note bad" role="alert">{error}</div>}
        <button className="btn pri" type="submit" disabled={busy}>{busy ? 'Đang gửi…' : 'Đăng ký'}</button>
      </>}
    <button className="text-button" type="button" onClick={() => navigate('/login')}>Quay lại đăng nhập</button>
  </form></AuthLayout>;
}
