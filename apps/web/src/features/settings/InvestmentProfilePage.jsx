import { useEffect, useState } from 'react';
import { api } from '../../api/index.js';

export function InvestmentProfilePage() {
  const [form, setForm] = useState({ capital_vnd: '', risk_pct: '' });
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    const result = await api.profile.get();
    if (result.profile) {
      setForm({ capital_vnd: String(result.profile.capital_vnd), risk_pct: String(result.profile.risk_pct) });
      setHasProfile(true);
    } else { setForm({ capital_vnd: '', risk_pct: '' }); setHasProfile(false); }
  }
  useEffect(() => { refresh().catch((e) => setError(e.message || 'Không tải được hồ sơ đầu tư.')).finally(() => setLoading(false)); }, []);

  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const result = await api.profile.save({ capital_vnd: Number(form.capital_vnd), risk_pct: Number(form.risk_pct) });
      setForm({ capital_vnd: String(result.profile.capital_vnd), risk_pct: String(result.profile.risk_pct) });
      setHasProfile(true); setNotice('Đã lưu hồ sơ riêng tư. Kế hoạch giao dịch sẽ dùng giá trị này để gợi ý khối lượng khi bạn chọn áp dụng.');
    } catch (e) { setError(e.message || 'Không lưu được hồ sơ.'); }
    finally { setBusy(false); }
  }

  if (loading) return <section className="content"><div className="card loading-card">Đang tải hồ sơ đầu tư…</div></section>;
  return <section className="content investment-profile-page">
    <header className="pagehead"><div><span className="eyebrow">CÀI ĐẶT CÁ NHÂN</span><h1>Hồ sơ đầu tư</h1><p>Thông tin này chỉ thuộc tài khoản của bạn và chỉ được dùng cho phép tính khối lượng kế hoạch giao dịch.</p></div><span className={`chip ${hasProfile ? 'up' : 'neutral'}`}>{hasProfile ? 'Đã thiết lập' : 'Chưa thiết lập'}</span></header>
    {error && <div className="note bad" role="alert">{error}</div>}{notice && <div className="note info" role="status">{notice}</div>}
    <section className="card investment-profile-card"><div className="card-h"><div><h2>Vốn và mức rủi ro</h2><p className="small muted">Đây là tham số do bạn tự chọn, không phải khuyến nghị đầu tư.</p></div></div>
      <form className="investment-profile-form" onSubmit={save}>
        <label className="field"><span>Vốn dự kiến (VND)</span><input required type="number" min="1" max="1000000000000000" step="1" value={form.capital_vnd} onChange={(e) => setForm({ ...form, capital_vnd: e.target.value })} /></label>
        <label className="field"><span>Rủi ro tối đa mỗi kế hoạch (%)</span><input required type="number" min="0.01" max="100" step="0.01" value={form.risk_pct} onChange={(e) => setForm({ ...form, risk_pct: e.target.value })} /></label>
        <button className="btn pri" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu hồ sơ'}</button>
      </form>
      <div className="note warn investment-profile-note">Khi tạo kế hoạch giao dịch, các giá trị này chỉ được dùng nếu bạn chủ động chọn “Dùng hồ sơ đầu tư”. Kết quả khối lượng là phép tính rủi ro, không đảm bảo khả năng khớp lệnh hay lợi nhuận.</div>
    </section>
  </section>;
}
