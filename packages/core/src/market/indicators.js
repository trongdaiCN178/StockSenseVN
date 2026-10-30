// Technical indicators on daily bars. Every series has the same length as its input;
// positions without enough history are null so they can be skipped when charting.

export function sma(values, period) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

// EMA seeded with the SMA of the first `period` values.
export function ema(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

// Wilder's RSI.
export function rsi(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gain += diff; else loss -= diff;
  }
  gain /= period;
  loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gain = (gain * (period - 1) + Math.max(diff, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-diff, 0)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export function macd(closes, fast = 12, slow = 26, signalPeriod = 9) {
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const line = closes.map((_, i) => (fastEma[i] == null || slowEma[i] == null ? null : fastEma[i] - slowEma[i]));
  const start = line.findIndex((value) => value != null);
  const signal = new Array(closes.length).fill(null);
  if (start >= 0) {
    const tail = ema(line.slice(start), signalPeriod);
    tail.forEach((value, i) => { signal[start + i] = value; });
  }
  const histogram = line.map((value, i) => (value == null || signal[i] == null ? null : value - signal[i]));
  return { macd: line, signal, histogram };
}

// Group daily bars (sorted by date, ISO yyyy-mm-dd) into weekly or monthly bars.
export function aggregateBars(bars, interval) {
  if (interval === 'day') return bars;
  const keyOf = (date) => {
    if (interval === 'month') return date.slice(0, 7);
    const d = new Date(`${date}T00:00:00Z`);
    const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000);
    return monday.toISOString().slice(0, 10);
  };
  const groups = [];
  for (const bar of bars) {
    const key = keyOf(bar.date);
    const last = groups.at(-1);
    if (last && last.key === key) {
      last.bar.high = Math.max(last.bar.high, bar.high);
      last.bar.low = Math.min(last.bar.low, bar.low);
      last.bar.close = bar.close;
      last.bar.volume = (last.bar.volume ?? 0) + (bar.volume ?? 0);
      last.bar.turnover = (last.bar.turnover ?? 0) + (bar.turnover ?? 0);
    } else {
      groups.push({ key, bar: { ...bar } });
    }
  }
  return groups.map((group) => group.bar);
}

// Percent change of the last close versus the close `sessions` bars earlier (null if not enough history).
export function changeOver(bars, sessions) {
  if (bars.length <= sessions) return null;
  const from = bars[bars.length - 1 - sessions].close;
  return from ? Number((((bars.at(-1).close - from) / from) * 100).toFixed(2)) : null;
}
