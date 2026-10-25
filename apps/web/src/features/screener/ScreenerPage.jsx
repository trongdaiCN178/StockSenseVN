import { useEffect, useState } from 'react';
import { api } from '../../api/index.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { hasCapability } from '@stocksense/core/access';
import { navigate } from '../../app/navigation.js';

const currency = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2, signDisplay: 'always' });
const initialFilters = { exchange: '', minPrice: '', maxPrice: '', minChange: '', maxChange: '', minTurnover: '' };

export function ScreenerPage() {
  const { user } = useAuth();
  const canSave = hasCapability(user.role, 'screener.saved.manage.self');
  const [filters, setFilters] = useState(initialFilters);
  const [items, setItems] = useState([]);
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
  useEffect(() => { run(initialFilters); loadSaved(); }, [user.role]);

  function update(key, value) { setFilters((current) => ({ ...current, [key]: value })); }
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

  return <section className="content screener-page">
    <header className="pagehead"><div><span className="eyebrow">CÔNG CỤ LỌC CỔ PHIẾU</span><h1>Bộ lọc cổ phiếu</h1><p>Lọc theo dữ liệu giá và thanh khoản đã có. Kết quả không phụ thuộc dự báo AI.</p></div><span className="chip acc">{items.length} mã</span></header>
    {error && <div className="note bad" role="alert">{error}</div>}{notice && <div className="note info" role="status">{notice}</div>}
    <section className="card"><div className="card-h"><div><h2>Điều kiện lọc</h2><p className="small muted">Đơn vị giá VND; thanh khoản là giá trị giao dịch trung bình 20 phiên.</p></div></div>
      <form className="screener-form" onSubmit={(event) => { event.preventDefault(); run(); }}>
        <label className="field"><span>Sàn</span><select value={filters.exchange} onChange={(event) => update('exchange', event.target.value)}><option value="">Tất cả</option><option>HOSE</option><option>HNX</option><option>UPCOM</option></select></label>
        <label className="field"><span>Giá từ (VND)</span><input type="number" min="0" value={filters.minPrice} onChange={(event) => update('minPrice', event.target.value)} /></label>
        <label className="field"><span>Giá đến (VND)</span><input type="number" min="0" value={filters.maxPrice} onChange={(event) => update('maxPrice', event.target.value)} /></label>
        <label className="field"><span>Thay đổi từ (%)</span><input type="number" step="0.01" value={filters.minChange} onChange={(event) => update('minChange', event.target.value)} /></label>
        <label className="field"><span>Thay đổi đến (%)</span><input type="number" step="0.01" value={filters.maxChange} onChange={(event) => update('maxChange', event.target.value)} /></label>
        <label className="field"><span>Thanh khoản 20 phiên từ (VND)</span><input type="number" min="0" value={filters.minTurnover} onChange={(event) => update('minTurnover', event.target.value)} /></label>
        <div className="screener-actions"><button className="btn pri" disabled={busy} type="submit">{busy ? 'Đang lọc…' : 'Lọc cổ phiếu'}</button><button className="btn" disabled={busy} type="button" onClick={() => { setFilters(initialFilters); run(initialFilters); }}>Xóa điều kiện</button></div>
      </form>
      {canSave && <form className="screener-save-form" onSubmit={saveFilter}><label className="field"><span>Tên bộ lọc</span><input maxLength="80" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Thanh khoản cao HOSE" /></label><button className="btn" type="submit" disabled={busy || !name.trim()}>Lưu bộ lọc</button></form>}
    </section>
    {canSave && <section className="card"><div className="card-h"><div><h2>Bộ lọc đã lưu</h2><p className="small muted">Được lưu riêng theo tài khoản; tối đa 20 bộ lọc.</p></div></div><div className="saved-filter-list">{saved.map((item) => <div className="saved-filter-row" key={item.id}><button type="button" className="text-button" onClick={() => { setFilters({ ...initialFilters, ...item.filters }); run({ ...initialFilters, ...item.filters }); }}>{item.name}</button><button type="button" className="btn sm danger" disabled={busy} onClick={() => deleteFilter(item.id)}>Xóa</button></div>)}{!saved.length && <p className="empty-row">Chưa lưu bộ lọc nào.</p>}</div></section>}
    <section className="card"><div className="card-h"><div><h2>Kết quả</h2><p className="small muted">{loading ? 'Đang tải dữ liệu…' : `${items.length} mã phù hợp`}</p></div></div><div className="tw"><table className="screener-table"><thead><tr><th>Mã</th><th>Sàn</th><th className="r">Giá</th><th className="r">Thay đổi</th><th className="r">Thanh khoản TB 20 phiên</th><th /></tr></thead><tbody>
      {items.map((item) => <tr key={item.symbol}><td><b>{item.symbol}</b><small className="company-name">{item.name}</small></td><td>{item.exchange}</td><td className="r num">{currency.format(item.closePrice)} ₫</td><td className={`r num ${item.changePercent > 0 ? 'positive' : item.changePercent < 0 ? 'negative' : ''}`}>{percent.format(item.changePercent)}%</td><td className="r num">{currency.format(item.averageTurnover20d)} ₫</td><td><button className="btn sm" type="button" onClick={() => navigate(`/symbols/${item.symbol}`)}>Chi tiết</button></td></tr>)}
      {!items.length && !loading && <tr><td colSpan="6" className="empty-row">Không có mã phù hợp với điều kiện hiện tại.</td></tr>}
    </tbody></table></div></section>
  </section>;
}
