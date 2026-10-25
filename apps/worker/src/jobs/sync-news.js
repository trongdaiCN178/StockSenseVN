import { tagSymbols } from '../providers/news.js';

const LOCK_KEY = 'stocksense:news:cafef-vnexpress:v1';

export async function syncNews({ pool, provider, startDate, endDate, logger = console }) {
  const client = await pool.connect();
  let lock;
  try {
    lock = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS acquired', [LOCK_KEY]);
  } catch (error) {
    client.release();
    throw error;
  }
  if (!lock.rows[0].acquired) {
    client.release();
    logger.info('[StockSense news worker] skipped: another news sync is running.');
    return { skipped: true };
  }

  let runId;
  let categoriesSucceeded = 0;
  let rowsUpserted = 0;
  const failures = [];
  try {
    const symbolsResult = await client.query('SELECT symbol FROM symbols WHERE is_enabled = true ORDER BY symbol');
    const symbols = symbolsResult.rows.map(({ symbol }) => symbol);
    if (!symbols.length) throw new Error('No enabled symbols are configured in the symbols table.');

    const runResult = await client.query(`INSERT INTO data_ingestion_runs
      (source, dataset, units_label, status, range_start, range_end, symbols_total)
      VALUES ('CafeF+VnExpress', 'news', 'categories', 'running', $1, $2, $3) RETURNING id`,
    [startDate, endDate, provider.categories.length]);
    runId = runResult.rows[0].id;

    for (let offset = 0; offset < provider.categories.length; offset += 3) {
      const categories = provider.categories.slice(offset, offset + 3);
      const settled = await Promise.allSettled(categories.map(async (category) => ({
        category,
        sources: await provider.fetchCategory(category),
      })));
      for (let index = 0; index < settled.length; index += 1) {
        const result = settled[index];
        if (result.status === 'rejected') {
          failures.push(`${categories[index]}: ${safeMessage(result.reason)}`);
          logger.error(`[StockSense news worker] ${categories[index]}: ${safeMessage(result.reason)}`);
          continue;
        }

        categoriesSucceeded += 1;
        const { category, sources } = result.value;
        for (const { source, articles } of sources) {
          for (const article of articles) {
            const localDate = vietnamDate(article.publishedAt);
            if (localDate < startDate || localDate > endDate) continue;
            const matchedSymbols = tagSymbols(`${article.title} ${article.summary}`, symbols.map((symbol) => ({ symbol })));
            if (!matchedSymbols.length) continue;
            await upsertArticle(client, article, source, matchedSymbols);
            rowsUpserted += 1;
          }
        }
        logger.info(`[StockSense news worker] ${category}: stored eligible articles.`);
      }
    }

    const status = failures.length === 0 ? 'succeeded' : categoriesSucceeded === 0 ? 'failed' : 'partial';
    await client.query(`UPDATE data_ingestion_runs SET status=$2, symbols_succeeded=$3,
      rows_upserted=$4, error_message=$5, completed_at=now() WHERE id=$1`,
    [runId, status, categoriesSucceeded, rowsUpserted, failures.length ? failures.join('\n').slice(0, 4000) : null]);
    if (status === 'failed') throw new Error('News sync failed for every upstream category.');
    return { runId, status, categoriesTotal: provider.categories.length, categoriesSucceeded, rowsUpserted };
  } catch (error) {
    if (runId) {
      await client.query(`UPDATE data_ingestion_runs SET status='failed', symbols_succeeded=$2,
        rows_upserted=$3, error_message=$4, completed_at=now() WHERE id=$1`,
      [runId, categoriesSucceeded, rowsUpserted, safeMessage(error).slice(0, 4000)]);
    }
    throw error;
  } finally {
    try { await client.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_KEY]); }
    finally { client.release(); }
  }
}

async function upsertArticle(client, article, source, symbols) {
  const result = await client.query(`INSERT INTO news_items
    (symbol, external_id, title, summary, source, published_at, sentiment, url)
    VALUES ($1, $2, $3, $4, $5, $6, 'neutral', $7)
    ON CONFLICT (source, external_id) DO UPDATE SET title=EXCLUDED.title,
      summary=EXCLUDED.summary, published_at=EXCLUDED.published_at, url=EXCLUDED.url
    RETURNING id`,
  [symbols[0], article.externalId, article.title, article.summary, source, article.publishedAt, article.url]);
  const newsId = result.rows[0].id;
  for (const symbol of symbols) {
    await client.query(`INSERT INTO news_item_symbols(news_item_id, symbol, match_method)
      VALUES ($1, $2, 'title_or_summary') ON CONFLICT (news_item_id, symbol) DO NOTHING`, [newsId, symbol]);
  }
}

function safeMessage(error) {
  return error instanceof Error ? error.message : 'Unknown upstream or database error.';
}

function vietnamDate(value) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
}
