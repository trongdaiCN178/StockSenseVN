import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/index.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { hasCapability } from '@stocksense/core/access';
import { ForecastBadge } from '../../components/ForecastBadge.jsx';
import { navigate } from '../../app/navigation.js';

const number = new Intl.NumberFormat('vi-VN');
const money = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const sessionDate = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });
const sessionDateTime = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function formatDataDate(value) {
  return sessionDate.format(new Date(`${value}T00:00:00+07:00`));
}

const compactMoney = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 });
const LIQUIDITY_OPTIONS = [['', 'Mọi thanh khoản'], ['10000000000', '≥ 10 tỷ/phiên'], ['50000000000', '≥ 50 tỷ/phiên'], ['100000000000', '≥ 100 tỷ/phiên']];
const SORTS = { symbol: (item) => item.symbol, closePrice: (item) => item.closePrice, changePercent: (item) => item.changePercent, averageTurnover20d: (item) => item.averageTurnover20d };

function formatChange(value) {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function OverviewPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [exchange, setExchange] = useState('Tất cả sàn');
  const [horizon, setHorizon] = useState('t2');
  const [industry, setIndustry] = useState('');
  const [minTurnover, setMinTurnover] = useState('');
  const [sort, setSort] = useState({ key: 'symbol', direction: 'asc' });
  const [watchlist, setWatchlist] = useState(new Set());
  const [watchError, setWatchError] = useState('');
  const canWatch = hasCapability(user.role, 'watchlist.manage.self');

  useEffect(() => {
    if (!canWatch) return;
    api.watchlist.list().then((result) => setWatchlist(new Set(result.items.map((item) => item.symbol)))).catch(() => {});
  }, [canWatch]);

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
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
  }

  useEffect(() => {
    let active = true;
    const symbolRequest = hasCapability(user.role, 'symbols.read')
      ? api.market.symbols()
      : Promise.resolve({ items: [], total: 0 });
    Promise.all([api.market.status(), api.market.summary(), symbolRequest])
      .then(([status, summary, symbols]) => {
        if (active) setData({ status, summary, symbols });
      })
      .catch((requestError) => { if (active) setError(requestError.message || 'Không tải được tổng quan.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user.role]);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLocaleUpperCase('vi-VN');
    const filtered = data.symbols.items.filter((item) => {
      const matchesQuery = !q || item.symbol.includes(q) || item.name.toLocaleUpperCase('vi-VN').includes(q);
      const matchesExchange = exchange === 'Tất cả sàn' || item.exchange === exchange;
      const matchesIndustry = !industry || item.industry === industry;
      const matchesLiquidity = !minTurnover || item.averageTurnover20d >= Number(minTurnover);
      return matchesQuery && matchesExchange && matchesIndustry && matchesLiquidity;
    });
    const value = SORTS[sort.key];
    const factor = sort.direction === 'asc' ? 1 : -1;
    return filtered.sort((a, b) => factor * (sort.key === 'symbol' ? value(a).localeCompare(value(b)) : value(a) - value(b)));
  }, [data, query, exchange, industry, minTurnover, sort]);
  const industries = useMemo(() => [...new Set((data?.symbols.items ?? []).map((item) => item.industry).filter(Boolean))].sort(), [data]);

  if (loading) return <section className="content"><div className="card loading-card">Đang tải dữ liệu tổng quan…</div></section>;
  if (error) return <section className="content"><div className="note bad" role="alert">{error}</div></section>;
  if (!data) return null;

  const canReadSymbols = hasCapability(user.role, 'symbols.read');
  const breadth = data.summary.breadth;
  const breadthTotal = breadth.advances + breadth.nochanges + breadth.declines || 1;

  return (
    <section className="content">
      <div className="pagehead">
        <div>
          <span className="eyebrow">THỊ TRƯỜNG CỔ PHIẾU VIỆT NAM</span>
          <h1>Tổng quan thị trường</h1>
          <p>Theo dõi trạng thái dữ liệu và dự báo gần nhất theo từng mã.</p>
        </div>
        <div className="overview-meta">
          <span className="chip info">DỮ LIỆU MẪU</span>
          <span className="small muted">Ngày dữ liệu: <b>{formatDataDate(data.status.dataDate)}</b></span>
        </div>
      </div>

      <div className="note warn demo-disclaimer">
        <strong>Bản demo:</strong> giá và dự báo bên dưới là dữ liệu mẫu để dựng giao diện, không phải tín hiệu giao dịch.
      </div>

      <section className="market-strip" aria-label="Tóm tắt thị trường">
        {data.summary.indices.map((index) => (
          <article className="market-tile" key={index.code}>
            <span className="small muted">{index.label}</span>
            <strong className="market-value num">{number.format(index.value)}</strong>
            <span className={index.changePercent >= 0 ? 'c-up small' : 'c-down small'}>
              {formatChange(index.changePercent)} <span className="muted">({index.changePoints > 0 ? '+' : ''}{index.changePoints.toFixed(2)})</span>
            </span>
          </article>
        ))}
        <article className="market-tile breadth-tile">
          <span className="small muted">Độ rộng thị trường</span>
          <strong className="market-value num">{breadth.advances} tăng · {breadth.nochanges} đứng · {breadth.declines} giảm</strong>
          <div className="breadth" aria-label={`Tăng ${breadth.advances}, không đổi ${breadth.nochanges}, giảm ${breadth.declines}`}>
            <i className="bg-up" style={{ width: `${(breadth.advances / breadthTotal) * 100}%` }} />
            <i className="bg-hold" style={{ width: `${(breadth.nochanges / breadthTotal) * 100}%` }} />
            <i className="bg-down" style={{ width: `${(breadth.declines / breadthTotal) * 100}%` }} />
          </div>
        </article>
      </section>

      <section className="card">
        <div className="card-h overview-toolbar">
          <div>
            <h2>{canReadSymbols ? 'Tín hiệu theo mã' : 'Trạng thái mô hình'}</h2>
            <p className="small muted">Cập nhật batch: {sessionDateTime.format(new Date(data.status.batchCompletedAt))} ICT · Model {data.status.modelVersion}</p>
          </div>
          {canReadSymbols && <div className="overview-filters">
            <label className="search overview-search">
              <span aria-hidden="true">⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã hoặc tên công ty" aria-label="Tìm mã hoặc tên công ty" />
            </label>
            <select value={exchange} onChange={(event) => setExchange(event.target.value)} aria-label="Lọc theo sàn">
              <option>Tất cả sàn</option><option>HOSE</option><option>HNX</option><option>UPCOM</option>
            </select>
            <select value={industry} onChange={(event) => setIndustry(event.target.value)} aria-label="Lọc theo ngành">
              <option value="">Tất cả ngành</option>{industries.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={minTurnover} onChange={(event) => setMinTurnover(event.target.value)} aria-label="Lọc theo thanh khoản">
              {LIQUIDITY_OPTIONS.map(([value, label]) => <option key={label} value={value}>{label}</option>)}
            </select>
            <div className="seg" role="group" aria-label="Kỳ hạn dự báo">
              <button type="button" className={horizon === 't2' ? 'on' : ''} onClick={() => setHorizon('t2')}>T+2</button>
              <button type="button" className={horizon === 't5' ? 'on' : ''} onClick={() => setHorizon('t5')}>T+5</button>
            </div>
          </div>}
        </div>

        {watchError && <div className="note bad" role="alert">{watchError}</div>}
        {canReadSymbols ? <div className="tw">
          <table>
            <thead><tr>
              {canWatch && <th aria-label="Watchlist" />}
              <SortHeader label="Mã / Công ty" sortKey="symbol" sort={sort} onSort={sortBy} />
              <th>Sàn</th><th>Ngành</th>
              <SortHeader label="Giá đóng cửa" sortKey="closePrice" sort={sort} onSort={sortBy} align="r" />
              <SortHeader label="Thay đổi" sortKey="changePercent" sort={sort} onSort={sortBy} align="r" />
              <SortHeader label="GTGD TB 20 phiên" sortKey="averageTurnover20d" sort={sort} onSort={sortBy} align="r" />
              <th>Kỳ hạn</th><th>Dự báo</th><th className="r">Xác suất nhãn</th>
            </tr></thead>
            <tbody>
              {rows.map((item) => {
                const forecast = item.forecasts[horizon];
                return <tr key={item.symbol} className="symbol-row" onClick={() => navigate(`/symbols/${item.symbol}`)} onKeyDown={(event) => { if (event.key === 'Enter') navigate(`/symbols/${item.symbol}`); }} tabIndex={0} aria-label={`Mở chi tiết ${item.symbol}`}>
                  {canWatch && <td><button type="button" className={`watch-star ${watchlist.has(item.symbol) ? 'on' : ''}`} onClick={(event) => toggleWatch(event, item.symbol)} aria-label={watchlist.has(item.symbol) ? `Bỏ ${item.symbol} khỏi watchlist` : `Thêm ${item.symbol} vào watchlist`} aria-pressed={watchlist.has(item.symbol)}>{watchlist.has(item.symbol) ? '★' : '☆'}</button></td>}
                  <td><span className="sym">{item.symbol}</span><small className="company-name">{item.name}</small></td>
                  <td><span className="tag">{item.exchange}</span></td>
                  <td className="small">{item.industry ?? '—'}</td>
                  <td className="r num">{money.format(item.closePrice)} ₫</td>
                  <td className={`r num ${item.changePercent >= 0 ? 'c-up' : 'c-down'}`}>{formatChange(item.changePercent)}</td>
                  <td className="r num">{item.averageTurnover20d ? `${compactMoney.format(item.averageTurnover20d)} ₫` : '—'}</td>
                  <td><span className="hz">{horizon.toUpperCase()}</span></td>
                  <td><ForecastBadge label={forecast.label} /></td>
                  <td className="r num">{Math.round(forecast.probabilities[forecast.label] * 100)}%</td>
                </tr>;
              })}
              {!rows.length && <tr><td colSpan={canWatch ? 11 : 10} className="empty-row">Không tìm thấy mã phù hợp.</td></tr>}
            </tbody>
          </table>
        </div> : <div className="admin-summary-card"><p>Vai trò quản trị có quyền xem trạng thái thị trường và mô hình. Danh sách mã và dữ liệu phân tích người dùng không nằm trong quyền truy cập màn hình này.</p></div>}
        {canReadSymbols && <div className="table-foot small muted">Hiển thị {rows.length} / {data.symbols.items.length} mã mẫu · Dữ liệu giả lập cho giao diện.</div>}
      </section>

      <p className="disclaimer">
        StockSense VN là công cụ tham khảo và nghiên cứu, không phải dịch vụ tư vấn đầu tư. Dự báo không cam kết lợi nhuận và không tự động đặt lệnh.
      </p>
    </section>
  );
}

function SortHeader({ label, sortKey, sort, onSort, align = '' }) {
  const active = sort.key === sortKey;
  return <th className={align} aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
    <button type="button" className="sort-button" onClick={() => onSort(sortKey)}>{label}{active ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : ''}</button>
  </th>;
}
