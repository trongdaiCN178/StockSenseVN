import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/index.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { hasCapability } from '@stocksense/core/access';
import { navigate } from '../../app/navigation.js';
import { Disclaimer } from '../../app/icons.jsx';
import { Confidence, MiniLab } from '../../components/forecast.jsx';

const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const LIQUIDITY_OPTIONS = [['', 'Mọi thanh khoản'], ['10000000000', 'GTGD ≥ 10 tỷ'], ['50000000000', 'GTGD ≥ 50 tỷ'], ['100000000000', 'GTGD ≥ 100 tỷ']];
const SORTS = { symbol: (item) => item.symbol, closePrice: (item) => item.closePrice, changePercent: (item) => item.changePercent, averageTurnover20d: (item) => item.averageTurnover20d };
const LABEL_TEXT = { up: '▲ Tăng', hold: '● Đi ngang', down: '▼ Giảm' };

function formatChange(value) {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(2).replace('.', ',')}%`;
}
const changeClass = (value) => (value > 0 ? 'c-up' : value < 0 ? 'c-down' : 'c-hold');

export function OverviewPage() {
  const { user } = useAuth();
  const canReadSymbols = hasCapability(user.role, 'symbols.read');
  const canWatch = hasCapability(user.role, 'watchlist.manage.self');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exchange, setExchange] = useState('all');
  const [industry, setIndustry] = useState('');
  const [trend, setTrend] = useState('');
  const [minTurnover, setMinTurnover] = useState('');
  const [sort, setSort] = useState({ key: 'averageTurnover20d', direction: 'desc' });
  const [watchlist, setWatchlist] = useState(new Set());
  const [watchError, setWatchError] = useState('');

  useEffect(() => {
    let active = true;
    const symbolRequest = canReadSymbols ? api.market.symbols() : Promise.resolve({ items: [], total: 0 });
    Promise.all([api.market.status(), api.market.summary(), symbolRequest])
      .then(([status, summary, symbols]) => { if (active) setData({ status, summary, symbols }); })
      .catch((requestError) => { if (active) setError(requestError.message || 'Không tải được tổng quan.'); })
      .finally(() => { if (active) setLoading(false); });
    if (canWatch) api.watchlist.list().then((result) => { if (active) setWatchlist(new Set(result.items.map((item) => item.symbol))); }).catch(() => {});
    return () => { active = false; };
  }, [user.role, canReadSymbols, canWatch]);

  // FR-M5-01: add/remove a symbol from the watchlist straight from the overview.
  async function toggleWatch(event, symbol) {
    event.stopPropagation();
    setWatchError('');
    try {
      if (watchlist.has(symbol)) await api.watchlist.remove(symbol); else await api.watchlist.add(symbol);
      setWatchlist((current) => { const next = new Set(current); if (next.has(symbol)) next.delete(symbol); else next.add(symbol); return next; });
    } catch (requestError) { setWatchError(requestError.message || 'Không cập nhật được watchlist.'); }
  }
  function sortBy(key) {
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc' }));
  }

  const rows = useMemo(() => {
    if (!data) return [];
    const filtered = data.symbols.items.filter((item) => (exchange === 'all' || item.exchange === exchange)
      && (!industry || item.industry === industry)
      && (!trend || item.forecasts?.t5?.label === trend)
      && (!minTurnover || item.averageTurnover20d >= Number(minTurnover)));
    const value = SORTS[sort.key];
    const factor = sort.direction === 'asc' ? 1 : -1;
    return filtered.sort((a, b) => factor * (sort.key === 'symbol' ? value(a).localeCompare(value(b)) : value(a) - value(b)));
  }, [data, exchange, industry, trend, minTurnover, sort]);
  const industries = useMemo(() => [...new Set((data?.symbols.items ?? []).map((item) => item.industry).filter(Boolean))].sort(), [data]);

  if (loading) return <main className="content"><div className="card muted">Đang tải dữ liệu tổng quan…</div></main>;
  if (error) return <main className="content"><div className="note bad" role="alert">{error}</div></main>;
  if (!data) return null;

  const items = data.symbols.items;
  const count = (label) => items.filter((item) => item.forecasts?.t5?.label === label).length;
  const index = (code) => data.summary.indices.find((item) => item.code === code);
  const breadth = data.summary.breadth;
  const exchanges = ['all', ...['HOSE', 'HNX', 'UPCOM'].filter((code) => items.some((item) => item.exchange === code))];

  return <main className="content">
    <div className="pagehead"><div><h1>Tổng quan thị trường</h1><p>Dự báo xu hướng T+2 và T+5 cho {canReadSymbols ? items.length : ''} mã thanh khoản cao, tính lại mỗi ngày sau phiên.</p></div>
      {data.status.state === 'demo' && <span className="chip info">Dự báo đang là dữ liệu mẫu</span>}</div>
    <section className="strip">
      {['VNINDEX', 'HNX'].map((code) => { const item = index(code); return <div key={code}><div className="k">{item?.label ?? code}</div><div className="v num">{item ? number.format(item.value) : '—'}</div>
        {item && <div className={`small num ${changeClass(item.changePoints)}`}>{item.changePoints >= 0 ? '▲' : '▼'} {item.changePoints > 0 ? '+' : ''}{number.format(item.changePoints)} ({formatChange(item.changePercent)})</div>}</div>; })}
      <div><div className="k">Độ rộng thị trường</div><div className="v num" style={{ fontSize: 16 }}><span className="c-up">{breadth.advances}</span> · <span className="c-hold">{breadth.nochanges}</span> · <span className="c-down">{breadth.declines}</span></div>
        <div className="breadth"><i className="bg-up" style={{ flex: breadth.advances }} /><i className="bg-hold" style={{ flex: breadth.nochanges }} /><i className="bg-down" style={{ flex: breadth.declines }} /></div></div>
      <div><div className="k">Tỷ lệ nhãn T+5 ({items.length || '—'} mã)</div>{canReadSymbols ? <><div className="v num" style={{ fontSize: 16 }}><span className="c-up">▲ {count('up')}</span> · <span className="c-hold">● {count('hold')}</span> · <span className="c-down">▼ {count('down')}</span></div>
        <div className="breadth"><i className="bg-up" style={{ flex: count('up') }} /><i className="bg-hold" style={{ flex: count('hold') }} /><i className="bg-down" style={{ flex: count('down') }} /></div></> : <div className="small muted">Không áp dụng cho vai trò này</div>}</div>
    </section>

    {canReadSymbols ? <section className="card">
      <div className="card-h"><h2>Danh sách mã</h2>
        <div className="actions">
          <div className="seg">{exchanges.map((value) => <button key={value} type="button" className={exchange === value ? 'on' : ''} onClick={() => setExchange(value)}>{value === 'all' ? 'Tất cả sàn' : value}</button>)}</div>
          <div className="field" style={{ flexDirection: 'row' }}><select aria-label="Lọc theo ngành" value={industry} onChange={(event) => setIndustry(event.target.value)}><option value="">Mọi ngành</option>{industries.map((item) => <option key={item}>{item}</option>)}</select></div>
          <div className="field" style={{ flexDirection: 'row' }}><select aria-label="Xu hướng T+5" value={trend} onChange={(event) => setTrend(event.target.value)}><option value="">Mọi xu hướng T+5</option>{Object.entries(LABEL_TEXT).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></div>
          <div className="field" style={{ flexDirection: 'row' }}><select aria-label="Lọc theo thanh khoản" value={minTurnover} onChange={(event) => setMinTurnover(event.target.value)}>{LIQUIDITY_OPTIONS.map(([value, text]) => <option key={text} value={value}>{text}</option>)}</select></div>
        </div></div>
      {watchError && <div className="note bad" role="alert">{watchError}</div>}
      <div className="tw"><table>
        <thead><tr>
          {canWatch && <th aria-label="Watchlist" />}
          <SortHeader label="Mã" sortKey="symbol" sort={sort} onSort={sortBy} />
          <th className="hide-sm">Sàn · Ngành</th>
          <SortHeader label="Giá" sortKey="closePrice" sort={sort} onSort={sortBy} align="r" />
          <SortHeader label="%" sortKey="changePercent" sort={sort} onSort={sortBy} align="r" />
          <SortHeader label="GTGD TB20 (tỷ)" sortKey="averageTurnover20d" sort={sort} onSort={sortBy} align="r hide-sm" />
          <th>T+2</th><th>T+5</th><th className="hide-sm">Tin cậy T+5</th>
        </tr></thead>
        <tbody>{rows.map((item) => <tr key={item.symbol} className="click symbol-row" tabIndex={0} onClick={() => navigate(`/symbols/${item.symbol}`)} onKeyDown={(event) => { if (event.key === 'Enter') navigate(`/symbols/${item.symbol}`); }}>
          {canWatch && <td><button type="button" className={`watch-star ${watchlist.has(item.symbol) ? 'on' : ''}`} onClick={(event) => toggleWatch(event, item.symbol)} aria-pressed={watchlist.has(item.symbol)} aria-label={watchlist.has(item.symbol) ? `Bỏ ${item.symbol} khỏi watchlist` : `Thêm ${item.symbol} vào watchlist`}>{watchlist.has(item.symbol) ? '★' : '☆'}</button></td>}
          <td><span className="sym">{item.symbol}<small className="hide-sm">{item.name}</small></span></td>
          <td className="hide-sm muted">{item.exchange}{item.industry ? ` · ${item.industry}` : ''}</td>
          <td className="r num">{money.format(item.closePrice)}</td>
          <td className={`r num ${changeClass(item.changePercent)}`}>{formatChange(item.changePercent)}</td>
          <td className="r num hide-sm">{item.averageTurnover20d ? number.format(item.averageTurnover20d / 1e9) : '—'}</td>
          <td><MiniLab forecast={item.forecasts?.t2} /></td>
          <td><MiniLab forecast={item.forecasts?.t5} />{conflict(item) && <> <span className="chip hold" title="T+2 và T+5 ngược chiều">Mâu thuẫn</span></>}</td>
          <td className="hide-sm"><Confidence level={item.forecasts?.t5?.confidence} /></td>
        </tr>)}
        {!rows.length && <tr><td colSpan={canWatch ? 9 : 8} className="muted">Không có mã khớp bộ lọc.</td></tr>}</tbody>
      </table></div>
      <div style={{ marginTop: 12, display: 'flex', gap: 14, flexWrap: 'wrap' }} className="small muted"><span>Bấm tiêu đề cột để sắp xếp</span><span>☆ thêm nhanh vào watchlist</span><span>Hiển thị {rows.length}/{items.length} mã</span></div>
    </section> : <div className="note info">Vai trò quản trị xem trạng thái thị trường và mô hình; danh sách mã và dự báo dành cho người dùng cuối.</div>}
    <Disclaimer />
  </main>;
}

const conflict = (item) => {
  const t2 = item.forecasts?.t2?.label; const t5 = item.forecasts?.t5?.label;
  return (t2 === 'up' && t5 === 'down') || (t2 === 'down' && t5 === 'up');
};

function SortHeader({ label, sortKey, sort, onSort, align = '' }) {
  const active = sort.key === sortKey;
  return <th className={align} aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
    <button type="button" className="sort-button" onClick={() => onSort(sortKey)}>{label}{active ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : ''}</button>
  </th>;
}
