import { getForecastLabel } from '@stocksense/core/labels';

export function ForecastBadge({ label }) {
  const forecast = getForecastLabel(label);
  return <span className={`chip ${forecast.tone}`}><span aria-hidden="true">{forecast.symbol}</span>{forecast.text}</span>;
}
