import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/index.js';
import { navigate } from '../../app/navigation.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { hasCapability } from '@stocksense/core/access';
import { Disclaimer } from '../../app/icons.jsx';
import { MiniLab } from '../../components/forecast.jsx';

const price = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const billions = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const SORTS = {
  symbol: (row) => row.symbol, close: (row) => row.close ?? 0, change: (row) => row.changePercent ?? 0,
  volume: (row) => row.volume ?? 0, turnover: (row) => row.turnover ?? 0,
};
const tone = (value) => `tone-${value}`;
const signed = (value, format) => (value == null ? '—' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${format(Math.abs(value))}`);

// End-of-day price board for the tracked symbols (not real-time; no order entry).
export function PriceBoardPage() {
  const { user } = useAuth();
  const canWatch = hasCapability(user.role, 'watchlist.manage.self');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [exchange, setExchange] = useState('all');
  const [industry, setIndustry] = useState('');
  const [query, setQuery] = useState('');
  const [onlyWatch, setOnlyWatch] = useState(false);
  const [watchlist, setWatchlist] = useState(new Set());
  const [sort, setSort] = useState({ key: 'symbol', direction: 'asc' });

  useEffect(() => {
    let active = true;
    api.market.board().then((result) => { if (active) setData(result); })
      .catch((requestError) => { if (active) setError(requestError.message || 'Không tải được bảng giá.'); });
    if (canWatch) api.watchlist.list().then((result) => { if (active) setWatchlist(new Set(result.items.map((item) => item.symbol))); }).catch(() => {});
    return () => { active = false; };
  }, [canWatch]);

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toUpperCase();
    const filtered = data.items.filter((row) => (exchange === 'all' || row.exchange === exchange)
      && (!industry || row.industry === industry)
      && (!onlyWatch || watchlist.has(row.symbol))
      && (!needle || row.symbol.includes(needle) || row.name.toUpperCase().includes(needle)));
    const value = SORTS[sort.key];
    const factor = sort.direction === 'asc' ? 1 : -1;
    return filtered.sort((a, b) => factor * (sort.key === 'symbol' ? value(a).localeCompare(value(b)) : value(a) - value(b)));
  }, [data, exchange, industry, query, onlyWatch, watchlist, sort]);

  if (error) return <main className="content"><div className="note bad" role="alert">{error}</div></main>;
  if (!data) return <main className="content"><div className="card muted">Đang tải bảng giá…</div></main>;

  const industries = [...new Set(data.items.map((row) => row.industry).filter(Boolean))].sort();
  const exchanges = ['all', ...['HOSE', 'HNX', 'UPCOM'].filter((code) => data.items.some((row) => row.exchange === code))];
  const count = (t) => data.items.filter((row) => row.tones.close === t).length;
  const sortBy = (key) => setSort((current) => ({ key, direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc' }));
  const open = (symbol) => navigate(`/symbols/${symbol}`);

  return <main className="content">
    <div className="pagehead"><div><h1>Bảng giá</h1>
      <p>Giá cuối ngày của {data.items.length} mã đang theo dõi, phiên {data.date ? new Date(`${data.date}T00:00:00`).toLocaleDateString('vi-VN') : '—'}. Bấm vào một mã để xem biểu đồ và chi tiết.</p></div>
      <div className="board-breadth small num"><span className="tone-ceiling">Trần {count('ceiling')}</span><span className="tone-up">Tăng {count('up')}</span><span className="tone-ref">Đứng {count('ref')}</span><span className="tone-down">Giảm {count('down')}</span><span className="tone-floor">Sàn {count('floor')}</span></div></div>

    <section className="card">
      <div className="card-h">
        <div className="seg">{exchanges.map((value) => <button key={value} type="button" className={exchange === value ? 'on' : ''} onClick={() => setExchange(value)}>{value === 'all' ? 'Tất cả' : value}</button>)}</div>
        <div className="actions">
          <div className="field" style={{ flexDirection: 'row' }}><input type="search" aria-label="Tìm mã" placeholder="Tìm mã hoặc tên" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <div className="field" style={{ flexDirection: 'row' }}><select aria-label="Lọc theo ngành" value={industry} onChange={(event) => setIndustry(event.target.value)}><option value="">Mọi ngành</option>{industries.map((item) => <option key={item}>{item}</option>)}</select></div>
          {canWatch && <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={onlyWatch} onChange={(event) => setOnlyWatch(event.target.checked)} />Chỉ watchlist</label>}
        </div>
      </div>
      <div className="tw"><table className="board-table">
        <thead><tr>
          <Sort label="Mã" sortKey="symbol" sort={sort} onSort={sortBy} />
          <th className="r">TC</th><th className="r">Trần</th><th className="r">Sàn</th>
          <Sort label="Đóng cửa" sortKey="close" sort={sort} onSort={sortBy} align="r" />
          <th className="r">+/−</th>
          <Sort label="%" sortKey="change" sort={sort} onSort={sortBy} align="r" />
          <th className="r">Mở cửa</th><th className="r">Cao</th><th className="r">Thấp</th>
          <Sort label="Tổng KL" sortKey="volume" sort={sort} onSort={sortBy} align="r" />
          <Sort label="GTGD (tỷ)" sortKey="turnover" sort={sort} onSort={sortBy} align="r" />
          <th>T+2</th><th>T+5</th>
        </tr></thead>
        <tbody>{rows.map((row) => <tr key={row.symbol} className="click symbol-row" tabIndex={0} onClick={() => open(row.symbol)} onKeyDown={(event) => { if (event.key === 'Enter') open(row.symbol); }}>
          <td><span className={`sym ${tone(row.tones.close)}`}>{watchlist.has(row.symbol) && <span className="watch-dot" title="Trong watchlist">★ </span>}{row.symbol}<small>{row.exchange}{row.industry ? ` · ${row.industry}` : ''}</small></span></td>
          <td className="r num tone-ref">{row.reference == null ? '—' : price.format(row.reference)}</td>
          <td className="r num tone-ceiling">{row.ceiling == null ? '—' : price.format(row.ceiling)}</td>
          <td className="r num tone-floor">{row.floor == null ? '—' : price.format(row.floor)}</td>
          <td className={`r num board-close ${tone(row.tones.close)}`}>{row.close == null ? '—' : price.format(row.close)}</td>
          <td className={`r num ${tone(row.tones.close)}`}>{signed(row.change, price.format)}</td>
          <td className={`r num ${tone(row.tones.close)}`}>{row.changePercent == null ? '—' : `${signed(row.changePercent, (v) => v.toFixed(2).replace('.', ','))}%`}</td>
          <td className={`r num ${tone(row.tones.open)}`}>{row.open == null ? '—' : price.format(row.open)}</td>
          <td className={`r num ${tone(row.tones.high)}`}>{row.high == null ? '—' : price.format(row.high)}</td>
          <td className={`r num ${tone(row.tones.low)}`}>{row.low == null ? '—' : price.format(row.low)}</td>
          <td className="r num">{row.volume == null ? '—' : price.format(row.volume)}</td>
          <td className="r num">{row.turnover == null ? '—' : billions.format(row.turnover / 1e9)}</td>
          <td><MiniLab forecast={row.forecasts?.t2} /></td>
          <td><MiniLab forecast={row.forecasts?.t5} /></td>
        </tr>)}
        {!rows.length && <tr><td colSpan="14" className="muted">Không có mã khớp bộ lọc.</td></tr>}</tbody>
      </table></div>
      <div className="board-legend small muted">
        <span><i className="sw tone-ceiling" />Trần</span><span><i className="sw tone-up" />Tăng</span><span><i className="sw tone-ref" />Tham chiếu</span><span><i className="sw tone-down" />Giảm</span><span><i className="sw tone-floor" />Sàn</span>
        <span>Dữ liệu cuối ngày từ SSI, không phải thời gian thực. TC/trần/sàn tính từ phiên trước theo biên độ HOSE ±7%, HNX ±10%, UPCoM ±15% (UPCoM: giá bình quân).</span>
      </div>
    </section>
    <Disclaimer />
  </main>;
}

function Sort({ label, sortKey, sort, onSort, align = '' }) {
  const active = sort.key === sortKey;
  return <th className={align} aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
    <button type="button" className="sort-button" onClick={() => onSort(sortKey)}>{label}{active ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : ''}</button>
  </th>;
}
