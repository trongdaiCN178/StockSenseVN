import { useEffect, useState } from 'react';
import { api } from '../../api/index.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { hasCapability } from '@stocksense/core/access';

const money = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const quantityFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 });
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const blankTransaction = { symbol: '', side: 'buy', quantity: '', unit_price: '', fee: '0', executed_at: today, note: '' };
const columns = ['symbol', 'side', 'quantity', 'unit_price', 'executed_at', 'fee', 'note'];

function parseCsv(source) {
  const text = source.replace(/^\uFEFF/, '');
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); if (row.some((value) => value.trim())) rows.push(row);
      row = []; cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('File CSV có trường chứa dấu ngoặc kép chưa đóng.');
  row.push(cell); if (row.some((value) => value.trim())) rows.push(row);
  if (rows.length < 2) throw new Error('File CSV cần có dòng tiêu đề và ít nhất một giao dịch.');
  const headers = rows.shift().map((value) => value.trim().toLowerCase());
  if (columns.slice(0, 5).some((key) => !headers.includes(key))) throw new Error(`Dòng tiêu đề CSV phải bao gồm: ${columns.slice(0, 5).join(', ')}.`);
  const records = rows.map((values, index) => {
    const item = Object.fromEntries(headers.map((header, column) => [header, values[column]?.trim() ?? '']));
    const side = ({ mua: 'buy', bán: 'sell', ban: 'sell', buy: 'buy', sell: 'sell' })[item.side?.toLowerCase()];
    const transaction = { ...item, side, symbol: item.symbol?.toUpperCase(), quantity: Number(item.quantity), unit_price: Number(item.unit_price), fee: Number(item.fee || 0) };
    if (!transaction.symbol || !transaction.side || !Number.isFinite(transaction.quantity) || transaction.quantity <= 0 || !Number.isFinite(transaction.unit_price) || transaction.unit_price <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(item.executed_at)) {
      throw new Error(`Giá trị giao dịch không hợp lệ tại dòng ${index + 2} của CSV.`);
    }
    return transaction;
  });
  if (records.length > 500) throw new Error('File CSV nhập vào chỉ được tối đa 500 dòng.');
  return records;
}

export function PortfolioPage() {
  const { user } = useAuth();
  const canImport = hasCapability(user.role, 'portfolio.import.self');
  const [data, setData] = useState(null);
  const [form, setForm] = useState(blankTransaction);
  const [preview, setPreview] = useState([]);
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
    try {
      await api.portfolio.add({ ...form, symbol: form.symbol.trim().toUpperCase(), quantity: Number(form.quantity), unit_price: Number(form.unit_price), fee: Number(form.fee || 0) });
      await refresh(); setForm({ ...blankTransaction, executed_at: today }); setNotice('Đã ghi giao dịch vào sổ danh mục.');
    } catch (requestError) { setError(requestError.message || 'Không lưu được giao dịch.'); }
    finally { setBusy(false); }
  }
  function prepareCsv(event) {
    const file = event.target.files?.[0];
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
    try { await api.portfolio.importMany(preview); await refresh(); setPreview([]); setNotice(`Đã nhập ${preview.length} giao dịch.`); }
    catch (requestError) { setError(requestError.message || 'Không nhập được file CSV. Không giao dịch nào được ghi nếu file có lỗi.'); }
    finally { setBusy(false); }
  }
  async function removeTransaction(id) {
    setBusy(true); setError(''); setNotice('');
    try { await api.portfolio.remove(id); await refresh(); setNotice('Đã xóa giao dịch.'); }
    catch (requestError) { setError(requestError.message || 'Không xóa được giao dịch.'); }
    finally { setBusy(false); }
  }

  if (loading) return <section className="content"><div className="card loading-card">Đang tải danh mục…</div></section>;
  const summary = data?.summary ?? { market_value: 0, cost_basis: 0, realized_pnl: 0, unrealized_pnl: 0 };
  return <section className="content portfolio-page">
    <header className="pagehead"><div><span className="eyebrow">DANH MỤC CỦA BẠN</span><h1>Danh mục đầu tư</h1><p>Vị thế được tính từ lịch sử mua/bán. Lãi lỗ chưa thực hiện chỉ có khi có giá thị trường.</p></div><div className="pagehead-actions"><span className="chip acc">{data?.positions.length ?? 0} vị thế</span><button className="btn sm" type="button" onClick={() => api.reports.portfolio().catch((e) => setError(e.message))}>Xuất PDF</button></div></header>
    {error && <div className="note bad" role="alert">{error}</div>}{notice && <div className="note info" role="status">{notice}</div>}
    <div className="portfolio-summary">
      <article className="card"><span className="small muted">Giá trị thị trường</span><b>{summary.market_value == null ? '—' : `${money.format(summary.market_value)} ₫`}</b></article>
      <article className="card"><span className="small muted">Giá vốn hiện tại</span><b>{money.format(summary.cost_basis)} ₫</b></article>
      <article className="card"><span className="small muted">Lãi/lỗ chưa thực hiện</span><b className={summary.unrealized_pnl == null ? '' : summary.unrealized_pnl >= 0 ? 'positive' : 'negative'}>{summary.unrealized_pnl == null ? '—' : `${money.format(summary.unrealized_pnl)} ₫`}</b></article>
      <article className="card"><span className="small muted">Lãi/lỗ đã thực hiện</span><b className={summary.realized_pnl >= 0 ? 'positive' : 'negative'}>{money.format(summary.realized_pnl)} ₫</b></article>
    </div>
    <section className="card"><div className="card-h"><div><h2>Vị thế hiện tại</h2><p className="small muted">Giá vốn bình quân có tính phí mua; phí bán được trừ vào lãi/lỗ đã thực hiện.</p></div></div>
      <div className="tw"><table className="portfolio-table"><thead><tr><th>Mã</th><th className="r">Số lượng</th><th className="r">Giá vốn TB</th><th className="r">Giá hiện tại</th><th className="r">Giá trị</th><th className="r">Lãi/lỗ chưa thực hiện</th></tr></thead><tbody>
        {data?.positions.map((item) => <tr key={item.symbol}><td><b>{item.symbol}</b></td><td className="r num">{quantityFormat.format(item.quantity)}</td><td className="r num">{money.format(item.average_cost)} ₫</td><td className="r num">{item.market_price == null ? '—' : `${money.format(item.market_price)} ₫`}</td><td className="r num">{item.market_value == null ? '—' : `${money.format(item.market_value)} ₫`}</td><td className={`r num ${item.unrealized_pnl >= 0 ? 'positive' : 'negative'}`}>{item.unrealized_pnl == null ? '—' : `${money.format(item.unrealized_pnl)} ₫`}</td></tr>)}
        {!data?.positions.length && <tr><td colSpan="6" className="empty-row">Chưa có vị thế. Ghi giao dịch mua đầu tiên để bắt đầu.</td></tr>}
      </tbody></table></div>
    </section>
    <section className="card"><div className="card-h"><div><h2>Ghi giao dịch</h2><p className="small muted">Bán vượt số lượng đang nắm giữ sẽ bị từ chối.</p></div></div>
      <form className="portfolio-tx-form" onSubmit={submitTransaction}>
        <label className="field"><span>Mã cổ phiếu</span><input required maxLength="12" pattern="[A-Za-z0-9.-]+" value={form.symbol} onChange={(event) => setForm({ ...form, symbol: event.target.value.toUpperCase() })} placeholder="FPT" /></label>
        <label className="field"><span>Loại</span><select value={form.side} onChange={(event) => setForm({ ...form, side: event.target.value })}><option value="buy">Mua</option><option value="sell">Bán</option></select></label>
        <label className="field"><span>Số lượng</span><input required type="number" min="0.0001" step="0.0001" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label>
        <label className="field"><span>Giá mỗi cổ phiếu (VND)</span><input required type="number" min="0.0001" step="0.0001" value={form.unit_price} onChange={(event) => setForm({ ...form, unit_price: event.target.value })} /></label>
        <label className="field"><span>Phí (VND)</span><input type="number" min="0" step="1" value={form.fee} onChange={(event) => setForm({ ...form, fee: event.target.value })} /></label>
        <label className="field"><span>Ngày giao dịch</span><input required type="date" value={form.executed_at} onChange={(event) => setForm({ ...form, executed_at: event.target.value })} /></label>
        <label className="field portfolio-note"><span>Ghi chú</span><input maxLength="500" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label>
        <button className="btn pri" type="submit" disabled={busy}>Ghi giao dịch</button>
      </form>
    </section>
    {canImport && <section className="card"><div className="card-h"><div><h2>Nhập giao dịch CSV</h2><p className="small muted">UTF-8, tối đa 500 dòng; header: symbol, side, quantity, unit_price, executed_at, fee, note. side nhận buy/sell hoặc mua/bán.</p></div></div>
      <div className="portfolio-import"><label className="field"><span>Chọn file CSV</span><input type="file" accept=".csv,text/csv" onChange={prepareCsv} /></label><a className="text-button" href={`data:text/csv;charset=utf-8,${encodeURIComponent('symbol,side,quantity,unit_price,executed_at,fee,note\nFPT,buy,10,100000,2026-10-01,1000,Example')}`} download="portfolio-template.csv">Tải mẫu CSV</a></div>
      {preview.length > 0 && <><p className="small muted">Xem trước {preview.length} giao dịch. Hiển thị 5 dòng đầu; file được ghi theo một giao dịch nguyên tử.</p><div className="tw"><table className="portfolio-table"><thead><tr><th>Ngày</th><th>Mã</th><th>Loại</th><th>Số lượng</th><th>Giá</th></tr></thead><tbody>{preview.slice(0, 5).map((item, index) => <tr key={`${item.symbol}-${index}`}><td>{item.executed_at}</td><td>{item.symbol}</td><td>{item.side === 'buy' ? 'Mua' : 'Bán'}</td><td>{quantityFormat.format(item.quantity)}</td><td>{money.format(item.unit_price)} ₫</td></tr>)}</tbody></table></div><button className="btn pri" type="button" disabled={busy} onClick={importCsv}>{busy ? 'Đang nhập…' : `Nhập ${preview.length} giao dịch`}</button></>}
    </section>}
    <section className="card"><div className="card-h"><div><h2>Lịch sử giao dịch</h2><p className="small muted">Sắp xếp theo ngày gần nhất. Xóa giao dịch có thể bị từ chối nếu làm phát sinh vị thế âm.</p></div></div>
      <div className="tw"><table className="portfolio-table"><thead><tr><th>Ngày</th><th>Mã</th><th>Loại</th><th className="r">Số lượng</th><th className="r">Giá</th><th className="r">Phí</th><th>Ghi chú</th><th /></tr></thead><tbody>
        {data?.transactions.map((item) => <tr key={item.id}><td>{item.executed_at}</td><td><b>{item.symbol}</b></td><td><span className={`chip ${item.side === 'buy' ? 'up' : 'down'}`}>{item.side === 'buy' ? 'Mua' : 'Bán'}</span></td><td className="r num">{quantityFormat.format(item.quantity)}</td><td className="r num">{money.format(item.unit_price)} ₫</td><td className="r num">{money.format(item.fee)} ₫</td><td>{item.note || '—'}</td><td><button className="btn sm danger" type="button" disabled={busy} onClick={() => removeTransaction(item.id)}>Xóa</button></td></tr>)}
        {!data?.transactions.length && <tr><td colSpan="8" className="empty-row">Chưa có giao dịch nào.</td></tr>}
      </tbody></table></div>
    </section>
  </section>;
}
