import { useState } from 'react';
import { api } from '../../api/index.js';
import { navigate } from '../../app/navigation.js';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const result = await api.auth.forgotPassword(email.trim());
      setMessage(result.message);
    } catch (requestError) { setError(requestError.message || 'Không gửi được yêu cầu.'); }
    finally { setBusy(false); }
  }

  return <main className="public-auth-page"><form className="card public-auth-card" onSubmit={submit}>
    <span className="eyebrow">STOCKSENSE VN</span><h1>Quên mật khẩu?</h1>
    <p className="muted">Nhập email tài khoản. Nếu tài khoản đang hoạt động, hướng dẫn đặt lại có thể được gửi qua email.</p>
    <label className="field"><span>Email</span><input type="email" autoComplete="email" maxLength="254" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    {error && <div className="note bad" role="alert">{error}</div>}
    {message && <div className="note info" role="status">{message}</div>}
    <button className="btn pri" type="submit" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi liên kết đặt lại'}</button>
    <button className="text-button" type="button" onClick={() => navigate('/login')}>Quay lại đăng nhập</button>
  </form></main>;
}
