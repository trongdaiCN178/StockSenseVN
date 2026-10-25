export function getConfig(env = process.env, args = process.argv.slice(2)) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required to run the market data worker.');

  const options = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!['--from', '--to'].includes(key)) throw new Error(`Unknown option: ${key}`);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Expected a date after ${key}.`);
    options.set(key, value);
    index += 1;
  }

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const endDate = options.get('--to') ?? today;
  const lookbackDays = Number(env.MARKET_SYNC_LOOKBACK_DAYS || 5);
  if (!Number.isInteger(lookbackDays) || lookbackDays < 0 || lookbackDays > 3650) {
    throw new Error('MARKET_SYNC_LOOKBACK_DAYS must be an integer from 0 to 3650.');
  }
  const startDate = options.get('--from') ?? addDays(endDate, -lookbackDays);
  if (!isDate(startDate) || !isDate(endDate) || startDate > endDate) {
    throw new Error('Use valid --from and --to dates in YYYY-MM-DD format, with --from <= --to.');
  }

  return {
    databaseUrl: env.DATABASE_URL,
    poolMax: Number(env.PG_POOL_MAX || 4),
    timeoutMs: Number(env.SSI_TIMEOUT_MS || 20_000),
    startDate,
    endDate,
  };
}

function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function addDays(value, days) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
