import { useEffect, useState } from 'react';
import { api } from '../../api/index.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { hasCapability } from '@stocksense/core/access';

const money = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 });
const quantityFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 });
const blank = { symbol: '', side: 'long', entry_price: '', stop_price: '', target_price: '', quantity: '', capital_vnd: '', risk_pct: '', use_profile: false, note: '' };

export function PlansPage() {
  const { user } = useAuth();
  const canQuantity = hasCapability(user.role, 'plans.calculate.quantity');
  const [plans, setPlans] = useState([]);
  const [investmentProfile, setInvestmentProfile] = useState(null);
  const [form, setForm] = useState(blank);
  const [calculation, setCalculation] = useState(null);
  const [closePlan, setClosePlan] = useState(null);
  const [exitPrice, setExitPrice] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() { const result = await api.plans.list(); setPlans(result.items); }
  useEffect(() => {
    Promise.all([api.plans.list(), canQuantity ? api.profile.get() : Promise.resolve({ profile: null })])
      .then(([result, profileResult]) => {
        setPlans(result.items); setInvestmentProfile(profileResult.profile);
        if (profileResult.profile) setForm((current) => ({ ...current, use_profile: true }));
      })
      .catch((e) => setError(e.message || 'Không tải được kế hoạch.'))
      .finally(() => setLoading(false));
  }, [user.role]);

  function update(key, value) { setForm((current) => ({ ...current, [key]: value })); setCalculation(null); }
  function calcPayload() {
    const payload = { side: form.side, entry_price: Number(form.entry_price), stop_price: Number(form.stop_price), target_price: Number(form.target_price) };
    if (canQuantity && form.use_profile && investmentProfile) { payload.capital_vnd = investmentProfile.capital_vnd; payload.risk_pct = investmentProfile.risk_pct; }
    else if (canQuantity && (form.capital_vnd || form.risk_pct)) { payload.capital_vnd = Number(form.capital_vnd); payload.risk_pct = Number(form.risk_pct); }
    return payload;
  }
  async function calculate(event) {
    event?.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { setCalculation(await api.plans.calculate(calcPayload())); }
    catch (e) { setCalculation(null); setError(e.message || 'Không tính được R:R.'); }
    finally { setBusy(false); }
  }
  async function createPlan(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const result = await api.plans.calculate(calcPayload()); setCalculation(result);
      const payload = { symbol: form.symbol.trim().toUpperCase(), side: form.side, entry_price: Number(form.entry_price), stop_price: Number(form.stop_price), target_price: Number(form.target_price), note: form.note };
      if (form.quantity) payload.quantity = Number(form.quantity);
      if (canQuantity && form.use_profile && investmentProfile) { payload.capital_vnd = investmentProfile.capital_vnd; payload.risk_pct = investmentProfile.risk_pct; }
      else if (canQuantity && (form.capital_vnd || form.risk_pct)) { payload.capital_vnd = Number(form.capital_vnd); payload.risk_pct = Number(form.risk_pct); }
      await api.plans.create(payload);
      await refresh(); setForm({ ...blank, use_profile: Boolean(investmentProfile) }); setCalculation(null); setNotice('Đã tạo kế hoạch và lưu ảnh chụp thị trường. Ảnh chụp dự báo sẽ có khi mô hình sẵn sàng.');
    } catch (e) { setError(e.message || 'Không tạo được kế hoạch.'); }
    finally { setBusy(false); }
  }
  async function changeStatus(plan, status) {
    setBusy(true); setError(''); setNotice('');
    try { await api.plans.updateStatus(plan.id, status); await refresh(); setNotice(status === 'active' ? 'Đã kích hoạt kế hoạch.' : 'Đã hủy kế hoạch.'); }
    catch (e) { setError(e.message || 'Không cập nhật được trạng thái.'); }
    finally { setBusy(false); }
  }
  async function submitClose(event) {
    event.preventDefault(); if (!closePlan) return;
    setBusy(true); setError(''); setNotice('');
    try { await api.plans.close(closePlan.id, { exit_price: Number(exitPrice), note: closeNote }); await refresh(); setClosePlan(null); setExitPrice(''); setCloseNote(''); setNotice('Đã đóng kế hoạch và tạo mục nhật ký trong cùng giao dịch.'); }
    catch (e) { setError(e.message || 'Không đóng được kế hoạch.'); }
    finally { setBusy(false); }
  }

  if (loading) return <section className="content"><div className="card loading-card">Đang tải kế hoạch giao dịch…</div></section>;
  const grouped = ['planned', 'active', 'closed', 'cancelled'];
  const labels = { planned: 'Đã lập', active: 'Đang thực hiện', closed: 'Đã đóng', cancelled: 'Đã hủy' };
  const sideLabels = { long: 'MUA', short: 'BÁN' };
  return <section className="content plans-page">
    <header className="pagehead"><div><span className="eyebrow">KẾ HOẠCH GIAO DỊCH CỦA BẠN</span><h1>Kế hoạch giao dịch</h1><p>R:R dựa trên giá vào, dừng lỗ và mục tiêu do bạn nhập. Không phải khuyến nghị đầu tư.</p></div><span className="chip acc">{plans.length} kế hoạch</span></header>
    <div className="note warn"><strong>Ảnh chụp mô hình:</strong> mô hình AI chưa sẵn sàng. Kế hoạch lưu ảnh chụp giá thị trường hiện có và ghi rõ dự báo chưa khả dụng; không tạo tín hiệu dự báo mẫu.</div>
    {error && <div className="note bad" role="alert">{error}</div>}{notice && <div className="note info" role="status">{notice}</div>}
    <section className="card"><div className="card-h"><div><h2>Lập kế hoạch</h2><p className="small muted">Giá dừng lỗ và giá mục tiêu phải đúng hướng với vị thế mua/bán.</p></div></div>
      <form className="plan-form" onSubmit={createPlan}>
        <label className="field"><span>Mã cổ phiếu</span><input required maxLength="12" pattern="[A-Za-z0-9.-]+" value={form.symbol} onChange={(e) => update('symbol', e.target.value.toUpperCase())} placeholder="FPT" /></label>
        <label className="field"><span>Hướng</span><select value={form.side} onChange={(e) => update('side', e.target.value)}><option value="long">Mua</option><option value="short">Bán</option></select></label>
        <label className="field"><span>Giá vào (VND)</span><input required type="number" min="0.0001" step="0.0001" value={form.entry_price} onChange={(e) => update('entry_price', e.target.value)} /></label>
        <label className="field"><span>Giá dừng lỗ (VND)</span><input required type="number" min="0.0001" step="0.0001" value={form.stop_price} onChange={(e) => update('stop_price', e.target.value)} /></label>
        <label className="field"><span>Giá mục tiêu (VND)</span><input required type="number" min="0.0001" step="0.0001" value={form.target_price} onChange={(e) => update('target_price', e.target.value)} /></label>
        <label className="field"><span>Số lượng dự kiến</span><input type="number" min="0.0001" step="0.0001" value={form.quantity} onChange={(e) => update('quantity', e.target.value)} /></label>
        {canQuantity && investmentProfile && <label className="plan-profile-toggle"><input type="checkbox" checked={form.use_profile} onChange={(e) => update('use_profile', e.target.checked)} /> Dùng hồ sơ đầu tư đã lưu ({money.format(investmentProfile.capital_vnd)} ₫ · {investmentProfile.risk_pct}%)</label>}
        {canQuantity && (!form.use_profile || !investmentProfile) && <><label className="field"><span>Vốn (VND, tùy chọn)</span><input type="number" min="1" value={form.capital_vnd} onChange={(e) => update('capital_vnd', e.target.value)} /></label><label className="field"><span>Rủi ro tối đa (%)</span><input type="number" min="0.01" max="100" step="0.01" value={form.risk_pct} onChange={(e) => update('risk_pct', e.target.value)} /></label></>}
        <label className="field plan-note"><span>Ghi chú</span><input maxLength="1000" value={form.note} onChange={(e) => update('note', e.target.value)} /></label>
        <div className="plan-form-actions"><button className="btn" type="button" disabled={busy} onClick={calculate}>Tính R:R</button><button className="btn pri" type="submit" disabled={busy}>Tạo kế hoạch</button></div>
      </form>
      {calculation && <div className="plan-calculation"><b>R:R {decimal.format(calculation.rr_ratio)}:1</b><span>Rủi ro/cổ phiếu {money.format(calculation.risk_per_share)} ₫</span><span>Lợi nhuận mục tiêu/cổ phiếu {money.format(calculation.reward_per_share)} ₫</span>{calculation.max_quantity != null && <span>Khối lượng tối đa theo mức rủi ro {quantityFormat.format(calculation.max_quantity)}</span>}</div>}
    </section>
    <div className="plan-board">{grouped.map((status) => <section className="card plan-column" key={status}><div className="card-h"><div><h2>{labels[status]}</h2><p className="small muted">{plans.filter((plan) => plan.status === status).length} kế hoạch</p></div></div>
      {plans.filter((plan) => plan.status === status).map((plan) => {
        const risk = Math.abs(plan.entry_price - plan.stop_price); const reward = Math.abs(plan.target_price - plan.entry_price);
        return <article className="plan-card" key={plan.id}>
          <header><div><b>{plan.symbol}</b><span className={`chip ${plan.side === 'long' ? 'up' : 'down'}`}>{sideLabels[plan.side] ?? plan.side.toUpperCase()}</span></div><small>{new Date(plan.created_at).toLocaleDateString('vi-VN')}</small></header>
          <div className="plan-levels"><span>Vào <b>{money.format(plan.entry_price)} ₫</b></span><span>Dừng lỗ <b>{money.format(plan.stop_price)} ₫</b></span><span>Mục tiêu <b>{money.format(plan.target_price)} ₫</b></span><span>R:R <b>{risk ? decimal.format(reward / risk) : '—'}:1</b></span></div>
          {plan.quantity != null && <p className="small">Khối lượng: {quantityFormat.format(plan.quantity)}</p>}
          {plan.note && <p className="plan-user-note">{plan.note}</p>}
          <div className="snapshot-card"><b>Ảnh chụp lúc lập</b><span>Giá: {plan.snapshot?.market_price == null ? 'Chưa có' : `${money.format(plan.snapshot.market_price)} ₫`}</span><span>Ngày: {plan.snapshot?.price_date ?? 'Chưa có'}</span><span>Nguồn giá: {plan.snapshot?.price_source === 'ssi' ? 'SSI' : plan.snapshot?.price_source ?? 'Chưa có'}</span><span>Dự báo: Chưa khả dụng (mô hình chưa sẵn sàng)</span></div>
          {plan.status === 'closed' && <p className="small">Thoát {money.format(plan.exit_price)} ₫{plan.realized_pnl == null ? '' : ` · Lãi/lỗ ${money.format(plan.realized_pnl)} ₫`}</p>}
          <footer>{status === 'planned' && <><button className="btn sm pri" disabled={busy} onClick={() => changeStatus(plan, 'active')}>Kích hoạt</button><button className="btn sm" disabled={busy} onClick={() => changeStatus(plan, 'cancelled')}>Hủy</button></>}{status === 'active' && <><button className="btn sm pri" disabled={busy} onClick={() => { setClosePlan(plan); setExitPrice(''); setCloseNote(''); }}>Đóng kế hoạch</button><button className="btn sm" disabled={busy} onClick={() => changeStatus(plan, 'cancelled')}>Hủy</button></>}<button className="btn sm" onClick={() => api.reports.plan(plan.id, plan.symbol).catch((e) => setError(e.message))}>PDF</button></footer>
        </article>;
      })}
      {!plans.some((plan) => plan.status === status) && <p className="empty-row">Chưa có kế hoạch.</p>}
    </section>)}</div>
    {closePlan && <div className="modal-backdrop" role="presentation"><section className="card plan-close-dialog" role="dialog" aria-modal="true" aria-labelledby="close-plan-title"><h2 id="close-plan-title">Đóng kế hoạch {closePlan.symbol}</h2><p className="small muted">Khi xác nhận, kế hoạch chuyển sang Đã đóng và mục nhật ký được tạo trong cùng giao dịch.</p><form onSubmit={submitClose}><label className="field"><span>Giá thoát (VND)</span><input autoFocus required type="number" min="0.0001" step="0.0001" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} /></label><label className="field"><span>Ghi chú kết quả</span><textarea maxLength="1000" value={closeNote} onChange={(e) => setCloseNote(e.target.value)} /></label><div className="plan-form-actions"><button className="btn" type="button" disabled={busy} onClick={() => setClosePlan(null)}>Quay lại</button><button className="btn pri" type="submit" disabled={busy}>Xác nhận đóng</button></div></form></section></div>}
  </section>;
}
