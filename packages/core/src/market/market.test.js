import { describe, it, expect } from 'vitest';
import { tickSize, priceLimits, referencePrice, priceTone, buildBoardQuote } from './priceBoard.js';
import { sma, ema, rsi, macd, aggregateBars, changeOver } from './indicators.js';

describe('price board rules', () => {
  it('uses HOSE tiered tick sizes and 100 VND elsewhere', () => {
    expect(tickSize('HOSE', 9_990)).toBe(10);
    expect(tickSize('HOSE', 25_000)).toBe(50);
    expect(tickSize('HOSE', 57_000)).toBe(100);
    expect(tickSize('HNX', 9_000)).toBe(100);
    expect(tickSize('UPCOM', 29_000)).toBe(100);
  });

  it('rounds ceiling and floor toward the reference price', () => {
    // FPT reference 56,000: 59,920 -> 59,900; 52,080 -> 52,100.
    expect(priceLimits('HOSE', 56_000)).toEqual({ ceiling: 59_900, floor: 52_100 });
    // HUT (HNX ±10%) reference 12,600: 13,860 -> 13,800; 11,340 -> 11,400.
    expect(priceLimits('HNX', 12_600)).toEqual({ ceiling: 13_800, floor: 11_400 });
    // BSR (UPCoM ±15%) reference 29,400: 33,810 -> 33,800; 24,990 -> 25,000.
    expect(priceLimits('UPCOM', 29_400)).toEqual({ ceiling: 33_800, floor: 25_000 });
    expect(priceLimits('HOSE', 0)).toEqual({ ceiling: null, floor: null });
  });

  it('uses the previous close as reference, except the average price on UPCoM', () => {
    expect(referencePrice('HOSE', { close: 56_000, volume: 10, turnover: 570_000 })).toBe(56_000);
    expect(referencePrice('UPCOM', { close: 29_400, volume: 8_922_000, turnover: 261_996_625_000 })).toBe(29_400);
    expect(referencePrice('UPCOM', { close: 29_400, volume: 0, turnover: 0 })).toBe(29_400);
    expect(referencePrice('HNX', null)).toBeNull();
  });

  it('colours prices like an exchange board', () => {
    const limits = { reference: 56_000, ceiling: 59_900, floor: 52_100 };
    expect(priceTone(59_900, limits)).toBe('ceiling');
    expect(priceTone(52_100, limits)).toBe('floor');
    expect(priceTone(56_000, limits)).toBe('ref');
    expect(priceTone(57_000, limits)).toBe('up');
    expect(priceTone(55_000, limits)).toBe('down');
  });

  it('builds a board quote from the last two bars', () => {
    const quote = buildBoardQuote('HOSE',
      { date: '2026-10-27', open: 56_500, high: 57_000, low: 55_800, close: 56_800, volume: 1_000, turnover: 56_000_000 },
      { date: '2026-10-26', close: 56_000 });
    expect(quote).toMatchObject({ reference: 56_000, ceiling: 59_900, floor: 52_100, change: 800, changePercent: 1.43 });
    expect(quote.tones).toEqual({ open: 'up', high: 'up', low: 'down', close: 'up' });
  });
});

describe('indicators', () => {
  const closes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('computes SMA and EMA with nulls before enough history', () => {
    expect(sma(closes, 3).slice(0, 4)).toEqual([null, null, 2, 3]);
    const e = ema(closes, 3);
    expect(e[1]).toBeNull();
    expect(e[2]).toBe(2);
    expect(e[3]).toBeCloseTo(3);
  });

  it('gives RSI 100 for a straight rise and about 50 for alternating moves', () => {
    expect(rsi(closes, 5)[9]).toBe(100);
    const zigzag = Array.from({ length: 40 }, (_, i) => (i % 2 ? 11 : 10));
    expect(rsi(zigzag, 14)[39]).toBeGreaterThan(40);
    expect(rsi(zigzag, 14)[39]).toBeLessThan(60);
  });

  it('computes MACD, signal and histogram on the same index', () => {
    const series = Array.from({ length: 60 }, (_, i) => 100 + i);
    const { macd: line, signal, histogram } = macd(series);
    expect(line[24]).toBeNull();
    expect(line[25]).not.toBeNull();
    expect(signal[33]).not.toBeNull();
    expect(histogram[59]).toBeCloseTo(line[59] - signal[59]);
  });

  it('aggregates daily bars into weeks', () => {
    const bars = [
      { date: '2026-10-19', open: 10, high: 12, low: 9, close: 11, volume: 1 },
      { date: '2026-10-23', open: 11, high: 15, low: 10, close: 14, volume: 2 },
      { date: '2026-10-26', open: 14, high: 14, low: 13, close: 13, volume: 3 },
    ];
    expect(aggregateBars(bars, 'week')).toEqual([
      { date: '2026-10-19', open: 10, high: 15, low: 9, close: 14, volume: 3, turnover: 0 },
      { date: '2026-10-26', open: 14, high: 14, low: 13, close: 13, volume: 3 },
    ]);
  });

  it('measures change over a number of sessions', () => {
    expect(changeOver([{ close: 100 }, { close: 110 }], 1)).toBe(10);
    expect(changeOver([{ close: 100 }], 5)).toBeNull();
  });
});
