import { ApiError } from '../errors.js';

export function createInvestmentProfileRepository(pool) {
  return {
    async get(userId) {
      const { rows } = await pool.query(`SELECT capital_vnd, risk_pct, updated_at
        FROM investment_profiles WHERE user_id=$1`, [userId]);
      if (!rows[0]) return { profile: null };
      return { profile: { capital_vnd: Number(rows[0].capital_vnd), risk_pct: Number(rows[0].risk_pct), updated_at: rows[0].updated_at } };
    },
    async save(userId, profile) {
      const { rows } = await pool.query(`INSERT INTO investment_profiles(user_id,capital_vnd,risk_pct)
        VALUES ($1,$2,$3) ON CONFLICT (user_id) DO UPDATE
        SET capital_vnd=EXCLUDED.capital_vnd,risk_pct=EXCLUDED.risk_pct,updated_at=now()
        RETURNING capital_vnd,risk_pct,updated_at`, [userId, profile.capital_vnd, profile.risk_pct]);
      return { profile: { capital_vnd: Number(rows[0].capital_vnd), risk_pct: Number(rows[0].risk_pct), updated_at: rows[0].updated_at } };
    },
  };
}

export function validateInvestmentProfile(input) {
  const capital_vnd = Number(input?.capital_vnd); const risk_pct = Number(input?.risk_pct);
  if (!Number.isFinite(capital_vnd) || capital_vnd <= 0 || capital_vnd > 1_000_000_000_000_000 ||
      !Number.isFinite(risk_pct) || risk_pct <= 0 || risk_pct > 100) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Capital must be positive and at most 1,000,000,000,000,000 VND; risk percentage must be greater than 0 and at most 100.');
  }
  return { capital_vnd, risk_pct };
}
