import { useEffect, useState } from 'react';
import { api } from '../../api/index.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { hasCapability } from '@stocksense/core/access';
import { navigate } from '../../app/navigation.js';
import { Disclaimer, Icon } from '../../app/icons.jsx';
import { Modal } from '../../app/Modal.jsx';
import { PriceChart } from '../symbol-detail/PriceChart.jsx';

const money = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const quantityFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 4 });
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const blankTransaction = { symbol: '', side: 'buy', quantity: '', unit_price: '', fee: '0', executed_at: today, note: '' };
const columns = ['symbol', 'side', 'quantity', 'unit_price', 'executed_at', 'fee', 'note'];
const CLEAR_PHRASE = 'XOA TOAN BO';
const signed = (value) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${money.format(Math.abs(value))}`;
const changeClass = (value) => (value > 0 ? 'c-up' : value < 0 ? 'c-down' : 'c-hold');

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
  const [txForm, setTxForm] = useState(null);
  const [importState, setImportState] = useState(null);
  const [clearing, setClearing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() { setData(await api.portfolio.snapshot()); }
  useEffect(() => {
    refresh().catch((requestError) => setError(requestError.message || 'Không tải được danh mục.')).finally(() => setLoading(false));
  }, []);

  async function submitTransaction(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    const { id, ...form } = txForm;
    const payload = { ...form, symbol: form.symbol.trim().toUpperCase(), quantity: Number(form.quantity), unit_price: Number(form.unit_price), fee: Number(form.fee || 0) };
    try {
      if (id) await api.portfolio.update(id, payload); else await api.portfolio.add(payload);
      await refresh(); setTxForm(null); setNotice(id ? 'Đã cập nhật giao dịch.' : 'Đã ghi giao dịch vào sổ danh mục.');
    } catch (requestError) { setError(requestError.message || 'Không lưu được giao dịch.'); setTxForm(null); }
    finally { setBusy(false); }
  }
  function prepareCsv(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { setImportState({ fileName: file.name, rows: parseCsv(String(reader.result ?? '')), result: null, error: '' }); }
      catch (parseError) { setImportState({ fileName: file.name, rows: [], result: null, error: parseError.message }); }
    };
    reader.onerror = () => setImportState({ fileName: file.name, rows: [], result: null, error: 'Không đọc được file CSV.' });
    reader.readAsText(file, 'UTF-8');
  }
  async function importCsv() {
    setBusy(true);
    try { const result = await api.portfolio.importMany(importState.rows); setImportState({ ...importState, result }); await refresh(); }
    catch (requestError) { setImportState({ ...importState, error: requestError.message || 'Không nhập được file CSV.' }); }
    finally { setBusy(false); }
  }
  async function removeTransaction(id) {
    setBusy(true); setError(''); setNotice('');
    try { await api.portfolio.remove(id); await refresh(); setNotice('Đã xóa giao dịch.'); }
    catch (requestError) { setError(requestError.message || 'Không xóa được giao dịch.'); }
    finally { setBusy(false); }
  }
  async function clearPortfolio(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { const result = await api.portfolio.clear(clearing); await refresh(); setNotice(`Đã xóa toàn bộ ${result.removed} giao dịch.`); }
    catch (requestError) { setError(requestError.message || 'Không xóa được danh mục.'); }
    finally { setBusy(false); setClearing(null); }
  }

  if (loading) return <main className="content"><div className="card muted">Đang tải danh mục…</div></main>;
  const summary = data?.summary ?? { market_value: 0, cost_basis: 0, realized_pnl: 0, unrealized_pnl: 0 };
  const positions = data?.positions ?? [];
  const transactions = data?.transactions ?? [];
  const allocation = data?.allocation ?? { by_symbol: [], by_industry: [] };
  const history = (data?.history ?? []).map((item) => ({ date: item.date, close: item.market_value }));
  const unrealizedPct = summary.unrealized_pnl != null && summary.cost_basis ? summary.unrealized_pnl / summary.cost_basis * 100 : null;

  return <main className="content">
    <div className="pagehead"><div><h1>Portfolio</h1><p>Danh mục bạn tự nhập để theo dõi. Hệ thống không kết nối tài khoản chứng khoán và không đưa khuyến nghị.</p></div>
      <div className="actions"><button className="btn pri" type="button" onClick={() => setTxForm({ ...blankTransaction, executed_at: today })}><Icon name="plus" />Nhập giao dịch</button>
        {canImport && <button className="btn" type="button" onClick={() => setImportState({ fileName: '', rows: [], result: null, error: '' })}>Import CSV</button>}
        <button className="btn" type="button" onClick={() => api.reports.portfolio().catch((e) => setError(e.message))}><Icon name="pdf" />PDF</button></div></div>
    {error && <div className="note bad" role="alert">{error}</div>}
    {notice && <div className="note info" role="status">{notice}</div>}
    <div className="grid g4">
      <div className="card stat"><div className="k">Giá trị thị trường</div><div className="v num">{summary.market_value == null ? '—' : money.format(summary.market_value)}</div><div className="s muted">đồng · {positions.length} vị thế</div></div>
      <div className="card stat"><div className="k">Lãi/lỗ tạm tính</div><div className={`v num ${changeClass(summary.unrealized_pnl ?? 0)}`}>{summary.unrealized_pnl == null ? '—' : signed(summary.unrealized_pnl)}</div><div className={`s num ${changeClass(summary.unrealized_pnl ?? 0)}`}>{unrealizedPct == null ? 'chưa có giá' : `${unrealizedPct >= 0 ? '+' : '−'}${Math.abs(unrealizedPct).toFixed(2).replace('.', ',')}%`}</div></div>
      <div className="card stat"><div className="k">Lãi/lỗ đã thực hiện</div><div className={`v num ${changeClass(summary.realized_pnl)}`}>{signed(summary.realized_pnl)}</div><div className="s muted">từ các lệnh bán</div></div>
      <div className="card stat"><div className="k">Giá vốn đang nắm</div><div className="v num">{money.format(summary.cost_basis)}</div><div className="s muted">có tính phí mua</div></div>
    </div>
    {history.length > 1 && <section className="card chart"><div className="card-h"><h2>Giá trị danh mục · {history.length} phiên</h2><span className="small muted">tối đa 180 ngày gần nhất</span></div><PriceChart items={history} /></section>}
    <section className="card"><div className="card-h"><h2>Vị thế</h2><span className="small muted">Tỷ trọng theo giá trị thị trường</span></div>
      <div className="tw"><table><thead><tr><th>Mã</th><th className="hide-sm">Ngành</th><th className="r">KL</th><th className="r">Giá vốn BQ</th><th className="r">Giá đóng cửa</th><th className="r">Lãi/lỗ tạm tính</th><th className="r">Tỷ trọng</th></tr></thead>
        <tbody>{positions.map((item) => { const pct = item.unrealized_pnl != null && item.average_cost ? item.unrealized_pnl / (item.quantity * item.average_cost) * 100 : null; return <tr key={item.symbol} className="click" onClick={() => navigate(`/symbols/${item.symbol}`)}>
          <td className="sym">{item.symbol}</td><td className="hide-sm muted">{item.industry ?? '—'}</td><td className="r num">{quantityFormat.format(item.quantity)}</td><td className="r num">{money.format(item.average_cost)}</td>
          <td className="r num">{item.market_price == null ? '—' : money.format(item.market_price)}</td>
          <td className={`r num ${changeClass(item.unrealized_pnl ?? 0)}`}>{item.unrealized_pnl == null ? '—' : <>{signed(item.unrealized_pnl)} <span className="small">({pct >= 0 ? '+' : '−'}{Math.abs(pct).toFixed(1).replace('.', ',')}%)</span></>}</td>
          <td className="r num">{item.weight_pct == null ? '—' : `${item.weight_pct.toFixed(1).replace('.', ',')}%`}</td></tr>; })}
        {!positions.length && <tr><td colSpan="7" className="muted">Chưa có vị thế. Bấm “Nhập giao dịch” để bắt đầu.</td></tr>}</tbody></table></div>
    </section>
    {positions.length > 0 && <div className="grid g2">
      {[['Phân bổ theo ngành', allocation.by_industry, 'industry', 'bg-up'], ['Phân bổ theo mã', allocation.by_symbol, 'symbol', 'bg-hold']].map(([title, rows, key, color]) => <section className="card" key={title}><div className="card-h"><h2>{title}</h2></div>
        {rows.map((item) => <div key={item[key]} className="allocation-row"><span>{item[key]}</span><div className="pbar" style={{ height: 8 }}><i className={color} style={{ width: `${item.weight_pct}%` }} /></div><b className="num small">{item.weight_pct.toFixed(1).replace('.', ',')}%</b></div>)}
      </section>)}
    </div>}
    <section className="card"><div className="card-h"><h2>Giao dịch</h2>{transactions.length > 0 && <button className="btn sm danger" type="button" onClick={() => setClearing('')}>Xóa toàn bộ giao dịch</button>}</div>
      <div className="tw"><table><thead><tr><th>Ngày</th><th>Mã</th><th>Loại</th><th className="r">KL</th><th className="r">Giá</th><th className="r">Phí</th><th>Ghi chú</th><th /></tr></thead><tbody>
        {transactions.map((item) => <tr key={item.id}><td className="num">{new Date(`${item.executed_at}T00:00:00`).toLocaleDateString('vi-VN')}</td><td className="sym">{item.symbol}</td>
          <td><span className={`chip ${item.side === 'buy' ? 'acc' : 'neutral'}`}>{item.side === 'buy' ? 'MUA' : 'BÁN'}</span></td><td className="r num">{quantityFormat.format(item.quantity)}</td><td className="r num">{money.format(item.unit_price)}</td><td className="r num">{money.format(item.fee)}</td><td className="muted">{item.note || '—'}</td>
          <td><div className="actions"><button className="btn sm" type="button" disabled={busy} onClick={() => setTxForm({ id: item.id, symbol: item.symbol, side: item.side, quantity: String(item.quantity), unit_price: String(item.unit_price), fee: String(item.fee), executed_at: item.executed_at, note: item.note ?? '' })}>Sửa</button><button className="btn sm" type="button" disabled={busy} onClick={() => removeTransaction(item.id)}>Xóa</button></div></td></tr>)}
        {!transactions.length && <tr><td colSpan="8" className="muted">Chưa có giao dịch nào.</td></tr>}
      </tbody></table></div>
    </section>
    <Disclaimer>Danh mục chỉ để bạn tự theo dõi. Hệ thống không đưa khuyến nghị cho danh mục của bạn; tín hiệu dự báo cạnh vị thế sẽ có khi mô hình AI sẵn sàng.</Disclaimer>

    {txForm && <Modal title={txForm.id ? 'Sửa giao dịch' : 'Nhập giao dịch'} onClose={() => setTxForm(null)}>
      <form onSubmit={submitTransaction} style={{ display: 'grid', gap: 12 }}>
        <div className="frow">
          <div className="field"><label htmlFor="t-d">Ngày</label><input id="t-d" type="date" required value={txForm.executed_at} onChange={(event) => setTxForm({ ...txForm, executed_at: event.target.value })} /></div>
          <div className="field"><label htmlFor="t-s">Mã</label><input id="t-s" required maxLength="12" pattern="[A-Za-z0-9.-]+" placeholder="FPT" value={txForm.symbol} onChange={(event) => setTxForm({ ...txForm, symbol: event.target.value.toUpperCase() })} /></div>
          <div className="field"><label htmlFor="t-k">Loại</label><select id="t-k" value={txForm.side} onChange={(event) => setTxForm({ ...txForm, side: event.target.value })}><option value="buy">MUA</option><option value="sell">BÁN</option></select></div>
          <div className="field"><label htmlFor="t-q">Khối lượng</label><input id="t-q" type="number" required min="0.0001" step="0.0001" value={txForm.quantity} onChange={(event) => setTxForm({ ...txForm, quantity: event.target.value })} /></div>
          <div className="field"><label htmlFor="t-p">Giá</label><input id="t-p" type="number" required min="0.0001" step="0.0001" value={txForm.unit_price} onChange={(event) => setTxForm({ ...txForm, unit_price: event.target.value })} /></div>
          <div className="field"><label htmlFor="t-f">Phí</label><input id="t-f" type="number" min="0" step="1" value={txForm.fee} onChange={(event) => setTxForm({ ...txForm, fee: event.target.value })} /></div>
        </div>
        <div className="field"><label htmlFor="t-n">Ghi chú</label><input id="t-n" maxLength="500" value={txForm.note} onChange={(event) => setTxForm({ ...txForm, note: event.target.value })} /></div>
        <div className="small muted">Giao dịch bán vượt khối lượng đang nắm sẽ bị từ chối.</div>
        <div className="actions"><button className="btn pri" type="submit" disabled={busy}>{txForm.id ? 'Lưu thay đổi' : 'Lưu'}</button><button className="btn" type="button" onClick={() => setTxForm(null)}>Hủy</button></div>
      </form>
    </Modal>}

    {importState && <Modal title="Import CSV" onClose={() => setImportState(null)}>
      <div className="small muted">UTF-8, tối đa 500 dòng; header: symbol, side, quantity, unit_price, executed_at, fee, note (side nhận buy/sell hoặc mua/bán). <a href={`data:text/csv;charset=utf-8,${encodeURIComponent('symbol,side,quantity,unit_price,executed_at,fee,note\nFPT,buy,100,100000,2026-10-01,1000,Ví dụ')}`} download="portfolio-template.csv">Tải mẫu CSV</a></div>
      <div className="field"><label htmlFor="csv-file">Chọn tệp</label><input id="csv-file" type="file" accept=".csv,text/csv" onChange={prepareCsv} /></div>
      {importState.error && <div className="note bad" role="alert">{importState.error}</div>}
      {importState.rows.length > 0 && !importState.result && <>
        <div className="note info">Tệp <b>{importState.fileName}</b>: {importState.rows.length} dòng. Dòng lỗi, trùng giao dịch đã có hoặc bán vượt khối lượng sẽ được bỏ qua và báo lại.</div>
        <div className="tw"><table><thead><tr><th>Dòng</th><th>Ngày</th><th>Mã</th><th>Loại</th><th className="r">KL</th><th className="r">Giá</th></tr></thead><tbody>
          {importState.rows.slice(0, 5).map((item) => <tr key={item.line}><td className="num">{item.line}</td><td className="num">{item.executed_at}</td><td>{item.symbol}</td><td>{item.side === 'buy' ? 'MUA' : item.side === 'sell' ? 'BÁN' : item.side}</td><td className="r num">{Number.isFinite(item.quantity) ? quantityFormat.format(item.quantity) : '—'}</td><td className="r num">{Number.isFinite(item.unit_price) ? money.format(item.unit_price) : '—'}</td></tr>)}
        </tbody></table></div>
        <div className="actions"><button className="btn pri" type="button" disabled={busy} onClick={importCsv}>{busy ? 'Đang nhập…' : `Xác nhận ghi ${importState.rows.length} dòng`}</button><button className="btn" type="button" onClick={() => setImportState(null)}>Hủy</button></div>
      </>}
      {importState.result && <>
        <div className={`note ${importState.result.skipped.length ? 'warn' : 'info'}`}><b>Đã ghi {importState.result.imported} dòng</b>, bỏ qua {importState.result.skipped.length} dòng.</div>
        {importState.result.skipped.length > 0 && <div className="tw"><table><thead><tr><th>Dòng</th><th>Lý do</th></tr></thead><tbody>
          {importState.result.skipped.map((item) => <tr key={`${item.line}-${item.reason}`}><td className="num">{item.line}</td><td className="c-down" style={{ whiteSpace: 'normal' }}>{item.reason}</td></tr>)}</tbody></table></div>}
        <div className="actions"><button className="btn pri" type="button" onClick={() => setImportState(null)}>Đóng</button></div>
      </>}
    </Modal>}

    {clearing != null && <Modal title="Xóa toàn bộ giao dịch?" onClose={() => setClearing(null)}>
      <p>Mọi giao dịch và vị thế trong Portfolio sẽ bị xóa vĩnh viễn. Trade Plan và Journal không bị ảnh hưởng.</p>
      <form onSubmit={clearPortfolio} style={{ display: 'grid', gap: 12 }}>
        <div className="field"><label htmlFor="del-c">Gõ {CLEAR_PHRASE} để xác nhận</label><input id="del-c" autoComplete="off" value={clearing} onChange={(event) => setClearing(event.target.value)} /></div>
        <div className="actions"><button className="btn danger" type="submit" disabled={busy || clearing !== CLEAR_PHRASE}>Xóa toàn bộ</button><button className="btn" type="button" onClick={() => setClearing(null)}>Hủy</button></div>
      </form>
    </Modal>}
  </main>;
}
