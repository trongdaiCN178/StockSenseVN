import { getForecastLabel } from '@stocksense/core/labels';

// Forecast display pieces from the HTML prototype (`.lab`, `.conf`, `.fc`).
export const CONFIDENCE = { low: [1, 'Thấp'], mid: [2, 'Trung bình'], high: [3, 'Cao'] };
const percent = (value) => (value == null ? '—' : `${Math.round(value * 100)}%`);

export function Lab({ label, children }) {
  const forecast = getForecastLabel(label);
  return <span className={`lab c-${forecast.tone}`}>{forecast.symbol} {forecast.text}{children}</span>;
}

export function MiniLab({ forecast }) {
  if (!forecast?.label) return <span className="muted">—</span>;
  return <><Lab label={forecast.label} /> <span className="num muted small">{percent(forecast.probabilities?.[forecast.label])}</span></>;
}

export function Confidence({ level }) {
  const [lv, text] = CONFIDENCE[level] ?? [0, 'Chưa có'];
  return <><span className={`conf lv${lv}`} title={`Mức tin cậy ${text}`}><i /><i /><i /></span> <span>{text}</span></>;
}

// Adds trading days (Mon–Fri) to an ISO date; public holidays are not modelled.
export function addTradingDays(isoDate, days) {
  if (!isoDate) return null;
  const date = new Date(`${isoDate}T00:00:00Z`);
  let left = days;
  while (left > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) left -= 1;
  }
  return date.toISOString().slice(0, 10);
}

export function ForecastCard({ horizon, forecast, dueDate }) {
  const p = forecast?.probabilities ?? {};
  const top = forecast?.label ? p[forecast.label] : null;
  const label = getForecastLabel(forecast?.label);
  return <div className="fc">
    <div className="fc-h"><span className="hz">{horizon === 't2' ? 'T+2' : 'T+5'}</span><span className="small muted">Đáo hạn <span className="num">{dueDate ? new Date(`${dueDate}T00:00:00`).toLocaleDateString('vi-VN') : '—'}</span></span></div>
    <div className={`fc-label c-${label.tone}`}>{label.symbol} {label.text} <span className="pct">{percent(top)}</span></div>
    <div className="pbar" role="img" aria-label={`Tăng ${percent(p.up)}, Đi ngang ${percent(p.hold)}, Giảm ${percent(p.down)}`}>
      <i className="bg-up" style={{ width: `${(p.up ?? 0) * 100}%` }} /><i className="bg-hold" style={{ width: `${(p.hold ?? 0) * 100}%` }} /><i className="bg-down" style={{ width: `${(p.down ?? 0) * 100}%` }} />
    </div>
    <div className="plegend num"><span className="c-up">▲ {percent(p.up)}</span><span className="c-hold">● {percent(p.hold)}</span><span className="c-down">▼ {percent(p.down)}</span></div>
    <div className="fc-f"><Confidence level={forecast?.confidence} />{top != null && top < 0.45 && <span className="chip hold">Độ tin cậy thấp</span>}</div>
  </div>;
}
