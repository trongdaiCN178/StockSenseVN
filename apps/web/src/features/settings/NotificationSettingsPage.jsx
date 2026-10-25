import { useEffect, useState } from 'react';
import { api } from '../../api/index.js';

const defaults = { in_app_enabled: true, email_enabled: false, telegram_enabled: false };

export function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState(defaults);
  const [delivery, setDelivery] = useState(null);
  const [channels, setChannels] = useState(null);
  const [emailCode, setEmailCode] = useState('');
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [telegramLink, setTelegramLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    Promise.all([api.notifications.getPreferences(), api.notifications.channels()]).then(([result, channelResult]) => {
      setPreferences(result.preferences); setDelivery(result.delivery); setChannels(channelResult);
    })
      .catch((e) => setError(e.message || 'Không tải được cài đặt thông báo.')).finally(() => setLoading(false));
  }, []);

  async function refreshChannels() {
    const result = await api.notifications.channels(); setChannels(result); return result;
  }

  async function channelAction(action, message) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); await refreshChannels(); setNotice(message); }
    catch (e) { setError(e.message || 'Không hoàn tất được thao tác với kênh.'); }
    finally { setBusy(false); }
  }

  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const result = await api.notifications.savePreferences(preferences);
      setPreferences(result.preferences); setDelivery(result.delivery);
      await refreshChannels();
      setNotice('Đã lưu lựa chọn nhận thông báo. Email và Telegram chưa gửi cho đến khi hoàn tất liên kết, xác minh và cấu hình dịch vụ.');
    } catch (e) { setError(e.message || 'Không lưu được cài đặt.'); }
    finally { setBusy(false); }
  }

  if (loading) return <section className="content"><div className="card loading-card">Đang tải cài đặt thông báo…</div></section>;
  return <section className="content notification-settings-page">
    <header className="pagehead"><div><span className="eyebrow">CÀI ĐẶT CÁ NHÂN</span><h1>Kênh thông báo</h1><p>Lựa chọn kênh bạn muốn dùng. Mỗi tài khoản chỉ quản lý cài đặt của chính mình.</p></div></header>
    {error && <div className="note bad" role="alert">{error}</div>}{notice && <div className="note info" role="status">{notice}</div>}
    <section className="card"><div className="card-h"><div><h2>Lựa chọn nhận tin</h2><p className="small muted">Cài đặt kênh chưa đồng nghĩa với việc thông báo đã được gửi.</p></div></div>
      <form className="notification-preferences" onSubmit={save}>
        <label className="notification-option"><input type="checkbox" checked={preferences.in_app_enabled} onChange={(e) => setPreferences({ ...preferences, in_app_enabled: e.target.checked })} /><span><b>Ưu tiên thông báo trong ứng dụng</b><small>Cảnh báo giá và lịch sử hiện được lưu trong hộp thư; tùy chọn này chưa thay đổi chính sách lưu lịch sử.</small></span><span className="chip up">Khả dụng</span></label>
        <div className="notification-channel-card"><label className="notification-option"><input type="checkbox" disabled={!channels?.channels?.email?.verified} checked={preferences.email_enabled} onChange={(e) => setPreferences({ ...preferences, email_enabled: e.target.checked })} /><span><b>Email · {channels?.channels?.email?.destination ?? 'địa chỉ tài khoản'}</b><small>{delivery?.email?.provider_configured ? 'SMTP đã cấu hình.' : 'SMTP chưa cấu hình; xác minh sẽ báo lỗi đến khi SMTP sẵn sàng.'}</small></span><span className={`chip ${channels?.channels?.email?.verified ? 'up' : 'neutral'}`}>{channels?.channels?.email?.verified ? 'Đã xác minh' : 'Chưa xác minh'}</span></label>
          {!channels?.channels?.email?.verified && <button className="btn sm" type="button" disabled={busy} onClick={() => channelAction(async () => { await api.notifications.linkEmail(); setEmailCodeSent(true); }, 'Đã gửi mã xác minh đến email tài khoản.')}>Gửi mã xác minh</button>}
          {emailCodeSent && <form className="notification-verify-form" onSubmit={(e) => { e.preventDefault(); channelAction(async () => { await api.notifications.verifyEmail(emailCode); setEmailCode(''); setEmailCodeSent(false); }, 'Email đã được xác minh.'); }}><label className="field"><span>Mã 6 chữ số</span><input inputMode="numeric" pattern="[0-9]{6}" maxLength="6" required value={emailCode} onChange={(e) => setEmailCode(e.target.value)} /></label><button className="btn sm pri" disabled={busy}>Xác minh</button></form>}
          {channels?.channels?.email?.verified && <div className="notification-channel-actions"><button className="btn sm" type="button" disabled={busy} onClick={() => channelAction(() => api.notifications.test('email'), 'Đã gửi email kiểm tra.')}>Gửi thử</button><button className="btn sm danger" type="button" disabled={busy} onClick={() => channelAction(() => api.notifications.unlink('email'), 'Đã hủy liên kết email.')}>Hủy liên kết</button></div>}
        </div>
        <div className="notification-channel-card"><label className="notification-option"><input type="checkbox" disabled={!channels?.channels?.telegram?.verified} checked={preferences.telegram_enabled} onChange={(e) => setPreferences({ ...preferences, telegram_enabled: e.target.checked })} /><span><b>Telegram</b><small>{delivery?.telegram?.provider_configured ? 'Bot đã cấu hình; liên kết bằng tài khoản Telegram của bạn.' : 'Cần cấu hình bot token, username và webhook secret.'}</small></span><span className={`chip ${channels?.channels?.telegram?.verified ? 'up' : 'neutral'}`}>{channels?.channels?.telegram?.verified ? 'Đã liên kết' : 'Chưa liên kết'}</span></label>
          {!channels?.channels?.telegram?.verified && <button className="btn sm" type="button" disabled={busy || !channels?.providers?.telegram?.provider_configured} onClick={() => channelAction(async () => { const result = await api.notifications.linkTelegram(); setTelegramLink(result.link); }, 'Liên kết có hiệu lực trong 10 phút.')}>Tạo liên kết Telegram</button>}
          {telegramLink && !channels?.channels?.telegram?.verified && <a className="btn sm" href={telegramLink} target="_blank" rel="noreferrer">Mở bot Telegram</a>}
          {channels?.channels?.telegram?.verified && <div className="notification-channel-actions"><button className="btn sm" type="button" disabled={busy} onClick={() => channelAction(() => api.notifications.test('telegram'), 'Đã gửi tin nhắn kiểm tra.')}>Gửi thử</button><button className="btn sm danger" type="button" disabled={busy} onClick={() => channelAction(() => api.notifications.unlink('telegram'), 'Đã hủy liên kết Telegram.')}>Hủy liên kết</button></div>}
          {telegramLink && !channels?.channels?.telegram?.verified && <button className="btn sm" type="button" disabled={busy} onClick={() => channelAction(refreshChannels, 'Đã cập nhật trạng thái Telegram.')}>Kiểm tra trạng thái liên kết</button>}
        </div>
        <div className="note warn">Chỉ bật kênh sau khi xác minh. Gửi thử kiểm tra kết nối. Cảnh báo tự động chỉ được gửi khi notifier worker được lập lịch; dự báo AI chưa khả dụng.</div>
        <button className="btn pri" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu lựa chọn'}</button>
      </form>
    </section>
  </section>;
}
