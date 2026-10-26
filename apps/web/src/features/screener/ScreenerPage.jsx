import { useEffect, useState } from 'react';
import { api } from '../../api/index.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { hasCapability } from '@stocksense/core/access';
import { navigate } from '../../app/navigation.js';
import { Disclaimer } from '../../app/icons.jsx';

const money = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const initialFilters = { exchange: '', industry: '', minPrice: '', maxPrice: '', minChange: '', maxChange: '', minTurnover: '', sort: 'turnover', direction: 'desc' };
// FR-M8-03: ready-made filters. They use price and liquidity only until forecasts come from a real model.
const PRESETS = [
  ['Thanh khoản cao', { minTurnover: '100000000000', sort: 'turnover', direction: 'desc' }],
  ['Tăng mạnh phiên gần nhất', { minChange: '2', sort: 'changePercent', direction: 'desc' }],
  ['Giảm mạnh phiên gần nhất', { maxChange: '-2', sort: 'changePercent', direction: 'asc' }],
  ['HOSE giá dưới 30.000', { exchange: 'HOSE', maxPrice: '30000', sort: 'price', direction: 'asc' }],
];
const SORT_LABELS = { turnover: 'Thanh khoản', changePercent: '% thay đổi', price: 'Giá', symbol: 'Mã' };
const formatChange = (value) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(2).replace('.', ',')}%`;
const changeClass = (value) => (value > 0 ? 'c-up' : value < 0 ? 'c-down' : 'c-hold');

export function ScreenerPage() {
  const { user } = useAuth();
  const canSave = hasCapability(user.role, 'screener.saved.manage.self');
  const canWatch = hasCapability(user.role, 'watchlist.manage.self');
  const canPlan = hasCapability(user.role, 'plans.manage.self');
  const [filters, setFilters] = useState(initialFilters);
  const [preset, setPreset] = useState(null);
  const [items, setItems] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [watchlist, setWatchlist] = useState(new Set());
  const [saved, setSaved] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function run(nextFilters = filters) {
    setBusy(true); setError('');
    try { const result = await api.screener.run(nextFilters); setItems(result.items); }
    catch (requestError) { setError(requestError.message || 'Không tải được kết quả lọc.'); }
    finally { setBusy(false); setLoading(false); }
  }
  async function loadSaved() {
    if (!canSave) return;
    try { const result = await api.screener.saved(); setSaved(result.items); }
    catch (requestError) { setError(requestError.message || 'Không tải được bộ lọc đã lưu.'); }
  }
  useEffect(() => {
    run(initialFilters); loadSaved();
    api.market.industries().then((result) => setIndustries(result.items)).catch(() => {});
    if (canWatch) api.watchlist.list().then((result) => setWatchlist(new Set(result.items.map((item) => item.symbol)))).catch(() => {});
  }, [user.role]);

  function update(key, value) { setPreset(null); setFilters((current) => ({ ...current, [key]: value })); }
  function apply(next, presetIndex = null) { const merged = { ...initialFilters, ...next }; setPreset(presetIndex); setFilters(merged); setNotice(''); run(merged); }
  async function saveFilter(event) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setError(''); setNotice('');
    try { await api.screener.save({ name: name.trim(), filters }); setName(''); await loadSaved(); setNotice('Đã lưu bộ lọc cho tài khoản của bạn.'); }
    catch (requestError) { setError(requestError.message || 'Không lưu được bộ lọc.'); }
    finally { setBusy(false); }
  }
  async function deleteFilter(id) {
    setBusy(true); setError('');
    try { await api.screener.remove(id); await loadSaved(); }
    catch (requestError) { setError(requestError.message || 'Không xóa được bộ lọc.'); }
    finally { setBusy(false); }
  }
  // FR-M8-06: act on a result row without leaving the screener.
  async function addToWatchlist(symbol) {
    setError(''); setNotice('');
    try { await api.watchlist.add(symbol); setWatchlist((current) => new Set(current).add(symbol)); setNotice(`Đã thêm ${symbol} vào watchlist.`); }
    catch (requestError) { setError(requestError.message || 'Không thêm được vào watchlist.'); }
  }
  function sortBy(key) {
    const next = { ...filters, sort: key, direction: filters.sort === key && filters.direction === 'desc' ? 'asc' : 'desc' };
    setFilters(next); run(next);
  }
  const sortMark = (key) => (filters.sort === key ? (filters.direction === 'asc' ? ' ▲' : ' ▼') : '');

  return <main className="content">
    <div className="pagehead"><div><h1>Screener</h1><p>Lọc các mã theo sàn, ngành, giá và thanh khoản. Kết quả là danh sách sàng lọc, không phải bảng xếp hạng nên mua.</p></div></div>
    {error && <div className="note bad" role="alert">{error}</div>}
    {notice && <div className="note info" role="status">{notice}</div>}
    <section className="card">
      <div className="card-h"><h2>Bộ lọc có sẵn</h2>
        {canSave && <div className="actions" style={{ alignItems: 'center' }}><span className="small muted">Bộ lọc đã lưu:</span>
          {saved.map((item) => <span key={item.id} className="chip acc" style={{ gap: 6 }}><button type="button" className="chip-link" onClick={() => apply(item.filters)}>{item.name}</button><button type="button" className="chip-link" aria-label={`Xóa bộ lọc ${item.name}`} disabled={busy} onClick={() => deleteFilter(item.id)}>×</button></span>)}
          {!saved.length && <span className="small muted">chưa có</span>}<span className="tag num">{saved.length}/20</span></div>}
      </div>
      <div className="seg">{PRESETS.map(([label, preset_], index) => <button key={label} type="button" className={preset === index ? 'on' : ''} onClick={() => apply(preset_, index)}>{label}</button>)}</div>
      <form onSubmit={(event) => { event.preventDefault(); setPreset(null); run(); }}>
        <div className="frow" style={{ marginTop: 14 }}>
          <div className="field"><label htmlFor="sc-e">Sàn</label><select id="sc-e" value={filters.exchange} onChange={(event) => update('exchange', event.target.value)}><option value="">Tất cả</option><option>HOSE</option><option>HNX</option><option>UPCOM</option></select></div>
          <div className="field"><label htmlFor="sc-i">Ngành</label><select id="sc-i" value={filters.industry} onChange={(event) => update('industry', event.target.value)}><option value="">Tất cả</option>{industries.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="field"><label htmlFor="sc-p1">Giá từ</label><input id="sc-p1" type="number" min="0" value={filters.minPrice} onChange={(event) => update('minPrice', event.target.value)} /><span className="hint">đồng</span></div>
          <div className="field"><label htmlFor="sc-p2">Giá đến</label><input id="sc-p2" type="number" min="0" value={filters.maxPrice} onChange={(event) => update('maxPrice', event.target.value)} /><span className="hint">đồng</span></div>
          <div className="field"><label htmlFor="sc-c1">% thay đổi từ</label><input id="sc-c1" type="number" step="0.01" value={filters.minChange} onChange={(event) => update('minChange', event.target.value)} /></div>
          <div className="field"><label htmlFor="sc-c2">% thay đổi đến</label><input id="sc-c2" type="number" step="0.01" value={filters.maxChange} onChange={(event) => update('maxChange', event.target.value)} /></div>
          <div className="field"><label htmlFor="sc-v">GTGD TB20 tối thiểu</label><input id="sc-v" type="number" min="0" value={filters.minTurnover} onChange={(event) => update('minTurnover', event.target.value)} /><span className="hint">đồng</span></div>
          <div className="field"><label htmlFor="sc-s">Sắp xếp</label><select id="sc-s" value={`${filters.sort}:${filters.direction}`} onChange={(event) => { const [sort, direction] = event.target.value.split(':'); setFilters({ ...filters, sort, direction }); }}>
            {Object.entries(SORT_LABELS).flatMap(([key, label]) => [<option key={`${key}d`} value={`${key}:desc`}>{label} giảm dần</option>, <option key={`${key}a`} value={`${key}:asc`}>{label} tăng dần</option>])}</select></div>
        </div>
        <div className="actions" style={{ marginTop: 12 }}>
          <button className="btn pri" type="submit" disabled={busy}>{busy ? 'Đang lọc…' : 'Lọc'}</button>
          <button className="btn" type="button" disabled={busy} onClick={() => apply({})}>Xóa điều kiện</button>
          {!canSave && <span className="small muted">Lưu bộ lọc dành cho Trader, Analyst.</span>}
        </div>
      </form>
      {canSave && <form className="actions" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--line)', alignItems: 'end' }} onSubmit={saveFilter}>
        <div className="field" style={{ flex: '1 1 220px' }}><label htmlFor="sc-name">Lưu điều kiện hiện tại thành bộ lọc</label><input id="sc-name" maxLength="80" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Ngân hàng thanh khoản cao" /></div>
        <button className="btn" type="submit" disabled={busy || !name.trim()}>Lưu bộ lọc</button>
      </form>}
    </section>
    <section className="card"><div className="card-h"><h2>Kết quả <span className="tag">{items.length} mã</span></h2><span className="small muted">{loading ? 'Đang tải…' : 'Bấm tiêu đề cột để sắp xếp'}</span></div>
      <div className="tw"><table><thead><tr>
        <th><button type="button" className="sort-button" onClick={() => sortBy('symbol')}>Mã{sortMark('symbol')}</button></th><th className="hide-sm">Ngành</th>
        <th className="r"><button type="button" className="sort-button" onClick={() => sortBy('price')}>Giá{sortMark('price')}</button></th>
        <th className="r"><button type="button" className="sort-button" onClick={() => sortBy('changePercent')}>%{sortMark('changePercent')}</button></th>
        <th className="r hide-sm"><button type="button" className="sort-button" onClick={() => sortBy('turnover')}>GTGD TB20 (tỷ){sortMark('turnover')}</button></th>
        <th className="hide-sm">Dữ liệu</th><th /></tr></thead>
        <tbody>{items.map((item) => <tr key={item.symbol}>
          <td className="sym" style={{ cursor: 'pointer' }} onClick={() => navigate(`/symbols/${item.symbol}`)}>{item.symbol}<small>{item.exchange}</small></td>
          <td className="hide-sm muted">{item.industry ?? '—'}</td>
          <td className="r num">{money.format(item.closePrice)}</td>
          <td className={`r num ${changeClass(item.changePercent)}`}>{formatChange(item.changePercent)}</td>
          <td className="r num hide-sm">{number.format(item.averageTurnover20d / 1e9)}</td>
          <td className="hide-sm">{item.priceDataStatus === 'live' ? <span className="chip up">SSI {item.priceDate ? new Date(`${item.priceDate}T00:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : ''}</span> : <span className="chip hold">Minh họa</span>}</td>
          <td><div className="actions">
            {canWatch && <button className="btn sm" type="button" disabled={watchlist.has(item.symbol)} onClick={() => addToWatchlist(item.symbol)}>{watchlist.has(item.symbol) ? '★ Đang theo dõi' : '+ Watchlist'}</button>}
            {canPlan && <button className="btn sm" type="button" onClick={() => navigate(`/plans?symbol=${encodeURIComponent(item.symbol)}`)}>Lập kế hoạch</button>}
          </div></td></tr>)}
        {!items.length && !loading && <tr><td colSpan="7" className="muted">Không có mã khớp bộ lọc.</td></tr>}</tbody></table></div>
    </section>
    <Disclaimer>Danh sách sàng lọc theo tiêu chí bạn chọn, không phải xếp hạng nên mua và không phải khuyến nghị đầu tư. Điều kiện theo nhãn và xác suất dự báo sẽ có khi mô hình AI sẵn sàng.</Disclaimer>
  </main>;
}
