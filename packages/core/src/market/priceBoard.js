// End-of-day price board rules for the Vietnamese exchanges.
// Daily price band around the reference price (biên độ dao động).
export const PRICE_BAND_PERCENT = Object.freeze({ HOSE: 7, HNX: 10, UPCOM: 15 });

// HOSE uses a tiered tick size; HNX and UPCoM trade in 100 VND steps.
export function tickSize(exchange, price) {
  if (exchange !== 'HOSE') return 100;
  if (price < 10_000) return 10;
  if (price < 50_000) return 50;
  return 100;
}

const roundToTick = (exchange, price) => {
  const tick = tickSize(exchange, price);
  return Math.round(price / tick) * tick;
};

// Reference price (giá tham chiếu) for the next session: HOSE/HNX use the previous close,
// UPCoM uses the previous session's volume-weighted average price.
export function referencePrice(exchange, previousBar) {
  if (!previousBar || !(previousBar.close > 0)) return null;
  if (exchange === 'UPCOM' && previousBar.volume > 0 && previousBar.turnover > 0) {
    return roundToTick(exchange, previousBar.turnover / previousBar.volume);
  }
  return roundToTick(exchange, previousBar.close);
}

// On an ex-rights day (stock dividend, bonus shares, split) the exchange lowers the reference price. Bars that carry
// back-adjusted prices (adjClose) let us restate the previous session on the latest session's basis.
function restatePrevious(latestBar, previousBar) {
  if (!previousBar || !(latestBar?.adjClose > 0) || !(previousBar.adjClose > 0) || !(previousBar.close > 0)) return previousBar;
  const factor = (previousBar.adjClose * (latestBar.close / latestBar.adjClose)) / previousBar.close;
  if (Math.abs(factor - 1) < 0.0005) return previousBar;
  return { ...previousBar, close: previousBar.close * factor, turnover: previousBar.turnover == null ? null : previousBar.turnover * factor };
}

// Ceiling/floor are rounded toward the reference price so they never exceed the band.
export function priceLimits(exchange, reference) {
  const percent = PRICE_BAND_PERCENT[exchange];
  if (!percent || !(reference > 0)) return { ceiling: null, floor: null };
  const rawCeiling = (reference * (100 + percent)) / 100;
  const rawFloor = (reference * (100 - percent)) / 100;
  const ceilingTick = tickSize(exchange, rawCeiling);
  const floorTick = tickSize(exchange, rawFloor);
  const ceiling = Math.floor(rawCeiling / ceilingTick + 1e-9) * ceilingTick;
  const floor = Math.max(Math.ceil(rawFloor / floorTick - 1e-9) * floorTick, floorTick);
  return { ceiling, floor };
}

// Colour class of a price on the board: ceiling (tím), floor (xanh lam), reference (vàng), up, down.
export function priceTone(price, { reference, ceiling, floor }) {
  if (!(price > 0) || !(reference > 0)) return 'none';
  if (ceiling && price >= ceiling) return 'ceiling';
  if (floor && price <= floor) return 'floor';
  if (price > reference) return 'up';
  if (price < reference) return 'down';
  return 'ref';
}

// One board row from the latest and previous daily bars (newest first is not assumed).
export function buildBoardQuote(exchange, latestBar, previousBar) {
  const reference = referencePrice(exchange, restatePrevious(latestBar, previousBar));
  const { ceiling, floor } = priceLimits(exchange, reference);
  const close = latestBar?.close ?? null;
  const change = close != null && reference ? close - reference : null;
  const changePercent = change != null ? Number(((change / reference) * 100).toFixed(2)) : null;
  const limits = { reference, ceiling, floor };
  return {
    date: latestBar?.date ?? null,
    reference, ceiling, floor,
    open: latestBar?.open ?? null, high: latestBar?.high ?? null, low: latestBar?.low ?? null, close,
    change, changePercent,
    volume: latestBar?.volume ?? null, turnover: latestBar?.turnover ?? null,
    tones: {
      open: priceTone(latestBar?.open, limits), high: priceTone(latestBar?.high, limits),
      low: priceTone(latestBar?.low, limits), close: priceTone(close, limits),
    },
  };
}
