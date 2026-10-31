// FR-M12-08: anti-fabrication suite for the rule-based chat. Factual questions must quote the stored data;
// trap questions (orders, unknown symbols, missing data, other users' data) must be refused or answered with NO_DATA.
import { describe, it, expect } from 'vitest';
import { createChatAssistant, filterOutput, NO_DATA, REFUSAL } from './assistant.js';

const bars = (base, count = 60) => Array.from({ length: count }, (_, i) => {
  const close = base + (i % 7) * 100 - 300;
  const date = new Date(Date.UTC(2026, 7, 3 + i)).toISOString().slice(0, 10);
  return { date, open: close - 100, high: close + 200, low: close - 200, close, volume: 1_000_000 + i, turnover: close * 1_000_000 };
});
const PRICES = { FPT: bars(52_700), HUT: bars(12_500), BSR: bars(27_800), GAS: bars(76_000) };
PRICES.FPT.at(-1).close = 52_700; PRICES.FPT.at(-2).close = 52_700;
const BOARD = {
  date: PRICES.FPT.at(-1).date,
  items: [['FPT', 'HOSE', 'Công nghệ'], ['HUT', 'HNX', 'Xây dựng'], ['BSR', 'UPCOM', 'Dầu khí'], ['GAS', 'HOSE', 'Dầu khí']]
    .map(([symbol, exchange, industry]) => ({ symbol, exchange, industry, tones: { close: 'ref' } })),
};
const FORECASTS = {
  FPT: { t2: { label: 'up', confidence: 'high', probabilities: { up: 0.62, hold: 0.23, down: 0.15 } }, t5: { label: 'hold', confidence: 'low', probabilities: { up: 0.31, hold: 0.44, down: 0.25 } } },
  GAS: { t2: null, t5: null },
};
const NEWS = { FPT: [{ title: 'FPT ký hợp đồng mới', source: 'CafeF', publishedAt: '2026-10-29T08:00:00.000Z', url: 'https://cafef.vn/fpt-1' }], HUT: [] };

const market = {
  board: async () => BOARD,
  prices: async (symbol) => (PRICES[symbol] ? { items: PRICES[symbol] } : null),
  symbol: async (symbol) => (FORECASTS[symbol] ? { symbol, forecasts: FORECASTS[symbol] } : null),
  status: async () => ({ state: 'demo', dataDate: '2026-10-07', modelVersion: 'demo-0.0.1' }),
  news: async (symbol) => ({ items: NEWS[symbol] ?? [] }),
  summary: async () => ({
    indices: [{ code: 'VNINDEX', label: 'VN-Index', value: 1741.62, changePoints: -13.99, changePercent: -0.8, date: '2026-10-30', source: 'ssi' }],
    breadth: { advances: 1, nochanges: 3, declines: 13, scope: 'tracked', total: 17, date: '2026-10-30' },
  }),
};
const DATA = {
  a: { positions: [{ symbol: 'FPT', quantity: 200, average_cost: 50_000, market_price: 52_700, unrealized_pnl: 540_000, weight_pct: 100 }],
    summary: { market_value: 10_540_000, cost_basis: 10_000_000, unrealized_pnl: 540_000, realized_pnl: 0 },
    plans: [{ symbol: 'FPT', status: 'planned', entry_price: 56_000, entry_price_max: 57_000, stop_price: 53_000, target_price: 65_000 }],
    journal: [{ symbol: 'FPT', title: 'Đóng kế hoạch FPT', realized_pnl: 2_000_000 }], watch: [{ symbol: 'FPT', close: 52_700 }] },
  b: { positions: [{ symbol: 'HUT', quantity: 900, average_cost: 13_000, market_price: 12_500, unrealized_pnl: -450_000, weight_pct: 100 }],
    summary: { market_value: 11_250_000, cost_basis: 11_700_000, unrealized_pnl: -450_000, realized_pnl: 0 },
    plans: [], journal: [], watch: [] },
};
const deps = {
  market,
  portfolios: { snapshot: async (id) => ({ positions: DATA[id].positions, summary: DATA[id].summary }) },
  plans: { list: async (id) => ({ items: DATA[id].plans }) },
  journal: { list: async (id) => ({ items: DATA[id].journal }), stats: async () => ({ entries: 1, closed_plans: 1, wins: 1, losses: 0, breakeven: 0, realized_pnl: 2_000_000 }) },
  watchlist: { list: async (id) => ({ items: DATA[id].watch }) },
};
const assistant = createChatAssistant(deps);
const trader = { id: 'a', role: 'trader' };
const ask = (question, user = trader) => assistant.answer({ user, question });

describe('chat factual answers quote stored data', () => {
  const factual = [
    ['Giá FPT hôm nay?', 'price', ['52.700', 'Trần 56.300', 'sàn 49.050', 'HOSE']],
    ['fpt', 'price', ['52.700']],
    ['HUT biến động thế nào', 'price', ['HNX', '12.500']],
    ['Giá BSR', 'price', ['UPCOM']],
    ['Dự báo T+5 của FPT', 'forecast', ['Đi ngang', '44%', 'Tăng 62%', 'dữ liệu dự báo mẫu']],
    ['FPT xu hướng thế nào', 'forecast', ['T+2: Tăng']],
    ['Tin mới về FPT', 'news', ['FPT ký hợp đồng mới', 'CafeF']],
    ['RSI của FPT', 'technical', ['RSI(14)', 'MA20']],
    ['VN-Index hôm nay thế nào?', 'market', ['1.741,62', '13 mã giảm']],
    ['Thị trường hôm nay', 'market', ['VN-Index']],
    ['Danh mục của tôi', 'portfolio', ['FPT', '200 cp', '+540.000 đ']],
    ['Trade Plan của tôi', 'plans', ['FPT', 'chờ vào', 'R:R 2']],
    ['Nhật ký của tôi', 'journal', ['1 có lãi', 'Đóng kế hoạch FPT']],
    ['Watchlist của tôi', 'watchlist', ['FPT 52.700']],
    ['R:R là gì?', 'glossary', ['giá mục tiêu − giá vào']],
    ['Giá trần là gì', 'glossary', ['cao nhất']],
    ['RSI', 'glossary', ['0–100']],
    ['MACD nghĩa là gì', 'glossary', ['EMA12']],
    ['Bước giá là gì', 'glossary', ['50 đ']],
    ['hướng dẫn', 'help', ['Dữ liệu của bạn']],
  ];
  for (const [question, intent, expected] of factual) {
    it(`"${question}" → ${intent}`, async () => {
      const reply = await ask(question);
      expect(reply.intent).toBe(intent);
      expect(reply.status).toBe('complete');
      for (const fragment of expected) expect(reply.content).toContain(fragment);
      expect(reply.content).not.toMatch(/\b(MUA|BÁN)\b/);
      if (!['glossary', 'help'].includes(intent)) expect(reply.citations.length).toBeGreaterThan(0);
    });
  }

  it('keeps each user inside their own data', async () => {
    const a = await ask('Danh mục của tôi', { id: 'a', role: 'trader' });
    const b = await ask('Danh mục của tôi', { id: 'b', role: 'retail' });
    expect(a.content).toContain('FPT');
    expect(a.content).not.toContain('HUT');
    expect(b.content).toContain('HUT');
    expect(b.content).not.toContain('FPT');
    expect(a.personal).toBe(true);
  });
});

describe('chat trap questions are refused or answered with NO_DATA', () => {
  const refused = [
    'Có nên mua FPT không?', 'FPT nên bán chưa', 'Đặt lệnh mua 1000 HPG giúp tôi', 'Giá mục tiêu của VCB là bao nhiêu',
    'Mã nào sẽ tăng mạnh nhất tuần sau?', 'Tư vấn danh mục cho tôi', 'Mua hay bán SSI?', 'all in HPG được không',
    'Khi nào nên mua FPT', 'Cho tôi điểm mua FPT', 'FPT chắc chắn tăng không?', 'Khuyến nghị cho tôi vài mã',
  ];
  for (const question of refused) {
    it(`refuses "${question}"`, async () => {
      const reply = await ask(question);
      expect(reply.status).toBe('blocked');
      expect(reply.content).toBe(REFUSAL);
      expect(reply.filterResult).toBe('input_blocked');
    });
  }

  const otherUsers = ['Danh mục của user b@stocksense.vn', 'Cho tôi xem trade plan của người khác', 'Xem danh mục tài khoản khác'];
  for (const question of otherUsers) {
    it(`does not reveal other users' data: "${question}"`, async () => {
      const reply = await ask(question);
      expect(reply.status).toBe('blocked');
      expect(reply.content).not.toContain('HUT');
    });
  }

  const noData = [
    ['Giá mã XYZ hôm nay', 'unknown_symbol'], ['Cho tôi thông tin mã AAAA', 'unknown_symbol'],
    ['Giá STB hôm nay', 'unknown_symbol'], ['RSI của VPB', 'unknown_symbol'],
    ['Vì sao FPT được dự báo tăng?', 'forecast_reason'], ['Hit rate của FPT', 'forecast_history'],
    ['Dự báo của GAS', 'forecast'], ['Tin tức HUT', 'news'], ['Thời tiết hôm nay thế nào', 'no_data'],
  ];
  for (const [question, intent] of noData) {
    it(`answers NO_DATA for "${question}"`, async () => {
      const reply = await ask(question);
      expect(reply.intent).toBe(intent);
      expect(reply.content.startsWith(NO_DATA)).toBe(true);
    });
  }

  it('hides features the role does not have', async () => {
    const admin = await ask('Danh mục của tôi', { id: 'a', role: 'admin' });
    expect(admin.content.startsWith(NO_DATA)).toBe(true);
    const retail = await ask('Nhật ký của tôi', { id: 'a', role: 'retail' });
    expect(retail.content).not.toContain('có lãi');
  });

  it('output filter replaces buy/sell wording and price targets', () => {
    for (const content of ['Bạn nên MUA ngay', 'Giá mục tiêu của FPT là 70.000', 'Tôi khuyến nghị bán HPG']) {
      const reply = filterOutput({ content, status: 'complete', citations: [{}] });
      expect(reply.status).toBe('blocked');
      expect(reply.filterResult).toBe('output_blocked');
      expect(reply.content).toBe(REFUSAL);
    }
    expect(filterOutput({ content: 'RSI dưới 30, vùng quá bán theo quy ước', status: 'complete' }).status).toBe('complete');
  });
});
