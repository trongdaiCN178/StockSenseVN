import { ApiError } from '../errors.js';

const MAX_SAVED_FILTERS = 20;

export function createScreenerRepository(pool) {
  return {
    async list(userId) {
      const { rows } = await pool.query(`SELECT id, name, filters, created_at, updated_at
        FROM saved_screener_filters WHERE user_id=$1 ORDER BY updated_at DESC, name`, [userId]);
      return { items: rows };
    },
    async save(userId, { name, filters }) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
        const existing = await client.query('SELECT id FROM saved_screener_filters WHERE user_id=$1 AND name=$2', [userId, name]);
        if (!existing.rowCount) {
          const { rows } = await client.query('SELECT count(*)::integer AS total FROM saved_screener_filters WHERE user_id=$1', [userId]);
          if (rows[0].total >= MAX_SAVED_FILTERS) throw new ApiError(409, 'SAVED_FILTER_LIMIT_REACHED', `You can save at most ${MAX_SAVED_FILTERS} screener filters.`);
        }
        const { rows } = await client.query(`INSERT INTO saved_screener_filters(user_id, name, filters)
          VALUES ($1,$2,$3::jsonb) ON CONFLICT (user_id,name) DO UPDATE
          SET filters=EXCLUDED.filters, updated_at=now()
          RETURNING id, name, filters, created_at, updated_at`, [userId, name, JSON.stringify(filters)]);
        await client.query('COMMIT');
        return rows[0];
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
    async remove(userId, id) {
      const { rowCount } = await pool.query('DELETE FROM saved_screener_filters WHERE id=$1 AND user_id=$2', [id, userId]);
      if (!rowCount) throw new ApiError(404, 'SAVED_FILTER_NOT_FOUND', 'Saved filter was not found.');
      return { id, removed: true };
    },
  };
}

export function validateScreenerFilters(filters) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Filters must be an object.');
  }
  const allowed = new Set(['exchange', 'minPrice', 'maxPrice', 'minChange', 'maxChange', 'minTurnover']);
  if (Object.keys(filters).some((key) => !allowed.has(key))) throw new ApiError(422, 'VALIDATION_ERROR', 'Unknown screener filter.');
  const normalized = {};
  if (filters.exchange !== undefined && filters.exchange !== '') {
    if (!['HOSE', 'HNX', 'UPCOM'].includes(filters.exchange)) throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid exchange.');
    normalized.exchange = filters.exchange;
  }
  for (const key of ['minPrice', 'maxPrice', 'minChange', 'maxChange', 'minTurnover']) {
    if (filters[key] === undefined || filters[key] === null || filters[key] === '') continue;
    const value = Number(filters[key]);
    if (!Number.isFinite(value) || Math.abs(value) > 1_000_000_000_000 || (key !== 'minChange' && key !== 'maxChange' && value < 0)) {
      throw new ApiError(422, 'VALIDATION_ERROR', `Invalid ${key}.`);
    }
    normalized[key] = value;
  }
  if (normalized.minPrice != null && normalized.maxPrice != null && normalized.minPrice > normalized.maxPrice) throw new ApiError(422, 'VALIDATION_ERROR', 'Minimum price cannot exceed maximum price.');
  if (normalized.minChange != null && normalized.maxChange != null && normalized.minChange > normalized.maxChange) throw new ApiError(422, 'VALIDATION_ERROR', 'Minimum change cannot exceed maximum change.');
  return normalized;
}

export function validateSavedFilterName(name) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) throw new ApiError(422, 'VALIDATION_ERROR', 'Filter name must contain 1 to 80 characters.');
  return name.trim();
}
