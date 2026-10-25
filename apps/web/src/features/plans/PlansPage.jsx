import { useEffect, useState } from 'react';
import { api } from '../../api/index.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { hasCapability } from '@stocksense/core/access';
import { navigate } from '../../app/navigation.js';

const money = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const quantityFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 });
const blank = { symbol: '', side: 'long', entry_price: '', entry_price_max: '', stop_price: '', target_price: '', quantity: '', expires_on: '', capital_vnd: '', risk_pct: '', use_profile: false, note: '' };
const STATUS_LABELS = { draft: 'Nháp', planned: 'Chờ vào', active: 'Đang mở', closed: 'Đã đóng', cancelled: 'Đã hủy / hết hạn' };
const CLOSE_REASONS = { target_hit: 'Chạm mục tiêu', stop_hit: 'Chạm cắt lỗ', expired: 'Hết hạn', manual: 'Đóng thủ công', cancelled: 'Đã hủy' };
const FIELD_LABELS = { entry_price: 'Giá vào', entry_price_max: 'Giá vào tối đa', stop_price: 'Cắt lỗ', target_price: 'Mục tiêu', quantity: 'Khối lượng', note: 'Lý do', expires_on: 'Hết hạn' };
const sideLabels = { long: 'MUA', short: 'BÁN' };
const optionalNumber = (value) => (value === '' || value == null ? null : Number(value));

export function PlansPage() {
  const { user } = useAuth();
  const canQuantity = hasCapability(user.role, 'plans.calculate.quantity');
  const [plans, setPlans] = useState([]);
  const [investmentProfile, setInvestmentProfile] = useState(null);
  const [form, setForm] = useState(() => ({ ...blank, symbol: new URLSearchParams(window.location.search).get('symbol')?.toUpperCase() ?? '' }));
  const [calculation, setCalculation] = useState(null);
  const [closePlan, setClosePlan] = useState(null);
  const [closeForm, setCloseForm] = useState({ exit_price: '', note: '', reason: 'manual' });
  const [editPlan, setEditPlan] = useState(null);
  const [editForm, setEditForm] = useState({});
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
  function sizing() {
    if (canQuantity && form.use_profile && investmentProfile) return { capital_vnd: investmentProfile.capital_vnd, risk_pct: investmentProfile.risk_pct };
    if (canQuantity && (form.capital_vnd || form.risk_pct)) return { capital_vnd: Number(form.capital_vnd), risk_pct: Number(form.risk_pct) };
    return {};
  }
  function calcPayload() {
    return { side: form.side, entry_price: Number(form.entry_price), stop_price: Number(form.stop_price), target_price: Number(form.target_price), ...sizing() };
  }
  async function calculate(event) {
    event?.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { setCalculation(await api.plans.calculate(calcPayload())); }
    catch (e) { setCalculation(null); setError(e.message || 'Không tính được R:R.'); }
    finally { setBusy(false); }
  }
  async function createPlan(status) {
    setBusy(true); setError(''); setNotice('');
    try {
      setCalculation(await api.plans.calculate(calcPayload()));
      const payload = { symbol: form.symbol.trim().toUpperCase(), side: form.side, status, entry_price: Number(form.entry_price),
        entry_price_max: optionalNumber(form.entry_price_max), stop_price: Number(form.stop_price), target_price: Number(form.target_price),
        expires_on: form.expires_on || null, note: form.note, ...sizing() };
      if (form.quantity) payload.quantity = Number(form.quantity);
      await api.plans.create(payload);
      await refresh(); setForm({ ...blank, use_profile: Boolean(investmentProfile) }); setCalculation(null);
      setNotice(status === 'draft' ? 'Đã lưu kế hoạch nháp.' : 'Đã tạo kế hoạch và lưu ảnh chụp thị trường. Ảnh chụp dự báo sẽ có khi mô hình sẵn sàng.');
    } catch (e) { setError(e.message || 'Không tạo được kế hoạch.'); }
    finally { setBusy(false); }
  }
  async function changeStatus(plan, status) {
    setBusy(true); setError(''); setNotice('');
    try { await api.plans.updateStatus(plan.id, status); await refresh(); setNotice(`Kế hoạch ${plan.symbol} chuyển sang “${STATUS_LABELS[status]}”.`); }
    catch (e) { setError(e.message || 'Không cập nhật được trạng thái.'); }
    finally { setBusy(false); }
  }
  function openEdit(plan) {
    setEditPlan(plan);
    setEditForm({ entry_price: plan.entry_price, entry_price_max: plan.entry_price_max ?? '', stop_price: plan.stop_price, target_price: plan.target_price,
      quantity: plan.quantity ?? '', note: plan.note ?? '', expires_on: plan.expires_on ?? '' });
  }
  async function submitEdit(event) {
    event.preventDefault(); if (!editPlan) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api.plans.update(editPlan.id, { entry_price: Number(editForm.entry_price), entry_price_max: optionalNumber(editForm.entry_price_max),
        stop_price: Number(editForm.stop_price), target_price: Number(editForm.target_price), quantity: optionalNumber(editForm.quantity),
        note: editForm.note, expires_on: editForm.expires_on || null });
      await refresh(); setEditPlan(null); setNotice('Đã lưu chỉnh sửa; lịch sử thay đổi được giữ lại.');
    } catch (e) { setError(e.message || 'Không sửa được kế hoạch.'); }
    finally { setBusy(false); }
  }
  async function submitClose(event) {
    event.preventDefault(); if (!closePlan) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api.plans.close(closePlan.id, { exit_price: Number(closeForm.exit_price), note: closeForm.note, reason: closeForm.reason });
      await refresh(); setClosePlan(null); setNotice('Đã đóng kế hoạch và tạo mục nhật ký trong cùng giao dịch.');
    } catch (e) { setError(e.message || 'Không đóng được kế hoạch.'); }
    finally { setBusy(false); }
  }

  if (loading) return <section className="content"><div className="card loading-card">Đang tải kế hoạch giao dịch…</div></section>;
  return <section className="content plans-page">
    <header className="pagehead"><div><span className="eyebrow">KẾ HOẠCH GIAO DỊCH CỦA BẠN</span><h1>Kế hoạch giao dịch</h1><p>R:R dựa trên vùng giá vào, cắt lỗ và mục tiêu do bạn nhập.</p></div><span className="chip acc">{plans.length} kế hoạch</span></header>
    <div className="note warn"><strong>Trade Plan do bạn tự lập; hệ thống không đưa khuyến nghị đầu tư.</strong> Mô hình AI chưa sẵn sàng nên ảnh chụp lúc lập chỉ gồm giá thị trường. Bạn sẽ nhận cảnh báo khi giá đóng cửa chạm vùng vào, cắt lỗ hoặc mục tiêu.</div>
    {error && <div className="note bad" role="alert">{error}</div>}{notice && <div className="note info" role="status">{notice}</div>}
    <section className="card"><div className="card-h"><div><h2>Lập kế hoạch</h2><p className="small muted">Cắt lỗ và mục tiêu phải đúng hướng với vị thế mua/bán và nằm ngoài vùng giá vào.</p></div></div>
      <form className="plan-form" onSubmit={(event) => { event.preventDefault(); createPlan('planned'); }}>
        <label className="field"><span>Mã cổ phiếu</span><input required maxLength="12" pattern="[A-Za-z0-9.-]+" value={form.symbol} onChange={(e) => update('symbol', e.target.value.toUpperCase())} placeholder="FPT" /></label>
        <label className="field"><span>Hướng</span><select value={form.side} onChange={(e) => update('side', e.target.value)}><option value="long">Mua</option><option value="short">Bán</option></select></label>
        <label className="field"><span>Giá vào từ (VND)</span><input required type="number" min="0.0001" step="0.0001" value={form.entry_price} onChange={(e) => update('entry_price', e.target.value)} /></label>
        <label className="field"><span>Giá vào đến (VND, tùy chọn)</span><input type="number" min="0.0001" step="0.0001" value={form.entry_price_max} onChange={(e) => update('entry_price_max', e.target.value)} /></label>
        <label className="field"><span>Giá cắt lỗ (VND)</span><input required type="number" min="0.0001" step="0.0001" value={form.stop_price} onChange={(e) => update('stop_price', e.target.value)} /></label>
        <label className="field"><span>Giá mục tiêu (VND)</span><input required type="number" min="0.0001" step="0.0001" value={form.target_price} onChange={(e) => update('target_price', e.target.value)} /></label>
        <label className="field"><span>Số lượng dự kiến</span><input type="number" min="1" step="1" value={form.quantity} onChange={(e) => update('quantity', e.target.value)} /></label>
        <label className="field"><span>Hết hạn (tùy chọn)</span><input type="date" value={form.expires_on} onChange={(e) => update('expires_on', e.target.value)} /></label>
        {canQuantity && investmentProfile && <label className="plan-profile-toggle"><input type="checkbox" checked={form.use_profile} onChange={(e) => update('use_profile', e.target.checked)} /> Dùng hồ sơ đầu tư đã lưu ({money.format(investmentProfile.capital_vnd)} ₫ · {investmentProfile.risk_pct}%)</label>}
        {canQuantity && (!form.use_profile || !investmentProfile) && <><label className="field"><span>Vốn (VND, tùy chọn)</span><input type="number" min="1" value={form.capital_vnd} onChange={(e) => update('capital_vnd', e.target.value)} /></label><label className="field"><span>Rủi ro tối đa (%)</span><input type="number" min="0.01" max="100" step="0.01" value={form.risk_pct} onChange={(e) => update('risk_pct', e.target.value)} /></label></>}
        <label className="field plan-note"><span>Lý do vào lệnh / ghi chú</span><input maxLength="1000" value={form.note} onChange={(e) => update('note', e.target.value)} /></label>
        <div className="plan-form-actions"><button className="btn" type="button" disabled={busy} onClick={calculate}>Tính R:R</button><button className="btn" type="button" disabled={busy} onClick={(e) => { if (e.currentTarget.form.reportValidity()) createPlan('draft'); }}>Lưu nháp</button><button className="btn pri" type="submit" disabled={busy}>Tạo kế hoạch</button></div>
      </form>
      {calculation && <div className="plan-calculation"><b>R:R {decimal.format(calculation.rr_ratio)}:1</b>
        <span>Cắt lỗ cách giá vào {decimal.format(calculation.risk_pct_distance)}% ({money.format(calculation.risk_per_share)} ₫/cp)</span>
        <span>Mục tiêu cách giá vào {decimal.format(calculation.reward_pct_distance)}% ({money.format(calculation.reward_per_share)} ₫/cp)</span>
        {calculation.max_quantity != null && <span>Khối lượng tối đa theo mức rủi ro: {quantityFormat.format(calculation.max_quantity)} cp (làm tròn lô 100)</span>}</div>}
    </section>
    <div className="plan-board">{Object.keys(STATUS_LABELS).map((status) => <section className="card plan-column" key={status}><div className="card-h"><div><h2>{STATUS_LABELS[status]}</h2><p className="small muted">{plans.filter((plan) => plan.status === status).length} kế hoạch</p></div></div>
      {plans.filter((plan) => plan.status === status).map((plan) => <PlanCard key={plan.id} plan={plan} busy={busy}
        onStatus={(next) => changeStatus(plan, next)} onEdit={() => openEdit(plan)}
        onClose={() => { setClosePlan(plan); setCloseForm({ exit_price: '', note: '', reason: 'manual' }); }}
        onPdf={() => api.reports.plan(plan.id, plan.symbol).catch((e) => setError(e.message))} />)}
      {!plans.some((plan) => plan.status === status) && <p className="empty-row">Chưa có kế hoạch.</p>}
    </section>)}</div>
    {editPlan && <div className="modal-backdrop" role="presentation"><section className="card plan-close-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-plan-title"><h2 id="edit-plan-title">Sửa kế hoạch {editPlan.symbol}</h2><p className="small muted">Ảnh chụp lúc lập không đổi; mọi thay đổi được lưu vào lịch sử chỉnh sửa.</p>
      <form className="plan-edit-form" onSubmit={submitEdit}>
        {['entry_price', 'entry_price_max', 'stop_price', 'target_price', 'quantity'].map((key) => <label className="field" key={key}><span>{FIELD_LABELS[key]}</span><input type="number" min="0.0001" step="0.0001" required={!['entry_price_max', 'quantity'].includes(key)} value={editForm[key]} onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })} /></label>)}
        <label className="field"><span>Hết hạn</span><input type="date" value={editForm.expires_on} onChange={(e) => setEditForm({ ...editForm, expires_on: e.target.value })} /></label>
        <label className="field plan-note"><span>Lý do / ghi chú</span><textarea maxLength="1000" value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} /></label>
        <div className="plan-form-actions"><button className="btn" type="button" disabled={busy} onClick={() => setEditPlan(null)}>Quay lại</button><button className="btn pri" type="submit" disabled={busy}>Lưu thay đổi</button></div>
      </form></section></div>}
    {closePlan && <div className="modal-backdrop" role="presentation"><section className="card plan-close-dialog" role="dialog" aria-modal="true" aria-labelledby="close-plan-title"><h2 id="close-plan-title">Đóng kế hoạch {closePlan.symbol}</h2><p className="small muted">Khi xác nhận, kế hoạch chuyển sang Đã đóng và mục nhật ký được tạo trong cùng giao dịch.</p>
      <form onSubmit={submitClose}>
        <label className="field"><span>Lý do đóng</span><select value={closeForm.reason} onChange={(e) => setCloseForm({ ...closeForm, reason: e.target.value, exit_price: closeForm.exit_price || (e.target.value === 'target_hit' ? String(closePlan.target_price) : e.target.value === 'stop_hit' ? String(closePlan.stop_price) : '') })}>{['target_hit', 'stop_hit', 'expired', 'manual'].map((reason) => <option key={reason} value={reason}>{CLOSE_REASONS[reason]}</option>)}</select></label>
        <label className="field"><span>Giá thoát (VND)</span><input autoFocus required type="number" min="0.0001" step="0.0001" value={closeForm.exit_price} onChange={(e) => setCloseForm({ ...closeForm, exit_price: e.target.value })} /></label>
        <label className="field"><span>Ghi chú kết quả</span><textarea maxLength="1000" value={closeForm.note} onChange={(e) => setCloseForm({ ...closeForm, note: e.target.value })} /></label>
        <div className="plan-form-actions"><button className="btn" type="button" disabled={busy} onClick={() => setClosePlan(null)}>Quay lại</button><button className="btn pri" type="submit" disabled={busy}>Xác nhận đóng</button></div>
      </form></section></div>}
  </section>;
}

function PlanCard({ plan, busy, onStatus, onEdit, onClose, onPdf }) {
  const zoneEdge = plan.side === 'long' ? plan.entry_price_max ?? plan.entry_price : plan.entry_price;
  const risk = Math.abs(zoneEdge - plan.stop_price); const reward = Math.abs(plan.target_price - zoneEdge);
  const editable = ['draft', 'planned', 'active'].includes(plan.status);
  return <article className="plan-card">
    <header><div><button type="button" className="text-button" onClick={() => navigate(`/symbols/${plan.symbol}`)}><b>{plan.symbol}</b></button><span className={`chip ${plan.side === 'long' ? 'up' : 'down'}`}>{sideLabels[plan.side] ?? plan.side.toUpperCase()}</span></div><small>{new Date(plan.created_at).toLocaleDateString('vi-VN')}</small></header>
    <div className="plan-levels">
      <span>Vào <b>{money.format(plan.entry_price)}{plan.entry_price_max ? ` – ${money.format(plan.entry_price_max)}` : ''} ₫</b></span>
      <span>Cắt lỗ <b>{money.format(plan.stop_price)} ₫</b> <small className="muted">({decimal.format(risk / zoneEdge * 100)}%)</small></span>
      <span>Mục tiêu <b>{money.format(plan.target_price)} ₫</b> <small className="muted">({decimal.format(reward / zoneEdge * 100)}%)</small></span>
      <span>R:R <b>{risk ? decimal.format(reward / risk) : '—'}:1</b></span>
    </div>
    {plan.quantity != null && <p className="small">Khối lượng: {quantityFormat.format(plan.quantity)}</p>}
    {plan.expires_on && <p className="small">Hết hạn: {new Date(`${plan.expires_on}T00:00:00`).toLocaleDateString('vi-VN')}</p>}
    {plan.note && <p className="plan-user-note">{plan.note}</p>}
    <div className="snapshot-card"><b>Ảnh chụp lúc lập</b><span>Giá: {plan.snapshot?.market_price == null ? 'Chưa có' : `${money.format(plan.snapshot.market_price)} ₫`}</span><span>Ngày: {plan.snapshot?.price_date ?? 'Chưa có'}</span><span>Nguồn giá: {plan.snapshot?.price_source === 'ssi' ? 'SSI' : plan.snapshot?.price_source ?? 'Chưa có'}</span><span>Dự báo: Chưa khả dụng (mô hình chưa sẵn sàng)</span></div>
    {plan.close_reason && <p className="small"><span className="chip neutral">{CLOSE_REASONS[plan.close_reason]}</span></p>}
    {plan.status === 'closed' && <p className="small">Thoát {money.format(plan.exit_price)} ₫{plan.realized_pnl == null ? '' : ` · Lãi/lỗ ${money.format(plan.realized_pnl)} ₫`}</p>}
    {plan.revisions?.length > 0 && <details className="plan-revisions"><summary>Lịch sử chỉnh sửa ({plan.revisions.length})</summary><ul>{plan.revisions.map((revision) => <li key={revision.id}><small className="muted">{new Date(revision.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</small> {Object.entries(revision.changes).map(([key, value]) => `${FIELD_LABELS[key] ?? key}: ${revision.previous?.[key] ?? '—'} → ${value ?? '—'}`).join('; ')}</li>)}</ul></details>}
    <footer>
      {plan.status === 'draft' && <button className="btn sm pri" disabled={busy} onClick={() => onStatus('planned')}>Chuyển sang Chờ vào</button>}
      {plan.status === 'planned' && <button className="btn sm pri" disabled={busy} onClick={() => onStatus('active')}>Đã vào lệnh</button>}
      {plan.status === 'active' && <button className="btn sm pri" disabled={busy} onClick={onClose}>Đóng kế hoạch</button>}
      {editable && <button className="btn sm" disabled={busy} onClick={onEdit}>Sửa</button>}
      {editable && <button className="btn sm" disabled={busy} onClick={() => onStatus('cancelled')}>Hủy</button>}
      <button className="btn sm" onClick={onPdf}>PDF</button>
    </footer>
  </article>;
}
