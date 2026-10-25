import { ApiError } from '../errors.js';
import { calculateRiskReward } from '@stocksense/core/calc';

export function createPlansRepository(pool) {
  return {
    async list(userId) {
      const { rows } = await pool.query(`SELECT p.id::text, p.symbol, s.name, p.side, p.status,
        p.entry_price, p.stop_price, p.target_price, p.quantity, p.capital_vnd, p.risk_pct,
        p.note, p.snapshot, p.exit_price, p.close_note, p.realized_pnl, p.created_at, p.updated_at, p.closed_at
        FROM trade_plans p JOIN symbols s ON s.symbol=p.symbol
        WHERE p.user_id=$1 ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'planned' THEN 1 WHEN 'closed' THEN 2 ELSE 3 END, p.created_at DESC`, [userId]);
      return { items: rows.map(mapPlan) };
    },
    async create(userId, plan) {
      const { rows: symbolRows } = await pool.query(`SELECT s.name, latest.close, latest.trade_date::text AS trade_date, latest.source
        FROM symbols s LEFT JOIN LATERAL (SELECT close, trade_date, source FROM daily_prices WHERE symbol=s.symbol ORDER BY trade_date DESC LIMIT 1) latest ON true
        WHERE s.symbol=$1 AND s.is_enabled=true`, [plan.symbol]);
      if (!symbolRows[0]) throw new ApiError(404, 'SYMBOL_NOT_FOUND', 'Active symbol was not found.');
      const quote = symbolRows[0];
      const snapshot = { captured_at: new Date().toISOString(), market_price: quote.close == null ? null : Number(quote.close), price_date: quote.trade_date, price_source: quote.source, forecast: null, forecast_status: 'not_available_model_not_ready' };
      const { rows } = await pool.query(`INSERT INTO trade_plans
        (user_id,symbol,side,entry_price,stop_price,target_price,quantity,capital_vnd,risk_pct,note,snapshot)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
        RETURNING id::text, symbol, side, status, entry_price, stop_price, target_price, quantity, capital_vnd, risk_pct, note, snapshot, created_at, updated_at`,
      [userId, plan.symbol, plan.side, plan.entry_price, plan.stop_price, plan.target_price, plan.quantity ?? null, plan.capital_vnd ?? null, plan.risk_pct ?? null, plan.note, JSON.stringify(snapshot)]);
      return mapPlan({ ...rows[0], name: quote.name });
    },
    async updateStatus(userId, id, status) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query('SELECT id, status FROM trade_plans WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, userId]);
        if (!rows[0]) throw new ApiError(404, 'PLAN_NOT_FOUND', 'Trade plan was not found.');
        const allowed = (rows[0].status === 'planned' && ['active', 'cancelled'].includes(status)) || (rows[0].status === 'active' && status === 'cancelled');
        if (!allowed) throw new ApiError(409, 'INVALID_PLAN_TRANSITION', 'This plan status transition is not allowed.');
        await client.query('UPDATE trade_plans SET status=$3, updated_at=now() WHERE id=$1 AND user_id=$2', [id, userId, status]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
      return this.get(userId, id);
    },
    async close(userId, id, { exit_price, note }) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(`SELECT id, symbol, side, status, entry_price, quantity, snapshot
          FROM trade_plans WHERE id=$1 AND user_id=$2 FOR UPDATE`, [id, userId]);
        const plan = rows[0];
        if (!plan) throw new ApiError(404, 'PLAN_NOT_FOUND', 'Trade plan was not found.');
        if (plan.status !== 'active') throw new ApiError(409, 'PLAN_NOT_ACTIVE', 'Only active plans can be closed.');
        const entry = Number(plan.entry_price); const quantity = plan.quantity == null ? null : Number(plan.quantity);
        const realized = quantity == null ? null : (plan.side === 'long' ? exit_price - entry : entry - exit_price) * quantity;
        await client.query(`UPDATE trade_plans SET status='closed', exit_price=$3, close_note=$4,
          realized_pnl=$5, closed_at=now(), updated_at=now() WHERE id=$1 AND user_id=$2`, [id, userId, exit_price, note, realized]);
        await client.query(`INSERT INTO journal_entries(user_id,plan_id,symbol,kind,title,body,realized_pnl,snapshot)
          VALUES ($1,$2,$3,'plan_close',$4,$5,$6,$7::jsonb)`,
        [userId, id, plan.symbol, `${plan.symbol} trade plan closed`, note, realized,
          JSON.stringify({ plan_snapshot: plan.snapshot, exit_price, closed_at: new Date().toISOString() })]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
      return this.get(userId, id);
    },
    async get(userId, id) {
      const { rows } = await pool.query(`SELECT p.id::text, p.symbol, s.name, p.side, p.status,
        p.entry_price, p.stop_price, p.target_price, p.quantity, p.capital_vnd, p.risk_pct,
        p.note, p.snapshot, p.exit_price, p.close_note, p.realized_pnl, p.created_at, p.updated_at, p.closed_at
        FROM trade_plans p JOIN symbols s ON s.symbol=p.symbol WHERE p.id=$1 AND p.user_id=$2`, [id, userId]);
      return rows[0] ? mapPlan(rows[0]) : null;
    },
  };
}

function mapPlan(row) {
  return { ...row,
    entry_price: Number(row.entry_price), stop_price: Number(row.stop_price), target_price: Number(row.target_price),
    quantity: row.quantity == null ? null : Number(row.quantity), capital_vnd: row.capital_vnd == null ? null : Number(row.capital_vnd),
    risk_pct: row.risk_pct == null ? null : Number(row.risk_pct), exit_price: row.exit_price == null ? null : Number(row.exit_price),
    realized_pnl: row.realized_pnl == null ? null : Number(row.realized_pnl),
  };
}

export function validatePlan(input, canCalculateQuantity) {
  if (!input || typeof input !== 'object' || !/^[A-Z0-9.-]{1,12}$/.test(input.symbol ?? '') || !['long', 'short'].includes(input.side)) throw new ApiError(422, 'VALIDATION_ERROR', 'Plan requires a valid symbol and long/short direction.');
  if (!canCalculateQuantity && (Object.hasOwn(input, 'capital_vnd') || Object.hasOwn(input, 'risk_pct'))) throw new ApiError(403, 'FIELD_FORBIDDEN', 'Capital and risk fields are not available for this role.');
  let calculation;
  try {
    calculation = calculateRiskReward({ side: input.side, entry_price: input.entry_price, stop_price: input.stop_price, target_price: input.target_price,
      ...(canCalculateQuantity && input.capital_vnd != null ? { capital_vnd: input.capital_vnd, risk_pct: input.risk_pct } : {}) });
  } catch (error) { throw new ApiError(422, 'VALIDATION_ERROR', error.message); }
  const suggestedQuantity = calculation.max_quantity > 0 ? calculation.max_quantity : null;
  const quantity = input.quantity == null || input.quantity === '' ? suggestedQuantity : Number(input.quantity);
  if (quantity != null && (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000_000)) throw new ApiError(422, 'VALIDATION_ERROR', 'Quantity must be positive.');
  const note = input.note ?? '';
  if (typeof note !== 'string' || note.length > 1000) throw new ApiError(422, 'VALIDATION_ERROR', 'Plan note must be at most 1000 characters.');
  const entry = Number(input.entry_price); const stop = Number(input.stop_price); const target = Number(input.target_price);
  if (![entry, stop, target].every((value) => Number.isFinite(value) && value <= 1_000_000_000_000)) throw new ApiError(422, 'VALIDATION_ERROR', 'Plan prices are outside the allowed range.');
  const capital = canCalculateQuantity && input.capital_vnd != null ? Number(input.capital_vnd) : null;
  const risk = canCalculateQuantity && input.risk_pct != null ? Number(input.risk_pct) : null;
  if ((capital == null) !== (risk == null)) throw new ApiError(422, 'VALIDATION_ERROR', 'Capital and risk percentage must be supplied together.');
  return { symbol: input.symbol, side: input.side, entry_price: entry, stop_price: stop, target_price: target, quantity, capital_vnd: capital, risk_pct: risk, note: note.trim(), calculation };
}

export function validatePlanCalculation(input, canCalculateQuantity) {
  if (!input || typeof input !== 'object') throw new ApiError(422, 'VALIDATION_ERROR', 'Calculation payload must be an object.');
  if (!canCalculateQuantity && (Object.hasOwn(input, 'capital_vnd') || Object.hasOwn(input, 'risk_pct'))) throw new ApiError(403, 'FIELD_FORBIDDEN', 'Capital and risk fields are not available for this role.');
  if (canCalculateQuantity && ((input.capital_vnd == null) !== (input.risk_pct == null))) throw new ApiError(422, 'VALIDATION_ERROR', 'Capital and risk percentage must be supplied together.');
  try {
    return calculateRiskReward({ side: input.side, entry_price: input.entry_price, stop_price: input.stop_price, target_price: input.target_price,
      ...(canCalculateQuantity && input.capital_vnd != null ? { capital_vnd: input.capital_vnd, risk_pct: input.risk_pct } : {}) });
  } catch (error) { throw new ApiError(422, 'VALIDATION_ERROR', error.message); }
}

export function validatePlanClose(input) {
  const exit = Number(input?.exit_price); const note = input?.note ?? '';
  if (!Number.isFinite(exit) || exit <= 0 || exit > 1_000_000_000_000 || typeof note !== 'string' || note.length > 1000) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Exit price must be positive and close note must be at most 1000 characters.');
  }
  return { exit_price: exit, note: note.trim() };
}
