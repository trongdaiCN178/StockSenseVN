import { useEffect, useState } from 'react';
import { api } from '../../api/index.js';
import { navigate } from '../../app/navigation.js';
import { ForecastBadge } from '../../components/ForecastBadge.jsx';
import { PriceChart } from './PriceChart.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { hasCapability } from '@stocksense/core/access';

const money = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });

export function SymbolDetailPage({ symbol }) {
  const { user } = useAuth();
  const canExportHistory = hasCapability(user.role, 'history.csv.export') && import.meta.env.VITE_HISTORY_CSV_EXPORT_ENABLED === 'true';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportError, setReportError] = useState('');
  const [tab, setTab] = useState('forecast');

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([api.symbols.detail(symbol), api.symbols.prices(symbol), api.symbols.news(symbol)])
      .then(([detail, prices, news]) => { if (active) setData({ detail, prices, news }); })
      .catch((requestError) => { if (active) setError(requestError.message || 'Không tải được dữ liệu mã cổ phiếu.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [symbol]);

  if (loading) return <section className="content"><div className="card loading-card">Đang tải dữ liệu {symbol}…</div></section>;
  if (error) return <section className="content"><div className="card"><button className="text-button" onClick={() => navigate('/overview')}>← Về tổng quan</button><div className="note bad" role="alert">{error}</div></div></section>;
  if (!data) return null;

  const { detail, prices, news } = data;
  return <section className="content symbol-detail">
    <button className="text-button back-link" onClick={() => navigate('/overview')}>← Tổng quan thị trường</button>
    <header className="pagehead detail-head">
      <div><span className="eyebrow">CHI TIẾT MÃ · {detail.exchange}</span><h1>{detail.symbol} <span className="muted">· {detail.name}</span></h1>
        <p className="detail-price">{money.format(detail.closePrice)} ₫ <span className={detail.changePercent >= 0 ? 'c-up' : 'c-down'}>{detail.changePercent > 0 ? '+' : ''}{detail.changePercent.toFixed(2)}%</span></p>
        <div className="pagehead-actions"><button className="btn sm" type="button" onClick={() => api.reports.symbol(symbol).catch((e) => setReportError(e.message))}>Xuất báo cáo PDF</button>
          {canExportHistory && <button className="btn sm" type="button" onClick={() => api.symbols.historyCsv(symbol).catch((e) => setReportError(e.message))}>Xuất lịch sử CSV</button>}</div>
      </div>
      <span className={`chip ${detail.priceDataStatus === 'live' ? 'up' : 'info'}`}>{detail.priceDataStatus === 'live' ? 'GIÁ SSI' : 'GIÁ MẪU'}</span>
    </header>
    {reportError && <div className="note bad" role="alert">{reportError}</div>}
    <div className="note warn demo-disclaimer"><strong>Nguồn dữ liệu:</strong> {detail.priceDataStatus === 'live' ? `Giá thị trường từ SSI cập nhật đến ${detail.priceDate}.` : 'Giá đang dùng dữ liệu minh họa.'} Dự báo và tin tức hiện vẫn là dữ liệu mẫu.</div>
    <nav className="detail-tabs" aria-label="Nội dung chi tiết mã">
      {[['forecast', 'Dự báo'], ['news', 'Tin tức'], ['history', 'Lịch sử'], ['audit', 'Phân tích mô hình']].map(([id, label]) => <button key={id} type="button" className={tab === id ? 'on' : ''} disabled={!['forecast', 'news', 'history'].includes(id)} onClick={() => setTab(id)}>{label}{!['forecast', 'news', 'history'].includes(id) && <small>Sắp có</small>}</button>)}
    </nav>
    {tab === 'history' ? <article className="card detail-history">
      <div className="card-h"><div><h2>Lịch sử giá</h2><p className="small muted">Giá đóng cửa · {prices.latestDate ? `cập nhật đến ${prices.latestDate}` : 'chưa có ngày cập nhật'}</p></div>
        <span className={`chip ${prices.sourceStatus === 'live' ? 'up' : 'info'}`}>{prices.sourceStatus === 'live' ? 'SSI' : prices.sourceStatus === 'mixed' ? 'DỮ LIỆU TRỘN' : 'MẪU'}</span></div>
      <PriceChart items={prices.items} />
      {prices.items.length === 0 ? <div className="note">Chưa có dữ liệu lịch sử giá cho mã {symbol}.</div> : <div className="history-table-wrap">
        <table className="history-table">
          <thead><tr><th>Ngày</th><th>Đóng cửa</th></tr></thead>
          <tbody>{prices.items.slice().reverse().map((item) => <tr key={item.date}><td>{item.date}</td><td>{money.format(item.close)} ₫</td></tr>)}</tbody>
        </table>
      </div>}
    </article> : tab === 'forecast' ? <div className="detail-grid">
      <article className="card detail-forecast"><div className="card-h"><div><h2>Dự báo ngắn hạn</h2><p className="small muted">Kết quả batch gần nhất</p></div><span className="tag">T+2</span></div>
        <div className="forecast-result"><ForecastBadge label={detail.forecasts.t2.label} /><span className="muted">Độ tin cậy: <b>{detail.forecasts.t2.confidence}</b></span></div>
        <div className="probability-list">{[['up', 'Tăng'], ['hold', 'Đi ngang'], ['down', 'Giảm']].map(([key, label]) => <div className="probability-row" key={key}><span>{label}</span><div className="prob-track"><i className={`prob-fill ${key}`} style={{ width: `${detail.forecasts.t2.probabilities[key] * 100}%` }} /></div><b>{Math.round(detail.forecasts.t2.probabilities[key] * 100)}%</b></div>)}</div>
        <p className="small muted">Xác suất là ước lượng của mô hình, không phải cam kết kết quả.</p>
      </article>
      <article className="card"><div className="card-h"><div><h2>Lịch sử giá</h2><p className="small muted">Giá đóng cửa · {prices.latestDate ? `cập nhật đến ${prices.latestDate}` : 'chưa có ngày cập nhật'}</p></div><span className={`chip ${prices.sourceStatus === 'live' ? 'up' : 'info'}`}>{prices.sourceStatus === 'live' ? 'SSI' : prices.sourceStatus === 'mixed' ? 'DỮ LIỆU TRỘN' : 'MẪU'}</span></div><PriceChart items={prices.items} /></article>
      <article className="card detail-news"><div className="card-h"><div><h2>Tin liên quan</h2><p className="small muted">Thông tin minh họa theo mã {symbol}</p></div><button className="text-button" onClick={() => setTab('news')}>Xem tất cả →</button></div>
        {news.items.length === 0 ? <div className="note">Chưa có tin tức nào cho mã {symbol}.</div> : news.items.slice(0, 2).map((item) => <NewsItem key={item.id} item={item} />)}
      </article>
    </div> : <article className="card news-list"><div className="card-h"><div><h2>Tin liên quan đến {symbol}</h2><p className="small muted">Kiểm tra nguồn và thời điểm công bố trước khi sử dụng.</p></div></div>{news.items.length === 0 ? <div className="note">Chưa có tin tức nào cho mã {symbol}.</div> : news.items.map((item) => <NewsItem key={item.id} item={item} />)}</article>}
    <p className="disclaimer">StockSense VN là công cụ tham khảo và nghiên cứu, không phải dịch vụ tư vấn đầu tư. Dự báo không cam kết lợi nhuận và không tự động đặt lệnh.</p>
  </section>;
}

function NewsItem({ item }) {
  return <article className="news-item"><div className="news-meta"><span>{item.source}</span><time dateTime={item.publishedAt}>{dateTime.format(new Date(item.publishedAt))}</time></div><h3>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.title}</a> : item.title}</h3><p>{item.summary}</p></article>;
}
