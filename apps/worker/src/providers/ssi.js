const HISTORY_URL = 'https://iboard-api.ssi.com.vn/statistics/company/ssmi/stock-info';

export function createSsiProvider({ fetchImpl = fetch, timeoutMs = 20_000 } = {}) {
  return { fetchHistory };

  async function fetchHistory(symbol, startDate, endDate) {
    const rows = [];
    let page = 1;
    let expectedTotal = Infinity;

    while (rows.length < expectedTotal) {
      const url = new URL(HISTORY_URL);
      url.search = new URLSearchParams({
        symbol,
        page: String(page),
        pageSize: '40',
        fromDate: toSsiDate(startDate),
        toDate: toSsiDate(endDate),
      });
      const payload = await fetchJson(url, { fetchImpl, timeoutMs });
      if (payload?.code !== 'SUCCESS' || !Array.isArray(payload.data) || !Number.isFinite(payload?.paging?.total)) {
        throw new Error(`SSI returned an invalid history response for ${symbol}.`);
      }
      if (payload.data.length === 0 && rows.length < payload.paging.total) {
        throw new Error(`SSI history for ${symbol} ended before all pages were returned.`);
      }

      rows.push(...payload.data.map((row) => normalizeRow(symbol, row)).filter(Boolean));
      expectedTotal = payload.paging.total;
      if (rows.length >= expectedTotal) break;
      page += 1;
      if (page > 10_000) throw new Error(`SSI pagination limit exceeded for ${symbol}.`);
    }

    return rows;
  }
}

async function fetchJson(url, { fetchImpl, timeoutMs }) {
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 StockSenseDataWorker/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`SSI request failed with HTTP ${response.status}.`);
  try {
    return await response.json();
  } catch {
    throw new Error('SSI returned a non-JSON response; the upstream may be unavailable or blocking this host.');
  }
}

function normalizeRow(symbol, row) {
  const tradeDate = parseSsiDate(row?.tradingDate);
  if (Number(row?.closeRaw) === 0) return null; // suspended/no-trade rows are not valid OHLC observations.
  const close = positiveNumber(row?.closeRaw);
  if (!tradeDate || !close) throw new Error(`SSI returned invalid OHLCV data for ${symbol}.`);

  return {
    symbol,
    tradeDate,
    open: optionalPositiveNumber(row.openRaw),
    high: optionalPositiveNumber(row.highRaw),
    low: optionalPositiveNumber(row.lowRaw),
    close,
    volume: optionalInteger(row.totalMatchVol),
    turnover: optionalNonNegativeNumber(row.totalMatchVal),
  };
}

function toSsiDate(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function parseSsiDate(value) {
  if (typeof value !== 'string' || !/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return null;
  const [day, month, year] = value.split('/');
  const iso = `${year}-${month}-${day}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== iso ? null : iso;
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function optionalPositiveNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  return positiveNumber(value);
}

function optionalNonNegativeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function optionalInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}
