import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/index.js';
import { navigate } from '../../app/navigation.js';
import { Icon } from '../../app/icons.jsx';
import { Modal } from '../../app/Modal.jsx';
import { MiniLab } from '../../components/forecast.jsx';
import { AlertInbox } from '../alerts/AlertsPage.jsx';

const money = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const formatChange = (value) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(2).replace('.', ',')}%`;
const changeClass = (value) => (value > 0 ? 'c-up' : value < 0 ? 'c-down' : 'c-hold');
const LIMIT = 10;

export function WatchlistPage() {
  const [symbols, setSymbols] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [rules, setRules] = useState([]);
  const [noteDrafts, setNoteDrafts] = useState({});
  const [adding, setAdding] = useState(null);
  const [ruleForm, setRuleForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    const [universe, list, alertRules] = await Promise.all([api.market.symbols(), api.watchlist.list(), api.alerts.rules()]);
    setSymbols(universe.items); setWatchlist(list.items); setRules(alertRules.items);
    setNoteDrafts(Object.fromEntries(list.items.map((item) => [item.symbol, item.note])));
  }
  useEffect(() => {
    let active = true;
    refresh().catch((requestError) => { if (active) setError(requestError.message || 'Không tải được watchlist.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const bySymbol = useMemo(() => Object.fromEntries(symbols.map((item) => [item.symbol, item])), [symbols]);
  const availableSymbols = symbols.filter((item) => !watchlist.some((row) => row.symbol === item.symbol));

  async function perform(action, successText) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); await refresh(); setNotice(successText); return true; }
    catch (requestError) { setError(requestError.message || 'Thao tác không thành công.'); return false; }
    finally { setBusy(false); }
  }
  async function addSymbol(event) {
    event.preventDefault();
    if (!adding?.symbol) return;
    if (await perform(() => api.watchlist.add(adding.symbol, adding.note), `Đã thêm ${adding.symbol} vào watchlist.`)) setAdding(null);
  }
  async function saveNote(symbol) {
    const watched = watchlist.find((item) => item.symbol === symbol);
    if ((noteDrafts[symbol] ?? '') === watched?.note) return;
    await perform(() => api.watchlist.updateNote(symbol, noteDrafts[symbol] ?? ''), 'Đã lưu ghi chú.');
  }
  async function createRule(event) {
    event.preventDefault();
    const price = Number(ruleForm.target_price);
    if (!ruleForm.symbol || !Number.isFinite(price) || price <= 0) { setError('Chọn mã và nhập giá mục tiêu lớn hơn 0.'); return; }
    if (await perform(() => api.alerts.createRule({ symbol: ruleForm.symbol, condition: ruleForm.condition, target_price: price }), 'Đã thêm quy tắc cảnh báo giá.')) setRuleForm(null);
  }

  if (loading) return <main className="content"><div className="card muted">Đang tải watchlist và cảnh báo…</div></main>;

  return <main className="content">
    <div className="pagehead"><div><h1>Watchlist & cảnh báo</h1><p>Theo dõi tối đa {LIMIT} mã. Cảnh báo được tạo sau khi đồng bộ giá hằng ngày và gửi qua kênh bạn đã bật trong Cài đặt.</p></div></div>
    {error && <div className="note bad" role="alert">{error}</div>}
    {notice && <div className="note info" role="status">{notice}</div>}

    <section className="card"><div className="card-h"><h2>Mã đang theo dõi <span className="tag num">{watchlist.length}/{LIMIT}</span></h2>
      <button className="btn sm" type="button" disabled={busy || watchlist.length >= LIMIT} onClick={() => setAdding({ symbol: availableSymbols[0]?.symbol ?? '', note: '' })}><Icon name="plus" />Thêm mã</button></div>
      <div className="tw"><table><thead><tr><th>Mã</th><th className="r">Giá</th><th className="r">%</th><th>T+2</th><th>T+5</th><th>Ghi chú</th><th /></tr></thead>
        <tbody>{watchlist.map((item) => { const market = bySymbol[item.symbol]; return <tr key={item.symbol}>
          <td className="sym" style={{ cursor: 'pointer' }} onClick={() => navigate(`/symbols/${item.symbol}`)}>{item.symbol}<small>{item.name}</small></td>
          <td className="r num">{item.close == null ? '—' : money.format(Number(item.close))}</td>
          <td className={`r num ${changeClass(market?.changePercent ?? 0)}`}>{market ? formatChange(market.changePercent) : '—'}</td>
          <td><MiniLab forecast={market?.forecasts?.t2} /></td><td><MiniLab forecast={market?.forecasts?.t5} /></td>
          <td><input className="note-input" maxLength="500" aria-label={`Ghi chú ${item.symbol}`} placeholder="Thêm ghi chú" value={noteDrafts[item.symbol] ?? ''} onChange={(event) => setNoteDrafts({ ...noteDrafts, [item.symbol]: event.target.value })} onBlur={() => saveNote(item.symbol)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></td>
          <td><button className="btn sm" type="button" disabled={busy} onClick={() => perform(() => api.watchlist.remove(item.symbol), `Đã bỏ ${item.symbol} khỏi watchlist.`)}>Bỏ</button></td>
        </tr>; })}
        {!watchlist.length && <tr><td colSpan="7" className="muted">Watchlist đang trống. Thêm mã, hoặc bấm ☆ ở trang Tổng quan.</td></tr>}</tbody></table></div>
    </section>

    <div className="grid g2">
      <section className="card"><div className="card-h"><h2>Quy tắc cảnh báo giá</h2><button className="btn sm pri" type="button" onClick={() => setRuleForm({ symbol: watchlist[0]?.symbol ?? symbols[0]?.symbol ?? '', condition: 'price_above', target_price: '' })}><Icon name="plus" />Thêm quy tắc</button></div>
        <div className="tw"><table><thead><tr><th>Mã</th><th>Điều kiện</th><th>Bật</th><th /></tr></thead><tbody>
          {rules.map((rule) => <tr key={rule.id}><td><b>{rule.symbol}</b></td><td className="muted" style={{ whiteSpace: 'normal' }}>Giá đóng cửa {rule.condition === 'price_above' ? 'vượt lên trên' : 'giảm xuống dưới'} <span className="num">{money.format(rule.target_price)}</span></td>
            <td><label className="toggle"><input type="checkbox" checked={rule.is_active} disabled={busy} aria-label={`Bật quy tắc ${rule.symbol}`} onChange={() => perform(() => api.alerts.updateRule(rule.id, { is_active: !rule.is_active }), rule.is_active ? 'Đã tắt quy tắc.' : 'Đã bật quy tắc.')} /></label></td>
            <td><button className="btn sm" type="button" disabled={busy} onClick={() => perform(() => api.alerts.deleteRule(rule.id), 'Đã xóa quy tắc.')}>Xóa</button></td></tr>)}
          {!rules.length && <tr><td colSpan="4" className="muted">Chưa có quy tắc cảnh báo giá.</td></tr>}
        </tbody></table></div>
        <div className="small muted" style={{ marginTop: 8 }}>Ngoài quy tắc giá, hệ thống tự cảnh báo khi giá chạm vùng vào, cắt lỗ hoặc mục tiêu của Trade Plan. Cảnh báo theo đổi nhãn dự báo sẽ có khi mô hình AI sẵn sàng.</div>
      </section>
      <AlertInbox />
    </div>

    {adding && <Modal title="Thêm mã vào watchlist" onClose={() => setAdding(null)}>
      <form onSubmit={addSymbol} style={{ display: 'grid', gap: 12 }}>
        <div className="field"><label htmlFor="m-sym">Mã</label><select id="m-sym" value={adding.symbol} onChange={(event) => setAdding({ ...adding, symbol: event.target.value })}>{availableSymbols.map((item) => <option key={item.symbol} value={item.symbol}>{item.symbol} · {item.name}</option>)}</select></div>
        <div className="field"><label htmlFor="m-note">Ghi chú</label><input id="m-note" maxLength="500" value={adding.note} onChange={(event) => setAdding({ ...adding, note: event.target.value })} /></div>
        <div className="actions"><button className="btn pri" type="submit" disabled={busy}>Thêm</button><button className="btn" type="button" onClick={() => setAdding(null)}>Hủy</button></div>
      </form>
    </Modal>}
    {ruleForm && <Modal title="Thêm quy tắc cảnh báo giá" onClose={() => setRuleForm(null)}>
      <form onSubmit={createRule} style={{ display: 'grid', gap: 12 }}>
        <div className="frow">
          <div className="field"><label htmlFor="r-s">Mã</label><select id="r-s" value={ruleForm.symbol} onChange={(event) => setRuleForm({ ...ruleForm, symbol: event.target.value })}>{symbols.map((item) => <option key={item.symbol} value={item.symbol}>{item.symbol}</option>)}</select></div>
          <div className="field"><label htmlFor="r-k">Điều kiện</label><select id="r-k" value={ruleForm.condition} onChange={(event) => setRuleForm({ ...ruleForm, condition: event.target.value })}><option value="price_above">Giá vượt lên trên</option><option value="price_below">Giá giảm xuống dưới</option></select></div>
          <div className="field"><label htmlFor="r-t">Giá mục tiêu</label><input id="r-t" type="number" min="0.0001" step="0.0001" required value={ruleForm.target_price} onChange={(event) => setRuleForm({ ...ruleForm, target_price: event.target.value })} /><span className="hint">đồng</span></div>
        </div>
        <div className="small muted">Gửi qua: trong ứng dụng, cùng Email/Telegram nếu đã bật trong Cài đặt.</div>
        <div className="actions"><button className="btn pri" type="submit" disabled={busy}>Lưu quy tắc</button><button className="btn" type="button" onClick={() => setRuleForm(null)}>Hủy</button></div>
      </form>
    </Modal>}
  </main>;
}

