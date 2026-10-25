import { ApiError } from '../errors.js';

const NOTE_LIMIT = 500;

export function createPostgresWatchlistRepository(pool) {
  return {
    async list(userId) {
      const { rows } = await pool.query(`SELECT w.symbol, s.name, s.exchange, w.note, w.created_at, w.updated_at,
        latest.close, latest.trade_date::text AS price_date
        FROM watchlist_items w JOIN symbols s ON s.symbol = w.symbol
        LEFT JOIN LATERAL (SELECT close, trade_date FROM daily_prices WHERE symbol = w.symbol ORDER BY trade_date DESC LIMIT 1) latest ON true
        WHERE w.user_id = $1 ORDER BY w.created_at, w.symbol`, [userId]);
      return { items: rows.map((row) => ({ ...row, close: row.close === null ? null : Number(row.close) })) };
    },
    async add(userId, symbol, note = '') {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
        const exists = await client.query('SELECT 1 FROM symbols WHERE symbol=$1 AND is_enabled=true', [symbol]);
        if (!exists.rowCount) throw new ApiError(404, 'SYMBOL_NOT_FOUND', 'Active symbol was not found.');
        const existing = await client.query('SELECT 1 FROM watchlist_items WHERE user_id=$1 AND symbol=$2', [userId, symbol]);
        if (!existing.rowCount) {
          const count = await client.query('SELECT count(*)::integer AS total FROM watchlist_items WHERE user_id=$1', [userId]);
          if (count.rows[0].total >= 10) throw new ApiError(409, 'WATCHLIST_LIMIT_REACHED', 'A watchlist can contain at most 10 symbols.');
        }
        await client.query(`INSERT INTO watchlist_items(user_id, symbol, note) VALUES ($1, $2, $3)
          ON CONFLICT (user_id, symbol) DO UPDATE SET note=EXCLUDED.note, updated_at=now()`, [userId, symbol, note]);
        await client.query('COMMIT');
        return { symbol, note };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
    async updateNote(userId, symbol, note) {
      const { rowCount } = await pool.query(`UPDATE watchlist_items SET note=$3, updated_at=now()
        WHERE user_id=$1 AND symbol=$2`, [userId, symbol, note]);
      if (!rowCount) throw new ApiError(404, 'WATCHLIST_ITEM_NOT_FOUND', 'This symbol is not in your watchlist.');
      return { symbol, note };
    },
    async remove(userId, symbol) {
      const { rowCount } = await pool.query('DELETE FROM watchlist_items WHERE user_id=$1 AND symbol=$2', [userId, symbol]);
      if (!rowCount) throw new ApiError(404, 'WATCHLIST_ITEM_NOT_FOUND', 'This symbol is not in your watchlist.');
      return { symbol, removed: true };
    },
    async rules(userId) {
      const { rows } = await pool.query(`SELECT r.id, r.symbol, s.name, r.condition, r.target_price,
        r.is_active, r.created_at, r.updated_at
        FROM alert_rules r JOIN symbols s ON s.symbol=r.symbol
        WHERE r.user_id=$1 ORDER BY r.created_at DESC`, [userId]);
      return { items: rows.map((row) => ({ ...row, target_price: Number(row.target_price) })) };
    },
    async createRule(userId, { symbol, condition, target_price }) {
      const { rows } = await pool.query(`INSERT INTO alert_rules(user_id, symbol, condition, target_price)
        SELECT $1, s.symbol, $3, $4 FROM symbols s WHERE s.symbol=$2 AND s.is_enabled=true
        RETURNING id, symbol, condition, target_price, is_active, created_at`, [userId, symbol, condition, target_price]);
      if (!rows[0]) throw new ApiError(404, 'SYMBOL_NOT_FOUND', 'Active symbol was not found.');
      return { ...rows[0], target_price: Number(rows[0].target_price) };
    },
    async updateRule(userId, ruleId, changes) {
      const active = changes.is_active;
      const target = changes.target_price;
      const { rows } = await pool.query(`UPDATE alert_rules SET
        is_active=COALESCE($3, is_active), target_price=COALESCE($4, target_price), updated_at=now()
        WHERE id=$1 AND user_id=$2
        RETURNING id, symbol, condition, target_price, is_active, created_at, updated_at`,
      [ruleId, userId, active ?? null, target ?? null]);
      if (!rows[0]) throw new ApiError(404, 'ALERT_RULE_NOT_FOUND', 'Alert rule was not found.');
      return { ...rows[0], target_price: Number(rows[0].target_price) };
    },
    async deleteRule(userId, ruleId) {
      const { rowCount } = await pool.query('DELETE FROM alert_rules WHERE id=$1 AND user_id=$2', [ruleId, userId]);
      if (!rowCount) throw new ApiError(404, 'ALERT_RULE_NOT_FOUND', 'Alert rule was not found.');
      return { id: ruleId, removed: true };
    },
    async alerts(userId, limit = 50) {
      const { rows } = await pool.query(`SELECT a.id, a.symbol, s.name, a.alert_type, a.title, a.message,
        a.payload, a.read_at, a.created_at, a.trade_date::text AS trade_date
        FROM user_alerts a JOIN symbols s ON s.symbol=a.symbol
        WHERE a.user_id=$1 ORDER BY a.created_at DESC, a.id DESC LIMIT $2`, [userId, limit]);
      return { items: rows };
    },
    async markAlertRead(userId, alertId) {
      const { rows } = await pool.query(`UPDATE user_alerts SET read_at=COALESCE(read_at, now())
        WHERE id=$1 AND user_id=$2 RETURNING id, read_at`, [alertId, userId]);
      if (!rows[0]) throw new ApiError(404, 'ALERT_NOT_FOUND', 'Alert was not found.');
      return rows[0];
    },
  };
}

export function validateNote(note) {
  if (typeof note !== 'string' || note.length > NOTE_LIMIT) {
    throw new ApiError(422, 'VALIDATION_ERROR', `Note must be a string of at most ${NOTE_LIMIT} characters.`);
  }
  return note.trim();
}
