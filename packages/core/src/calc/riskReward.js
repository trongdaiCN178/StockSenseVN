const PRICE_SCALE = 10_000;
// HOSE/HNX trade in board lots of 100 shares (FR-M10-04).
export const BOARD_LOT = 100;

export function calculateRiskReward({ side, entry_price, stop_price, target_price, capital_vnd, risk_pct }) {
  const entry = Math.round(Number(entry_price) * PRICE_SCALE);
  const stop = Math.round(Number(stop_price) * PRICE_SCALE);
  const target = Math.round(Number(target_price) * PRICE_SCALE);
  if (!['long', 'short'].includes(side) || ![entry, stop, target].every(Number.isSafeInteger) || entry <= 0 || stop <= 0 || target <= 0) {
    throw new TypeError('A valid side, entry, stop, and target price are required.');
  }
  const direction = side === 'long' ? 1 : -1;
  const riskTicks = direction * (entry - stop);
  const rewardTicks = direction * (target - entry);
  if (riskTicks <= 0 || rewardTicks <= 0) throw new RangeError('Stop and target must be on the correct side of the entry price.');
  const result = {
    risk_per_share: riskTicks / PRICE_SCALE,
    reward_per_share: rewardTicks / PRICE_SCALE,
    rr_ratio: Number((rewardTicks / riskTicks).toFixed(4)),
    // FR-M10-03: distance from entry to stop and to target, in percent of entry.
    risk_pct_distance: Number((riskTicks / entry * 100).toFixed(2)),
    reward_pct_distance: Number((rewardTicks / entry * 100).toFixed(2)),
  };
  if (capital_vnd !== undefined || risk_pct !== undefined) {
    const capital = Number(capital_vnd); const riskPercent = Number(risk_pct);
    if (!Number.isFinite(capital) || capital <= 0 || capital > 1_000_000_000_000_000 || !Number.isFinite(riskPercent) || riskPercent <= 0 || riskPercent > 100) {
      throw new RangeError('Capital and risk percentage are invalid.');
    }
    result.risk_budget = capital * riskPercent / 100;
    const rawQuantity = Math.min(1_000_000_000, Math.floor(result.risk_budget / result.risk_per_share), Math.floor(capital / (entry / PRICE_SCALE)));
    result.max_quantity = Math.floor(rawQuantity / BOARD_LOT) * BOARD_LOT;
  }
  return result;
}
