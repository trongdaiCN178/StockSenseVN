import { ApiError } from '../errors.js';

const NOTE_LIMIT = 500;

function calculatePositions(transactions, prices) {
  const positions = new Map();
  for (const tx of [...transactions].sort((a, b) => a.symbol.localeCompare(b.symbol) || a.executed_at.localeCompare(b.executed_at) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.id.localeCompare(b.id))) {
    const position = positions.get(tx.symbol) ?? { symbol: tx.symbol, quantity: 0, average_cost: 0, invested_amount: 0, realized_pnl: 0 };
    const quantity = Number(tx.quantity); const price = Number(tx.unit_price); const fee = Number(tx.fee);
    if (tx.side === 'buy') {
      const totalQuantity = position.quantity + quantity;
      position.average_cost = (position.average_cost * position.quantity + price * quantity + fee) / totalQuantity;
      position.quantity = totalQuantity;
      position.invested_amount += price * quantity + fee;
    } else {
      if (quantity > position.quantity + 0.000001) throw new ApiError(409, 'INSUFFICIENT_POSITION', `Sell transaction for ${tx.symbol} exceeds the available quantity.`);
      position.realized_pnl += quantity * (price - position.average_cost) - fee;
      position.quantity = Math.max(0, position.quantity - quantity);
      position.invested_amount = position.average_cost * position.quantity;
      if (position.quantity === 0) position.average_cost = 0;
    }
    positions.set(tx.symbol, position);
  }
  return [...positions.values()].map((item) => {
    const marketPrice = prices.get(item.symbol) ?? null;
    const marketValue = marketPrice == null ? null : item.quantity * marketPrice;
    const costBasis = item.quantity * item.average_cost;
    return { ...item, market_price: marketPrice, market_value: marketValue, unrealized_pnl: marketValue == null ? null : marketValue - costBasis };
  }).map((item) => Object.fromEntries(Object.entries(item).map(([key, value]) => [key, typeof value === 'number' ? Number(value.toFixed(4)) : value])));
}

export function createPortfolioRepository(pool) {
  async function readLedger(db, userId) {
    const { rows } = await db.query(`SELECT id::text, symbol, side, quantity, unit_price, fee,
      executed_at::text AS executed_at, note, created_at
      FROM portfolio_transactions WHERE user_id=$1
      ORDER BY executed_at, created_at, id`, [userId]);
    return rows;
  }

  async function snapshot(userId) {
    const transactions = await readLedger(pool, userId);
    const symbols = [...new Set(transactions.map((item) => item.symbol))];
    const prices = new Map();
    if (symbols.length) {
      const { rows } = await pool.query(`SELECT DISTINCT ON (symbol) symbol, close
        FROM daily_prices WHERE symbol=ANY($1::varchar[]) ORDER BY symbol, trade_date DESC`, [symbols]);
      for (const row of rows) prices.set(row.symbol, Number(row.close));
    }
    const calculated = calculatePositions(transactions, prices);
    const positions = calculated.filter((item) => item.quantity > 0);
    const totals = calculated.reduce((sum, item) => ({
      market_value: sum.market_value + (item.market_value ?? 0),
      cost_basis: sum.cost_basis + item.quantity * item.average_cost,
      realized_pnl: sum.realized_pnl + item.realized_pnl,
      unrealized_pnl: sum.unrealized_pnl + (item.unrealized_pnl ?? 0),
    }), { market_value: 0, cost_basis: 0, realized_pnl: 0, unrealized_pnl: 0 });
    if (positions.some((item) => item.market_value == null)) {
      totals.market_value = null;
      totals.unrealized_pnl = null;
    }
    return {
      summary: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value == null ? null : Number(value.toFixed(2))])),
      positions,
      transactions: transactions.reverse().map((item) => ({ ...item, quantity: Number(item.quantity), unit_price: Number(item.unit_price), fee: Number(item.fee) })),
    };
  }

  async function insertTransactions(userId, entries) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
      for (const item of entries) {
        const exists = await client.query('SELECT 1 FROM symbols WHERE symbol=$1 AND is_enabled=true', [item.symbol]);
        if (!exists.rowCount) throw new ApiError(404, 'SYMBOL_NOT_FOUND', `Active symbol ${item.symbol} was not found.`);
        await client.query(`INSERT INTO portfolio_transactions(user_id,symbol,side,quantity,unit_price,fee,executed_at,note)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [userId, item.symbol, item.side, item.quantity, item.unit_price, item.fee, item.executed_at, item.note]);
      }
      const ledger = await readLedger(client, userId);
      calculatePositions(ledger, new Map());
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
    return snapshot(userId);
  }

  return {
    snapshot,
    add: (userId, transaction) => insertTransactions(userId, [transaction]),
    importMany: (userId, transactions) => insertTransactions(userId, transactions),
    async remove(userId, id) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
        const { rowCount } = await client.query('DELETE FROM portfolio_transactions WHERE id=$1 AND user_id=$2', [id, userId]);
        if (!rowCount) throw new ApiError(404, 'TRANSACTION_NOT_FOUND', 'Portfolio transaction was not found.');
        calculatePositions(await readLedger(client, userId), new Map());
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
      return snapshot(userId);
    },
  };
}

export function validatePortfolioTransaction(input) {
  if (!input || typeof input !== 'object' || !/^[A-Z0-9.-]{1,12}$/.test(input.symbol ?? '') || !['buy', 'sell'].includes(input.side)) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Transaction requires a valid symbol and buy/sell side.');
  }
  const quantity = Number(input.quantity); const unit_price = Number(input.unit_price); const fee = input.fee === undefined ? 0 : Number(input.fee);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000_000 || !Number.isFinite(unit_price) || unit_price <= 0 || unit_price > 1_000_000_000_000 || !Number.isFinite(fee) || fee < 0 || fee > 1_000_000_000_000) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Quantity, unit price, and fee are outside the allowed range.');
  }
  const dateParts = typeof input.executed_at === 'string' ? input.executed_at.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  const parsedDate = dateParts ? new Date(Date.UTC(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3]))) : null;
  if (!dateParts || parsedDate.toISOString().slice(0, 10) !== input.executed_at) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Transaction date must use YYYY-MM-DD format.');
  }
  if (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > NOTE_LIMIT)) throw new ApiError(422, 'VALIDATION_ERROR', `Note must be at most ${NOTE_LIMIT} characters.`);
  return { symbol: input.symbol, side: input.side, quantity, unit_price, fee, executed_at: input.executed_at, note: (input.note ?? '').trim() };
}
