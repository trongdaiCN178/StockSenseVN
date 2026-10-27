import { ApiError } from '../errors.js';
import { calculateRiskReward } from '@stocksense/core/calc';

// FR-M10-05: Nháp → Chờ vào → Đang mở → Đã đóng; any open plan may be cancelled.
const TRANSITIONS = Object.freeze({
  draft: ['planned', 'cancelled'],
  planned: ['active', 'cancelled'],
  active: ['cancelled'],
});
const EDITABLE_STATUSES = new Set(['draft', 'planned', 'active']);
const CLOSE_REASONS = new Set(['target_hit', 'stop_hit', 'expired', 'manual']);
const EDITABLE_FIELDS = ['entry_price', 'entry_price_max', 'stop_price', 'target_price', 'quantity', 'note', 'expires_on'];

const planColumns = `p.id::text, p.symbol, s.name, s.industry, p.side, p.status,
  p.entry_price, p.entry_price_max, p.stop_price, p.target_price, p.quantity, p.capital_vnd, p.risk_pct,
  p.note, p.snapshot, p.exit_price, p.close_note, p.close_reason, p.realized_pnl,
  p.expires_on::text AS expires_on, p.created_at, p.updated_at, p.closed_at,
  COALESCE((SELECT json_agg(json_build_object('id', r.id, 'previous', r.previous, 'changes', r.changes, 'created_at', r.created_at)
    ORDER BY r.created_at DESC) FROM trade_plan_revisions r WHERE r.plan_id = p.id), '[]'::json) AS revisions`;

export function createPlansRepository(pool) {
  async function withTransaction(work) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async function lockPlan(client, userId, id) {
    const { rows } = await client.query('SELECT * FROM trade_plans WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, userId]);
    if (!rows[0]) throw new ApiError(404, 'PLAN_NOT_FOUND', 'Không tìm thấy kế hoạch giao dịch.');
    return rows[0];
  }

  const repository = {
    async list(userId) {
      const { rows } = await pool.query(`SELECT ${planColumns}
        FROM trade_plans p JOIN symbols s ON s.symbol=p.symbol
        WHERE p.user_id=$1 ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'planned' THEN 1 WHEN 'draft' THEN 2 WHEN 'closed' THEN 3 ELSE 4 END,
          p.created_at DESC`, [userId]);
      return { items: rows.map(mapPlan) };
    },
    async get(userId, id) {
      const { rows } = await pool.query(`SELECT ${planColumns}
        FROM trade_plans p JOIN symbols s ON s.symbol=p.symbol WHERE p.id=$1 AND p.user_id=$2`, [id, userId]);
      return rows[0] ? mapPlan(rows[0]) : null;
    },
    async create(userId, plan) {
      const { rows: symbolRows } = await pool.query(`SELECT s.name, latest.close, latest.trade_date::text AS trade_date, latest.source
        FROM symbols s LEFT JOIN LATERAL (SELECT close, trade_date, source FROM daily_prices WHERE symbol=s.symbol ORDER BY trade_date DESC LIMIT 1) latest ON true
        WHERE s.symbol=$1 AND s.is_enabled=true`, [plan.symbol]);
      if (!symbolRows[0]) throw new ApiError(404, 'SYMBOL_NOT_FOUND', 'Không tìm thấy mã cổ phiếu đang hoạt động.');
      const quote = symbolRows[0];
      const snapshot = { captured_at: new Date().toISOString(), market_price: quote.close == null ? null : Number(quote.close), price_date: quote.trade_date, price_source: quote.source, forecast: null, forecast_status: 'not_available_model_not_ready' };
      const { rows } = await pool.query(`INSERT INTO trade_plans
        (user_id,symbol,side,status,entry_price,entry_price_max,stop_price,target_price,quantity,capital_vnd,risk_pct,note,expires_on,snapshot)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb) RETURNING id::text`,
      [userId, plan.symbol, plan.side, plan.status, plan.entry_price, plan.entry_price_max, plan.stop_price, plan.target_price,
        plan.quantity ?? null, plan.capital_vnd ?? null, plan.risk_pct ?? null, plan.note, plan.expires_on, JSON.stringify(snapshot)]);
      return repository.get(userId, rows[0].id);
    },
    async updateStatus(userId, id, status) {
      await withTransaction(async (client) => {
        const plan = await lockPlan(client, userId, id);
        if (!TRANSITIONS[plan.status]?.includes(status)) throw new ApiError(409, 'INVALID_PLAN_TRANSITION', 'Không thể chuyển kế hoạch sang trạng thái này.');
        await client.query(`UPDATE trade_plans SET status=$3, close_reason=CASE WHEN $3='cancelled' THEN 'cancelled' ELSE close_reason END,
          updated_at=now() WHERE id=$1 AND user_id=$2`, [id, userId, status]);
      });
      return repository.get(userId, id);
    },
    // FR-M10-09: open plans can be edited; every edit is kept as a revision for the journal to compare.
    async update(userId, id, changes) {
      await withTransaction(async (client) => {
        const plan = await lockPlan(client, userId, id);
        if (!EDITABLE_STATUSES.has(plan.status)) throw new ApiError(409, 'PLAN_NOT_EDITABLE', 'Chỉ sửa được kế hoạch chưa đóng hoặc chưa hủy.');
        const current = Object.fromEntries(EDITABLE_FIELDS.map((key) => [key, normalizeStored(key, plan[key])]));
        const next = { ...current, ...changes };
        validateLevels({ side: plan.side, ...next });
        const changed = Object.fromEntries(Object.entries(changes).filter(([key, value]) => value !== current[key]));
        if (!Object.keys(changed).length) return;
        await client.query(`UPDATE trade_plans SET entry_price=$3, entry_price_max=$4, stop_price=$5, target_price=$6,
          quantity=$7, note=$8, expires_on=$9, updated_at=now() WHERE id=$1 AND user_id=$2`,
        [id, userId, next.entry_price, next.entry_price_max, next.stop_price, next.target_price, next.quantity, next.note, next.expires_on]);
        await client.query(`INSERT INTO trade_plan_revisions(plan_id,user_id,previous,changes) VALUES ($1,$2,$3::jsonb,$4::jsonb)`,
          [id, userId, JSON.stringify(Object.fromEntries(Object.keys(changed).map((key) => [key, current[key]]))), JSON.stringify(changed)]);
      });
      return repository.get(userId, id);
    },
    async close(userId, id, { exit_price, note, reason }) {
      await withTransaction(async (client) => {
        const plan = await lockPlan(client, userId, id);
        if (plan.status !== 'active') throw new ApiError(409, 'PLAN_NOT_ACTIVE', 'Chỉ đóng được kế hoạch đang mở.');
        const entry = Number(plan.entry_price); const quantity = plan.quantity == null ? null : Number(plan.quantity);
        const realized = quantity == null ? null : (plan.side === 'long' ? exit_price - entry : entry - exit_price) * quantity;
        await client.query(`UPDATE trade_plans SET status='closed', exit_price=$3, close_note=$4, close_reason=$5,
          realized_pnl=$6, closed_at=now(), updated_at=now() WHERE id=$1 AND user_id=$2`, [id, userId, exit_price, note, reason, realized]);
        const { rows: revisions } = await client.query('SELECT previous, changes, created_at FROM trade_plan_revisions WHERE plan_id=$1 ORDER BY created_at', [id]);
        const risk = Math.abs(entry - Number(plan.stop_price));
        const realizedR = risk ? Number(((plan.side === 'long' ? exit_price - entry : entry - exit_price) / risk).toFixed(2)) : null;
        await client.query(`INSERT INTO journal_entries(user_id,plan_id,symbol,kind,title,body,realized_pnl,snapshot)
          VALUES ($1,$2,$3,'plan_close',$4,$5,$6,$7::jsonb)`,
        [userId, id, plan.symbol, `Đóng kế hoạch ${plan.symbol} · ${CLOSE_REASON_LABELS[reason]}`, note, realized,
          JSON.stringify({
            plan_snapshot: plan.snapshot,
            plan: { side: plan.side, entry_price: entry, entry_price_max: plan.entry_price_max == null ? null : Number(plan.entry_price_max),
              stop_price: Number(plan.stop_price), target_price: Number(plan.target_price), quantity, note: plan.note, created_at: plan.created_at },
            revisions, exit_price, close_reason: reason, realized_r: realizedR, closed_at: new Date().toISOString(),
          })]);
      });
      return repository.get(userId, id);
    },
  };
  return repository;
}

export const CLOSE_REASON_LABELS = Object.freeze({
  target_hit: 'Chạm mục tiêu', stop_hit: 'Chạm cắt lỗ', expired: 'Hết hạn', manual: 'Đóng thủ công', cancelled: 'Đã hủy',
});

function normalizeStored(key, value) {
  if (value == null) return null;
  if (key === 'note') return value;
  // node-pg parses DATE columns as local-midnight Date objects.
  if (key === 'expires_on') return value instanceof Date ? value.toLocaleDateString('en-CA') : String(value).slice(0, 10);
  return Number(value);
}

function mapPlan(row) {
  const toNumber = (value) => (value == null ? null : Number(value));
  return { ...row,
    entry_price: Number(row.entry_price), entry_price_max: toNumber(row.entry_price_max),
    stop_price: Number(row.stop_price), target_price: Number(row.target_price),
    quantity: toNumber(row.quantity), capital_vnd: toNumber(row.capital_vnd), risk_pct: toNumber(row.risk_pct),
    exit_price: toNumber(row.exit_price), realized_pnl: toNumber(row.realized_pnl),
  };
}

function parsePrice(value, label) {
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0 || price > 1_000_000_000_000) throw new ApiError(422, 'VALIDATION_ERROR', `${label} không hợp lệ.`);
  return price;
}

function parseOptionalDate(value) {
  if (value == null || value === '') return null;
  const parts = typeof value === 'string' ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  const date = parts ? new Date(Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))) : null;
  if (!date || date.toISOString().slice(0, 10) !== value) throw new ApiError(422, 'VALIDATION_ERROR', 'Ngày hết hạn phải có dạng YYYY-MM-DD.');
  return value;
}

function validateLevels({ side, entry_price, entry_price_max, stop_price, target_price }) {
  if (entry_price_max != null && entry_price_max < entry_price) throw new ApiError(422, 'VALIDATION_ERROR', 'Giá vào tối đa phải lớn hơn hoặc bằng giá vào tối thiểu.');
  // The whole entry zone must sit between stop and target for the plan to make sense.
  const zoneEdge = side === 'long' ? entry_price_max ?? entry_price : entry_price;
  try { calculateRiskReward({ side, entry_price: zoneEdge, stop_price, target_price }); }
  catch { throw new ApiError(422, 'VALIDATION_ERROR', 'Giá cắt lỗ và giá mục tiêu phải nằm đúng phía so với vùng giá vào.'); }
}

export function validatePlan(input, canCalculateQuantity) {
  if (!input || typeof input !== 'object' || !/^[A-Z0-9.-]{1,12}$/.test(input.symbol ?? '') || !['long', 'short'].includes(input.side)) throw new ApiError(422, 'VALIDATION_ERROR', 'Kế hoạch cần mã cổ phiếu hợp lệ và hướng mua/bán.');
  if (!canCalculateQuantity && (Object.hasOwn(input, 'capital_vnd') || Object.hasOwn(input, 'risk_pct'))) throw new ApiError(403, 'FIELD_FORBIDDEN', 'Vai trò hiện tại không dùng được vốn và mức rủi ro.');
  const entry = parsePrice(input.entry_price, 'Giá vào'); const stop = parsePrice(input.stop_price, 'Giá cắt lỗ'); const target = parsePrice(input.target_price, 'Giá mục tiêu');
  const entryMax = input.entry_price_max == null || input.entry_price_max === '' ? null : parsePrice(input.entry_price_max, 'Giá vào tối đa');
  validateLevels({ side: input.side, entry_price: entry, entry_price_max: entryMax, stop_price: stop, target_price: target });
  // Size the position on the unfavourable edge of the entry zone, exactly as the plan form shows it.
  const sizingEntry = input.side === 'long' ? entryMax ?? entry : entry;
  let calculation;
  try {
    calculation = calculateRiskReward({ side: input.side, entry_price: sizingEntry, stop_price: stop, target_price: target,
      ...(canCalculateQuantity && input.capital_vnd != null ? { capital_vnd: input.capital_vnd, risk_pct: input.risk_pct } : {}) });
  } catch (error) { throw new ApiError(422, 'VALIDATION_ERROR', error instanceof RangeError ? 'Giá cắt lỗ và giá mục tiêu phải nằm đúng phía so với giá vào.' : 'Giá vào, cắt lỗ, mục tiêu hoặc vốn không hợp lệ.'); }
  const suggestedQuantity = calculation.max_quantity > 0 ? calculation.max_quantity : null;
  const quantity = input.quantity == null || input.quantity === '' ? suggestedQuantity : Number(input.quantity);
  if (quantity != null && (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000_000)) throw new ApiError(422, 'VALIDATION_ERROR', 'Khối lượng phải lớn hơn 0.');
  const note = input.note ?? '';
  if (typeof note !== 'string' || note.length > 1000) throw new ApiError(422, 'VALIDATION_ERROR', 'Lý do/ghi chú tối đa 1000 ký tự.');
  const capital = canCalculateQuantity && input.capital_vnd != null ? Number(input.capital_vnd) : null;
  const risk = canCalculateQuantity && input.risk_pct != null ? Number(input.risk_pct) : null;
  if ((capital == null) !== (risk == null)) throw new ApiError(422, 'VALIDATION_ERROR', 'Vốn và mức rủi ro phải nhập cùng nhau.');
  const status = input.status ?? 'planned';
  if (!['draft', 'planned'].includes(status)) throw new ApiError(422, 'VALIDATION_ERROR', 'Kế hoạch mới chỉ có thể lưu nháp hoặc chờ vào.');
  return { symbol: input.symbol, side: input.side, status, entry_price: entry, entry_price_max: entryMax, stop_price: stop, target_price: target,
    quantity, capital_vnd: capital, risk_pct: risk, note: note.trim(), expires_on: parseOptionalDate(input.expires_on), calculation };
}

export function validatePlanUpdate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(422, 'VALIDATION_ERROR', 'Nội dung sửa kế hoạch không hợp lệ.');
  const keys = Object.keys(input);
  if (!keys.length || keys.some((key) => !EDITABLE_FIELDS.includes(key))) throw new ApiError(422, 'VALIDATION_ERROR', `Chỉ sửa được: ${EDITABLE_FIELDS.join(', ')}.`);
  const changes = {};
  for (const key of ['entry_price', 'stop_price', 'target_price']) if (Object.hasOwn(input, key)) changes[key] = parsePrice(input[key], key);
  if (Object.hasOwn(input, 'entry_price_max')) changes.entry_price_max = input.entry_price_max == null || input.entry_price_max === '' ? null : parsePrice(input.entry_price_max, 'Giá vào tối đa');
  if (Object.hasOwn(input, 'quantity')) {
    const quantity = input.quantity == null || input.quantity === '' ? null : Number(input.quantity);
    if (quantity != null && (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000_000)) throw new ApiError(422, 'VALIDATION_ERROR', 'Khối lượng phải lớn hơn 0.');
    changes.quantity = quantity;
  }
  if (Object.hasOwn(input, 'note')) {
    if (typeof input.note !== 'string' || input.note.length > 1000) throw new ApiError(422, 'VALIDATION_ERROR', 'Lý do/ghi chú tối đa 1000 ký tự.');
    changes.note = input.note.trim();
  }
  if (Object.hasOwn(input, 'expires_on')) changes.expires_on = parseOptionalDate(input.expires_on);
  return changes;
}

export function validatePlanCalculation(input, canCalculateQuantity) {
  if (!input || typeof input !== 'object') throw new ApiError(422, 'VALIDATION_ERROR', 'Dữ liệu tính toán không hợp lệ.');
  if (!canCalculateQuantity && (Object.hasOwn(input, 'capital_vnd') || Object.hasOwn(input, 'risk_pct'))) throw new ApiError(403, 'FIELD_FORBIDDEN', 'Vai trò hiện tại không dùng được vốn và mức rủi ro.');
  if (canCalculateQuantity && ((input.capital_vnd == null) !== (input.risk_pct == null))) throw new ApiError(422, 'VALIDATION_ERROR', 'Vốn và mức rủi ro phải nhập cùng nhau.');
  try {
    return calculateRiskReward({ side: input.side, entry_price: input.entry_price, stop_price: input.stop_price, target_price: input.target_price,
      ...(canCalculateQuantity && input.capital_vnd != null ? { capital_vnd: input.capital_vnd, risk_pct: input.risk_pct } : {}) });
  } catch (error) { throw new ApiError(422, 'VALIDATION_ERROR', error instanceof RangeError ? 'Giá cắt lỗ và giá mục tiêu phải nằm đúng phía so với giá vào.' : 'Giá vào, cắt lỗ, mục tiêu hoặc vốn không hợp lệ.'); }
}

export function validatePlanClose(input) {
  const exit = Number(input?.exit_price); const note = input?.note ?? ''; const reason = input?.reason ?? 'manual';
  if (!Number.isFinite(exit) || exit <= 0 || exit > 1_000_000_000_000 || typeof note !== 'string' || note.length > 1000) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Giá thoát phải lớn hơn 0 và ghi chú tối đa 1000 ký tự.');
  }
  if (!CLOSE_REASONS.has(reason)) throw new ApiError(422, 'VALIDATION_ERROR', 'Lý do đóng không hợp lệ.');
  return { exit_price: exit, note: note.trim(), reason };
}
