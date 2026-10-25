import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/index.js';

const money = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });

export function WatchlistPage() {
  const [symbols, setSymbols] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [rules, setRules] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [selectedRuleSymbol, setSelectedRuleSymbol] = useState('');
  const [noteDrafts, setNoteDrafts] = useState({});
  const [condition, setCondition] = useState('price_above');
  const [targetPrice, setTargetPrice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    const [universe, list, alertRules, userAlerts] = await Promise.all([
      api.market.symbols(), api.watchlist.list(), api.alerts.rules(), api.alerts.list(),
    ]);
    setSymbols(universe.items);
    setWatchlist(list.items);
    setRules(alertRules.items);
    setAlerts(userAlerts.items);
    setNoteDrafts(Object.fromEntries(list.items.map((item) => [item.symbol, item.note])));
  }

  useEffect(() => {
    let active = true;
    refresh().catch((requestError) => { if (active) setError(requestError.message || 'Không tải được watchlist.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const availableSymbols = useMemo(() => symbols.filter((item) => !watchlist.some((row) => row.symbol === item.symbol)), [symbols, watchlist]);

  async function perform(action, successText) {
    setBusy(true); setError(''); setNotice('');
    try {
      await action();
      await refresh();
      setNotice(successText);
      return true;
    } catch (requestError) {
      setError(requestError.message || 'Thao tác không thành công.');
      return false;
    } finally { setBusy(false); }
  }

  async function addSymbol(event) {
    event.preventDefault();
    if (!selectedSymbol) return;
    if (await perform(() => api.watchlist.add(selectedSymbol), 'Đã thêm mã vào watchlist.')) setSelectedSymbol('');
  }

  async function saveNote(symbol) {
    await perform(() => api.watchlist.updateNote(symbol, noteDrafts[symbol] ?? ''), 'Đã lưu ghi chú.');
  }

  async function createRule(event) {
    event.preventDefault();
    const parsedPrice = Number(targetPrice);
    if (!selectedRuleSymbol || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError('Chọn mã và nhập giá mục tiêu lớn hơn 0.');
      return;
    }
    if (await perform(() => api.alerts.createRule({ symbol: selectedRuleSymbol, condition, target_price: parsedPrice }), 'Đã tạo quy tắc cảnh báo giá.')) setTargetPrice('');
  }

  async function toggleRule(rule) {
    await perform(() => api.alerts.updateRule(rule.id, { is_active: !rule.is_active }), 'Đã cập nhật trạng thái quy tắc.');
  }

  if (loading) return <section className="content"><div className="card loading-card">Đang tải watchlist và cảnh báo…</div></section>;

  return <section className="content watchlist-page">
    <header className="pagehead"><div><span className="eyebrow">THEO DÕI CỦA BẠN</span><h1>Watchlist và cảnh báo</h1><p>Danh sách và cảnh báo chỉ thuộc tài khoản hiện tại.</p></div><span className="chip acc">{watchlist.length}/10 mã</span></header>
    <div className="note warn"><strong>Phạm vi cảnh báo hiện tại:</strong> chỉ phát sinh khi giá SSI vượt qua ngưỡng tăng/giảm đã đặt. Không có điều kiện dựa trên dự báo AI; giá không có nguồn SSI sẽ không kích hoạt cảnh báo.</div>
    {error && <div className="note bad" role="alert">{error}</div>}
    {notice && <div className="note info" role="status">{notice}</div>}

    <section className="card">
      <div className="card-h"><div><h2>Mã đang theo dõi</h2><p className="small muted">Tối đa 10 mã; ghi chú riêng tư trong tài khoản.</p></div></div>
      <form className="watchlist-add-form" onSubmit={addSymbol}>
        <label className="field"><span>Thêm mã</span><select value={selectedSymbol} onChange={(event) => setSelectedSymbol(event.target.value)}>
          <option value="">Chọn mã cổ phiếu</option>{availableSymbols.map((item) => <option key={item.symbol} value={item.symbol}>{item.symbol} · {item.name}</option>)}
        </select></label>
        <button className="btn pri" type="submit" disabled={busy || !selectedSymbol || watchlist.length >= 10}>Thêm vào watchlist</button>
      </form>
      <div className="tw"><table className="watchlist-table"><thead><tr><th>Mã</th><th>Sàn</th><th className="r">Giá đóng cửa</th><th>Ngày giá</th><th>Ghi chú</th><th /></tr></thead><tbody>
        {watchlist.map((item) => <tr key={item.symbol}>
          <td><b>{item.symbol}</b><small className="company-name">{item.name}</small></td><td>{item.exchange}</td>
          <td className="r num">{item.close === null ? '—' : `${money.format(Number(item.close))} ₫`}</td><td>{item.price_date ?? '—'}</td>
          <td><input maxLength="500" aria-label={`Ghi chú ${item.symbol}`} value={noteDrafts[item.symbol] ?? ''} onChange={(event) => setNoteDrafts({ ...noteDrafts, [item.symbol]: event.target.value })} /></td>
          <td><div className="watchlist-actions"><button className="btn sm" type="button" disabled={busy || (noteDrafts[item.symbol] ?? '') === item.note} onClick={() => saveNote(item.symbol)}>Lưu</button><button className="btn sm danger" type="button" disabled={busy} onClick={() => perform(() => api.watchlist.remove(item.symbol), 'Đã xóa mã khỏi watchlist.')}>Xóa</button></div></td>
        </tr>)}
        {!watchlist.length && <tr><td colSpan="6" className="empty-row">Watchlist đang trống. Thêm mã để bắt đầu theo dõi.</td></tr>}
      </tbody></table></div>
    </section>

    <section className="card">
      <div className="card-h"><div><h2>Quy tắc cảnh báo giá</h2><p className="small muted">Cảnh báo được tạo khi giá đóng cửa SSI cắt qua ngưỡng.</p></div></div>
      <form className="alert-rule-form" onSubmit={createRule}>
        <label className="field"><span>Mã cổ phiếu</span><select value={selectedRuleSymbol} onChange={(event) => setSelectedRuleSymbol(event.target.value)} required><option value="">Chọn mã</option>{symbols.map((item) => <option key={item.symbol} value={item.symbol}>{item.symbol} · {item.name}</option>)}</select></label>
        <label className="field"><span>Điều kiện</span><select value={condition} onChange={(event) => setCondition(event.target.value)}><option value="price_above">Giá cắt lên trên</option><option value="price_below">Giá cắt xuống dưới</option></select></label>
        <label className="field"><span>Giá mục tiêu (VND)</span><input type="number" min="0.0001" step="0.0001" value={targetPrice} onChange={(event) => setTargetPrice(event.target.value)} required /></label>
        <button className="btn pri" type="submit" disabled={busy}>Tạo cảnh báo</button>
      </form>
      <div className="alert-rule-list">{rules.map((rule) => <article className="alert-rule-row" key={rule.id}>
        <div><b>{rule.symbol}</b><span>{rule.condition === 'price_above' ? ' cắt lên ' : ' cắt xuống '}{money.format(rule.target_price)} ₫</span><small className="company-name">{rule.name}</small></div>
        <span className={`chip ${rule.is_active ? 'up' : 'neutral'}`}>{rule.is_active ? 'Đang bật' : 'Đang tắt'}</span>
        <div className="watchlist-actions"><button className="btn sm" type="button" disabled={busy} onClick={() => toggleRule(rule)}>{rule.is_active ? 'Tắt' : 'Bật'}</button><button className="btn sm danger" type="button" disabled={busy} onClick={() => perform(() => api.alerts.deleteRule(rule.id), 'Đã xóa quy tắc.')}>Xóa</button></div>
      </article>)}{!rules.length && <p className="empty-row">Chưa có quy tắc cảnh báo.</p>}</div>
    </section>

    <section className="card">
      <div className="card-h"><div><h2>Lịch sử cảnh báo</h2><p className="small muted">Cảnh báo chỉ xuất hiện khi worker xử lý giá SSI và điều kiện được cắt qua.</p></div></div>
      <div className="alert-inbox">{alerts.map((alert) => <article className={`alert-inbox-row ${alert.read_at ? 'read' : ''}`} key={alert.id}>
        <div><b>{alert.title}</b><p>{alert.message}</p><small className="muted">{alert.symbol} · {dateTime.format(new Date(alert.created_at))}</small></div>
        {!alert.read_at && <button className="btn sm" type="button" disabled={busy} onClick={() => perform(() => api.alerts.markRead(alert.id), 'Đã đánh dấu đã đọc.')}>Đã đọc</button>}
      </article>)}{!alerts.length && <p className="empty-row">Chưa có cảnh báo nào.</p>}</div>
    </section>
  </section>;
}
