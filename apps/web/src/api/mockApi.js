import { marketMock } from '../../../../mocks/market.js';
import { calculateRiskReward } from '@stocksense/core/calc';

const SESSION_KEY = 'stocksense.mock.session.v1';
const validRoles = new Set(['retail', 'trader', 'analyst', 'admin']);
function defaultDemoPassword(role) {
  return `${role}12345678`;
}
const demoPasswords = new Map();
const mockUsers = new Map(['retail', 'trader', 'analyst', 'admin'].map((role) => {
  const email = `${role}@stocksense.vn`;
  return [`demo-${role}`, { id: `demo-${role}`, email, role, is_active: true, must_change_password: false, failed_login_count: 0, locked_until: null, created_at: '2026-10-01T00:00:00.000Z' }];
}));
const mockAudit = [];
const mockWatchlists = new Map();
const mockAlertRules = new Map();
const mockUserAlerts = new Map();
const mockSavedScreeners = new Map();
const mockPortfolioLedger = new Map();
const mockTradePlans = new Map();
const mockJournalEntries = new Map();
const mockInvestmentProfiles = new Map();
const mockChatSessions = new Map();
const mockNotificationPreferences = new Map();

function userCollection(collection, userId = readSession()?.id) {
  if (!userId) return [];
  if (!collection.has(userId)) collection.set(userId, []);
  return collection.get(userId);
}

function portfolioSnapshot(entries) {
  const positions = new Map();
  for (const tx of [...entries].sort((a, b) => a.executed_at.localeCompare(b.executed_at) || a.created_at.localeCompare(b.created_at))) {
    const position = positions.get(tx.symbol) ?? { symbol: tx.symbol, quantity: 0, average_cost: 0, realized_pnl: 0 };
    if (tx.side === 'buy') {
      const quantity = position.quantity + tx.quantity;
      position.average_cost = (position.average_cost * position.quantity + tx.quantity * tx.unit_price + tx.fee) / quantity;
      position.quantity = quantity;
    } else {
      if (tx.quantity > position.quantity + 0.000001) { const error = new Error(`Sell transaction for ${tx.symbol} exceeds the available quantity.`); error.status = 409; throw error; }
      position.realized_pnl += tx.quantity * (tx.unit_price - position.average_cost) - tx.fee;
      position.quantity = Math.max(0, position.quantity - tx.quantity);
      if (position.quantity === 0) position.average_cost = 0;
    }
    positions.set(tx.symbol, position);
  }
  const symbols = marketMock.symbols.items;
  const allPositions = [...positions.values()].map((item) => {
    const quote = symbols.find((row) => row.symbol === item.symbol);
    const marketPrice = quote?.closePrice ?? null;
    const marketValue = marketPrice == null ? null : marketPrice * item.quantity;
    return { ...item, market_price: marketPrice, market_value: marketValue,
      unrealized_pnl: marketValue == null ? null : marketValue - item.average_cost * item.quantity,
      quantity: Number(item.quantity.toFixed(4)), average_cost: Number(item.average_cost.toFixed(4)), realized_pnl: Number(item.realized_pnl.toFixed(2)) };
  });
  const holdings = allPositions.filter((item) => item.quantity > 0);
  const summary = allPositions.reduce((total, item) => ({
    market_value: total.market_value + (item.market_value ?? 0),
    cost_basis: total.cost_basis + item.quantity * item.average_cost,
    realized_pnl: total.realized_pnl + item.realized_pnl,
    unrealized_pnl: total.unrealized_pnl + (item.unrealized_pnl ?? 0),
  }), { market_value: 0, cost_basis: 0, realized_pnl: 0, unrealized_pnl: 0 });
  if (holdings.some((item) => item.market_value == null)) {
    summary.market_value = null;
    summary.unrealized_pnl = null;
  }
  return { summary, positions: holdings, transactions: [...entries].sort((a, b) => b.executed_at.localeCompare(a.executed_at) || b.created_at.localeCompare(a.created_at)) };
}

function validateMockTransaction(input) {
  const symbol = String(input?.symbol ?? '').toUpperCase();
  const quantity = Number(input?.quantity); const unit_price = Number(input?.unit_price); const fee = Number(input?.fee ?? 0);
  if (!marketMock.symbols.items.some((item) => item.symbol === symbol) || !['buy', 'sell'].includes(input?.side) || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unit_price) || unit_price <= 0 || !Number.isFinite(fee) || fee < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(input?.executed_at ?? '')) {
    const error = new Error('Invalid portfolio transaction.'); error.status = 422; throw error;
  }
  return { id: `demo-tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, symbol, side: input.side, quantity, unit_price, fee, executed_at: input.executed_at, note: String(input.note ?? '').slice(0, 500), created_at: new Date().toISOString() };
}

function temporaryPassword() {
  return `Demo-${Math.random().toString(36).slice(2, 8)}-${Math.random().toString(36).slice(2, 8)}`;
}

function actorEmail() {
  return readSession()?.email ?? 'demo-admin@stocksense.vn';
}

function ensureChatRole() {
  if (!['retail', 'trader', 'analyst'].includes(readSession()?.role)) {
    const error = new Error('Chat is not available for this role.'); error.status = 403; throw error;
  }
}

function ensureNotificationRole() {
  if (!['retail', 'trader', 'analyst'].includes(readSession()?.role)) {
    const error = new Error('Notification channel preferences are not available for this role.'); error.status = 403; throw error;
  }
}

function delay(ms = 120) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function readSession() {
  try {
    return JSON.parse(window.sessionStorage.getItem(SESSION_KEY) ?? 'null');
  } catch {
    return null;
  }
}

export const mockApi = {
  auth: {
    async me() {
      await delay(50);
      const user = readSession();
      return user ? { user } : null;
    },
    async login({ email, password, role }) {
      await delay();
      if ((password !== (demoPasswords.get(email?.trim().toLowerCase()) ?? defaultDemoPassword(role))) || !validRoles.has(role) || !email?.includes('@')) {
        const error = new Error('Email hoặc mật khẩu demo không đúng.');
        error.status = 401;
        throw error;
      }
      const user = {
        id: `demo-${role}`,
        email: email.trim().toLowerCase(),
        role,
        must_change_password: [...mockUsers.values()].find((item) => item.email === email.trim().toLowerCase())?.must_change_password ?? false,
        is_demo: true,
      };
      const mockUser = [...mockUsers.values()].find((item) => item.email === user.email);
      if (mockUser?.is_active === false) {
        const error = new Error('Tài khoản đã bị khóa.'); error.status = 401; throw error;
      }
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
      return { user };
    },
    async logout() {
      await delay(40);
      window.sessionStorage.removeItem(SESSION_KEY);
      return null;
    },
    async forgotPassword() { throw new Error('Đặt lại mật khẩu cần API thật, SMTP và feature flag đã bật.'); },
    async resetPassword() { throw new Error('Đặt lại mật khẩu cần API thật, SMTP và feature flag đã bật.'); },
    async register() { throw new Error('Đăng ký tài khoản cần API thật kết nối PostgreSQL.'); },
    async verifyEmail() { throw new Error('Xác thực email cần API thật kết nối PostgreSQL.'); },
    async resendVerification() { throw new Error('Gửi lại email xác thực cần API thật kết nối PostgreSQL.'); },
    async changePassword({ current_password, new_password }) {
      await delay();
      const user = readSession();
      const current = demoPasswords.get(user?.email) ?? defaultDemoPassword(user?.role);
      if (current_password !== current) { const error = new Error('Mật khẩu hiện tại không đúng.'); error.status = 422; throw error; }
      if (new_password === current) { const error = new Error('Mật khẩu mới phải khác mật khẩu hiện tại.'); error.status = 422; throw error; }
      demoPasswords.set(user.email, new_password);
      const updated = { ...user, must_change_password: false };
      const managedUser = [...mockUsers.values()].find((item) => item.email === user.email);
      if (managedUser) managedUser.must_change_password = false;
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));
      return { user: updated };
    },
  },
  market: {
    async status() { await delay(); return structuredClone(marketMock.status); },
    async summary() { await delay(); return structuredClone(marketMock.summary); },
    async symbols() { await delay(); return structuredClone(marketMock.symbols); },
  },
  screener: {
    async run(filters = {}) {
      await delay();
      const items = marketMock.symbols.items.filter((item) =>
        (!filters.exchange || item.exchange === filters.exchange) &&
        (filters.minPrice === '' || filters.minPrice == null || item.closePrice >= Number(filters.minPrice)) &&
        (filters.maxPrice === '' || filters.maxPrice == null || item.closePrice <= Number(filters.maxPrice)) &&
        (filters.minChange === '' || filters.minChange == null || item.changePercent >= Number(filters.minChange)) &&
        (filters.maxChange === '' || filters.maxChange == null || item.changePercent <= Number(filters.maxChange)) &&
        (filters.minTurnover === '' || filters.minTurnover == null || item.averageTurnover20d >= Number(filters.minTurnover)));
      return { total: items.length, items: structuredClone(items) };
    },
    async saved() { await delay(); return { items: structuredClone(userCollection(mockSavedScreeners)) }; },
    async save({ name, filters }) {
      await delay();
      const items = userCollection(mockSavedScreeners);
      const existing = items.find((item) => item.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase());
      if (!existing && items.length >= 20) { const error = new Error('You can save at most 20 filters.'); error.status = 409; throw error; }
      if (existing) { existing.filters = structuredClone(filters); existing.updated_at = new Date().toISOString(); return structuredClone(existing); }
      const saved = { id: `demo-filter-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: name.trim(), filters: structuredClone(filters), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      items.unshift(saved);
      return structuredClone(saved);
    },
    async remove(id) {
      await delay();
      const items = userCollection(mockSavedScreeners);
      const next = items.filter((item) => item.id !== id);
      if (next.length === items.length) { const error = new Error('Saved filter was not found.'); error.status = 404; throw error; }
      mockSavedScreeners.set(readSession()?.id, next);
      return { id, removed: true };
    },
  },
  portfolio: {
    async snapshot() { await delay(); return structuredClone(portfolioSnapshot(userCollection(mockPortfolioLedger))); },
    async add(input) {
      await delay();
      const tx = validateMockTransaction(input);
      const ledger = userCollection(mockPortfolioLedger);
      portfolioSnapshot([...ledger, tx]);
      ledger.push(tx);
      return structuredClone(portfolioSnapshot(ledger));
    },
    async importMany(inputs) {
      await delay();
      if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 500) { const error = new Error('Import between 1 and 500 rows at a time.'); error.status = 422; throw error; }
      const ledger = userCollection(mockPortfolioLedger);
      const additions = inputs.map(validateMockTransaction);
      const snapshot = portfolioSnapshot([...ledger, ...additions]);
      ledger.push(...additions);
      return structuredClone(snapshot);
    },
    async remove(id) {
      await delay();
      const ledger = userCollection(mockPortfolioLedger);
      const next = ledger.filter((item) => item.id !== id);
      if (next.length === ledger.length) { const error = new Error('Portfolio transaction was not found.'); error.status = 404; throw error; }
      const snapshot = portfolioSnapshot(next);
      mockPortfolioLedger.set(readSession()?.id, next);
      return structuredClone(snapshot);
    },
  },
  plans: {
    async calculate(payload) {
      await delay();
      const role = readSession()?.role;
      const canQuantity = ['trader', 'analyst'].includes(role);
      if (!canQuantity && (Object.hasOwn(payload, 'capital_vnd') || Object.hasOwn(payload, 'risk_pct'))) { const error = new Error('Capital and risk fields are not available for this role.'); error.status = 403; throw error; }
      return calculateRiskReward({ side: payload.side, entry_price: payload.entry_price, stop_price: payload.stop_price, target_price: payload.target_price,
        ...(canQuantity && payload.capital_vnd != null ? { capital_vnd: payload.capital_vnd, risk_pct: payload.risk_pct } : {}) });
    },
    async list() { await delay(); return { items: structuredClone(userCollection(mockTradePlans)) }; },
    async create(payload) {
      await delay();
      const role = readSession()?.role;
      const canQuantity = ['trader', 'analyst'].includes(role);
      const input = { ...payload, symbol: String(payload.symbol ?? '').toUpperCase() };
      if (!marketMock.symbols.items.some((item) => item.symbol === input.symbol)) { const error = new Error('Active symbol was not found.'); error.status = 404; throw error; }
      if (!canQuantity && (Object.hasOwn(input, 'capital_vnd') || Object.hasOwn(input, 'risk_pct'))) { const error = new Error('Capital and risk fields are not available for this role.'); error.status = 403; throw error; }
      const calculation = calculateRiskReward(input);
      const quote = marketMock.symbols.items.find((item) => item.symbol === input.symbol);
      const plan = { id: `demo-plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...input, status: 'planned',
        quantity: input.quantity ? Number(input.quantity) : calculation.max_quantity > 0 ? calculation.max_quantity : null,
        entry_price: Number(input.entry_price), stop_price: Number(input.stop_price), target_price: Number(input.target_price),
        capital_vnd: input.capital_vnd == null ? null : Number(input.capital_vnd), risk_pct: input.risk_pct == null ? null : Number(input.risk_pct),
        calculation, snapshot: { captured_at: new Date().toISOString(), market_price: quote.closePrice, price_date: marketMock.status.dataDate, price_source: 'demo', forecast: null, forecast_status: 'not_available_model_not_ready' },
        note: String(input.note ?? ''), created_at: new Date().toISOString() };
      userCollection(mockTradePlans).unshift(plan);
      return structuredClone(plan);
    },
    async updateStatus(id, status) {
      await delay();
      const plan = userCollection(mockTradePlans).find((item) => item.id === id);
      if (!plan) { const error = new Error('Trade plan was not found.'); error.status = 404; throw error; }
      const allowed = (plan.status === 'planned' && ['active', 'cancelled'].includes(status)) || (plan.status === 'active' && status === 'cancelled');
      if (!allowed) { const error = new Error('This plan status transition is not allowed.'); error.status = 409; throw error; }
      plan.status = status; plan.updated_at = new Date().toISOString();
      return structuredClone(plan);
    },
    async close(id, { exit_price, note }) {
      await delay();
      const plan = userCollection(mockTradePlans).find((item) => item.id === id);
      if (!plan) { const error = new Error('Trade plan was not found.'); error.status = 404; throw error; }
      if (plan.status !== 'active') { const error = new Error('Only active plans can be closed.'); error.status = 409; throw error; }
      const realized = plan.quantity == null ? null : (plan.side === 'long' ? Number(exit_price) - plan.entry_price : plan.entry_price - Number(exit_price)) * plan.quantity;
      plan.status = 'closed'; plan.exit_price = Number(exit_price); plan.close_note = note; plan.realized_pnl = realized; plan.closed_at = new Date().toISOString();
      userCollection(mockJournalEntries).unshift({ id: `demo-journal-${Date.now()}`, plan_id: plan.id, symbol: plan.symbol, kind: 'plan_close', title: `${plan.symbol} trade plan closed`, body: note, realized_pnl: realized, snapshot: { plan_snapshot: plan.snapshot, exit_price: plan.exit_price, closed_at: plan.closed_at }, created_at: plan.closed_at });
      return structuredClone(plan);
    },
  },
  journal: {
    async list({ symbol = '', limit = 50 } = {}) {
      await delay();
      const items = userCollection(mockJournalEntries).filter((entry) => !symbol || entry.symbol === symbol.toUpperCase()).slice(0, limit);
      return { items: structuredClone(items) };
    },
    async update(id, changes) {
      await delay();
      const entry = userCollection(mockJournalEntries).find((item) => item.id === id);
      if (!entry) { const error = new Error('Journal entry was not found.'); error.status = 404; throw error; }
      if (Object.hasOwn(changes, 'body')) entry.body = String(changes.body).slice(0, 4000);
      if (Object.hasOwn(changes, 'lesson')) entry.lesson = String(changes.lesson).slice(0, 3000);
      if (Object.hasOwn(changes, 'tags')) entry.tags = [...new Set(changes.tags.map((tag) => tag.trim().toLowerCase()))];
      entry.updated_at = new Date().toISOString();
      return structuredClone(entry);
    },
    async createManual(input) {
      await delay();
      if (!['trader', 'analyst'].includes(readSession()?.role)) { const error = new Error('Manual journal creation is not available for this role.'); error.status = 403; throw error; }
      const symbol = String(input.symbol ?? '').toUpperCase();
      if (!marketMock.symbols.items.some((item) => item.symbol === symbol)) { const error = new Error('Active symbol was not found.'); error.status = 404; throw error; }
      const entry = { id: `demo-journal-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, plan_id: null, symbol, kind: 'manual',
        title: input.title.trim(), body: input.body ?? '', tags: input.tags ?? [], lesson: input.lesson ?? '', realized_pnl: null, snapshot: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      userCollection(mockJournalEntries).unshift(entry);
      return structuredClone(entry);
    },
    async stats() {
      await delay();
      if (!['trader', 'analyst'].includes(readSession()?.role)) { const error = new Error('Journal statistics are not available for this role.'); error.status = 403; throw error; }
      const entries = userCollection(mockJournalEntries); const closed = entries.filter((item) => item.realized_pnl != null);
      const wins = closed.filter((item) => item.realized_pnl > 0).length; const losses = closed.filter((item) => item.realized_pnl < 0).length;
      return { entries: entries.length, closed_plans: closed.length, wins, losses, breakeven: closed.length - wins - losses,
        realized_pnl: closed.reduce((sum, item) => sum + item.realized_pnl, 0), average_realized_pnl: closed.length ? closed.reduce((sum, item) => sum + item.realized_pnl, 0) / closed.length : null };
    },
  },
  profile: {
    async get() {
      await delay();
      if (!['trader', 'analyst'].includes(readSession()?.role)) { const error = new Error('Investment profile is not available for this role.'); error.status = 403; throw error; }
      return { profile: structuredClone(mockInvestmentProfiles.get(readSession()?.id) ?? null) };
    },
    async save(input) {
      await delay();
      if (!['trader', 'analyst'].includes(readSession()?.role)) { const error = new Error('Investment profile is not available for this role.'); error.status = 403; throw error; }
      const capital_vnd = Number(input?.capital_vnd); const risk_pct = Number(input?.risk_pct);
      if (!Number.isFinite(capital_vnd) || capital_vnd <= 0 || capital_vnd > 1_000_000_000_000_000 || !Number.isFinite(risk_pct) || risk_pct <= 0 || risk_pct > 100) { const error = new Error('Invalid capital or risk percentage.'); error.status = 422; throw error; }
      const profile = { capital_vnd, risk_pct, updated_at: new Date().toISOString() };
      mockInvestmentProfiles.set(readSession()?.id, profile);
      return { profile: structuredClone(profile) };
    },
  },
  chat: {
    async sessions() { await delay(); ensureChatRole(); return { items: structuredClone(userCollection(mockChatSessions)) }; },
    async createSession(title = 'Cuộc trò chuyện mới') {
      await delay(); ensureChatRole();
      const value = String(title ?? '').trim();
      if (!value || value.length > 120) { const error = new Error('Tiêu đề phải từ 1 đến 120 ký tự.'); error.status = 422; throw error; }
      const session = { id: `demo-chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title: value, message_count: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      userCollection(mockChatSessions).unshift(session);
      return { session: structuredClone(session) };
    },
    async messages(id) {
      await delay(); ensureChatRole();
      if (!userCollection(mockChatSessions).some((item) => item.id === id)) { const error = new Error('Không tìm thấy phiên chat.'); error.status = 404; throw error; }
      return { items: [] };
    },
    async sendMessage(id, content) {
      await delay(); ensureChatRole();
      if (!userCollection(mockChatSessions).some((item) => item.id === id)) { const error = new Error('Không tìm thấy phiên chat.'); error.status = 404; throw error; }
      if (typeof content !== 'string' || !content.trim() || content.trim().length > 8000) { const error = new Error('Câu hỏi phải từ 1 đến 8.000 ký tự.'); error.status = 422; throw error; }
      const error = new Error('Mô hình ONNX và pipeline an toàn chưa sẵn sàng. Câu hỏi chưa được gửi hoặc lưu.'); error.status = 503; throw error;
    },
    async deleteSession(id) {
      await delay(); ensureChatRole(); const items = userCollection(mockChatSessions); const next = items.filter((item) => item.id !== id);
      if (next.length === items.length) { const error = new Error('Không tìm thấy phiên chat.'); error.status = 404; throw error; }
      mockChatSessions.set(readSession()?.id, next); return { id, removed: true };
    },
  },
  notifications: {
    async getPreferences() {
      await delay(); ensureNotificationRole();
      return { preferences: structuredClone(mockNotificationPreferences.get(readSession()?.id) ?? { in_app_enabled: true, email_enabled: false, telegram_enabled: false, updated_at: null }),
        delivery: { email: { provider_configured: false, verified: false, delivery_enabled: false }, telegram: { provider_configured: false, verified: false, delivery_enabled: false } } };
    },
    async savePreferences(input) {
      await delay(); ensureNotificationRole();
      const keys = ['in_app_enabled', 'email_enabled', 'telegram_enabled'];
      if (!input || Object.keys(input).length !== keys.length || keys.some((key) => typeof input[key] !== 'boolean') || Object.keys(input).some((key) => !keys.includes(key))) { const error = new Error('Thiết lập thông báo không hợp lệ.'); error.status = 422; throw error; }
      if (input.email_enabled || input.telegram_enabled) { const error = new Error('Kênh ngoài chưa được xác minh trong mock mode.'); error.status = 409; throw error; }
      const preferences = { ...input, updated_at: new Date().toISOString() };
      mockNotificationPreferences.set(readSession()?.id, preferences);
      return { preferences: structuredClone(preferences), delivery: { email: { provider_configured: false, verified: false, delivery_enabled: false }, telegram: { provider_configured: false, verified: false, delivery_enabled: false } } };
    },
    async channels() { await delay(); ensureNotificationRole(); return { channels: { email: { destination: readSession()?.email, verified: false }, telegram: { destination: null, verified: false } }, providers: { email: { provider_configured: false }, telegram: { provider_configured: false } } }; },
    async linkEmail() { await delay(); const error = new Error('Mock mode không gửi email xác minh. Hãy cấu hình SMTP và dùng API thật.'); error.status = 503; throw error; },
    async verifyEmail() { await delay(); const error = new Error('Mock mode không hỗ trợ xác minh email.'); error.status = 503; throw error; },
    async linkTelegram() { await delay(); const error = new Error('Mock mode không liên kết Telegram. Hãy cấu hình Telegram Bot và dùng API thật.'); error.status = 503; throw error; },
    async test() { await delay(); const error = new Error('Mock mode không gửi thông báo ngoài ứng dụng.'); error.status = 503; throw error; },
    async unlink(channel) { await delay(); ensureNotificationRole(); return { channel, removed: true }; },
  },
  symbols: {
    async historyCsv() { throw new Error('CSV export requires the real API and an enabled release flag.'); },
    async detail(symbol) {
      await delay();
      const item = marketMock.symbols.items.find((row) => row.symbol === symbol);
      if (!item) { const error = new Error('Không tìm thấy mã cổ phiếu.'); error.status = 404; throw error; }
      return structuredClone(item);
    },
    async prices(symbol) {
      await delay();
      const item = marketMock.symbols.items.find((row) => row.symbol === symbol);
      if (!item) { const error = new Error('Không tìm thấy mã cổ phiếu.'); error.status = 404; throw error; }
      const seed = [...symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const points = Array.from({ length: 30 }, (_, index) => {
        const drift = ((index * (seed % 7 + 3)) % 17 - 8) / 100;
        const wave = Math.sin((index + seed) / 3) * 0.012;
        const close = Math.round(item.closePrice * (0.91 + index * 0.003 + drift * 0.01 + wave));
        return { date: new Date(Date.UTC(2026, 9, 7 - (29 - index) * 3)).toISOString().slice(0, 10), close };
      });
      points[points.length - 1].close = item.closePrice;
      return { symbol, currency: 'VND', interval: '1d', sourceStatus: 'demo', latestDate: points.at(-1).date, items: points };
    },
    async news(symbol) {
      await delay();
      const item = marketMock.symbols.items.find((row) => row.symbol === symbol);
      if (!item) { const error = new Error('Không tìm thấy mã cổ phiếu.'); error.status = 404; throw error; }
      return { items: [
        { id: `${symbol}-news-1`, title: `${item.name}: cập nhật hoạt động kinh doanh`, summary: 'Tin mẫu để hoàn thiện luồng giao diện. Nội dung thực tế sẽ được cung cấp từ nguồn tin đã cấp phép.', source: 'StockSense Demo', publishedAt: '2026-10-07T09:30:00+07:00', sentiment: 'neutral', url: null },
        { id: `${symbol}-news-2`, title: `Diễn biến đáng chú ý quanh cổ phiếu ${symbol}`, summary: 'Bản tin minh họa; cần đối chiếu nguồn và thời điểm công bố khi thay bằng dữ liệu thật.', source: 'StockSense Demo', publishedAt: '2026-10-06T14:15:00+07:00', sentiment: 'positive', url: null },
      ] };
    },
  },
  watchlist: {
    async list() { await delay(); return { items: structuredClone(userCollection(mockWatchlists)) }; },
    async add(symbol, note = '') {
      await delay();
      const item = marketMock.symbols.items.find((row) => row.symbol === symbol);
      if (!item) { const error = new Error('Không tìm thấy mã cổ phiếu.'); error.status = 404; throw error; }
      const items = userCollection(mockWatchlists);
      const existing = items.find((row) => row.symbol === symbol);
      if (!existing && items.length >= 10) { const error = new Error('Watchlist tối đa 10 mã.'); error.status = 409; throw error; }
      if (existing) existing.note = note;
      else items.push({ symbol, name: item.name, exchange: item.exchange, close: item.closePrice, price_date: marketMock.status.dataDate, note, created_at: new Date().toISOString() });
      return { symbol, note };
    },
    async updateNote(symbol, note) {
      await delay();
      const item = userCollection(mockWatchlists).find((row) => row.symbol === symbol);
      if (!item) { const error = new Error('Mã không có trong watchlist của bạn.'); error.status = 404; throw error; }
      item.note = note;
      return { symbol, note };
    },
    async remove(symbol) {
      await delay();
      const items = userCollection(mockWatchlists);
      const next = items.filter((item) => item.symbol !== symbol);
      if (next.length === items.length) { const error = new Error('Mã không có trong watchlist của bạn.'); error.status = 404; throw error; }
      mockWatchlists.set(readSession()?.id, next);
      return { symbol, removed: true };
    },
  },
  alerts: {
    async rules() { await delay(); return { items: structuredClone(userCollection(mockAlertRules)) }; },
    async createRule(payload) {
      await delay();
      const symbol = marketMock.symbols.items.find((row) => row.symbol === payload.symbol);
      if (!symbol) { const error = new Error('Không tìm thấy mã cổ phiếu.'); error.status = 404; throw error; }
      const rule = { id: `demo-rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...payload, name: symbol.name, is_active: true, created_at: new Date().toISOString() };
      userCollection(mockAlertRules).unshift(rule);
      return rule;
    },
    async updateRule(id, changes) {
      await delay();
      const rule = userCollection(mockAlertRules).find((item) => item.id === id);
      if (!rule) { const error = new Error('Không tìm thấy quy tắc cảnh báo.'); error.status = 404; throw error; }
      Object.assign(rule, changes);
      return structuredClone(rule);
    },
    async deleteRule(id) {
      await delay();
      const rules = userCollection(mockAlertRules);
      const next = rules.filter((rule) => rule.id !== id);
      if (next.length === rules.length) { const error = new Error('Không tìm thấy quy tắc cảnh báo.'); error.status = 404; throw error; }
      mockAlertRules.set(readSession()?.id, next);
      return { id, removed: true };
    },
    async list() { await delay(); return { items: structuredClone(userCollection(mockUserAlerts)) }; },
    async markRead(id) {
      await delay();
      const alert = userCollection(mockUserAlerts).find((item) => item.id === id);
      if (!alert) { const error = new Error('Không tìm thấy cảnh báo.'); error.status = 404; throw error; }
      alert.read_at = new Date().toISOString();
      return { id, read_at: alert.read_at };
    },
  },
  reports: {
    async symbol() { throw new Error('Xuất PDF cần kết nối API thật.'); },
    async portfolio() { throw new Error('Xuất PDF cần kết nối API thật.'); },
    async plan() { throw new Error('Xuất PDF cần kết nối API thật.'); },
    async journal() { throw new Error('Xuất PDF cần kết nối API thật.'); },
  },
  admin: {
    users: {
      async list({ q = '' } = {}) {
        await delay();
        const needle = q.trim().toLowerCase();
        const items = [...mockUsers.values()].filter((user) => !needle || user.email.includes(needle));
        return { total: items.length, items: structuredClone(items) };
      },
      async create({ email, role }) {
        await delay();
        const normalizedEmail = email.trim().toLowerCase();
        if ([...mockUsers.values()].some((user) => user.email === normalizedEmail)) { const error = new Error('Email này đã được sử dụng.'); error.status = 409; throw error; }
        const password = temporaryPassword();
        const user = { id: `demo-created-${Date.now()}`, email: normalizedEmail, role, is_active: true, must_change_password: true, failed_login_count: 0, locked_until: null, created_at: new Date().toISOString() };
        demoPasswords.set(normalizedEmail, password);
        mockUsers.set(user.id, user);
        mockAudit.unshift({ id: `audit-${Date.now()}`, event_type: 'user.created', target_email: user.email, actor_email: actorEmail(), created_at: new Date().toISOString(), details: { role } });
        return { user: structuredClone(user), temporary_password: password };
      },
      async update(id, changes) {
        await delay();
        const user = mockUsers.get(id);
        if (!user) { const error = new Error('Không tìm thấy tài khoản.'); error.status = 404; throw error; }
        if (readSession()?.id === id) { const error = new Error('Không thể thay đổi vai trò hoặc trạng thái tài khoản đang sử dụng.'); error.status = 409; throw error; }
        const nextRole = changes.role ?? user.role;
        const nextActive = changes.is_active ?? user.is_active;
        if (user.role === 'admin' && user.is_active && (nextRole !== 'admin' || !nextActive) && [...mockUsers.values()].filter((entry) => entry.role === 'admin' && entry.is_active).length <= 1) {
          const error = new Error('Phải luôn còn ít nhất một quản trị viên đang hoạt động.'); error.status = 409; throw error;
        }
        Object.assign(user, changes);
        mockAudit.unshift({ id: `audit-${Date.now()}`, event_type: 'user.updated', target_email: user.email, actor_email: actorEmail(), created_at: new Date().toISOString(), details: changes });
        return { user: structuredClone(user), revoked_sessions: 1 };
      },
      async resetPassword(id) {
        await delay();
        const user = mockUsers.get(id);
        if (!user) { const error = new Error('Không tìm thấy tài khoản.'); error.status = 404; throw error; }
        if (readSession()?.id === id) { const error = new Error('Dùng chức năng đổi mật khẩu cho tài khoản đang đăng nhập.'); error.status = 409; throw error; }
        const password = temporaryPassword();
        user.must_change_password = true;
        demoPasswords.set(user.email, password);
        mockAudit.unshift({ id: `audit-${Date.now()}`, event_type: 'user.password_reset', target_email: user.email, actor_email: actorEmail(), created_at: new Date().toISOString(), details: {} });
        return { user: structuredClone(user), temporary_password: password, revoked_sessions: 1 };
      },
      async revokeSessions(id) {
        await delay();
        if (!mockUsers.has(id)) { const error = new Error('Không tìm thấy tài khoản.'); error.status = 404; throw error; }
        if (readSession()?.id === id) { const error = new Error('Không thể thu hồi phiên của tài khoản đang thực hiện thao tác.'); error.status = 409; throw error; }
        mockAudit.unshift({ id: `audit-${Date.now()}`, event_type: 'user.sessions_revoked', target_email: mockUsers.get(id).email, actor_email: actorEmail(), created_at: new Date().toISOString(), details: { revoked_sessions: 1 } });
        return { revoked_sessions: 1 };
      },
    },
    async audit({ eventType } = {}) { await delay(); const filtered = eventType ? mockAudit.filter((item) => item.event_type === eventType) : mockAudit; return { items: structuredClone(filtered.slice(0, 50)), next_cursor: null }; },
    async ingestionRuns() { await delay(); return { items: [] }; },
    async notifications() { await delay(); return { items: [] }; },
    async opsEvents() { await delay(); return { items: [] }; },
    async jobs() { await delay(); return { jobs: [
      { key: 'market.sync', label: 'Sync SSI market data', description: 'Load daily OHLCV for enabled symbols.' },
      { key: 'news.sync', label: 'Sync news', description: 'Load headlines and link them to symbols.' },
      { key: 'notifications.deliver', label: 'Deliver pending notifications', description: 'Send queued email and Telegram notifications.' },
    ], runs: [], workers: [] }; },
    async enqueueJob() { throw new Error('Hàng đợi worker cần API thật, PostgreSQL và migration 016.'); },
  },
};
