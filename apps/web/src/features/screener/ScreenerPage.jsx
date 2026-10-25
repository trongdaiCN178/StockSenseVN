import { useEffect, useState } from 'react';
import { api } from '../../api/index.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { hasCapability } from '@stocksense/core/access';
import { navigate } from '../../app/navigation.js';

const currency = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2, signDisplay: 'always' });
const initialFilters = { exchange: '', industry: '', minPrice: '', maxPrice: '', minChange: '', maxChange: '', minTurnover: '', sort: 'symbol', direction: 'asc' };
// FR-M8-03: ready-made filters for retail users. They only use price and liquidity until forecasts are available.
const PRESETS = [
  { name: 'Thanh khoản cao (≥ 100 tỷ/phiên)', filters: { minTurnover: '100000000000', sort: 'turnover', direction: 'desc' } },
  { name: 'Tăng mạnh phiên gần nhất (≥ 2%)', filters: { minChange: '2', sort: 'changePercent', direction: 'desc' } },
  { name: 'Giảm mạnh phiên gần nhất (≤ -2%)', filters: { maxChange: '-2', sort: 'changePercent', direction: 'asc' } },
  { name: 'Cổ phiếu HOSE giá dưới 30.000 ₫', filters: { exchange: 'HOSE', maxPrice: '30000', sort: 'price', direction: 'asc' } },
];
const SORT_LABELS = { symbol: 'Mã', price: 'Giá', changePercent: '% thay đổi', turnover: 'Thanh khoản' };

export function ScreenerPage() {
  const { user } = useAuth();
  const canSave = hasCapability(user.role, 'screener.saved.manage.self');
  const canWatch = hasCapability(user.role, 'watchlist.manage.self');
  const canPlan = hasCapability(user.role, 'plans.manage.self');
  const [filters, setFilters] = useState(initialFilters);
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
    setBusy(true); setError(''); setNotice('');
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

  function update(key, value) { setFilters((current) => ({ ...current, [key]: value })); }
  function apply(next) { const merged = { ...initialFilters, ...next }; setFilters(merged); run(merged); }
  function sortBy(key) {
    const next = { ...filters, sort: key, direction: filters.sort === key && filters.direction === 'asc' ? 'desc' : 'asc' };
    setFilters(next); run(next);
  }
  async function saveFilter(event) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api.screener.save({ name: name.trim(), filters });
      setName(''); await loadSaved(); setNotice('Đã lưu bộ lọc cho tài khoản của bạn.');
    } catch (requestError) { setError(requestError.message || 'Không lưu được bộ lọc.'); }
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
  const sortMark = (key) => (filters.sort === key ? (filters.direction === 'asc' ? ' ▲' : ' ▼') : '');

  return <section className="content screener-page">
    <header className="pagehead"><div><span className="eyebrow">CÔNG CỤ LỌC CỔ PHIẾU</span><h1>Bộ lọc cổ phiếu</h1><p>Lọc theo sàn, ngành, giá và thanh khoản. Điều kiện theo dự báo AI sẽ có khi mô hình sẵn sàng.</p></div><span className="chip acc">{items.length} mã</span></header>
    <div className="note warn"><strong>Lưu ý:</strong> kết quả là danh sách sàng lọc theo điều kiện bạn chọn, không phải xếp hạng “mã nên mua” và không phải khuyến nghị đầu tư.</div>
    {error && <div className="note bad" role="alert">{error}</div>}{notice && <div className="note info" role="status">{notice}</div>}
    <section className="card"><div className="card-h"><div><h2>Bộ lọc có sẵn</h2><p className="small muted">Chọn nhanh một điều kiện phổ biến.</p></div></div>
      <div className="preset-list">{PRESETS.map((preset) => <button key={preset.name} type="button" className="btn sm" disabled={busy} onClick={() => apply(preset.filters)}>{preset.name}</button>)}</div>
    </section>
    <section className="card"><div className="card-h"><div><h2>Điều kiện lọc</h2><p className="small muted">Đơn vị giá VND; thanh khoản là giá trị giao dịch trung bình 20 phiên.</p></div></div>
      <form className="screener-form" onSubmit={(event) => { event.preventDefault(); run(); }}>
        <label className="field"><span>Sàn</span><select value={filters.exchange} onChange={(event) => update('exchange', event.target.value)}><option value="">Tất cả</option><option>HOSE</option><option>HNX</option><option>UPCOM</option></select></label>
        <label className="field"><span>Ngành</span><select value={filters.industry} onChange={(event) => update('industry', event.target.value)}><option value="">Tất cả</option>{industries.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="field"><span>Giá từ (VND)</span><input type="number" min="0" value={filters.minPrice} onChange={(event) => update('minPrice', event.target.value)} /></label>
        <label className="field"><span>Giá đến (VND)</span><input type="number" min="0" value={filters.maxPrice} onChange={(event) => update('maxPrice', event.target.value)} /></label>
        <label className="field"><span>Thay đổi từ (%)</span><input type="number" step="0.01" value={filters.minChange} onChange={(event) => update('minChange', event.target.value)} /></label>
        <label className="field"><span>Thay đổi đến (%)</span><input type="number" step="0.01" value={filters.maxChange} onChange={(event) => update('maxChange', event.target.value)} /></label>
        <label className="field"><span>Thanh khoản 20 phiên từ (VND)</span><input type="number" min="0" value={filters.minTurnover} onChange={(event) => update('minTurnover', event.target.value)} /></label>
        <label className="field"><span>Sắp xếp theo</span><select value={filters.sort} onChange={(event) => update('sort', event.target.value)}>{Object.entries(SORT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="field"><span>Thứ tự</span><select value={filters.direction} onChange={(event) => update('direction', event.target.value)}><option value="asc">Tăng dần</option><option value="desc">Giảm dần</option></select></label>
        <div className="screener-actions"><button className="btn pri" disabled={busy} type="submit">{busy ? 'Đang lọc…' : 'Lọc cổ phiếu'}</button><button className="btn" disabled={busy} type="button" onClick={() => apply({})}>Xóa điều kiện</button></div>
      </form>
      {canSave && <form className="screener-save-form" onSubmit={saveFilter}><label className="field"><span>Tên bộ lọc</span><input maxLength="80" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Thanh khoản cao HOSE" /></label><button className="btn" type="submit" disabled={busy || !name.trim()}>Lưu bộ lọc</button></form>}
    </section>
    {canSave && <section className="card"><div className="card-h"><div><h2>Bộ lọc đã lưu</h2><p className="small muted">Được lưu riêng theo tài khoản; tối đa 20 bộ lọc.</p></div></div><div className="saved-filter-list">{saved.map((item) => <div className="saved-filter-row" key={item.id}><button type="button" className="text-button" onClick={() => apply(item.filters)}>{item.name}</button><button type="button" className="btn sm danger" disabled={busy} onClick={() => deleteFilter(item.id)}>Xóa</button></div>)}{!saved.length && <p className="empty-row">Chưa lưu bộ lọc nào.</p>}</div></section>}
    <section className="card"><div className="card-h"><div><h2>Kết quả</h2><p className="small muted">{loading ? 'Đang tải dữ liệu…' : `${items.length} mã phù hợp · bấm tiêu đề cột để sắp xếp`}</p></div></div><div className="tw"><table className="screener-table"><thead><tr>
      <th><button type="button" className="sort-button" onClick={() => sortBy('symbol')}>Mã{sortMark('symbol')}</button></th><th>Sàn</th><th>Ngành</th>
      <th className="r"><button type="button" className="sort-button" onClick={() => sortBy('price')}>Giá{sortMark('price')}</button></th>
      <th className="r"><button type="button" className="sort-button" onClick={() => sortBy('changePercent')}>Thay đổi{sortMark('changePercent')}</button></th>
      <th className="r"><button type="button" className="sort-button" onClick={() => sortBy('turnover')}>Thanh khoản TB 20 phiên{sortMark('turnover')}</button></th><th>Ngày dữ liệu</th><th /></tr></thead><tbody>
      {items.map((item) => <tr key={item.symbol}><td><b>{item.symbol}</b><small className="company-name">{item.name}</small></td><td>{item.exchange}</td><td className="small">{item.industry ?? '—'}</td><td className="r num">{currency.format(item.closePrice)} ₫</td><td className={`r num ${item.changePercent > 0 ? 'positive' : item.changePercent < 0 ? 'negative' : ''}`}>{percent.format(item.changePercent)}%</td><td className="r num">{currency.format(item.averageTurnover20d)} ₫</td><td className="small">{item.priceDate ?? '—'}</td>
        <td><div className="watchlist-actions">
          <button className="btn sm" type="button" onClick={() => navigate(`/symbols/${item.symbol}`)}>Chi tiết</button>
          {canWatch && <button className="btn sm" type="button" disabled={watchlist.has(item.symbol)} onClick={() => addToWatchlist(item.symbol)}>{watchlist.has(item.symbol) ? '★ Đang theo dõi' : '☆ Watchlist'}</button>}
          {canPlan && <button className="btn sm" type="button" onClick={() => navigate(`/plans?symbol=${encodeURIComponent(item.symbol)}`)}>Lập kế hoạch</button>}
        </div></td></tr>)}
      {!items.length && !loading && <tr><td colSpan="8" className="empty-row">Không có mã phù hợp với điều kiện hiện tại.</td></tr>}
    </tbody></table></div></section>
    <p className="disclaimer">StockSense VN là công cụ tham khảo và nghiên cứu, không phải dịch vụ tư vấn đầu tư.</p>
  </section>;
}
