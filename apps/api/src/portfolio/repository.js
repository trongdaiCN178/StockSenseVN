import { ApiError } from '../errors.js';

const NOTE_LIMIT = 500;
const HISTORY_DAYS = 180;

const sameTransaction = (a, b) => a.symbol === b.symbol && a.side === b.side && a.executed_at === b.executed_at &&
  Number(a.quantity) === Number(b.quantity) && Number(a.unit_price) === Number(b.unit_price) && Number(a.fee) === Number(b.fee);

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
    const industries = new Map();
    if (symbols.length) {
      const [priceResult, industryResult] = await Promise.all([
        pool.query(`SELECT DISTINCT ON (symbol) symbol, close
          FROM daily_prices WHERE symbol=ANY($1::varchar[]) ORDER BY symbol, trade_date DESC`, [symbols]),
        pool.query('SELECT symbol, industry FROM symbols WHERE symbol=ANY($1::varchar[])', [symbols]),
      ]);
      for (const row of priceResult.rows) prices.set(row.symbol, Number(row.close));
      for (const row of industryResult.rows) industries.set(row.symbol, row.industry);
    }
    const calculated = calculatePositions(transactions, prices);
    // FR-M9-03/05: weight of each open position and allocation by industry, valued at market price (cost when no price).
    const positionValue = (item) => item.market_value ?? item.quantity * item.average_cost;
    const heldValue = calculated.reduce((sum, item) => sum + (item.quantity > 0 ? positionValue(item) : 0), 0);
    const positions = calculated.filter((item) => item.quantity > 0).map((item) => ({
      ...item, industry: industries.get(item.symbol) ?? null,
      weight_pct: heldValue ? Number((positionValue(item) / heldValue * 100).toFixed(2)) : 0,
    }));
    const byIndustry = new Map();
    for (const item of positions) {
      const key = item.industry ?? 'Chưa phân loại';
      byIndustry.set(key, (byIndustry.get(key) ?? 0) + item.weight_pct);
    }
    const allocation = {
      by_symbol: positions.map((item) => ({ symbol: item.symbol, weight_pct: item.weight_pct })),
      by_industry: [...byIndustry].map(([industry, weight]) => ({ industry, weight_pct: Number(weight.toFixed(2)) }))
        .sort((a, b) => b.weight_pct - a.weight_pct),
    };
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
      allocation,
      history: await valueHistory(transactions),
      transactions: transactions.reverse().map((item) => ({ ...item, quantity: Number(item.quantity), unit_price: Number(item.unit_price), fee: Number(item.fee) })),
    };
  }

  // FR-M9-05: end-of-day market value of the holdings over the last HISTORY_DAYS days.
  async function valueHistory(transactions) {
    if (!transactions.length) return [];
    const symbols = [...new Set(transactions.map((item) => item.symbol))];
    const { rows } = await pool.query(`SELECT symbol, trade_date::text AS trade_date, close FROM daily_prices
      WHERE symbol=ANY($1::varchar[]) AND trade_date >= GREATEST($2::date, current_date - $3::integer)
      ORDER BY trade_date, symbol`, [symbols, transactions[0].executed_at, HISTORY_DAYS]);
    const closes = new Map(rows.map((row) => [`${row.symbol}|${row.trade_date}`, Number(row.close)]));
    const lastClose = new Map();
    return [...new Set(rows.map((row) => row.trade_date))].map((date) => {
      const held = new Map();
      for (const tx of transactions) {
        if (tx.executed_at > date) continue;
        held.set(tx.symbol, (held.get(tx.symbol) ?? 0) + (tx.side === 'buy' ? 1 : -1) * Number(tx.quantity));
      }
      let value = 0;
      for (const [symbol, quantity] of held) {
        const close = closes.get(`${symbol}|${date}`) ?? lastClose.get(symbol);
        if (close == null) continue;
        lastClose.set(symbol, close);
        value += Math.max(0, quantity) * close;
      }
      return { date, market_value: Number(value.toFixed(2)) };
    });
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
    // FR-M9-02: valid rows are imported; invalid, duplicate or oversold rows are skipped and reported by CSV line.
    async importMany(userId, rows) {
      const client = await pool.connect();
      const skipped = [];
      let imported = 0;
      try {
        await client.query('BEGIN');
        await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
        const ledger = await readLedger(client, userId);
        const ordered = [...rows].sort((a, b) =>
          (a.transaction?.executed_at ?? '').localeCompare(b.transaction?.executed_at ?? '') || a.line - b.line);
        for (const row of ordered) {
          if (row.error) { skipped.push({ line: row.line, reason: row.error }); continue; }
          const item = row.transaction;
          if (ledger.some((existing) => sameTransaction(existing, item))) {
            skipped.push({ line: row.line, reason: 'Trùng với giao dịch đã có.' }); continue;
          }
          const exists = await client.query('SELECT 1 FROM symbols WHERE symbol=$1 AND is_enabled=true', [item.symbol]);
          if (!exists.rowCount) { skipped.push({ line: row.line, reason: `Mã ${item.symbol} không có trong hệ thống.` }); continue; }
          try { calculatePositions([...ledger, { ...item, id: `line-${row.line}`, created_at: new Date() }], new Map()); }
          catch { skipped.push({ line: row.line, reason: `Bán ${item.symbol} vượt số lượng đang nắm giữ.` }); continue; }
          const inserted = await client.query(`INSERT INTO portfolio_transactions(user_id,symbol,side,quantity,unit_price,fee,executed_at,note)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id::text, created_at`,
          [userId, item.symbol, item.side, item.quantity, item.unit_price, item.fee, item.executed_at, item.note]);
          ledger.push({ ...item, ...inserted.rows[0] });
          imported += 1;
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
      return { imported, skipped: skipped.sort((a, b) => a.line - b.line), portfolio: await snapshot(userId) };
    },
    async update(userId, id, transaction) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
        const exists = await client.query('SELECT 1 FROM symbols WHERE symbol=$1 AND is_enabled=true', [transaction.symbol]);
        if (!exists.rowCount) throw new ApiError(404, 'SYMBOL_NOT_FOUND', `Active symbol ${transaction.symbol} was not found.`);
        const { rowCount } = await client.query(`UPDATE portfolio_transactions SET symbol=$3, side=$4, quantity=$5,
          unit_price=$6, fee=$7, executed_at=$8, note=$9 WHERE id=$1 AND user_id=$2`,
        [id, userId, transaction.symbol, transaction.side, transaction.quantity, transaction.unit_price, transaction.fee, transaction.executed_at, transaction.note]);
        if (!rowCount) throw new ApiError(404, 'TRANSACTION_NOT_FOUND', 'Portfolio transaction was not found.');
        calculatePositions(await readLedger(client, userId), new Map());
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
      return snapshot(userId);
    },
    // FR-M9-06: the owner can erase the whole portfolio ledger.
    async clear(userId) {
      const { rowCount } = await pool.query('DELETE FROM portfolio_transactions WHERE user_id=$1', [userId]);
      return { removed: rowCount };
    },
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
    throw new ApiError(422, 'VALIDATION_ERROR', 'Mã cổ phiếu hoặc loại giao dịch (mua/bán) không hợp lệ.');
  }
  const quantity = Number(input.quantity); const unit_price = Number(input.unit_price); const fee = input.fee === undefined ? 0 : Number(input.fee);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000_000 || !Number.isFinite(unit_price) || unit_price <= 0 || unit_price > 1_000_000_000_000 || !Number.isFinite(fee) || fee < 0 || fee > 1_000_000_000_000) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Số lượng, giá hoặc phí không hợp lệ (số lượng và giá phải lớn hơn 0).');
  }
  const dateParts = typeof input.executed_at === 'string' ? input.executed_at.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  const parsedDate = dateParts ? new Date(Date.UTC(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3]))) : null;
  if (!dateParts || parsedDate.toISOString().slice(0, 10) !== input.executed_at) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Ngày giao dịch phải có dạng YYYY-MM-DD.');
  }
  if (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > NOTE_LIMIT)) throw new ApiError(422, 'VALIDATION_ERROR', `Ghi chú tối đa ${NOTE_LIMIT} ký tự.`);
  return { symbol: input.symbol, side: input.side, quantity, unit_price, fee, executed_at: input.executed_at, note: (input.note ?? '').trim() };
}
