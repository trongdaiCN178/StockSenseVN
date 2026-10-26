import { useEffect, useState } from 'react';
import { api } from '../../api/index.js';
import { navigate } from '../../app/navigation.js';
import { PriceChart } from './PriceChart.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { hasCapability } from '@stocksense/core/access';
import { Disclaimer, Icon } from '../../app/icons.jsx';
import { ForecastCard, addTradingDays } from '../../components/forecast.jsx';

const money = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });
const SENTIMENT = { positive: ['up', 'Tích cực'], neutral: ['neutral', 'Trung tính'], negative: ['down', 'Tiêu cực'] };
const formatChange = (value) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(2).replace('.', ',')}%`;
const changeClass = (value) => (value > 0 ? 'c-up' : value < 0 ? 'c-down' : 'c-hold');

export function SymbolDetailPage({ symbol }) {
  const { user } = useAuth();
  const canExportHistory = hasCapability(user.role, 'history.csv.export') && import.meta.env.VITE_HISTORY_CSV_EXPORT_ENABLED === 'true';
  const canWatch = hasCapability(user.role, 'watchlist.manage.self');
  const canPlan = hasCapability(user.role, 'plans.manage.self');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [tab, setTab] = useState('fc');
  const [range, setRange] = useState('6m');
  const [newsFrom, setNewsFrom] = useState('');
  const [newsTo, setNewsTo] = useState('');
  const [watching, setWatching] = useState(false);
  const [watchBusy, setWatchBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setTab('fc'); setRange('6m');
    Promise.all([api.symbols.detail(symbol), api.symbols.prices(symbol, '6m'), api.symbols.news(symbol), api.market.status().catch(() => null)])
      .then(([detail, prices, news, status]) => { if (active) setData({ detail, prices, news, status }); })
      .catch((requestError) => { if (active) setError(requestError.message || 'Không tải được dữ liệu mã cổ phiếu.'); })
      .finally(() => { if (active) setLoading(false); });
    if (canWatch) api.watchlist.list().then((result) => { if (active) setWatching(result.items.some((item) => item.symbol === symbol)); }).catch(() => {});
    return () => { active = false; };
  }, [symbol, canWatch]);

  async function changeRange(nextRange) {
    setRange(nextRange);
    try { const prices = await api.symbols.prices(symbol, nextRange); setData((current) => ({ ...current, prices })); }
    catch (requestError) { setActionError(requestError.message || 'Không tải được lịch sử giá.'); }
  }
  // FR-M5-01: watchlist toggle from the symbol page.
  async function toggleWatch() {
    setWatchBusy(true); setActionError('');
    try {
      if (watching) await api.watchlist.remove(symbol); else await api.watchlist.add(symbol);
      setWatching(!watching);
    } catch (requestError) { setActionError(requestError.message || 'Không cập nhật được watchlist.'); }
    finally { setWatchBusy(false); }
  }

  if (loading) return <main className="content"><div className="card muted">Đang tải dữ liệu {symbol}…</div></main>;
  if (error) return <main className="content"><div><button className="btn sm" type="button" onClick={() => navigate('/overview')}>← Tổng quan</button></div><div className="note bad" role="alert">{error}</div></main>;
  if (!data) return null;

  const { detail, prices, news, status } = data;
  const t2 = detail.forecasts?.t2; const t5 = detail.forecasts?.t5;
  const conflict = (t2?.label === 'up' && t5?.label === 'down') || (t2?.label === 'down' && t5?.label === 'up');
  const labelText = { up: 'Tăng', hold: 'Đi ngang', down: 'Giảm' };
  // FR-M4-03: filter news by publication date (ICT calendar day).
  const newsDay = (item) => new Date(item.publishedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const filteredNews = news.items.filter((item) => (!newsFrom || newsDay(item) >= newsFrom) && (!newsTo || newsDay(item) <= newsTo));
  const rangeSwitch = <div className="seg" role="group" aria-label="Khoảng thời gian">{[['1m', '1 tháng'], ['3m', '3 tháng'], ['6m', '6 tháng']].map(([value, label]) => <button key={value} type="button" className={range === value ? 'on' : ''} onClick={() => changeRange(value)}>{label}</button>)}</div>;
  const priceDate = detail.priceDate ? new Date(`${detail.priceDate}T00:00:00`).toLocaleDateString('vi-VN') : '—';

  return <main className="content">
    <div><button className="btn sm" type="button" onClick={() => navigate('/overview')}>← Tổng quan</button></div>
    <div className="dhead">
      <div><div className="small muted">{detail.exchange}{detail.industry ? ` · ${detail.industry}` : ''}</div>
        <h1 style={{ fontSize: 28 }}>{detail.symbol} <span style={{ fontWeight: 500, fontSize: 16 }} className="muted">{detail.name}</span></h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', marginTop: 4, flexWrap: 'wrap' }}><span className="px num">{money.format(detail.closePrice)}</span><span className={`num ${changeClass(detail.changePercent)}`}>{formatChange(detail.changePercent)}</span><span className="small muted">đóng cửa {priceDate} · {detail.priceDataStatus === 'live' ? 'giá SSI' : 'giá minh họa'}</span></div></div>
      <div className="actions">
        {canWatch && <button className="btn" type="button" disabled={watchBusy} onClick={toggleWatch}><Icon name={watching ? 'star' : 'plus'} />{watching ? 'Đang theo dõi' : 'Thêm watchlist'}</button>}
        {canPlan && <button className="btn" type="button" onClick={() => navigate(`/plans?symbol=${encodeURIComponent(symbol)}`)}><Icon name="target" />Lập Trade Plan</button>}
        <button className="btn" type="button" onClick={() => api.reports.symbol(symbol).catch((e) => setActionError(e.message))}><Icon name="pdf" />Xuất PDF</button>
        {canExportHistory && <button className="btn" type="button" onClick={() => api.symbols.historyCsv(symbol).catch((e) => setActionError(e.message))}><Icon name="dl" />CSV giá</button>}
      </div>
    </div>
    {actionError && <div className="note bad" role="alert">{actionError}</div>}
    <div className="tabs" role="tablist">{[['fc', 'Dự báo'], ['news', 'Tin tức'], ['hist', 'Lịch sử giá']].map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>)}
      <button type="button" disabled title="Cần mô hình AI">Giải thích mô hình <span className="tag">Sắp có</span></button></div>

    {tab === 'fc' && <>
      {conflict && <div className="note warn"><b>Mâu thuẫn kỳ hạn.</b> T+2 dự báo {labelText[t2.label]}, T+5 dự báo {labelText[t5.label]}. Nên đọc cả hai thẻ trước khi quyết định.</div>}
      {status?.state === 'demo' && <div className="note info">Dự báo hiển thị là <b>dữ liệu mẫu</b> trong khi mô hình AI chưa triển khai; giá thị trường {detail.priceDataStatus === 'live' ? 'lấy từ SSI' : 'là dữ liệu minh họa'}.</div>}
      <div className="fcs"><ForecastCard horizon="t2" forecast={t2} dueDate={addTradingDays(status?.dataDate, 2)} /><ForecastCard horizon="t5" forecast={t5} dueDate={addTradingDays(status?.dataDate, 5)} /></div>
      <div className="grid g2">
        <section className="card"><div className="card-h"><h2>Tin mới nhất</h2><button className="btn sm" type="button" onClick={() => setTab('news')}>Xem tất cả</button></div>
          <div className="news">{news.items.slice(0, 3).map((item) => <NewsItem key={item.id} item={item} />)}{!news.items.length && <p className="muted">Chưa có tin tức cho mã {symbol}.</p>}</div></section>
        <section className="card"><div className="card-h"><h2>Trạng thái dữ liệu</h2></div>
          <dl className="kv"><dt>Giá</dt><dd>{detail.priceDataStatus === 'live' ? <span className="chip up">SSI · {priceDate}</span> : <span className="chip hold">Dữ liệu minh họa</span>}</dd>
            <dt>Tin tức</dt><dd>{news.items.length ? <span className="chip up">{news.items.length} bài</span> : <span className="chip hold">Thiếu tin</span>}</dd>
            <dt>Dự báo</dt><dd>{status?.state === 'demo' ? <span className="chip hold">Dữ liệu mẫu</span> : <span className="chip up">Mô hình {status?.modelVersion}</span>}</dd>
            <dt>Batch</dt><dd className="num">{status?.batchCompletedAt ? dateTime.format(new Date(status.batchCompletedAt)) : '—'}</dd></dl>
          <div className="small muted" style={{ marginTop: 12 }}>Phần “Vì sao?” và “Điều gì có thể làm dự báo sai” sẽ có khi mô hình AI và giải thích (SHAP) sẵn sàng.</div></section>
      </div>
      <section className="card chart"><div className="card-h"><h2>Giá và khối lượng</h2>{rangeSwitch}</div><PriceChart items={prices.items} /></section>
      <Disclaimer />
    </>}

    {tab === 'news' && <section className="card"><div className="card-h"><h2>Tin liên quan</h2>
      <div className="actions news-filters"><div className="field"><label htmlFor="news-from">Từ ngày</label><input id="news-from" type="date" value={newsFrom} max={newsTo || undefined} onChange={(e) => setNewsFrom(e.target.value)} /></div>
        <div className="field"><label htmlFor="news-to">Đến ngày</label><input id="news-to" type="date" value={newsTo} min={newsFrom || undefined} onChange={(e) => setNewsTo(e.target.value)} /></div>
        {(newsFrom || newsTo) && <button className="btn sm" type="button" onClick={() => { setNewsFrom(''); setNewsTo(''); }}>Bỏ lọc</button>}</div></div>
      <div className="news">{filteredNews.map((item) => <NewsItem key={item.id} item={item} />)}
        {!news.items.length ? <p className="muted">Chưa có tin tức nào cho mã {symbol}.</p> : !filteredNews.length && <p className="muted">Không có tin trong khoảng ngày đã chọn.</p>}</div>
      <div className="small muted" style={{ marginTop: 8 }}>Mới nhất trước. Hệ thống chỉ hiển thị tiêu đề, sapo và link gốc. Nhãn sắc thái sẽ chính xác khi mô hình sentiment sẵn sàng.</div>
    </section>}

    {tab === 'hist' && <>
      <section className="card chart"><div className="card-h"><h2>Lịch sử giá</h2>{rangeSwitch}</div><PriceChart items={prices.items} /></section>
      <section className="card"><div className="card-h"><h2>Giá đóng cửa theo phiên</h2><span className="small muted">{prices.sourceStatus === 'live' ? 'Nguồn SSI' : 'Dữ liệu minh họa'}</span></div>
        <div className="tw" style={{ maxHeight: 420, overflowY: 'auto' }}><table><thead><tr><th>Ngày</th><th className="r">Đóng cửa</th><th className="r">Khối lượng</th></tr></thead>
          <tbody>{prices.items.slice().reverse().map((item) => <tr key={item.date}><td className="num">{new Date(`${item.date}T00:00:00`).toLocaleDateString('vi-VN')}</td><td className="r num">{money.format(item.close)}</td><td className="r num">{item.volume == null ? '—' : money.format(item.volume)}</td></tr>)}
            {!prices.items.length && <tr><td colSpan="3" className="muted">Chưa có dữ liệu giá.</td></tr>}</tbody></table></div>
      </section>
    </>}
  </main>;
}

function NewsItem({ item }) {
  const [tone, text] = SENTIMENT[item.sentiment] ?? SENTIMENT.neutral;
  return <article><h4>{item.title}</h4><span className={`chip ${tone}`} style={{ gridRow: 'span 2', alignSelf: 'start' }}>{text}</span><p>{item.summary}</p>
    <div className="meta">{item.source} · <span className="num">{dateTime.format(new Date(item.publishedAt))}</span>{item.url && <> · <a href={item.url} target="_blank" rel="noopener noreferrer">Đọc bài gốc ↗</a></>}</div></article>;
}
