import { useEffect, useState } from 'react';
import { api } from '../../api/index.js';
import { navigate } from '../../app/navigation.js';

export function VerifyEmailPage() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '');
  const [status, setStatus] = useState(token ? 'verifying' : 'missing-token');
  const [error, setError] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname);
  }, []);

  useEffect(() => {
    if (!token) return;
    api.auth.verifyEmail(token)
      .then(() => setStatus('verified'))
      .catch((requestError) => { setError(requestError.message || 'Liên kết không hợp lệ hoặc đã hết hạn.'); setStatus('failed'); });
  }, [token]);

  async function resend(event) {
    event.preventDefault();
    setBusy(true);
    setResendMessage('');
    try {
      const result = await api.auth.resendVerification(resendEmail.trim());
      setResendMessage(result.message);
    } catch (requestError) {
      setResendMessage(requestError.message || 'Không thể gửi lại email xác thực.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="public-auth-page"><section className="card public-auth-card">
    <span className="eyebrow">STOCKSENSE VN</span><h1>Xác thực email</h1>

    {status === 'verifying' && <p className="muted">Đang xác thực email…</p>}

    {status === 'verified' && <>
      <div className="note info" role="status">Email đã được xác thực. Bạn có thể đăng nhập ngay.</div>
      <button className="btn pri" type="button" onClick={() => navigate('/login')}>Đến đăng nhập</button>
    </>}

    {(status === 'failed' || status === 'missing-token') && <>
      {status === 'missing-token'
        ? <div className="note warn">Liên kết thiếu mã xác thực. Nhập email để gửi lại liên kết mới.</div>
        : <div className="note bad" role="alert">{error}</div>}
      <form onSubmit={resend}>
        <label className="field"><span>Email</span>
          <input type="email" autoComplete="email" maxLength="254" required disabled={busy}
            value={resendEmail} onChange={(event) => setResendEmail(event.target.value)} />
        </label>
        {resendMessage && <div className="note info" role="status">{resendMessage}</div>}
        <button className="btn pri" type="submit" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi lại email xác thực'}</button>
      </form>
      <button className="text-button" type="button" onClick={() => navigate('/login')}>Quay lại đăng nhập</button>
    </>}
  </section></main>;
}
