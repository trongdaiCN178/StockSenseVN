const width = 720;
const height = 220;
const pad = 12;

export function PriceChart({ items = [] }) {
  if (items.length < 2) return <div className="chart-empty">Chưa có đủ dữ liệu giá để hiển thị biểu đồ.</div>;
  const values = items.map((item) => item.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = pad + index * (width - pad * 2) / (values.length - 1);
    const y = height - pad - ((value - min) / span) * (height - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  return <div className="price-chart" role="img" aria-label={`Biểu đồ giá đóng cửa từ ${items[0].date} đến ${items.at(-1).date}`}>
    <div className="chart-range"><span>{new Intl.NumberFormat('vi-VN').format(min)} ₫</span><span>{new Intl.NumberFormat('vi-VN').format(max)} ₫</span></div>
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      {[0.25, 0.5, 0.75].map((ratio) => <line key={ratio} x1="0" x2={width} y1={height * ratio} y2={height * ratio} className="chart-grid" />)}
      <polyline points={points} className="chart-line" />
    </svg>
    <div className="chart-range"><span>{items[0].date}</span><span>{items.at(-1).date}</span></div>
  </div>;
}
