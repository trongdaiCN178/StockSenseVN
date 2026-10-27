import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/index.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { hasCapability } from '@stocksense/core/access';
import { calculateRiskReward } from '@stocksense/core/calc';
import { navigate } from '../../app/navigation.js';
import { Disclaimer, Icon } from '../../app/icons.jsx';
import { Modal } from '../../app/Modal.jsx';

const money = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
const COLUMNS = [['draft', 'Nháp'], ['planned', 'Chờ vào'], ['active', 'Đang mở'], ['closed', 'Đã đóng']];
const STATUS_LABELS = { draft: 'Nháp', planned: 'Chờ vào', active: 'Đang mở', closed: 'Đã đóng', cancelled: 'Đã hủy' };
const CLOSE_REASONS = { target_hit: 'Chạm mục tiêu', stop_hit: 'Chạm cắt lỗ', expired: 'Hết hạn', manual: 'Đóng thủ công', cancelled: 'Đã hủy' };
const FIELD_LABELS = { entry_price: 'Vào từ', entry_price_max: 'Vào đến', stop_price: 'Cắt lỗ', target_price: 'Mục tiêu', quantity: 'Khối lượng', note: 'Lý do', expires_on: 'Hết hạn' };
const blankForm = { symbol: '', side: 'long', entry_price: '', entry_price_max: '', stop_price: '', target_price: '', quantity: '', expires_on: '', capital_vnd: '', risk_pct: '', use_profile: false, note: '' };
const optionalNumber = (value) => (value === '' || value == null ? null : Number(value));
const pct = (value) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1).replace('.', ',')}%`;

// Same rule as the API: the worst edge of the entry zone is used for R:R and sizing.
function zoneEdge(form) {
  const low = Number(form.entry_price); const high = optionalNumber(form.entry_price_max);
  return form.side === 'long' ? high ?? low : low;
}
function liveCalculation(form, sizing) {
  try {
    return calculateRiskReward({ side: form.side, entry_price: zoneEdge(form), stop_price: Number(form.stop_price), target_price: Number(form.target_price), ...sizing });
  } catch { return null; }
}

export function PlansPage() {
  const { user } = useAuth();
  const canQuantity = hasCapability(user.role, 'plans.calculate.quantity');
  const initialSymbol = new URLSearchParams(window.location.search).get('symbol')?.toUpperCase() ?? '';
  const [plans, setPlans] = useState([]);
  const [profile, setProfile] = useState(null);
  const [selected, setSelected] = useState(initialSymbol ? 'new' : null);
  const [form, setForm] = useState({ ...blankForm, symbol: initialSymbol });
  const [closing, setClosing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() { const result = await api.plans.list(); setPlans(result.items); return result.items; }
  useEffect(() => {
    Promise.all([api.plans.list(), canQuantity ? api.profile.get() : Promise.resolve({ profile: null })])
      .then(([result, profileResult]) => {
        setPlans(result.items); setProfile(profileResult.profile);
        if (profileResult.profile) setForm((current) => ({ ...current, use_profile: true }));
        if (!initialSymbol) {
          const first = result.items.find((plan) => ['active', 'planned', 'draft'].includes(plan.status)) ?? result.items[0];
          if (first) selectPlan(first); else setSelected('new');
        }
      })
      .catch((e) => setError(e.message || 'Không tải được kế hoạch.'))
      .finally(() => setLoading(false));
  }, [user.role]);

  const plan = plans.find((item) => item.id === selected) ?? null;
  const editable = selected === 'new' || ['draft', 'planned', 'active'].includes(plan?.status);
  const sizing = canQuantity && form.use_profile && profile ? { capital_vnd: profile.capital_vnd, risk_pct: profile.risk_pct }
    : canQuantity && form.capital_vnd && form.risk_pct ? { capital_vnd: Number(form.capital_vnd), risk_pct: Number(form.risk_pct) } : {};
  const calc = useMemo(() => liveCalculation(form, sizing), [form, profile]);

  function selectPlan(item) {
    setSelected(item.id); setError(''); setNotice('');
    setForm({ ...blankForm, symbol: item.symbol, side: item.side, entry_price: String(item.entry_price), entry_price_max: item.entry_price_max ?? '', stop_price: String(item.stop_price),
      target_price: String(item.target_price), quantity: item.quantity ?? '', expires_on: item.expires_on ?? '', note: item.note ?? '' });
  }
  function startNew(symbol = '') {
    setSelected('new'); setError(''); setNotice('');
    setForm({ ...blankForm, symbol, use_profile: Boolean(profile) });
  }
  function update(key, value) { setForm((current) => ({ ...current, [key]: value })); }

  async function save(status) {
    setBusy(true); setError(''); setNotice('');
    try {
      if (selected === 'new') {
        const payload = { symbol: form.symbol.trim().toUpperCase(), side: form.side, status, entry_price: Number(form.entry_price), entry_price_max: optionalNumber(form.entry_price_max),
          stop_price: Number(form.stop_price), target_price: Number(form.target_price), expires_on: form.expires_on || null, note: form.note, ...sizing };
        if (form.quantity) payload.quantity = Number(form.quantity);
        const created = await api.plans.create(payload);
        await refresh(); selectPlan(created);
        setNotice(status === 'draft' ? 'Đã lưu kế hoạch nháp.' : 'Đã tạo kế hoạch ở trạng thái Chờ vào và lưu ảnh chụp giá lúc lập.');
      } else {
        const updated = await api.plans.update(plan.id, { entry_price: Number(form.entry_price), entry_price_max: optionalNumber(form.entry_price_max), stop_price: Number(form.stop_price),
          target_price: Number(form.target_price), quantity: optionalNumber(form.quantity), note: form.note, expires_on: form.expires_on || null });
        await refresh(); selectPlan(updated); setNotice('Đã lưu thay đổi; lịch sử chỉnh sửa được giữ lại.');
      }
    } catch (e) { setError(e.message || 'Không lưu được kế hoạch.'); }
    finally { setBusy(false); }
  }
  async function changeStatus(status) {
    setBusy(true); setError(''); setNotice('');
    try { const updated = await api.plans.updateStatus(plan.id, status); await refresh(); selectPlan(updated); setNotice(`Kế hoạch ${plan.symbol} chuyển sang ${STATUS_LABELS[status]}.`); }
    catch (e) { setError(e.message || 'Không cập nhật được trạng thái.'); }
    finally { setBusy(false); }
  }
  async function submitClose(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const updated = await api.plans.close(plan.id, { exit_price: Number(closing.exit_price), note: closing.note, reason: closing.reason });
      await refresh(); selectPlan(updated); setClosing(null); setNotice('Đã đóng kế hoạch và tạo bản ghi Journal.');
    } catch (e) { setError(e.message || 'Không đóng được kế hoạch.'); setClosing(null); }
    finally { setBusy(false); }
  }

  if (loading) return <main className="content"><div className="card muted">Đang tải kế hoạch giao dịch…</div></main>;
  const columnPlans = (status) => plans.filter((item) => (status === 'closed' ? ['closed', 'cancelled'].includes(item.status) : item.status === status));
  const snapshot = plan?.snapshot ?? {};

  return <main className="content">
    <div className="pagehead"><div><h1>Trade Plan</h1><p>Kế hoạch giao dịch do bạn tự lập. Giá thị trường lúc lập được lưu lại làm snapshot để đối chiếu sau này.</p></div>
      <div className="actions"><button className="btn pri" type="button" onClick={() => startNew()}><Icon name="plus" />Lập kế hoạch</button>
        {plan && <button className="btn" type="button" onClick={() => api.reports.plan(plan.id, plan.symbol).catch((e) => setError(e.message))}><Icon name="pdf" />PDF</button>}</div></div>
    {error && <div className="note bad" role="alert">{error}</div>}
    {notice && <div className="note info" role="status">{notice}</div>}

    <div className="kan">{COLUMNS.map(([status, label]) => { const items = columnPlans(status); return <div className="col" key={status}>
      <div className="col-h"><span>{label}</span><span className="num">{items.length}</span></div>
      {items.map((item) => <div key={item.id} className={`pc ${item.id === selected ? 'sel' : ''}`} role="button" tabIndex={0} onClick={() => selectPlan(item)} onKeyDown={(event) => { if (event.key === 'Enter') selectPlan(item); }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="sym">{item.symbol} <span className={`chip ${item.side === 'long' ? 'up' : 'down'}`}>{item.side === 'long' ? 'MUA' : 'BÁN'}</span></span><span className="small muted num">{new Date(item.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</span></div>
        <div className="small num muted">Vào {money.format(item.entry_price)}{item.entry_price_max ? `–${money.format(item.entry_price_max)}` : ''} · CL {money.format(item.stop_price)} · MT {money.format(item.target_price)}</div>
        {item.expires_on && ['draft', 'planned'].includes(item.status) && <span className="chip neutral">Hết hạn {new Date(`${item.expires_on}T00:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</span>}
        {item.close_reason && <span className={`chip ${item.close_reason === 'target_hit' ? 'up' : item.close_reason === 'stop_hit' ? 'down' : 'neutral'}`}>{CLOSE_REASONS[item.close_reason]}</span>}
        {item.status === 'closed' && item.exit_price != null && <span className={`chip ${(item.side === 'long' ? item.exit_price - item.entry_price : item.entry_price - item.exit_price) >= 0 ? 'up' : 'down'}`}>{pct((item.side === 'long' ? item.exit_price - item.entry_price : item.entry_price - item.exit_price) / item.entry_price * 100)}</span>}
      </div>)}
      {!items.length && <div className="small muted" style={{ padding: '2px 4px' }}>Trống</div>}
    </div>; })}</div>

    <div className="grid g-main">
      <section className="card">
        <div className="card-h"><h2>{selected === 'new' ? 'Lập kế hoạch mới' : `Kế hoạch ${plan?.symbol}`} {plan && <span className="chip neutral">{STATUS_LABELS[plan.status]}</span>}</h2></div>
        {editable ? <form onSubmit={(event) => { event.preventDefault(); save(selected === 'new' ? 'planned' : undefined); }}>
          <div className="frow">
            <div className="field"><label htmlFor="pl-s">Mã</label><input id="pl-s" required maxLength="12" pattern="[A-Za-z0-9.-]+" disabled={selected !== 'new'} value={form.symbol} onChange={(e) => update('symbol', e.target.value.toUpperCase())} placeholder="FPT" /></div>
            <div className="field"><label htmlFor="pl-side">Hướng</label><select id="pl-side" disabled={selected !== 'new'} value={form.side} onChange={(e) => update('side', e.target.value)}><option value="long">Mua</option><option value="short">Bán</option></select></div>
            <div className="field"><label htmlFor="pl-e1">Vùng vào từ</label><input id="pl-e1" className="num" type="number" required min="0.0001" step="0.0001" value={form.entry_price} onChange={(e) => update('entry_price', e.target.value)} /></div>
            <div className="field"><label htmlFor="pl-e2">đến</label><input id="pl-e2" className="num" type="number" min="0.0001" step="0.0001" value={form.entry_price_max} onChange={(e) => update('entry_price_max', e.target.value)} /><span className="hint">tùy chọn</span></div>
            <div className="field"><label htmlFor="pl-sl">Cắt lỗ</label><input id="pl-sl" className="num" type="number" required min="0.0001" step="0.0001" value={form.stop_price} onChange={(e) => update('stop_price', e.target.value)} /></div>
            <div className="field"><label htmlFor="pl-tp">Mục tiêu</label><input id="pl-tp" className="num" type="number" required min="0.0001" step="0.0001" value={form.target_price} onChange={(e) => update('target_price', e.target.value)} /></div>
            <div className="field"><label htmlFor="pl-q">Khối lượng dự kiến</label><input id="pl-q" className="num" type="number" min="1" step="1" value={form.quantity} onChange={(e) => update('quantity', e.target.value)} /><span className="hint">cp, tùy chọn</span></div>
            <div className="field"><label htmlFor="pl-exp">Hết hạn</label><input id="pl-exp" type="date" value={form.expires_on} onChange={(e) => update('expires_on', e.target.value)} /><span className="hint">tùy chọn</span></div>
            {canQuantity && selected === 'new' && (!form.use_profile || !profile) && <>
              <div className="field"><label htmlFor="pl-cap">Vốn (đồng)</label><input id="pl-cap" className="num" type="number" min="1" value={form.capital_vnd} onChange={(e) => update('capital_vnd', e.target.value)} /></div>
              <div className="field"><label htmlFor="pl-risk">Rủi ro tối đa</label><input id="pl-risk" className="num" type="number" step="0.01" min="0.01" max="100" value={form.risk_pct} onChange={(e) => update('risk_pct', e.target.value)} /><span className="hint">% vốn</span></div>
            </>}
          </div>
          {canQuantity && selected === 'new' && profile && <label className="toggle" style={{ marginTop: 12 }}><input type="checkbox" checked={form.use_profile} onChange={(e) => update('use_profile', e.target.checked)} /> Dùng hồ sơ đầu tư ({money.format(profile.capital_vnd)} đ · {profile.risk_pct}% rủi ro)</label>}
          <div className="field" style={{ marginTop: 12 }}><label htmlFor="pl-why">Lý do</label><textarea id="pl-why" maxLength="1000" value={form.note} onChange={(e) => update('note', e.target.value)} /></div>
          <div style={{ marginTop: 14 }}><CalcBox calc={calc} edge={zoneEdge(form)} canQuantity={canQuantity} /></div>
          <div className="actions" style={{ marginTop: 14 }}>
            {selected === 'new' ? <><button className="btn pri" type="submit" disabled={busy}>Tạo kế hoạch</button><button className="btn" type="button" disabled={busy} onClick={(event) => { if (event.currentTarget.form.reportValidity()) save('draft'); }}>Lưu nháp</button></>
              : <><button className="btn pri" type="submit" disabled={busy}>Lưu</button>
                {plan.status === 'draft' && <button className="btn" type="button" disabled={busy} onClick={() => changeStatus('planned')}>Chuyển sang Chờ vào</button>}
                {plan.status === 'planned' && <button className="btn" type="button" disabled={busy} onClick={() => changeStatus('active')}>Đã vào lệnh</button>}
                {plan.status === 'active' && <button className="btn" type="button" disabled={busy} onClick={() => setClosing({ exit_price: '', note: '', reason: 'manual' })}>Đóng kế hoạch</button>}
                <button className="btn danger" type="button" disabled={busy} onClick={() => changeStatus('cancelled')}>Hủy kế hoạch</button></>}
          </div>
        </form> : plan && <>
          <dl className="kv">
            <dt>Hướng</dt><dd>{plan.side === 'long' ? 'Mua' : 'Bán'}</dd>
            <dt>Vùng vào</dt><dd className="num">{money.format(plan.entry_price)}{plan.entry_price_max ? ` – ${money.format(plan.entry_price_max)}` : ''}</dd>
            <dt>Cắt lỗ / Mục tiêu</dt><dd className="num">{money.format(plan.stop_price)} / {money.format(plan.target_price)}</dd>
            <dt>Khối lượng</dt><dd className="num">{plan.quantity == null ? '—' : money.format(plan.quantity)}</dd>
            {plan.exit_price != null && <><dt>Giá thoát</dt><dd className="num">{money.format(plan.exit_price)}</dd></>}
            <dt>Kết quả</dt><dd>{plan.close_reason ? CLOSE_REASONS[plan.close_reason] : STATUS_LABELS[plan.status]}{plan.realized_pnl != null && <span className={`num ${plan.realized_pnl >= 0 ? 'c-up' : 'c-down'}`}> · {plan.realized_pnl >= 0 ? '+' : '−'}{money.format(Math.abs(plan.realized_pnl))} đ</span>}</dd>
            {plan.note && <><dt>Lý do</dt><dd style={{ whiteSpace: 'normal' }}>{plan.note}</dd></>}
            {plan.close_note && <><dt>Ghi chú khi đóng</dt><dd style={{ whiteSpace: 'normal' }}>{plan.close_note}</dd></>}
          </dl>
          <div className="actions" style={{ marginTop: 14 }}>{plan.status === 'closed' && <button className="btn" type="button" onClick={() => navigate('/journal')}><Icon name="book" />Xem Journal</button>}<button className="btn" type="button" onClick={() => startNew(plan.symbol)}>Lập lại kế hoạch {plan.symbol}</button></div>
        </>}
      </section>
      <div className="grid" style={{ alignContent: 'start' }}>
        <section className="card"><div className="card-h"><h2>Snapshot lúc lập</h2><span className="tag">chỉ đọc</span></div>
          {plan ? <dl className="kv"><dt>Giá thị trường</dt><dd className="num">{snapshot.market_price == null ? '—' : money.format(snapshot.market_price)}</dd><dt>Ngày giá</dt><dd className="num">{snapshot.price_date ?? '—'}</dd><dt>Nguồn</dt><dd>{snapshot.price_source === 'ssi' ? 'SSI' : snapshot.price_source ?? '—'}</dd><dt>Dự báo T+2 / T+5</dt><dd className="muted">Chưa khả dụng</dd><dt>Lập lúc</dt><dd className="num">{dateTime.format(new Date(plan.created_at))}</dd></dl>
            : <p className="small muted">Khi tạo kế hoạch, giá đóng cửa gần nhất được lưu lại làm snapshot. Snapshot dự báo sẽ có khi mô hình AI sẵn sàng.</p>}
        </section>
        <section className="card"><div className="card-h"><h2>Lịch sử chỉnh sửa</h2></div>
          {plan ? <>
            <div style={{ display: 'flex', gap: 10, fontSize: 13, padding: '5px 0' }}><span className="num muted" style={{ width: 84, flex: 'none' }}>{dateTime.format(new Date(plan.created_at))}</span><span>Tạo kế hoạch</span></div>
            {[...(plan.revisions ?? [])].reverse().map((revision) => <div key={revision.id} style={{ display: 'flex', gap: 10, fontSize: 13, padding: '5px 0' }}><span className="num muted" style={{ width: 84, flex: 'none' }}>{dateTime.format(new Date(revision.created_at))}</span>
              <span>Sửa {Object.entries(revision.changes).map(([key, value]) => `${FIELD_LABELS[key] ?? key} ${revision.previous?.[key] ?? '—'} → ${value ?? '—'}`).join('; ')}</span></div>)}
            {plan.closed_at && <div style={{ display: 'flex', gap: 10, fontSize: 13, padding: '5px 0' }}><span className="num muted" style={{ width: 84, flex: 'none' }}>{dateTime.format(new Date(plan.closed_at))}</span><span>Đóng kế hoạch · {CLOSE_REASONS[plan.close_reason] ?? ''}</span></div>}
          </> : <p className="small muted">Chưa có.</p>}
        </section>
        <Disclaimer>Trade Plan do bạn tự lập. Hệ thống không điền sẵn giá vào, cắt lỗ, mục tiêu và không khuyến nghị giao dịch. Bạn nhận cảnh báo khi giá chạm vùng vào, cắt lỗ hoặc mục tiêu.</Disclaimer>
      </div>
    </div>

    {closing && plan && <Modal title={`Đóng kế hoạch ${plan.symbol}`} onClose={() => setClosing(null)}>
      <form onSubmit={submitClose} style={{ display: 'grid', gap: 12 }}>
        <div className="frow">
          <div className="field"><label htmlFor="c-r">Lý do đóng</label><select id="c-r" value={closing.reason} onChange={(e) => setClosing({ ...closing, reason: e.target.value, exit_price: closing.exit_price || (e.target.value === 'target_hit' ? String(plan.target_price) : e.target.value === 'stop_hit' ? String(plan.stop_price) : '') })}>{['target_hit', 'stop_hit', 'expired', 'manual'].map((reason) => <option key={reason} value={reason}>{CLOSE_REASONS[reason]}</option>)}</select></div>
          <div className="field"><label htmlFor="c-x">Giá thoát</label><input id="c-x" type="number" required min="0.0001" step="0.0001" value={closing.exit_price} onChange={(e) => setClosing({ ...closing, exit_price: e.target.value })} /></div>
        </div>
        <div className="field"><label htmlFor="c-n">Ghi chú</label><textarea id="c-n" maxLength="1000" value={closing.note} onChange={(e) => setClosing({ ...closing, note: e.target.value })} /></div>
        <div className="small muted">Một bản ghi Journal sẽ được tạo kèm kế hoạch gốc, lịch sử chỉnh sửa và snapshot lúc lập.</div>
        <div className="actions"><button className="btn pri" type="submit" disabled={busy}>Đóng và ghi Journal</button><button className="btn" type="button" onClick={() => setClosing(null)}>Hủy</button></div>
      </form>
    </Modal>}
  </main>;
}

function CalcBox({ calc, edge, canQuantity }) {
  return <div className="grid g4">
    <div className="stat"><div className="k">Giá vào tham chiếu</div><div className="v num" style={{ fontSize: 18 }}>{edge ? money.format(edge) : '—'}</div><div className="s muted">cạnh bất lợi của vùng vào</div></div>
    <div className="stat"><div className="k">R:R</div><div className="v num" style={{ fontSize: 18 }}>{calc ? decimal.format(calc.rr_ratio) : '—'}</div><div className="s muted">(MT − vào) / (vào − CL)</div></div>
    <div className="stat"><div className="k">Khoảng cách</div><div className="v num" style={{ fontSize: 15 }}>{calc ? <><span className="c-down">−{decimal.format(calc.risk_pct_distance)}%</span> / <span className="c-up">+{decimal.format(calc.reward_pct_distance)}%</span></> : '—'}</div><div className="s muted">tới cắt lỗ / mục tiêu</div></div>
    {canQuantity ? <div className="stat"><div className="k">Khối lượng tối đa</div><div className="v num" style={{ fontSize: 18 }}>{calc?.max_quantity != null ? money.format(calc.max_quantity) : '—'}</div><div className="s muted">cp, làm tròn lô 100</div></div>
      : <div className="stat"><div className="k">Khối lượng tối đa</div><div className="s muted" style={{ marginTop: 6 }}>Dành cho Trader, Analyst</div></div>}
  </div>;
}
