import { useEffect, useState } from 'react';
import { api } from '../../api/index.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { hasCapability } from '@stocksense/core/access';
import { PriceChart } from '../symbol-detail/PriceChart.jsx';

const money = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const quantityFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 });
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const blankTransaction = { symbol: '', side: 'buy', quantity: '', unit_price: '', fee: '0', executed_at: today, note: '' };
const columns = ['symbol', 'side', 'quantity', 'unit_price', 'executed_at', 'fee', 'note'];
const CLEAR_PHRASE = 'XOA TOAN BO';

// Parses the CSV and keeps every data row with its file line number; row-level problems are
// reported by the server so valid rows can still be imported (FR-M9-02).
function parseCsv(source) {
  const text = source.replace(/^\uFEFF/, '');
  const rows = []; let row = []; let cell = ''; let quoted = false; let line = 1; let rowLine = 1;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); if (row.some((value) => value.trim())) rows.push({ line: rowLine, values: row });
      row = []; cell = ''; line += 1; rowLine = line;
    } else cell += char;
  }
  if (quoted) throw new Error('File CSV có trường chứa dấu ngoặc kép chưa đóng.');
  row.push(cell); if (row.some((value) => value.trim())) rows.push({ line: rowLine, values: row });
  if (rows.length < 2) throw new Error('File CSV cần có dòng tiêu đề và ít nhất một giao dịch.');
  const headers = rows.shift().values.map((value) => value.trim().toLowerCase());
  if (columns.slice(0, 5).some((key) => !headers.includes(key))) throw new Error(`Dòng tiêu đề CSV phải bao gồm: ${columns.slice(0, 5).join(', ')}.`);
  if (rows.length > 500) throw new Error('File CSV nhập vào chỉ được tối đa 500 dòng.');
  return rows.map(({ line: fileLine, values }) => {
    const item = Object.fromEntries(headers.map((header, column) => [header, values[column]?.trim() ?? '']));
    const side = ({ mua: 'buy', bán: 'sell', ban: 'sell', buy: 'buy', sell: 'sell' })[item.side?.toLowerCase()] ?? item.side;
    return { line: fileLine, symbol: item.symbol?.toUpperCase(), side, quantity: Number(item.quantity), unit_price: Number(item.unit_price),
      fee: Number(item.fee || 0), executed_at: item.executed_at, note: item.note ?? '' };
  });
}

export function PortfolioPage() {
  const { user } = useAuth();
  const canImport = hasCapability(user.role, 'portfolio.import.self');
  const [data, setData] = useState(null);
  const [form, setForm] = useState(blankTransaction);
  const [editingId, setEditingId] = useState(null);
  const [preview, setPreview] = useState([]);
  const [importResult, setImportResult] = useState(null);
  const [clearPhrase, setClearPhrase] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    const result = await api.portfolio.snapshot();
    setData(result);
  }
  useEffect(() => {
    refresh().catch((requestError) => setError(requestError.message || 'Không tải được danh mục.'))
      .finally(() => setLoading(false));
  }, []);

  async function submitTransaction(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    const payload = { ...form, symbol: form.symbol.trim().toUpperCase(), quantity: Number(form.quantity), unit_price: Number(form.unit_price), fee: Number(form.fee || 0) };
    try {
      if (editingId) await api.portfolio.update(editingId, payload); else await api.portfolio.add(payload);
      await refresh(); setForm({ ...blankTransaction, executed_at: today });
      setNotice(editingId ? 'Đã cập nhật giao dịch.' : 'Đã ghi giao dịch vào sổ danh mục.');
      setEditingId(null);
    } catch (requestError) { setError(requestError.message || 'Không lưu được giao dịch.'); }
    finally { setBusy(false); }
  }
  function startEdit(item) {
    setEditingId(item.id);
    setForm({ symbol: item.symbol, side: item.side, quantity: String(item.quantity), unit_price: String(item.unit_price), fee: String(item.fee), executed_at: item.executed_at, note: item.note ?? '' });
    setNotice(''); setError('');
    document.getElementById('portfolio-transaction-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function cancelEdit() { setEditingId(null); setForm({ ...blankTransaction, executed_at: today }); }
  function prepareCsv(event) {
    const file = event.target.files?.[0];
    setImportResult(null);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? '');
      try { const parsed = parseCsv(content); setPreview(parsed); setError(''); }
      catch (parseError) { setPreview([]); setError(parseError.message); }
    };
    reader.onerror = () => setError('Không đọc được file CSV.');
    reader.readAsText(file, 'UTF-8');
  }
  async function importCsv() {
    if (!preview.length) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await api.portfolio.importMany(preview);
      setImportResult(result); setPreview([]); await refresh();
      setNotice(`Đã nhập ${result.imported}/${result.imported + result.skipped.length} dòng.`);
    } catch (requestError) { setError(requestError.message || 'Không nhập được file CSV.'); }
    finally { setBusy(false); }
  }
  async function removeTransaction(id) {
    setBusy(true); setError(''); setNotice('');
    try { await api.portfolio.remove(id); await refresh(); setNotice('Đã xóa giao dịch.'); if (editingId === id) cancelEdit(); }
    catch (requestError) { setError(requestError.message || 'Không xóa được giao dịch.'); }
    finally { setBusy(false); }
  }
  async function clearPortfolio(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { const result = await api.portfolio.clear(clearPhrase); await refresh(); setClearPhrase(''); cancelEdit(); setNotice(`Đã xóa toàn bộ ${result.removed} giao dịch.`); }
    catch (requestError) { setError(requestError.message || 'Không xóa được danh mục.'); }
    finally { setBusy(false); }
  }

  if (loading) return <section className="content"><div className="card loading-card">Đang tải danh mục…</div></section>;
  const summary = data?.summary ?? { market_value: 0, cost_basis: 0, realized_pnl: 0, unrealized_pnl: 0 };
  const allocation = data?.allocation ?? { by_symbol: [], by_industry: [] };
  const history = (data?.history ?? []).map((item) => ({ date: item.date, close: item.market_value }));
  return <section className="content portfolio-page">
    <header className="pagehead"><div><span className="eyebrow">DANH MỤC CỦA BẠN</span><h1>Danh mục đầu tư</h1><p>Vị thế được tính từ lịch sử mua/bán. Lãi lỗ chưa thực hiện chỉ có khi có giá thị trường.</p></div><div className="pagehead-actions"><span className="chip acc">{data?.positions.length ?? 0} vị thế</span><button className="btn sm" type="button" onClick={() => api.reports.portfolio().catch((e) => setError(e.message))}>Xuất PDF</button></div></header>
    {error && <div className="note bad" role="alert">{error}</div>}{notice && <div className="note info" role="status">{notice}</div>}
    <div className="portfolio-summary">
      <article className="card"><span className="small muted">Giá trị thị trường</span><b>{summary.market_value == null ? '—' : `${money.format(summary.market_value)} ₫`}</b></article>
      <article className="card"><span className="small muted">Giá vốn hiện tại</span><b>{money.format(summary.cost_basis)} ₫</b></article>
      <article className="card"><span className="small muted">Lãi/lỗ chưa thực hiện</span><b className={summary.unrealized_pnl == null ? '' : summary.unrealized_pnl >= 0 ? 'positive' : 'negative'}>{summary.unrealized_pnl == null ? '—' : `${money.format(summary.unrealized_pnl)} ₫`}</b></article>
      <article className="card"><span className="small muted">Lãi/lỗ đã thực hiện</span><b className={summary.realized_pnl >= 0 ? 'positive' : 'negative'}>{money.format(summary.realized_pnl)} ₫</b></article>
    </div>
    <section className="card"><div className="card-h"><div><h2>Vị thế hiện tại</h2><p className="small muted">Giá vốn bình quân có tính phí mua; phí bán được trừ vào lãi/lỗ đã thực hiện. Tỷ trọng tính theo giá trị thị trường.</p></div></div>
      <div className="tw"><table className="portfolio-table"><thead><tr><th>Mã</th><th>Ngành</th><th className="r">Số lượng</th><th className="r">Giá vốn TB</th><th className="r">Giá hiện tại</th><th className="r">Giá trị</th><th className="r">Tỷ trọng</th><th className="r">Lãi/lỗ chưa thực hiện</th></tr></thead><tbody>
        {data?.positions.map((item) => <tr key={item.symbol}><td><b>{item.symbol}</b></td><td className="small">{item.industry ?? '—'}</td><td className="r num">{quantityFormat.format(item.quantity)}</td><td className="r num">{money.format(item.average_cost)} ₫</td><td className="r num">{item.market_price == null ? '—' : `${money.format(item.market_price)} ₫`}</td><td className="r num">{item.market_value == null ? '—' : `${money.format(item.market_value)} ₫`}</td><td className="r num">{item.weight_pct == null ? '—' : `${item.weight_pct}%`}</td><td className={`r num ${item.unrealized_pnl >= 0 ? 'positive' : 'negative'}`}>{item.unrealized_pnl == null ? '—' : `${money.format(item.unrealized_pnl)} ₫`}</td></tr>)}
        {!data?.positions.length && <tr><td colSpan="8" className="empty-row">Chưa có vị thế. Ghi giao dịch mua đầu tiên để bắt đầu.</td></tr>}
      </tbody></table></div>
    </section>
    {data?.positions.length > 0 && <div className="portfolio-insights">
      <section className="card"><div className="card-h"><div><h2>Phân bổ theo ngành</h2><p className="small muted">Tỷ trọng giá trị nắm giữ.</p></div></div>
        <div className="allocation-list">{allocation.by_industry.map((item) => <div className="allocation-row" key={item.industry}><span>{item.industry}</span><div className="prob-track"><i className="prob-fill up" style={{ width: `${item.weight_pct}%` }} /></div><b>{item.weight_pct}%</b></div>)}</div>
      </section>
      <section className="card"><div className="card-h"><div><h2>Phân bổ theo mã</h2><p className="small muted">Tỷ trọng từng vị thế.</p></div></div>
        <div className="allocation-list">{allocation.by_symbol.map((item) => <div className="allocation-row" key={item.symbol}><span>{item.symbol}</span><div className="prob-track"><i className="prob-fill hold" style={{ width: `${item.weight_pct}%` }} /></div><b>{item.weight_pct}%</b></div>)}</div>
      </section>
    </div>}
    {history.length > 1 && <section className="card"><div className="card-h"><div><h2>Giá trị danh mục theo thời gian</h2><p className="small muted">Giá trị cuối ngày của các mã đang nắm giữ, tối đa 180 ngày gần nhất.</p></div></div><PriceChart items={history} /></section>}
    <section className="card" id="portfolio-transaction-form"><div className="card-h"><div><h2>{editingId ? 'Sửa giao dịch' : 'Ghi giao dịch'}</h2><p className="small muted">Bán vượt số lượng đang nắm giữ sẽ bị từ chối.</p></div></div>
      <form className="portfolio-tx-form" onSubmit={submitTransaction}>
        <label className="field"><span>Mã cổ phiếu</span><input required maxLength="12" pattern="[A-Za-z0-9.-]+" value={form.symbol} onChange={(event) => setForm({ ...form, symbol: event.target.value.toUpperCase() })} placeholder="FPT" /></label>
        <label className="field"><span>Loại</span><select value={form.side} onChange={(event) => setForm({ ...form, side: event.target.value })}><option value="buy">Mua</option><option value="sell">Bán</option></select></label>
        <label className="field"><span>Số lượng</span><input required type="number" min="0.0001" step="0.0001" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label>
        <label className="field"><span>Giá mỗi cổ phiếu (VND)</span><input required type="number" min="0.0001" step="0.0001" value={form.unit_price} onChange={(event) => setForm({ ...form, unit_price: event.target.value })} /></label>
        <label className="field"><span>Phí (VND)</span><input type="number" min="0" step="1" value={form.fee} onChange={(event) => setForm({ ...form, fee: event.target.value })} /></label>
        <label className="field"><span>Ngày giao dịch</span><input required type="date" value={form.executed_at} onChange={(event) => setForm({ ...form, executed_at: event.target.value })} /></label>
        <label className="field portfolio-note"><span>Ghi chú</span><input maxLength="500" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label>
        <div className="watchlist-actions"><button className="btn pri" type="submit" disabled={busy}>{editingId ? 'Lưu thay đổi' : 'Ghi giao dịch'}</button>{editingId && <button className="btn" type="button" disabled={busy} onClick={cancelEdit}>Hủy sửa</button>}</div>
      </form>
    </section>
    {canImport && <section className="card"><div className="card-h"><div><h2>Nhập giao dịch CSV</h2><p className="small muted">UTF-8, tối đa 500 dòng; header: symbol, side, quantity, unit_price, executed_at, fee, note. side nhận buy/sell hoặc mua/bán. Dòng lỗi hoặc trùng giao dịch đã có sẽ được bỏ qua và báo lại.</p></div></div>
      <div className="portfolio-import"><label className="field"><span>Chọn file CSV</span><input type="file" accept=".csv,text/csv" onChange={prepareCsv} /></label><a className="text-button" href={`data:text/csv;charset=utf-8,${encodeURIComponent('symbol,side,quantity,unit_price,executed_at,fee,note\nFPT,buy,10,100000,2026-10-01,1000,Example')}`} download="portfolio-template.csv">Tải mẫu CSV</a></div>
      {preview.length > 0 && <><p className="small muted">Xem trước {preview.length} dòng (hiển thị 5 dòng đầu). Hệ thống kiểm tra từng dòng khi nhập.</p><div className="tw"><table className="portfolio-table"><thead><tr><th>Dòng</th><th>Ngày</th><th>Mã</th><th>Loại</th><th>Số lượng</th><th>Giá</th></tr></thead><tbody>{preview.slice(0, 5).map((item) => <tr key={item.line}><td>{item.line}</td><td>{item.executed_at}</td><td>{item.symbol}</td><td>{item.side === 'buy' ? 'Mua' : item.side === 'sell' ? 'Bán' : item.side}</td><td>{Number.isFinite(item.quantity) ? quantityFormat.format(item.quantity) : '—'}</td><td>{Number.isFinite(item.unit_price) ? `${money.format(item.unit_price)} ₫` : '—'}</td></tr>)}</tbody></table></div><button className="btn pri" type="button" disabled={busy} onClick={importCsv}>{busy ? 'Đang nhập…' : `Nhập ${preview.length} dòng`}</button></>}
      {importResult && <div className={`note ${importResult.skipped.length ? 'warn' : 'info'}`} role="status"><strong>Kết quả nhập:</strong> {importResult.imported} dòng đã nhập, {importResult.skipped.length} dòng bị bỏ qua.
        {importResult.skipped.length > 0 && <ul className="import-skipped">{importResult.skipped.map((item) => <li key={`${item.line}-${item.reason}`}>Dòng {item.line}: {item.reason}</li>)}</ul>}</div>}
    </section>}
    <section className="card"><div className="card-h"><div><h2>Lịch sử giao dịch</h2><p className="small muted">Sắp xếp theo ngày gần nhất. Sửa hoặc xóa có thể bị từ chối nếu làm phát sinh vị thế âm.</p></div></div>
      <div className="tw"><table className="portfolio-table"><thead><tr><th>Ngày</th><th>Mã</th><th>Loại</th><th className="r">Số lượng</th><th className="r">Giá</th><th className="r">Phí</th><th>Ghi chú</th><th /></tr></thead><tbody>
        {data?.transactions.map((item) => <tr key={item.id} className={editingId === item.id ? 'editing-row' : ''}><td>{item.executed_at}</td><td><b>{item.symbol}</b></td><td><span className={`chip ${item.side === 'buy' ? 'up' : 'down'}`}>{item.side === 'buy' ? 'Mua' : 'Bán'}</span></td><td className="r num">{quantityFormat.format(item.quantity)}</td><td className="r num">{money.format(item.unit_price)} ₫</td><td className="r num">{money.format(item.fee)} ₫</td><td>{item.note || '—'}</td><td><div className="watchlist-actions"><button className="btn sm" type="button" disabled={busy} onClick={() => startEdit(item)}>Sửa</button><button className="btn sm danger" type="button" disabled={busy} onClick={() => removeTransaction(item.id)}>Xóa</button></div></td></tr>)}
        {!data?.transactions.length && <tr><td colSpan="8" className="empty-row">Chưa có giao dịch nào.</td></tr>}
      </tbody></table></div>
    </section>
    {data?.transactions.length > 0 && <section className="card danger-zone"><div className="card-h"><div><h2>Xóa toàn bộ danh mục</h2><p className="small muted">Xóa vĩnh viễn mọi giao dịch trong danh mục của bạn. Không thể hoàn tác.</p></div></div>
      <form className="watchlist-add-form" onSubmit={clearPortfolio}><label className="field"><span>Nhập “{CLEAR_PHRASE}” để xác nhận</span><input value={clearPhrase} onChange={(event) => setClearPhrase(event.target.value)} autoComplete="off" /></label><button className="btn danger" type="submit" disabled={busy || clearPhrase !== CLEAR_PHRASE}>Xóa toàn bộ</button></form>
    </section>}
  </section>;
}
