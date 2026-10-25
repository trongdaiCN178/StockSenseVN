import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { navigate } from '../../app/navigation.js';

export function ChangePasswordPage({ mandatory = false }) {
  const { user, changePassword, logout } = useAuth();
  const [values, setValues] = useState({ current_password: '', new_password: '', confirmation: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (values.new_password.length < 12 || values.new_password.length > 128) {
      setError('Mật khẩu mới cần dài từ 12 đến 128 ký tự.'); return;
    }
    if (values.new_password !== values.confirmation) { setError('Mật khẩu xác nhận chưa khớp.'); return; }
    setSaving(true);
    try {
      await changePassword({ current_password: values.current_password, new_password: values.new_password });
      navigate('/overview');
    } catch (requestError) {
      setError(requestError.message || 'Không đổi được mật khẩu.');
    } finally {
      setSaving(false);
    }
  }

  return <main className={mandatory ? 'password-gate' : 'content'}>
    <section className="card password-card">
      <span className="eyebrow">BẢO MẬT TÀI KHOẢN</span>
      <h1>{mandatory ? 'Đặt mật khẩu mới để tiếp tục' : 'Đổi mật khẩu'}</h1>
      <p className="muted">{mandatory ? `Tài khoản ${user.email} đang dùng mật khẩu tạm. Hãy tạo mật khẩu cá nhân trước khi tiếp tục.` : `Cập nhật mật khẩu cho ${user.email}.`}</p>
      <form className="password-form" onSubmit={submit}>
        <label className="field"><span>Mật khẩu hiện tại hoặc mật khẩu tạm</span><input type="password" autoComplete="current-password" required value={values.current_password} onChange={(event) => setValues({ ...values, current_password: event.target.value })} /></label>
        <label className="field"><span>Mật khẩu mới</span><input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={values.new_password} onChange={(event) => setValues({ ...values, new_password: event.target.value })} /><small className="muted">Từ 12 đến 128 ký tự.</small></label>
        <label className="field"><span>Nhập lại mật khẩu mới</span><input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={values.confirmation} onChange={(event) => setValues({ ...values, confirmation: event.target.value })} /></label>
        {error && <div className="note bad" role="alert">{error}</div>}
        <div className="password-actions"><button className="btn pri" type="submit" disabled={saving}>{saving ? 'Đang cập nhật…' : 'Cập nhật mật khẩu'}</button>{!mandatory && <button className="btn" type="button" onClick={() => navigate('/overview')}>Hủy</button>}{mandatory && <button className="btn" type="button" onClick={logout}>Đăng xuất</button>}</div>
      </form>
    </section>
  </main>;
}
