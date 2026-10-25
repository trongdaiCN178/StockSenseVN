const width = 720;
const height = 220;
const volumeHeight = 60;
const pad = 12;

// FR-M2-06: close-price line with a volume histogram underneath.
export function PriceChart({ items = [] }) {
  if (items.length < 2) return <div className="chart-empty">Chưa có đủ dữ liệu giá để hiển thị biểu đồ.</div>;
  const values = items.map((item) => item.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = (width - pad * 2) / (values.length - 1);
  const points = values.map((value, index) => {
    const x = pad + index * step;
    const y = height - pad - ((value - min) / span) * (height - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  const volumes = items.map((item) => item.volume ?? 0);
  const maxVolume = Math.max(...volumes);
  const barWidth = Math.max(1, Math.min(step * 0.7, pad * 2));
  const number = new Intl.NumberFormat('vi-VN');
  return <div className="price-chart" role="img" aria-label={`Biểu đồ giá đóng cửa và khối lượng từ ${items[0].date} đến ${items.at(-1).date}`}>
    <div className="chart-range"><span>{number.format(min)} ₫</span><span>{number.format(max)} ₫</span></div>
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      {[0.25, 0.5, 0.75].map((ratio) => <line key={ratio} x1="0" x2={width} y1={height * ratio} y2={height * ratio} className="chart-grid" />)}
      <polyline points={points} className="chart-line" />
    </svg>
    {maxVolume > 0 && <>
      <svg className="volume-chart" viewBox={`0 0 ${width} ${volumeHeight}`} preserveAspectRatio="none" aria-hidden="true">
        {volumes.map((volume, index) => {
          const barHeight = (volume / maxVolume) * (volumeHeight - 4);
          const up = index === 0 || items[index].close >= items[index - 1].close;
          const x = Math.min(Math.max(pad + index * step - barWidth / 2, 0), width - barWidth);
          return <rect key={items[index].date} x={x} y={volumeHeight - barHeight} width={barWidth} height={barHeight} className={up ? 'volume-up' : 'volume-down'} />;
        })}
      </svg>
      <div className="chart-range small muted"><span>Khối lượng</span><span>Cao nhất {number.format(maxVolume)} cp</span></div>
    </>}
    <div className="chart-range"><span>{items[0].date}</span><span>{items.at(-1).date}</span></div>
  </div>;
}
