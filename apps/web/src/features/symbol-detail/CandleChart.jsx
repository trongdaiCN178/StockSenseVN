import { useEffect, useMemo, useRef, useState } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
import { aggregateBars, sma, rsi, macd } from '@stocksense/core/indicators';

const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const INTERVALS = [['day', 'Ngày'], ['week', 'Tuần'], ['month', 'Tháng']];
const RANGES = [['1m', '1T', 1], ['3m', '3T', 3], ['6m', '6T', 6], ['1y', '1N', 12], ['all', 'Tất cả', null]];
const MA_COLORS = { ma20: '#E3A008', ma50: '#7C5CDB' };

const cssVar = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
const series = (bars, values) => bars.map((bar, i) => (values[i] == null ? { time: bar.date } : { time: bar.date, value: values[i] }));

// Indicator panes hide the time axis and the TradingView logo (shown once on the main chart);
// a fixed price-axis width keeps their bars aligned with the candles above.
function baseOptions(colors, { showTime = true } = {}) {
  return {
    autoSize: true,
    layout: { background: { color: 'transparent' }, textColor: colors.muted, fontFamily: 'IBM Plex Mono, ui-monospace, monospace', fontSize: 11, attributionLogo: showTime },
    grid: { vertLines: { color: colors.line }, horzLines: { color: colors.line } },
    rightPriceScale: { borderColor: colors.line, minimumWidth: 84 },
    timeScale: { borderColor: colors.line, visible: showTime, rightOffset: 3 },
    crosshair: { mode: CrosshairMode.Normal },
    localization: { locale: 'vi-VN', priceFormatter: (value) => number.format(value) },
  };
}

// FR-M2-06: candlestick chart (TradingView Lightweight Charts) with volume, moving averages, RSI and MACD.
export function CandleChart({ bars = [], newsDays = [] }) {
  const mainRef = useRef(null);
  const rsiRef = useRef(null);
  const macdRef = useRef(null);
  const chartRef = useRef(null);
  const [barInterval, setBarInterval] = useState('day');
  const [range, setRange] = useState('6m');
  const [show, setShow] = useState({ ma20: true, ma50: true, news: true, rsi: true, macd: true });
  const [hover, setHover] = useState(null);

  const data = useMemo(() => aggregateBars(bars.filter((bar) => bar.open != null && bar.high != null && bar.low != null), barInterval), [bars, barInterval]);

  useEffect(() => {
    if (!mainRef.current || data.length < 2) return undefined;
    const colors = { up: cssVar('--up', '#0B8445'), down: cssVar('--down', '#C9352A'), line: cssVar('--line', '#DADFD8'), muted: cssVar('--muted', '#5A6660'), accent: cssVar('--accent', '#0B5D52') };
    const closes = data.map((bar) => bar.close);
    const charts = [];

    const main = createChart(mainRef.current, baseOptions(colors));
    charts.push(main);
    const candles = main.addCandlestickSeries({ upColor: colors.up, downColor: colors.down, wickUpColor: colors.up, wickDownColor: colors.down, borderVisible: false });
    candles.setData(data.map((bar) => ({ time: bar.date, open: bar.open, high: bar.high, low: bar.low, close: bar.close })));
    candles.priceScale().applyOptions({ scaleMargins: { top: 0.06, bottom: 0.26 } });
    if (show.news) candles.setMarkers(newsMarkers(data, newsDays, barInterval, colors.accent));
    const volume = main.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'volume', lastValueVisible: false, priceLineVisible: false });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volume.setData(data.map((bar, i) => ({ time: bar.date, value: bar.volume ?? 0, color: `${i && bar.close < data[i - 1].close ? colors.down : colors.up}66` })));
    for (const [key, period] of [['ma20', 20], ['ma50', 50]]) {
      if (!show[key]) continue;
      const line = main.addLineSeries({ color: MA_COLORS[key], lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      line.setData(series(data, sma(closes, period)));
    }

    const subs = [];
    if (show.rsi && rsiRef.current) {
      const chart = createChart(rsiRef.current, baseOptions(colors, { showTime: false }));
      const line = chart.addLineSeries({ color: colors.accent, lineWidth: 1, priceLineVisible: false, lastValueVisible: true });
      line.setData(series(data, rsi(closes, 14)));
      for (const level of [70, 30]) line.createPriceLine({ price: level, color: colors.muted, lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
      charts.push(chart); subs.push(chart);
    }
    if (show.macd && macdRef.current) {
      const chart = createChart(macdRef.current, baseOptions(colors, { showTime: false }));
      const { macd: macdLine, signal, histogram } = macd(closes);
      const hist = chart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });
      hist.setData(data.map((bar, i) => (histogram[i] == null ? { time: bar.date } : { time: bar.date, value: histogram[i], color: histogram[i] >= 0 ? `${colors.up}99` : `${colors.down}99` })));
      chart.addLineSeries({ color: '#2962FF', lineWidth: 1, priceLineVisible: false, lastValueVisible: false }).setData(series(data, macdLine));
      chart.addLineSeries({ color: '#FF6D00', lineWidth: 1, priceLineVisible: false, lastValueVisible: false }).setData(series(data, signal));
      charts.push(chart); subs.push(chart);
    }

    // Keep the indicator panes scrolled and zoomed together with the price chart.
    main.timeScale().subscribeVisibleLogicalRangeChange((logical) => {
      if (logical) subs.forEach((chart) => chart.timeScale().setVisibleLogicalRange(logical));
    });
    main.subscribeCrosshairMove((param) => {
      const bar = param.time ? data.find((item) => item.date === param.time) : null;
      setHover(bar ?? null);
    });
    chartRef.current = main;
    applyRange(main, data, range);
    return () => { chartRef.current = null; charts.forEach((chart) => chart.remove()); };
    // `range` is applied separately so changing it does not rebuild the charts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, show, newsDays]);

  useEffect(() => { if (chartRef.current) applyRange(chartRef.current, data, range); }, [range, data]);

  if (data.length < 2) return <div className="chart-empty">Chưa có đủ dữ liệu giá để vẽ biểu đồ nến.</div>;
  const last = hover ?? data.at(-1);
  const previous = data[data.indexOf(last) - 1];
  const change = previous ? last.close - previous.close : 0;

  return <div className="candle-chart">
    <div className="candle-toolbar">
      <div className="seg" role="group" aria-label="Khung thời gian">{INTERVALS.map(([value, label]) => <button key={value} type="button" className={barInterval === value ? 'on' : ''} onClick={() => setBarInterval(value)}>{label}</button>)}</div>
      <div className="seg" role="group" aria-label="Khoảng hiển thị">{RANGES.map(([value, label]) => <button key={value} type="button" className={range === value ? 'on' : ''} onClick={() => setRange(value)}>{label}</button>)}</div>
      <div className="seg" role="group" aria-label="Chỉ báo">{[['ma20', 'MA20'], ['ma50', 'MA50'], ['news', 'Tin'], ['rsi', 'RSI'], ['macd', 'MACD']].map(([key, label]) => <button key={key} type="button" aria-pressed={show[key]} className={show[key] ? 'on' : ''} onClick={() => setShow((current) => ({ ...current, [key]: !current[key] }))}>{label}</button>)}</div>
    </div>
    <div className="candle-legend num">
      <span>{new Date(`${last.date}T00:00:00`).toLocaleDateString('vi-VN')}</span>
      <span>O <b>{number.format(last.open)}</b></span><span>H <b>{number.format(last.high)}</b></span>
      <span>L <b>{number.format(last.low)}</b></span><span>C <b className={change > 0 ? 'c-up' : change < 0 ? 'c-down' : 'c-hold'}>{number.format(last.close)}</b></span>
      <span>KL <b>{last.volume == null ? '—' : number.format(last.volume)}</b></span>
      {show.ma20 && <span style={{ color: MA_COLORS.ma20 }}>MA20</span>}{show.ma50 && <span style={{ color: MA_COLORS.ma50 }}>MA50</span>}
    </div>
    <div ref={mainRef} className="candle-main" role="img" aria-label={`Biểu đồ nến từ ${data[0].date} đến ${data.at(-1).date}`} />
    {show.rsi && <><div className="candle-sub-title">RSI (14)</div><div ref={rsiRef} className="candle-sub" /></>}
    {show.macd && <><div className="candle-sub-title">MACD (12, 26, 9) <span style={{ color: '#2962FF' }}>MACD</span> <span style={{ color: '#FF6D00' }}>Signal</span></div><div ref={macdRef} className="candle-sub" /></>}
  </div>;
}

// FR-M2-06: mark sessions that have linked news. newsDays holds the session each article counts for
// (articles after 15:00 count for the next session); weekly/monthly bars collect the news inside them.
function newsMarkers(data, newsDays, interval, color) {
  const counts = new Map();
  for (const day of newsDays) {
    const index = interval === 'day'
      ? data.findIndex((bar) => bar.date >= day)
      : data.findLastIndex((bar) => bar.date <= day);
    if (index >= 0) counts.set(data[index].date, (counts.get(data[index].date) ?? 0) + 1);
  }
  return [...counts].sort(([a], [b]) => a.localeCompare(b))
    .map(([time, count]) => ({ time, position: 'belowBar', color, shape: 'circle', text: `${count} tin` }));
}

function applyRange(chart, data, range) {
  const months = RANGES.find(([value]) => value === range)?.[2];
  if (!months) { chart.timeScale().fitContent(); return; }
  const to = new Date(`${data.at(-1).date}T00:00:00Z`);
  const from = new Date(to);
  from.setUTCMonth(from.getUTCMonth() - months);
  const fromDate = from.toISOString().slice(0, 10);
  if (fromDate <= data[0].date) chart.timeScale().fitContent();
  else chart.timeScale().setVisibleRange({ from: fromDate, to: data.at(-1).date });
}
