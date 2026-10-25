import { describe, it, expect } from 'vitest';
import { calculateRiskReward } from './riskReward.js';

describe('calculateRiskReward', () => {
  it('computes risk/reward for a long position', () => {
    const result = calculateRiskReward({ side: 'long', entry_price: 100, stop_price: 95, target_price: 115 });
    expect(result.risk_per_share).toBeCloseTo(5);
    expect(result.reward_per_share).toBeCloseTo(15);
    expect(result.rr_ratio).toBeCloseTo(3);
  });

  it('computes risk/reward for a short position', () => {
    const result = calculateRiskReward({ side: 'short', entry_price: 100, stop_price: 105, target_price: 85 });
    expect(result.risk_per_share).toBeCloseTo(5);
    expect(result.reward_per_share).toBeCloseTo(15);
    expect(result.rr_ratio).toBeCloseTo(3);
  });

  it('includes position sizing when capital and risk percentage are provided', () => {
    const result = calculateRiskReward({
      side: 'long', entry_price: 100, stop_price: 95, target_price: 115,
      capital_vnd: 100_000_000, risk_pct: 1,
    });
    expect(result.risk_budget).toBeCloseTo(1_000_000);
    expect(result.max_quantity).toBe(200_000);
  });

  it('rounds the maximum quantity down to a board lot of 100 shares', () => {
    const result = calculateRiskReward({
      side: 'long', entry_price: 25_000, stop_price: 24_000, target_price: 28_000,
      capital_vnd: 50_000_000, risk_pct: 1.5,
    });
    expect(result.max_quantity).toBe(700);
  });

  it('reports percentage distance from entry to stop and target', () => {
    const result = calculateRiskReward({ side: 'long', entry_price: 100, stop_price: 95, target_price: 115 });
    expect(result.risk_pct_distance).toBe(5);
    expect(result.reward_pct_distance).toBe(15);
  });

  it('throws TypeError for an invalid side', () => {
    expect(() => calculateRiskReward({ side: 'sideways', entry_price: 100, stop_price: 95, target_price: 115 }))
      .toThrow(TypeError);
  });

  it('throws TypeError when prices are not positive numbers', () => {
    expect(() => calculateRiskReward({ side: 'long', entry_price: 0, stop_price: 95, target_price: 115 }))
      .toThrow(TypeError);
    expect(() => calculateRiskReward({ side: 'long', entry_price: 100, stop_price: -1, target_price: 115 }))
      .toThrow(TypeError);
  });

  it('throws RangeError when stop/target are on the wrong side of entry', () => {
    expect(() => calculateRiskReward({ side: 'long', entry_price: 100, stop_price: 105, target_price: 115 }))
      .toThrow(RangeError);
    expect(() => calculateRiskReward({ side: 'long', entry_price: 100, stop_price: 95, target_price: 90 }))
      .toThrow(RangeError);
  });

  it('throws RangeError for invalid capital or risk percentage', () => {
    expect(() => calculateRiskReward({
      side: 'long', entry_price: 100, stop_price: 95, target_price: 115, capital_vnd: 0, risk_pct: 1,
    })).toThrow(RangeError);
    expect(() => calculateRiskReward({
      side: 'long', entry_price: 100, stop_price: 95, target_price: 115, capital_vnd: 100_000_000, risk_pct: 101,
    })).toThrow(RangeError);
  });
});
