export const ROLES = Object.freeze({
  RETAIL: 'retail',
  TRADER: 'trader',
  ANALYST: 'analyst',
  ADMIN: 'admin',
});

export const ROLE_LABELS = Object.freeze({
  [ROLES.RETAIL]: 'Nhà đầu tư cá nhân',
  [ROLES.TRADER]: 'Nhà giao dịch',
  [ROLES.ANALYST]: 'Chuyên viên phân tích',
  [ROLES.ADMIN]: 'Quản trị viên',
});

const commonUserCapabilities = [
  'market.read',
  'models.summary.read',
];

export const ROLE_CAPABILITIES = Object.freeze({
  [ROLES.RETAIL]: [
    ...commonUserCapabilities,
    'symbols.read', 'forecast.read', 'forecast.explanation.basic',
    'news.read', 'history.read', 'watchlist.manage.self', 'alerts.manage.self',
    'screener.read', 'portfolio.manage.self', 'plans.manage.self',
    'plans.calculate.rr', 'journal.read.self', 'journal.update.self',
    'chat.use.self', 'reports.symbol.export', 'reports.portfolio.export.self',
    'reports.plan.export.self', 'notifications.channels.manage.self',
  ],
  [ROLES.TRADER]: [
    ...commonUserCapabilities,
    'symbols.read', 'forecast.read', 'forecast.explanation.trader',
    'forecast.hit-rate.read', 'news.read', 'news.impact.read', 'history.read',
    'watchlist.manage.self', 'alerts.manage.self', 'screener.read',
    'screener.advanced', 'screener.saved.manage.self', 'portfolio.manage.self',
    'portfolio.import.self', 'portfolio.overview.self', 'plans.manage.self',
    'plans.calculate.rr', 'plans.calculate.quantity', 'profile.investment.manage.self',
    'journal.read.self', 'journal.update.self', 'journal.manual.create.self',
    'journal.stats.read.self', 'chat.use.self', 'reports.symbol.export',
    'reports.portfolio.export.self', 'reports.plan.export.self',
    'reports.journal.export.self', 'notifications.channels.manage.self',
  ],
  [ROLES.ANALYST]: [
    ...commonUserCapabilities,
    'symbols.read', 'forecast.read', 'forecast.explanation.full',
    'forecast.hit-rate.read', 'forecast.audit.read', 'forecast.inputs.read',
    'forecast.replay.create', 'news.read', 'news.impact.read', 'history.read',
    'history.csv.export', 'watchlist.manage.self', 'alerts.manage.self',
    'screener.read', 'screener.advanced', 'screener.saved.manage.self',
    'portfolio.manage.self', 'portfolio.import.self', 'portfolio.overview.self',
    'plans.manage.self', 'plans.calculate.rr', 'plans.calculate.quantity',
    'profile.investment.manage.self', 'journal.read.self', 'journal.update.self',
    'journal.manual.create.self', 'journal.stats.read.self', 'chat.use.self',
    'reports.symbol.export', 'reports.portfolio.export.self',
    'reports.plan.export.self', 'reports.journal.export.self',
    'models.evaluation.read', 'models.versions.read',
    'admin.chat-log.read.redacted', 'notifications.channels.manage.self',
  ],
  [ROLES.ADMIN]: [
    'market.read', 'models.summary.read', 'models.evaluation.read',
    'models.versions.read', 'forecast.audit.read', 'forecast.inputs.read',
    'forecast.replay.create', 'admin.users.manage', 'admin.jobs.read',
    'admin.jobs.enqueue', 'admin.models.manage', 'admin.audit.read',
    'admin.notifications.read', 'admin.ops-events.read',
    'admin.chat-log.read.redacted',
  ],
});

/**
 * UI-only capability check. The API must independently enforce every permission.
 */
export function hasCapability(role, capability) {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}
