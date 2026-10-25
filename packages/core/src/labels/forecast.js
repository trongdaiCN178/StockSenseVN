export const FORECAST_LABELS = Object.freeze({
  up: { text: 'Tăng', symbol: '▲', tone: 'up' },
  hold: { text: 'Đi ngang', symbol: '●', tone: 'hold' },
  down: { text: 'Giảm', symbol: '▼', tone: 'down' },
});

export function getForecastLabel(label) {
  return FORECAST_LABELS[label] ?? {
    text: 'Chưa có dữ liệu',
    symbol: '—',
    tone: 'neutral',
  };
}
