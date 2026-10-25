import { useEffect, useState } from 'react';
import { api } from '../../api/index.js';
import { navigate } from '../../app/navigation.js';

export function ResetPasswordPage() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname); }, []);

  async function submit(event) {
    event.preventDefault(); setError('');
    if (password !== confirmation) { setError('Mật khẩu xác nhận không khớp.'); return; }
    setBusy(true);
    try { await api.auth.resetPassword({ token, new_password: password }); setComplete(true); }
    catch (requestError) { setError(requestError.message || 'Liên kết không hợp lệ hoặc đã hết hạn.'); }
    finally { setBusy(false); }
  }

  return <main className="public-auth-page"><section className="card public-auth-card">
    <span className="eyebrow">STOCKSENSE VN</span><h1>Đặt lại mật khẩu</h1>
    {complete ? <><div className="note info" role="status">Mật khẩu đã được cập nhật. Các phiên đăng nhập khác đã bị thu hồi.</div><button className="btn pri" type="button" onClick={() => navigate('/login')}>Đến đăng nhập</button></>
      : <form onSubmit={submit}>
        {!token && <div className="note warn">Liên kết thiếu token. Hãy yêu cầu email đặt lại mật khẩu mới.</div>}
        <label className="field"><span>Mật khẩu mới</span><input type="password" autoComplete="new-password" minLength="12" maxLength="128" required disabled={!token} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <label className="field"><span>Nhập lại mật khẩu</span><input type="password" autoComplete="new-password" minLength="12" maxLength="128" required disabled={!token} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
        <p className="small muted">Mật khẩu dài từ 12 đến 128 ký tự. Liên kết chỉ dùng được một lần và hết hạn sau 30 phút.</p>
        {error && <div className="note bad" role="alert">{error}</div>}
        <button className="btn pri" type="submit" disabled={busy || !token}>{busy ? 'Đang cập nhật…' : 'Đặt mật khẩu mới'}</button>
        <button className="text-button" type="button" onClick={() => navigate('/forgot-password')}>Yêu cầu liên kết khác</button>
      </form>}
  </section></main>;
}
