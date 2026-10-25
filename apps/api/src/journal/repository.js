import { ApiError } from '../errors.js';

const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 24;

export function createJournalRepository(pool) {
  return {
    // FR-M11-05: filter by symbol, date range, tag and result, plus free-text search.
    async list(userId, { symbol = '', limit = 50, from = null, to = null, tag = '', result = '', q = '' } = {}) {
      const { rows } = await pool.query(`SELECT id::text, plan_id::text, symbol, kind, title, body, tags, lesson,
        realized_pnl, snapshot, decision_date::text AS decision_date, created_at, updated_at
        FROM journal_entries WHERE user_id=$1 AND ($2='' OR symbol=$2)
          AND ($4::date IS NULL OR COALESCE(decision_date, (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) >= $4)
          AND ($5::date IS NULL OR COALESCE(decision_date, (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) <= $5)
          AND ($6='' OR $6 = ANY(tags))
          AND ($7='' OR ($7='win' AND realized_pnl > 0) OR ($7='loss' AND realized_pnl < 0)
            OR ($7='breakeven' AND realized_pnl = 0) OR ($7='none' AND realized_pnl IS NULL))
          AND ($8='' OR title ILIKE '%' || $8 || '%' OR body ILIKE '%' || $8 || '%' OR lesson ILIKE '%' || $8 || '%')
        ORDER BY created_at DESC, id DESC LIMIT $3`, [userId, symbol, limit, from, to, tag, result, q]);
      return { items: rows.map(mapEntry) };
    },
    async update(userId, id, changes) {
      const { rows } = await pool.query(`UPDATE journal_entries SET
        body=COALESCE($3,body), tags=COALESCE($4::text[],tags), lesson=COALESCE($5,lesson), updated_at=now()
        WHERE id=$1 AND user_id=$2
        RETURNING id::text, plan_id::text, symbol, kind, title, body, tags, lesson, realized_pnl, snapshot, created_at, updated_at`,
      [id, userId, changes.body ?? null, changes.tags ?? null, changes.lesson ?? null]);
      if (!rows[0]) throw new ApiError(404, 'JOURNAL_ENTRY_NOT_FOUND', 'Journal entry was not found.');
      return mapEntry(rows[0]);
    },
    async createManual(userId, input) {
      const { rows } = await pool.query(`INSERT INTO journal_entries(user_id,symbol,kind,title,body,tags,lesson,snapshot,decision_date)
        SELECT $1,s.symbol,'manual',$3,$4,$5,$6,'{}'::jsonb,$7 FROM symbols s
        WHERE s.symbol=$2 AND s.is_enabled=true
        RETURNING id::text, plan_id::text, symbol, kind, title, body, tags, lesson, realized_pnl, snapshot,
          decision_date::text AS decision_date, created_at, updated_at`,
      [userId, input.symbol, input.title, input.body, input.tags, input.lesson, input.decision_date]);
      if (!rows[0]) throw new ApiError(404, 'SYMBOL_NOT_FOUND', 'Active symbol was not found.');
      return mapEntry(rows[0]);
    },
    async stats(userId) {
      const { rows } = await pool.query(`SELECT count(*)::integer AS entries,
        count(realized_pnl)::integer AS closed_plans,
        count(*) FILTER (WHERE realized_pnl > 0)::integer AS wins,
        count(*) FILTER (WHERE realized_pnl < 0)::integer AS losses,
        count(*) FILTER (WHERE realized_pnl = 0)::integer AS breakeven,
        COALESCE(sum(realized_pnl),0) AS realized_pnl,
        avg(realized_pnl) AS average_realized_pnl
        FROM journal_entries WHERE user_id=$1`, [userId]);
      const row = rows[0];
      return { entries: row.entries, closed_plans: row.closed_plans, wins: row.wins, losses: row.losses, breakeven: row.breakeven,
        realized_pnl: Number(row.realized_pnl), average_realized_pnl: row.average_realized_pnl == null ? null : Number(row.average_realized_pnl) };
    },
    // FR-M11-06: look-back statistics per week, month or quarter. Signal-following rate needs forecasts and is omitted.
    async periodStats(userId, period = 'month') {
      const { rows } = await pool.query(`WITH plans AS (
          SELECT date_trunc($2, (p.closed_at AT TIME ZONE 'Asia/Ho_Chi_Minh'))::date AS period_start,
            p.close_reason, p.realized_pnl,
            CASE WHEN p.entry_price = p.stop_price THEN NULL
              ELSE (CASE WHEN p.side='long' THEN p.exit_price - p.entry_price ELSE p.entry_price - p.exit_price END) / abs(p.entry_price - p.stop_price) END AS realized_r,
            abs(p.target_price - p.entry_price) / NULLIF(abs(p.entry_price - p.stop_price), 0) AS planned_r
          FROM trade_plans p WHERE p.user_id=$1 AND p.status='closed'
        )
        SELECT period_start::text AS period_start, count(*)::integer AS closed_plans,
          count(*) FILTER (WHERE close_reason='target_hit')::integer AS target_hits,
          count(*) FILTER (WHERE close_reason='stop_hit')::integer AS stop_hits,
          count(*) FILTER (WHERE realized_pnl > 0)::integer AS wins,
          count(*) FILTER (WHERE realized_pnl < 0)::integer AS losses,
          round(avg(realized_r)::numeric, 2) AS average_realized_r,
          round(avg(planned_r)::numeric, 2) AS average_planned_r,
          COALESCE(sum(realized_pnl), 0) AS realized_pnl
        FROM plans GROUP BY period_start ORDER BY period_start DESC LIMIT 24`, [userId, period]);
      return { period, items: rows.map((item) => ({ ...item,
        target_hit_rate: item.closed_plans ? Number((item.target_hits / item.closed_plans * 100).toFixed(1)) : null,
        stop_hit_rate: item.closed_plans ? Number((item.stop_hits / item.closed_plans * 100).toFixed(1)) : null,
        average_realized_r: item.average_realized_r == null ? null : Number(item.average_realized_r),
        average_planned_r: item.average_planned_r == null ? null : Number(item.average_planned_r),
        realized_pnl: Number(item.realized_pnl) })) };
    },
  };
}

function mapEntry(row) {
  return { ...row, realized_pnl: row.realized_pnl == null ? null : Number(row.realized_pnl), tags: row.tags ?? [] };
}

function normalizeTags(tags) {
  if (tags === undefined) return undefined;
  if (!Array.isArray(tags) || tags.length > MAX_TAGS || tags.some((tag) => typeof tag !== 'string' || !tag.trim() || tag.trim().length > MAX_TAG_LENGTH)) {
    throw new ApiError(422, 'VALIDATION_ERROR', `Tags must contain at most ${MAX_TAGS} labels of 1 to ${MAX_TAG_LENGTH} characters.`);
  }
  return [...new Set(tags.map((tag) => tag.trim().toLocaleLowerCase()))];
}

export function validateJournalUpdate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(422, 'VALIDATION_ERROR', 'Journal update must be an object.');
  const allowed = new Set(['body', 'tags', 'lesson']);
  if (!Object.keys(input).length || Object.keys(input).some((key) => !allowed.has(key))) throw new ApiError(422, 'VALIDATION_ERROR', 'Only body, tags, and lesson may be edited.');
  const changes = {};
  if (Object.hasOwn(input, 'body')) {
    if (typeof input.body !== 'string' || input.body.length > 4000) throw new ApiError(422, 'VALIDATION_ERROR', 'Journal note must be at most 4000 characters.');
    changes.body = input.body.trim();
  }
  if (Object.hasOwn(input, 'tags')) changes.tags = normalizeTags(input.tags);
  if (Object.hasOwn(input, 'lesson')) {
    if (typeof input.lesson !== 'string' || input.lesson.length > 3000) throw new ApiError(422, 'VALIDATION_ERROR', 'Lesson must be at most 3000 characters.');
    changes.lesson = input.lesson.trim();
  }
  return changes;
}

export function validateManualJournal(input) {
  if (!input || typeof input !== 'object' || !/^[A-Z0-9.-]{1,12}$/.test(input.symbol ?? '')) throw new ApiError(422, 'VALIDATION_ERROR', 'A valid uppercase symbol is required.');
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 160) throw new ApiError(422, 'VALIDATION_ERROR', 'Title must contain 1 to 160 characters.');
  const body = input.body ?? ''; const lesson = input.lesson ?? '';
  if (typeof body !== 'string' || body.length > 4000 || typeof lesson !== 'string' || lesson.length > 3000) throw new ApiError(422, 'VALIDATION_ERROR', 'Journal note or lesson exceeds the allowed length.');
  const decisionDate = input.decision_date ?? null;
  if (decisionDate != null && (typeof decisionDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(decisionDate) || Number.isNaN(Date.parse(decisionDate)))) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Ngày quyết định phải có dạng YYYY-MM-DD.');
  }
  return { symbol: input.symbol, title: input.title.trim(), body: body.trim(), lesson: lesson.trim(), tags: normalizeTags(input.tags ?? []), decision_date: decisionDate };
}
