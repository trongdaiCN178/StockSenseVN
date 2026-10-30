import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { randomUUID, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { ROLE_CAPABILITIES, ROLES } from '@stocksense/core/access';
import { isStrongPassword, PASSWORD_POLICY_TEXT } from '@stocksense/core/password';
import { databaseEnabled, pool } from './db/pool.js';
import { createPostgresAuthRepository } from './auth/postgres-repository.js';
import { createPasswordResetRepository } from './auth/password-reset-repository.js';
import { createRegistrationRepository } from './auth/registration-repository.js';
import { createAdminUsersRepository } from './admin/users-repository.js';
import { createAdminJobsRepository } from './admin/jobs-repository.js';
import { createPostgresWatchlistRepository, validateNote } from './watchlist/repository.js';
import { createScreenerRepository, validateSavedFilterName, validateScreenerFilters } from './screener/repository.js';
import { createPortfolioRepository, validatePortfolioTransaction } from './portfolio/repository.js';
import { CLOSE_REASON_LABELS, createPlansRepository, validatePlan, validatePlanCalculation, validatePlanClose, validatePlanUpdate } from './plans/repository.js';
import { createJournalRepository, validateJournalUpdate, validateManualJournal } from './journal/repository.js';
import { createInvestmentProfileRepository, validateInvestmentProfile } from './profile/repository.js';
import { createAccountRepository } from './profile/account-repository.js';
import { createChatRepository, validateChatSession } from './chat/repository.js';
import { createChatAssistant } from './chat/assistant.js';
import { createNotificationPreferencesRepository, createNotificationChannelsRepository, validateNotificationPreferences, hashVerificationCode } from './notifications/repository.js';
import { emailProviderConfigured, telegramProviderConfigured, sendVerificationEmail, sendPasswordResetEmail, sendRegistrationVerificationEmail, sendAccountAlreadyExistsEmail, sendTestEmail, sendTelegramMessage } from './notifications/providers.js';
import { ApiError } from './errors.js';
import { createFixtureMarketRepository, createPostgresMarketRepository, PRICE_RANGES } from './market/repository.js';
import { createPdfReport, formatReportValue } from './reports/pdf.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('The bootstrap API still enables development identities and sample market data. It must not run in production.');
}

function formatRetryAfterVi(ttlMs) {
  const seconds = Math.max(1, Math.ceil(ttlMs / 1000));
  if (seconds < 60) return `${seconds} giây`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} giờ`;
}

const app = Fastify({ logger: true, genReqId: () => randomUUID() });
const market = databaseEnabled ? createPostgresMarketRepository(pool) : createFixtureMarketRepository();
const postgresAuth = databaseEnabled ? createPostgresAuthRepository(pool) : null;
const passwordResets = databaseEnabled ? createPasswordResetRepository(pool) : null;
const registration = databaseEnabled ? createRegistrationRepository(pool) : null;
const adminUsers = databaseEnabled ? createAdminUsersRepository(pool) : null;
const adminJobs = databaseEnabled ? createAdminJobsRepository(pool) : null;
const personalMarketTools = databaseEnabled ? createPostgresWatchlistRepository(pool) : null;
const screenerSavedFilters = databaseEnabled ? createScreenerRepository(pool) : null;
const portfolios = databaseEnabled ? createPortfolioRepository(pool) : null;
const plans = databaseEnabled ? createPlansRepository(pool) : null;
const journal = databaseEnabled ? createJournalRepository(pool) : null;
const investmentProfiles = databaseEnabled ? createInvestmentProfileRepository(pool) : null;
const account = databaseEnabled ? createAccountRepository(pool) : null;
const chat = databaseEnabled ? createChatRepository(pool) : null;
const chatAssistant = createChatAssistant({ market, portfolios, plans, journal, watchlist: personalMarketTools });
const notificationPreferences = databaseEnabled ? createNotificationPreferencesRepository(pool) : null;
const notificationChannels = databaseEnabled ? createNotificationChannelsRepository(pool) : null;
const sessions = new Map();
const sessionCookie = 'stocksense_session';
const demoAccounts = new Map([
  ['retail@stocksense.vn', ROLES.RETAIL],
  ['trader@stocksense.vn', ROLES.TRADER],
  ['analyst@stocksense.vn', ROLES.ANALYST],
  ['admin@stocksense.vn', ROLES.ADMIN],
]);
const demoPasswords = new Map([...demoAccounts.entries()].map(([email, role]) => [email, `${role}12345678`]));
const demoMustChangePassword = new Map();

await app.register(cookie);
await app.register(helmet, { global: true });
await app.register(cors, {
  origin: process.env.PUBLIC_APP_URL || 'http://localhost:5173',
  credentials: true,
});
// Runs after the session hook so signed-in users get their own bucket instead of sharing one per IP
// (classrooms and offices behind NAT); anonymous traffic is still limited per IP.
await app.register(rateLimit, {
  global: true,
  hook: 'preHandler',
  max: (request) => (request.user ? 300 : 100),
  keyGenerator: (request) => (request.user ? `user:${request.user.id}` : `ip:${request.ip}`),
  timeWindow: '1 minute',
  errorResponseBuilder: (request, context) => new ApiError(
    context.statusCode,
    context.ban ? 'TOO_MANY_REQUESTS_BANNED' : 'TOO_MANY_REQUESTS',
    context.ban
      ? 'Bạn đã bị tạm khoá do gửi quá nhiều yêu cầu. Vui lòng thử lại sau.'
      : `Bạn đã thao tác quá nhiều lần. Vui lòng thử lại sau ${formatRetryAfterVi(context.ttl)}.`,
  ),
});
app.decorateRequest('user', null);
app.decorateRequest('sessionToken', null);
const mustChangeAllowedRoutes = new Set(['/api/v1/auth/login', '/api/v1/auth/logout', '/api/v1/auth/change-password', '/api/v1/me']);
app.addHook('onRequest', async (request) => {
  const sessionId = request.cookies[sessionCookie];
  request.sessionToken = sessionId ?? null;
  if (postgresAuth) {
    request.user = await postgresAuth.findUserByToken(sessionId);
    return;
  }
  const session = sessionId ? sessions.get(sessionId) : null;
  if (session && session.expiresAt <= Date.now()) sessions.delete(sessionId);
  request.user = session && session.expiresAt > Date.now() ? session.user : null;
});
app.addHook('preHandler', async (request, reply) => {
  if (request.user?.must_change_password && !mustChangeAllowedRoutes.has(request.routeOptions.url)) {
    return fail(reply, request, 403, 'PASSWORD_CHANGE_REQUIRED', 'Đổi mật khẩu tạm thời trước khi tiếp tục.');
  }
});

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  const status = error instanceof ApiError ? error.statusCode : error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
  const code = status === 500 ? 'INTERNAL_ERROR' : error.code || (status === 400 ? 'INVALID_REQUEST' : 'REQUEST_FAILED');
  reply.code(status).send({ error: { code, message: status === 500 ? 'Đã xảy ra lỗi máy chủ.' : error.message, request_id: request.id } });
});

function fail(reply, request, status, code, message) {
  return reply.code(status).send({ error: { code, message, request_id: request.id } });
}

function clearSessionCookie(reply) {
  reply.clearCookie(sessionCookie, { path: '/api/v1', httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true' });
}

async function requireSession(request, reply) {
  if (!request.user) {
    clearSessionCookie(reply);
    return fail(reply, request, 401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập.');
  }
}

function requireCapability(capability) {
  return async (request, reply) => {
    if (!request.user) {
      clearSessionCookie(reply);
      return fail(reply, request, 401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập.');
    }
    if (!ROLE_CAPABILITIES[request.user.role]?.includes(capability)) {
      return fail(reply, request, 403, 'FORBIDDEN', 'Tài khoản không có quyền truy cập chức năng này.');
    }
  };
}

function envelope(data) { return { data }; }
function dataNotReady(reply, request) {
  return fail(reply, request, 503, 'DATA_NOT_READY', 'Chưa có batch dữ liệu thị trường trong cơ sở dữ liệu.');
}
async function requireRegistrationStore(request, reply) {
  if (!registration) return fail(reply, request, 503, 'REGISTRATION_UNAVAILABLE', 'Đăng ký tài khoản cần PostgreSQL.');
}
async function requireAdminStore(request, reply) {
  if (!adminUsers) return fail(reply, request, 503, 'ADMIN_STORE_UNAVAILABLE', 'Chức năng quản trị tài khoản cần PostgreSQL.');
}
async function requireAdminJobsStore(request, reply) {
  if (!adminJobs) return fail(reply, request, 503, 'ADMIN_JOBS_STORE_UNAVAILABLE', 'Admin job queue requires PostgreSQL and migrations 016 and 017.');
  const { rows } = await pool.query(`SELECT to_regclass('public.admin_job_runs') IS NOT NULL
    AND to_regclass('public.admin_worker_instances') IS NOT NULL AS available`);
  if (!rows[0]?.available) return fail(reply, request, 503, 'ADMIN_JOBS_STORE_UNAVAILABLE', 'Apply migrations 016_admin_job_queue.sql and 017_admin_worker_heartbeat.sql before using admin jobs.');
}
async function requireAdminNotificationsStore(request, reply) {
  if (!adminJobs) return fail(reply, request, 503, 'ADMIN_NOTIFICATIONS_UNAVAILABLE', 'Admin notification history requires PostgreSQL and migration 014.');
  const { rows } = await pool.query("SELECT to_regclass('public.notification_outbox') IS NOT NULL AS available");
  if (!rows[0]?.available) return fail(reply, request, 503, 'ADMIN_NOTIFICATIONS_UNAVAILABLE', 'Apply migration 014_notification_outbox.sql before reading delivery history.');
}
async function requireAdminOpsStore(request, reply) {
  if (!adminJobs) return fail(reply, request, 503, 'ADMIN_OPS_STORE_UNAVAILABLE', 'Admin operations events require PostgreSQL and migrations 003, 014, and 016.');
  const { rows } = await pool.query(`SELECT to_regclass('public.data_ingestion_runs') IS NOT NULL
    AND to_regclass('public.notification_outbox') IS NOT NULL
    AND to_regclass('public.admin_job_runs') IS NOT NULL AS available`);
  if (!rows[0]?.available) return fail(reply, request, 503, 'ADMIN_OPS_STORE_UNAVAILABLE', 'Apply migrations 003_ingestion_runs.sql, 014_notification_outbox.sql, and 016_admin_job_queue.sql before reading ops events.');
}
async function requirePersonalStore(request, reply) {
  if (!personalMarketTools) return fail(reply, request, 503, 'PERSONAL_STORE_UNAVAILABLE', 'Watchlist và cảnh báo cần PostgreSQL.');
}
async function requireScreenerStore(request, reply) {
  if (!screenerSavedFilters) return fail(reply, request, 503, 'SCREENER_STORE_UNAVAILABLE', 'Saved screener filters require PostgreSQL.');
}
async function requirePortfolioStore(request, reply) {
  if (!portfolios) return fail(reply, request, 503, 'PORTFOLIO_STORE_UNAVAILABLE', 'Portfolio requires PostgreSQL.');
}
async function requirePlansStore(request, reply) {
  if (!plans) return fail(reply, request, 503, 'PLANS_STORE_UNAVAILABLE', 'Trade plans require PostgreSQL.');
}
async function requireJournalStore(request, reply) {
  if (!journal) return fail(reply, request, 503, 'JOURNAL_STORE_UNAVAILABLE', 'Journal requires PostgreSQL.');
}
async function requireInvestmentProfileStore(request, reply) {
  if (!investmentProfiles) return fail(reply, request, 503, 'PROFILE_STORE_UNAVAILABLE', 'Investment profile requires PostgreSQL.');
}
async function requireAccountStore(request, reply) {
  if (!account) return fail(reply, request, 503, 'ACCOUNT_STORE_UNAVAILABLE', 'Chức năng nâng cấp/quản lý tài khoản cần PostgreSQL.');
}
async function requireChatStore(request, reply) {
  if (!chat) return fail(reply, request, 503, 'CHAT_STORE_UNAVAILABLE', 'Chat sessions require PostgreSQL.');
}
async function requireNotificationPreferencesStore(request, reply) {
  if (!notificationPreferences) return fail(reply, request, 503, 'NOTIFICATION_STORE_UNAVAILABLE', 'Notification preferences require PostgreSQL.');
}
function notificationDeliveryStatus() {
  return { email: { provider_configured: emailProviderConfigured() },
    telegram: { provider_configured: telegramProviderConfigured() } };
}
async function validateUuid(request, reply) {
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(request.params.id)) {
    return fail(reply, request, 422, 'VALIDATION_ERROR', 'Mã định danh không hợp lệ.');
  }
}
async function validateUserId(request, reply) {
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(request.params.userId)) {
    return fail(reply, request, 422, 'VALIDATION_ERROR', 'Mã tài khoản không hợp lệ.');
  }
}

function getPublicAppUrl() {
  if (!process.env.PUBLIC_APP_URL) return null;
  try {
    const url = new URL(process.env.PUBLIC_APP_URL);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash ||
        (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')) return null;
    return url.origin;
  } catch { return null; }
}

function getPasswordResetAppUrl() {
  if (process.env.PASSWORD_RESET_ENABLED !== 'true' || !passwordResets ||
      !process.env.AUTH_RATE_LIMIT_SECRET || process.env.AUTH_RATE_LIMIT_SECRET.length < 32) return null;
  return getPublicAppUrl();
}

app.post('/api/v1/auth/forgot-password', {
  config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
}, async (request, reply) => {
  const email = request.body?.email;
  if (typeof email !== 'string' || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email.trim())) {
    return fail(reply, request, 422, 'VALIDATION_ERROR', 'Vui lòng nhập địa chỉ email hợp lệ.');
  }
  const appUrl = getPasswordResetAppUrl();
  if (!appUrl || !emailProviderConfigured()) return fail(reply, request, 503, 'PASSWORD_RESET_UNAVAILABLE', 'Chức năng đặt lại mật khẩu chưa được cấu hình.');
  const issued = await passwordResets.issue(email, request.ip);
  reply.code(202).header('Cache-Control', 'no-store');
  const response = reply.send(envelope({ message: 'Nếu email thuộc một tài khoản đang hoạt động, hướng dẫn đặt lại mật khẩu sẽ được gửi tới hộp thư. Liên kết có hiệu lực trong 30 phút.' }));
  if (issued) {
    const resetUrl = new URL('/reset-password', appUrl);
    resetUrl.hash = new URLSearchParams({ token: issued.token }).toString();
    setImmediate(async () => {
      try { await sendPasswordResetEmail(issued.email, resetUrl.toString()); }
      catch (error) {
        await passwordResets.cancel(issued.token).catch(() => {});
        request.log.error({ err: error, user_id: issued.userId }, 'Password reset email delivery failed.');
      }
    });
  }
  return response;
});

app.post('/api/v1/auth/reset-password', {
  config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
}, async (request, reply) => {
  if (!getPasswordResetAppUrl()) return fail(reply, request, 503, 'PASSWORD_RESET_UNAVAILABLE', 'Chức năng đặt lại mật khẩu chưa được cấu hình.');
  const { token, new_password: newPassword } = request.body ?? {};
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,64}$/.test(token) || !isStrongPassword(newPassword)) {
    return fail(reply, request, 422, 'VALIDATION_ERROR', `Cần mã token hợp lệ. ${PASSWORD_POLICY_TEXT}`);
  }
  const result = await passwordResets.reset(token, newPassword);
  reply.header('Cache-Control', 'no-store');
  return envelope(result);
});

app.post('/api/v1/auth/register', {
  config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  preHandler: [requireRegistrationStore],
}, async (request, reply) => {
  const { email, password, full_name: fullName, age_confirmed: ageConfirmed, terms_accepted: termsAccepted, privacy_accepted: privacyAccepted } = request.body ?? {};
  if (typeof email !== 'string' || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email.trim()) ||
      !isStrongPassword(password) ||
      (fullName !== undefined && fullName !== null && (typeof fullName !== 'string' || fullName.trim().length > 100)) ||
      ageConfirmed !== true || termsAccepted !== true || privacyAccepted !== true) {
    return fail(reply, request, 422, 'VALIDATION_ERROR', `Vui lòng nhập email hợp lệ và xác nhận đủ các điều kiện bắt buộc. ${PASSWORD_POLICY_TEXT}`);
  }
  const appUrl = getPublicAppUrl();
  if (!appUrl) return fail(reply, request, 503, 'REGISTRATION_UNAVAILABLE', 'Thiếu cấu hình PUBLIC_APP_URL.');
  const issued = await registration.register(email, password, fullName ?? null, request.ip);
  reply.code(202).header('Cache-Control', 'no-store');
  const response = reply.send(envelope({ message: 'Nếu email hợp lệ, chúng tôi đã gửi email xác thực tài khoản.' }));
  if (issued?.created) {
    const verifyUrl = new URL('/verify-email', appUrl);
    verifyUrl.hash = new URLSearchParams({ token: issued.token }).toString();
    setImmediate(async () => {
      if (!emailProviderConfigured()) {
        request.log.warn({ user_id: issued.userId, verify_url: verifyUrl.toString() }, 'SMTP chưa cấu hình: dùng liên kết này để xác thực email trong môi trường phát triển.');
        return;
      }
      try { await sendRegistrationVerificationEmail(issued.email, verifyUrl.toString()); }
      catch (error) {
        await registration.cancelVerification(issued.token).catch(() => {});
        request.log.error({ err: error, user_id: issued.userId }, 'Registration verification email delivery failed.');
      }
    });
  } else if (issued?.alreadyExists && emailProviderConfigured()) {
    setImmediate(async () => {
      try { await sendAccountAlreadyExistsEmail(issued.email, new URL('/login', appUrl).toString()); }
      catch (error) { request.log.error({ err: error }, 'Account-exists notice email delivery failed.'); }
    });
  }
  return response;
});

app.post('/api/v1/auth/verify-email', {
  config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  preHandler: [requireRegistrationStore],
}, async (request, reply) => {
  const token = request.body?.token;
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,64}$/.test(token)) {
    return fail(reply, request, 422, 'VALIDATION_ERROR', 'Mã xác thực không hợp lệ.');
  }
  reply.header('Cache-Control', 'no-store');
  return envelope(await registration.verifyEmail(token));
});

app.post('/api/v1/auth/resend-verification', {
  config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  preHandler: [requireRegistrationStore],
}, async (request, reply) => {
  const email = request.body?.email;
  if (typeof email !== 'string' || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email.trim())) {
    return fail(reply, request, 422, 'VALIDATION_ERROR', 'Vui lòng nhập địa chỉ email hợp lệ.');
  }
  const appUrl = getPublicAppUrl();
  if (!appUrl) return fail(reply, request, 503, 'REGISTRATION_UNAVAILABLE', 'Thiếu cấu hình PUBLIC_APP_URL.');
  const issued = await registration.resend(email, request.ip);
  reply.code(202).header('Cache-Control', 'no-store');
  const response = reply.send(envelope({ message: 'Nếu email hợp lệ và chưa xác thực, chúng tôi đã gửi lại email xác thực.' }));
  if (issued) {
    const verifyUrl = new URL('/verify-email', appUrl);
    verifyUrl.hash = new URLSearchParams({ token: issued.token }).toString();
    setImmediate(async () => {
      if (!emailProviderConfigured()) {
        request.log.warn({ user_id: issued.userId, verify_url: verifyUrl.toString() }, 'SMTP chưa cấu hình: dùng liên kết này để xác thực email trong môi trường phát triển.');
        return;
      }
      try { await sendRegistrationVerificationEmail(issued.email, verifyUrl.toString()); }
      catch (error) {
        await registration.cancelVerification(issued.token).catch(() => {});
        request.log.error({ err: error, user_id: issued.userId }, 'Registration verification email delivery failed.');
      }
    });
  }
  return response;
});

app.post('/api/v1/auth/login', {
  config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
}, async (request, reply) => {
  const { email, password } = request.body ?? {};
  if (typeof email !== 'string' || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email) ||
      typeof password !== 'string' || !password || password.length > 256) {
    return fail(reply, request, 422, 'VALIDATION_ERROR', 'Email và mật khẩu là bắt buộc.');
  }
  const normalizedEmail = email.trim().toLowerCase();
  let login;
  if (postgresAuth) {
    login = await postgresAuth.login(normalizedEmail, password);
    if (login?.emailUnverified) {
      return fail(reply, request, 403, 'EMAIL_NOT_VERIFIED', 'Vui lòng xác thực email trước khi đăng nhập. Kiểm tra hộp thư hoặc yêu cầu gửi lại email xác thực.');
    }
  } else {
    const role = demoAccounts.get(normalizedEmail);
    if (role && password === demoPasswords.get(normalizedEmail)) {
      const token = randomUUID();
      const user = { id: `dev-${role}`, email: normalizedEmail, role, must_change_password: demoMustChangePassword.get(normalizedEmail) ?? false };
      sessions.set(token, { user, expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
      login = { token, user, maxAgeSeconds: 60 * 60 * 8 };
    }
  }
  if (!login) return fail(reply, request, 401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');

  reply.header('Cache-Control', 'no-store');
  reply.setCookie(sessionCookie, login.token, {
    path: '/api/v1', httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true',
    maxAge: login.maxAgeSeconds,
  });
  return envelope({ user: login.user });
});

app.post('/api/v1/auth/logout', { preHandler: requireSession }, async (request, reply) => {
  if (postgresAuth) await postgresAuth.revokeToken(request.sessionToken);
  else if (request.sessionToken) sessions.delete(request.sessionToken);
  clearSessionCookie(reply);
  return reply.code(204).send();
});

app.post('/api/v1/auth/change-password', { preHandler: requireSession }, async (request, reply) => {
  const { current_password: currentPassword, new_password: newPassword } = request.body ?? {};
  if (typeof currentPassword !== 'string' || !currentPassword || !isStrongPassword(newPassword)) {
    return fail(reply, request, 422, 'VALIDATION_ERROR', `Mật khẩu mới không hợp lệ. ${PASSWORD_POLICY_TEXT}`);
  }
  if (postgresAuth) {
    const result = await postgresAuth.changePassword(request.user.id, request.sessionToken, currentPassword, newPassword);
    reply.header('Cache-Control', 'no-store');
    return envelope({ user: { ...request.user, ...result.user } });
  }
  if (currentPassword !== demoPasswords.get(request.user.email)) return fail(reply, request, 422, 'CURRENT_PASSWORD_INVALID', 'Mật khẩu hiện tại không đúng.');
  if (currentPassword === newPassword) return fail(reply, request, 422, 'PASSWORD_UNCHANGED', 'Mật khẩu mới phải khác mật khẩu hiện tại.');
  demoPasswords.set(request.user.email, newPassword);
  demoMustChangePassword.set(request.user.email, false);
  for (const [token, session] of sessions) {
    if (session.user.email === request.user.email && token !== request.sessionToken) sessions.delete(token);
  }
  const user = { ...request.user, must_change_password: false };
  const currentSession = sessions.get(request.sessionToken);
  if (currentSession) currentSession.user = user;
  reply.header('Cache-Control', 'no-store');
  return envelope({ user });
});

app.get('/api/v1/me', { preHandler: requireSession }, async (request) => envelope({ user: request.user }));

app.post('/api/v1/me/upgrade/trader', { preHandler: [requireCapability('profile.role.manage.self'), requireAccountStore] }, async (request, reply) => {
  const result = await account.upgradeToTrader(request.user.id, request.body ?? {});
  clearSessionCookie(reply);
  return envelope(result);
});
app.post('/api/v1/me/downgrade/retail', { preHandler: [requireCapability('profile.role.manage.self'), requireAccountStore] }, async (request, reply) => {
  const result = await account.downgradeToRetail(request.user.id);
  clearSessionCookie(reply);
  return envelope(result);
});
app.post('/api/v1/me/role-requests', {
  config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  preHandler: [requireCapability('profile.role.manage.self'), requireAccountStore],
}, async (request, reply) => {
  reply.code(201);
  return envelope(await account.requestAnalyst(request.user.id, request.body ?? {}));
});
app.get('/api/v1/me/role-requests', { preHandler: [requireCapability('profile.role.manage.self'), requireAccountStore] }, async (request) =>
  envelope(await account.listOwnRequests(request.user.id)));
app.get('/api/v1/me/consents', { preHandler: [requireSession, requireAccountStore] }, async (request) =>
  envelope(await account.listConsents(request.user.id)));
app.delete('/api/v1/me', { preHandler: [requireSession, requireAccountStore] }, async (request, reply) => {
  const result = await account.deleteSelf(request.user.id, request.body?.password);
  clearSessionCookie(reply);
  return envelope(result);
});

app.get('/api/v1/me/profile', { preHandler: [requireCapability('profile.investment.manage.self'), requireInvestmentProfileStore] }, async (request) =>
  envelope(await investmentProfiles.get(request.user.id)));
app.put('/api/v1/me/profile', { preHandler: [requireCapability('profile.investment.manage.self'), requireInvestmentProfileStore] }, async (request) =>
  envelope(await investmentProfiles.save(request.user.id, validateInvestmentProfile(request.body))));
app.get('/api/v1/me/notification-preferences', { preHandler: [requireCapability('notifications.channels.manage.self'), requireNotificationPreferencesStore] }, async (request) =>
  envelope(await notificationPreferences.get(request.user.id, notificationDeliveryStatus())));
app.put('/api/v1/me/notification-preferences', { preHandler: [requireCapability('notifications.channels.manage.self'), requireNotificationPreferencesStore] }, async (request) => {
  const preferences = validateNotificationPreferences(request.body);
  const delivery = notificationDeliveryStatus();
  if (preferences.email_enabled && !await notificationChannels.verifiedDestination(request.user.id, 'email')) throw new ApiError(409, 'EMAIL_NOT_VERIFIED', 'Hãy xác minh kênh email trước khi bật.');
  if (preferences.telegram_enabled && !await notificationChannels.verifiedDestination(request.user.id, 'telegram')) throw new ApiError(409, 'TELEGRAM_NOT_VERIFIED', 'Hãy liên kết và xác minh Telegram trước khi bật.');
  if (preferences.email_enabled && !delivery.email.provider_configured) throw new ApiError(503, 'EMAIL_PROVIDER_NOT_CONFIGURED', 'Máy chủ email (SMTP) chưa được cấu hình nên chưa bật được kênh email.');
  if (preferences.telegram_enabled && !delivery.telegram.provider_configured) throw new ApiError(503, 'TELEGRAM_PROVIDER_NOT_CONFIGURED', 'Bot Telegram chưa được cấu hình nên chưa bật được kênh Telegram.');
  return envelope(await notificationPreferences.save(request.user.id, preferences, delivery));
});
app.get('/api/v1/notify/channels', { preHandler: [requireCapability('notifications.channels.manage.self'), requireNotificationPreferencesStore] }, async (request, reply) => {
  reply.header('Cache-Control', 'no-store');
  return envelope({ channels: await notificationChannels.list(request.user.id, request.user.email), providers: notificationDeliveryStatus() });
});
app.post('/api/v1/notify/email/link', { preHandler: [requireCapability('notifications.channels.manage.self'), requireNotificationPreferencesStore] }, async (request) => {
  const code = String(randomInt(100000, 1000000)); const hash = hashVerificationCode(code);
  await notificationChannels.issue(request.user.id, 'email', request.user.email, hash, new Date(Date.now() + 10 * 60_000));
  await pool.query('UPDATE notification_preferences SET email_enabled=false,updated_at=now() WHERE user_id=$1', [request.user.id]);
  try { await sendVerificationEmail(request.user.email, code); }
  catch (error) { await notificationChannels.cancelChallenge(request.user.id, 'email', hash); throw error; }
  return envelope({ channel: 'email', destination: request.user.email, expires_in_seconds: 600 });
});
app.post('/api/v1/notify/email/verify', { preHandler: [requireCapability('notifications.channels.manage.self'), requireNotificationPreferencesStore] }, async (request) => {
  const code = request.body?.code;
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new ApiError(422, 'VALIDATION_ERROR', 'Vui lòng nhập mã xác minh gồm 6 chữ số.');
  return envelope({ channel: await notificationChannels.verifyEmail(request.user.id, hashVerificationCode(code)) });
});
app.post('/api/v1/notify/telegram/link', { preHandler: [requireCapability('notifications.channels.manage.self'), requireNotificationPreferencesStore] }, async (request) => {
  if (!telegramProviderConfigured()) throw new ApiError(503, 'TELEGRAM_PROVIDER_NOT_CONFIGURED', 'Bot Telegram chưa được cấu hình (username, token, webhook secret).');
  const code = randomBytes(24).toString('base64url'); const hash = hashVerificationCode(code);
  await notificationChannels.issue(request.user.id, 'telegram', null, hash, new Date(Date.now() + 10 * 60_000));
  await pool.query('UPDATE notification_preferences SET telegram_enabled=false,updated_at=now() WHERE user_id=$1', [request.user.id]);
  return envelope({ channel: 'telegram', link: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${code}`, expires_in_seconds: 600 });
});
app.post('/api/v1/notify/telegram/webhook', async (request, reply) => {
  const supplied = request.headers['x-telegram-bot-api-secret-token']; const expected = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';
  if (!expected || typeof supplied !== 'string' || supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return fail(reply, request, 401, 'INVALID_WEBHOOK_SECRET', 'Unauthorized webhook.');
  const message = request.body?.message;
  if (message?.chat?.type !== 'private' || typeof message?.text !== 'string') return reply.code(204).send();
  const match = message.text.match(/^\/start\s+([A-Za-z0-9_-]{20,64})$/);
  if (!match) return reply.code(204).send();
  await notificationChannels.consumeTelegramChallenge(hashVerificationCode(match[1]), message.chat.id);
  return reply.code(204).send();
});
app.post('/api/v1/notify/channels/:channel/test', { preHandler: [requireCapability('notifications.channels.manage.self'), requireNotificationPreferencesStore] }, async (request) => {
  const { channel } = request.params;
  if (!['email', 'telegram'].includes(channel)) throw new ApiError(422, 'VALIDATION_ERROR', 'Kênh thông báo không được hỗ trợ.');
  const destination = await notificationChannels.claimTest(request.user.id, channel);
  if (channel === 'email') await sendTestEmail(destination);
  else await sendTelegramMessage(destination, 'StockSense VN: kênh Telegram đã kết nối thành công.');
  return envelope({ channel, sent: true });
});
app.delete('/api/v1/notify/channels/:channel', { preHandler: [requireCapability('notifications.channels.manage.self'), requireNotificationPreferencesStore] }, async (request) => {
  const { channel } = request.params;
  if (!['email', 'telegram'].includes(channel)) throw new ApiError(422, 'VALIDATION_ERROR', 'Kênh thông báo không được hỗ trợ.');
  return envelope(await notificationChannels.unlink(request.user.id, channel));
});
app.get('/api/v1/chat/sessions', { preHandler: [requireCapability('chat.use.self'), requireChatStore] }, async (request) =>
  envelope(await chat.listSessions(request.user.id)));
app.post('/api/v1/chat/sessions', { preHandler: [requireCapability('chat.use.self'), requireChatStore] }, async (request, reply) => {
  reply.code(201);
  return envelope({ session: await chat.createSession(request.user.id, validateChatSession(request.body)) });
});
app.get('/api/v1/chat/sessions/:sessionId/messages', { preHandler: [requireCapability('chat.use.self'), requireChatStore] }, async (request, reply) => {
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(request.params.sessionId)) return fail(reply, request, 422, 'VALIDATION_ERROR', 'Invalid chat session id.');
  const limit = Number(request.query.limit ?? 100);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return fail(reply, request, 422, 'VALIDATION_ERROR', 'limit must be between 1 and 100.');
  return envelope(await chat.listMessages(request.user.id, request.params.sessionId, limit));
});
app.post('/api/v1/chat/sessions/:sessionId/messages', { preHandler: [requireCapability('chat.use.self'), requireChatStore] }, async (request, reply) => {
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(request.params.sessionId)) return fail(reply, request, 422, 'VALIDATION_ERROR', 'Invalid chat session id.');
  const content = request.body?.content;
  if (typeof content !== 'string' || !content.trim() || content.trim().length > 8000) return fail(reply, request, 422, 'VALIDATION_ERROR', 'Message must contain 1 to 8000 characters.');
  await chat.assertSession(request.user.id, request.params.sessionId);
  const question = content.trim();
  const answer = await chatAssistant.answer({ user: request.user, question });
  return envelope(await chat.addExchange(request.user.id, request.params.sessionId, question, answer));
});
// FR-M12-07: chat log for analysts and admins, personal content masked.
app.get('/api/v1/admin/chat-log', { preHandler: [requireCapability('admin.chat-log.read.redacted'), requireChatStore] }, async (request, reply) => {
  const limit = Number(request.query.limit ?? 100);
  const status = request.query.status ?? '';
  if (!Number.isInteger(limit) || limit < 1 || limit > 500 || !['', 'complete', 'blocked'].includes(status)) return fail(reply, request, 422, 'VALIDATION_ERROR', 'Bộ lọc nhật ký Chat không hợp lệ.');
  return envelope(await chat.listLog({ limit, status }));
});
app.delete('/api/v1/chat/sessions/:sessionId', { preHandler: [requireCapability('chat.use.self'), requireChatStore] }, async (request, reply) => {
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(request.params.sessionId)) return fail(reply, request, 422, 'VALIDATION_ERROR', 'Invalid chat session id.');
  return envelope(await chat.deleteSession(request.user.id, request.params.sessionId));
});
app.get('/api/v1/admin/users', { preHandler: [requireCapability('admin.users.manage'), requireAdminStore] }, async (request, reply) => {
  const q = typeof request.query.q === 'string' ? request.query.q.trim() : '';
  if (q.length > 100) return fail(reply, request, 422, 'VALIDATION_ERROR', 'Từ khóa tìm kiếm quá dài.');
  return envelope(await adminUsers.list({ q }));
});
app.post('/api/v1/admin/users', { preHandler: [requireCapability('admin.users.manage'), requireAdminStore] }, async (request, reply) => {
  const { email, role } = request.body ?? {};
  if (typeof email !== 'string' || typeof role !== 'string') throw new ApiError(422, 'VALIDATION_ERROR', 'Email và vai trò là bắt buộc.');
  reply.header('Cache-Control', 'no-store');
  return envelope(await adminUsers.create(request.user.id, { email, role }));
});
app.patch('/api/v1/admin/users/:userId', { preHandler: [requireCapability('admin.users.manage'), requireAdminStore, validateUserId] }, async (request) => {
  return envelope(await adminUsers.update(request.user.id, request.params.userId, request.body));
});
app.post('/api/v1/admin/users/:userId/reset-password', { preHandler: [requireCapability('admin.users.manage'), requireAdminStore, validateUserId] }, async (request, reply) => {
  reply.header('Cache-Control', 'no-store');
  return envelope(await adminUsers.resetPassword(request.user.id, request.params.userId));
});
app.post('/api/v1/admin/users/:userId/revoke-sessions', { preHandler: [requireCapability('admin.users.manage'), requireAdminStore, validateUserId] }, async (request) => {
  return envelope(await adminUsers.revokeSessions(request.user.id, request.params.userId));
});
app.get('/api/v1/admin/role-requests', { preHandler: [requireCapability('admin.role-requests.manage'), requireAccountStore] }, async (request, reply) => {
  const status = request.query.status;
  if (status !== undefined && !['pending_review', 'approved', 'rejected'].includes(status)) {
    return fail(reply, request, 422, 'VALIDATION_ERROR', 'status không hợp lệ.');
  }
  return envelope(await account.listRequestsAdmin({ status }));
});
app.post('/api/v1/admin/role-requests/:id/approve', { preHandler: [requireCapability('admin.role-requests.manage'), requireAccountStore, validateUuid] }, async (request) => {
  return envelope(await account.approveRequest(request.user.id, request.params.id));
});
app.post('/api/v1/admin/role-requests/:id/reject', { preHandler: [requireCapability('admin.role-requests.manage'), requireAccountStore, validateUuid] }, async (request) => {
  return envelope(await account.rejectRequest(request.user.id, request.params.id, request.body?.note));
});
app.get('/api/v1/admin/audit', { preHandler: [requireCapability('admin.audit.read'), requireAdminStore] }, async (request, reply) => {
  const limit = Number(request.query.limit ?? 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return fail(reply, request, 422, 'VALIDATION_ERROR', 'limit phải từ 1 đến 100.');
  const eventType = request.query.event_type;
  if (eventType !== undefined && (typeof eventType !== 'string' || !/^[a-z][a-z0-9_.-]{0,79}$/.test(eventType))) {
    return fail(reply, request, 422, 'VALIDATION_ERROR', 'event_type must be a valid event key.');
  }
  const cursor = request.query.cursor;
  if (cursor !== undefined && (typeof cursor !== 'string' || cursor.length > 256)) return fail(reply, request, 422, 'INVALID_AUDIT_CURSOR', 'The audit cursor is invalid.');
  const { from, to, actor, target } = request.query;
  const isDate = (value) => value === undefined || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)));
  const isSearch = (value) => value === undefined || (typeof value === 'string' && value.length <= 254);
  if (!isDate(from) || !isDate(to) || !isSearch(actor) || !isSearch(target)) {
    return fail(reply, request, 422, 'VALIDATION_ERROR', 'Bộ lọc nhật ký quản trị không hợp lệ.');
  }
  reply.header('Cache-Control', 'private, no-store');
  return envelope(await adminUsers.audit({ limit, cursor, eventType, from, to, actor: actor?.trim(), target: target?.trim() }));
});
app.get('/api/v1/admin/jobs', { preHandler: [requireCapability('admin.jobs.read'), requireAdminJobsStore] }, async (_request, reply) => {
  reply.header('Cache-Control', 'private, no-store');
  return envelope(await adminJobs.list());
});
app.post('/api/v1/admin/jobs/:job/run', { preHandler: [requireCapability('admin.jobs.enqueue'), requireAdminJobsStore] }, async (request, reply) => {
  const run = await adminJobs.enqueue(request.params.job, request.user.id);
  reply.code(202).header('Cache-Control', 'no-store');
  return envelope(run);
});
app.get('/api/v1/admin/notifications', { preHandler: [requireCapability('admin.notifications.read'), requireAdminNotificationsStore] }, async (request, reply) => {
  const limit = Number(request.query.limit ?? 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return fail(reply, request, 422, 'VALIDATION_ERROR', 'limit must be between 1 and 100.');
  reply.header('Cache-Control', 'private, no-store');
  return envelope(await adminJobs.listNotifications(limit));
});
app.get('/api/v1/admin/ops-events', { preHandler: [requireCapability('admin.ops-events.read'), requireAdminOpsStore] }, async (request, reply) => {
  const limit = Number(request.query.limit ?? 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return fail(reply, request, 422, 'VALIDATION_ERROR', 'limit must be between 1 and 100.');
  reply.header('Cache-Control', 'private, no-store');
  return envelope(await adminJobs.listOpsEvents(limit));
});
app.get('/api/v1/admin/ingestion-runs', { preHandler: [requireCapability('admin.jobs.read'), requireAdminStore] }, async (request, reply) => {
  reply.header('Cache-Control', 'private, no-store');
  const limit = Number(request.query.limit ?? 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return fail(reply, request, 422, 'VALIDATION_ERROR', 'limit phải từ 1 đến 100.');
  const { rows } = await pool.query(`SELECT id::text, source, dataset, status,
    range_start::text AS range_start, range_end::text AS range_end,
    units_label, symbols_total, symbols_succeeded, rows_upserted, error_message, started_at, completed_at
    FROM data_ingestion_runs ORDER BY started_at DESC, id DESC LIMIT $1`, [limit]);
  return envelope({ items: rows });
});
app.get('/api/v1/market/status', { preHandler: requireCapability('market.read') }, async (request, reply) => {
  const data = await market.status();
  return data ? envelope(data) : dataNotReady(reply, request);
});
app.get('/api/v1/market/summary', { preHandler: requireCapability('market.read') }, async (request, reply) => {
  const data = await market.summary();
  return data ? envelope(data) : dataNotReady(reply, request);
});
// End-of-day price board for the enabled symbols (not real-time).
app.get('/api/v1/market/board', { preHandler: requireCapability('symbols.read') }, async () => envelope(await market.board()));

app.get('/api/v1/symbols', { preHandler: requireCapability('symbols.read') }, async (request, reply) => {
  const q = typeof request.query.q === 'string' ? request.query.q.trim().toUpperCase() : '';
  const exchange = request.query.exchange;
  if (q.length > 50 || (exchange && !['HOSE', 'HNX', 'UPCOM'].includes(exchange))) {
    return fail(reply, request, 422, 'VALIDATION_ERROR', 'Bộ lọc danh sách mã không hợp lệ.');
  }
  return envelope(await market.symbols({ q, exchange }));
});

app.get('/api/v1/industries', { preHandler: requireCapability('symbols.read') }, async () => envelope(await market.industries()));

app.get('/api/v1/screener', { preHandler: requireCapability('screener.read') }, async (request, reply) => {
  const raw = Object.fromEntries(['exchange', 'industry', 'minPrice', 'maxPrice', 'minChange', 'maxChange', 'minTurnover', 'sort', 'direction']
    .filter((key) => request.query[key] !== undefined).map((key) => [key, request.query[key]]));
  let filters;
  try { filters = validateScreenerFilters(raw); }
  catch (error) { return fail(reply, request, error.statusCode ?? 422, error.code ?? 'VALIDATION_ERROR', error.message); }
  return envelope(await market.screener(filters));
});
app.get('/api/v1/screener/saved-filters', { preHandler: [requireCapability('screener.saved.manage.self'), requireScreenerStore] }, async (request) =>
  envelope(await screenerSavedFilters.list(request.user.id)));
app.post('/api/v1/screener/saved-filters', { preHandler: [requireCapability('screener.saved.manage.self'), requireScreenerStore] }, async (request) => {
  const name = validateSavedFilterName(request.body?.name);
  const filters = validateScreenerFilters(request.body?.filters);
  return envelope(await screenerSavedFilters.save(request.user.id, { name, filters }));
});
app.delete('/api/v1/screener/saved-filters/:id', { preHandler: [requireCapability('screener.saved.manage.self'), requireScreenerStore, validateUuid] }, async (request) =>
  envelope(await screenerSavedFilters.remove(request.user.id, request.params.id)));

app.get('/api/v1/portfolio', { preHandler: [requireCapability('portfolio.manage.self'), requirePortfolioStore] }, async (request) =>
  envelope(await portfolios.snapshot(request.user.id)));
app.post('/api/v1/portfolio/transactions', { preHandler: [requireCapability('portfolio.manage.self'), requirePortfolioStore] }, async (request, reply) => {
  const transaction = validatePortfolioTransaction(request.body);
  reply.code(201);
  return envelope(await portfolios.add(request.user.id, transaction));
});
app.post('/api/v1/portfolio/transactions/import', { preHandler: [requireCapability('portfolio.import.self'), requirePortfolioStore] }, async (request) => {
  const rows = request.body?.transactions;
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 500) throw new ApiError(422, 'VALIDATION_ERROR', 'CSV import must contain between 1 and 500 transactions.');
  const checked = rows.map((row, index) => {
    const line = Number.isInteger(row?.line) ? row.line : index + 2;
    try { return { line, transaction: validatePortfolioTransaction(row) }; }
    catch (error) { return { line, error: error.message }; }
  });
  return envelope(await portfolios.importMany(request.user.id, checked));
});
app.patch('/api/v1/portfolio/transactions/:id', { preHandler: [requireCapability('portfolio.manage.self'), requirePortfolioStore, validateUuid] }, async (request) =>
  envelope(await portfolios.update(request.user.id, request.params.id, validatePortfolioTransaction(request.body))));
app.delete('/api/v1/portfolio/transactions/:id', { preHandler: [requireCapability('portfolio.manage.self'), requirePortfolioStore, validateUuid] }, async (request) =>
  envelope(await portfolios.remove(request.user.id, request.params.id)));
app.delete('/api/v1/portfolio', { preHandler: [requireCapability('portfolio.manage.self'), requirePortfolioStore] }, async (request) => {
  if (request.body?.confirm !== 'XOA TOAN BO') throw new ApiError(422, 'CONFIRMATION_REQUIRED', 'Nhập đúng cụm xác nhận để xóa toàn bộ danh mục.');
  return envelope(await portfolios.clear(request.user.id));
});

app.post('/api/v1/plans/calc', { preHandler: requireCapability('plans.calculate.rr') }, async (request) => {
  const canCalculateQuantity = ROLE_CAPABILITIES[request.user.role]?.includes('plans.calculate.quantity') ?? false;
  return envelope(validatePlanCalculation(request.body, canCalculateQuantity));
});
app.get('/api/v1/plans', { preHandler: [requireCapability('plans.manage.self'), requirePlansStore] }, async (request) =>
  envelope(await plans.list(request.user.id)));
app.post('/api/v1/plans', { preHandler: [requireCapability('plans.manage.self'), requirePlansStore] }, async (request, reply) => {
  const canCalculateQuantity = ROLE_CAPABILITIES[request.user.role]?.includes('plans.calculate.quantity') ?? false;
  const plan = validatePlan(request.body, canCalculateQuantity);
  reply.code(201);
  return envelope(await plans.create(request.user.id, plan));
});
app.patch('/api/v1/plans/:id', { preHandler: [requireCapability('plans.manage.self'), requirePlansStore, validateUuid] }, async (request) => {
  if (request.body && Object.hasOwn(request.body, 'status')) {
    const status = request.body.status;
    if (Object.keys(request.body).length !== 1 || !['planned', 'active', 'cancelled'].includes(status)) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Trạng thái yêu cầu phải là planned, active hoặc cancelled và gửi riêng.');
    }
    return envelope(await plans.updateStatus(request.user.id, request.params.id, status));
  }
  return envelope(await plans.update(request.user.id, request.params.id, validatePlanUpdate(request.body)));
});
app.post('/api/v1/plans/:id/close', { preHandler: [requireCapability('plans.manage.self'), requirePlansStore, validateUuid] }, async (request) =>
  envelope(await plans.close(request.user.id, request.params.id, validatePlanClose(request.body))));

app.get('/api/v1/journal', { preHandler: [requireCapability('journal.read.self'), requireJournalStore] }, async (request, reply) => {
  return envelope(await journal.list(request.user.id, parseJournalFilters(request.query)));
});
app.patch('/api/v1/journal/:id', { preHandler: [requireCapability('journal.update.self'), requireJournalStore, validateUuid] }, async (request) =>
  envelope(await journal.update(request.user.id, request.params.id, validateJournalUpdate(request.body))));
app.post('/api/v1/journal', { preHandler: [requireCapability('journal.manual.create.self'), requireJournalStore] }, async (request, reply) => {
  reply.code(201);
  return envelope(await journal.createManual(request.user.id, validateManualJournal(request.body)));
});
app.get('/api/v1/journal/stats', { preHandler: [requireCapability('journal.stats.read.self'), requireJournalStore] }, async (request) => {
  const period = request.query.period ?? 'month';
  if (!['week', 'month', 'quarter'].includes(period)) throw new ApiError(422, 'VALIDATION_ERROR', 'period phải là week, month hoặc quarter.');
  const [summary, periods] = await Promise.all([journal.stats(request.user.id), journal.periodStats(request.user.id, period)]);
  return envelope({ ...summary, periods });
});

function parseJournalFilters(query) {
  const symbol = typeof query.symbol === 'string' ? query.symbol.trim().toUpperCase() : '';
  const limit = Number(query.limit ?? 50);
  const isDate = (value) => value == null || value === '' || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)));
  const tag = typeof query.tag === 'string' ? query.tag.trim().toLocaleLowerCase() : '';
  const q = typeof query.q === 'string' ? query.q.trim() : '';
  const result = query.result ?? '';
  if ((symbol && !/^[A-Z0-9.-]{1,12}$/.test(symbol)) || !Number.isInteger(limit) || limit < 1 || limit > 100 ||
      !isDate(query.from) || !isDate(query.to) || tag.length > 24 || q.length > 100 ||
      !['', 'win', 'loss', 'breakeven', 'none'].includes(result)) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Bộ lọc nhật ký không hợp lệ.');
  }
  return { symbol, limit, from: query.from || null, to: query.to || null, tag, result, q };
}

async function sendPdf(reply, filename, report) {
  const status = await market.status();
  const meta = status
    ? `Ngày dữ liệu: ${status.dataDate} · Phiên bản mô hình: ${status.modelVersion}${status.state === 'demo' ? ' (dữ liệu mẫu, mô hình AI chưa triển khai)' : ''}`
    : 'Ngày dữ liệu: chưa có batch dữ liệu thị trường';
  const pdf = await createPdfReport({ ...report, meta });
  return reply.header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `attachment; filename="${filename}"`)
    .header('Cache-Control', 'private, no-store')
    .send(pdf);
}

app.get('/api/v1/reports/symbols/:symbol.pdf', { preHandler: requireCapability('reports.symbol.export') }, async (request, reply) => {
  const symbol = request.params.symbol.toUpperCase();
  if (!/^[A-Z0-9.-]{1,12}$/.test(symbol)) return fail(reply, request, 422, 'VALIDATION_ERROR', 'Mã cổ phiếu không hợp lệ.');
  const item = await market.symbol(symbol);
  if (!item) return fail(reply, request, 404, 'NOT_FOUND', 'Không tìm thấy mã cổ phiếu.');
  return sendPdf(reply, `stocksense-${symbol}.pdf`, { title: `Báo cáo mã ${symbol}`, subtitle: item.name,
    sections: [{ heading: 'Thông tin thị trường', lines: [
      `Mã: ${symbol}`, `Sàn: ${item.exchange ?? 'Chưa có dữ liệu'}`,
      `Giá đóng cửa: ${formatReportValue(item.closePrice)}`, `Thay đổi: ${formatReportValue(item.changePercent)}%`,
      `Ngày dữ liệu: ${formatReportValue(item.priceDate)}`, `Nguồn: ${item.priceDataStatus === 'live' ? 'SSI' : 'Dữ liệu minh họa'}`,
    ] }, { heading: 'Dự báo', lines: ['Mô hình AI chưa sẵn sàng; báo cáo không đưa ra dự báo hoặc xác suất.'] }] });
});

app.get('/api/v1/reports/portfolio.pdf', { preHandler: [requireCapability('reports.portfolio.export.self'), requirePortfolioStore] }, async (request, reply) => {
  const snapshot = await portfolios.snapshot(request.user.id);
  const positions = snapshot.positions.length ? snapshot.positions.map((item) =>
    `${item.symbol} (${item.industry ?? 'Chưa phân loại'}): số lượng ${formatReportValue(item.quantity)}, giá vốn ${formatReportValue(item.average_cost)}, giá thị trường ${formatReportValue(item.market_price)}, lãi/lỗ tạm tính ${formatReportValue(item.unrealized_pnl)}, tỷ trọng ${formatReportValue(item.weight_pct)}%`) : ['Chưa có vị thế đang nắm giữ.'];
  return sendPdf(reply, 'stocksense-portfolio.pdf', { title: 'Báo cáo danh mục', subtitle: 'Danh mục riêng của tài khoản đang đăng nhập', sections: [
    { heading: 'Tổng quan', lines: [`Giá trị thị trường: ${formatReportValue(snapshot.summary.market_value)}`, `Giá vốn: ${formatReportValue(snapshot.summary.cost_basis)}`, `Lãi/lỗ đã thực hiện: ${formatReportValue(snapshot.summary.realized_pnl)}`, `Lãi/lỗ tạm tính: ${formatReportValue(snapshot.summary.unrealized_pnl)}`] },
    { heading: 'Vị thế', lines: positions },
    { heading: 'Phân bổ theo ngành', lines: snapshot.allocation.by_industry.length ? snapshot.allocation.by_industry.map((item) => `${item.industry}: ${formatReportValue(item.weight_pct)}%`) : ['Chưa có vị thế.'] },
    { heading: 'Tín hiệu hiện tại', lines: ['Mô hình AI chưa sẵn sàng; báo cáo không kèm tín hiệu dự báo.'] },
    { heading: 'Giao dịch gần đây', lines: snapshot.transactions.slice(0, 100).map((tx) => `${formatReportValue(tx.executed_at)} · ${tx.symbol} · ${tx.side} · ${formatReportValue(tx.quantity)} @ ${formatReportValue(tx.unit_price)} · phí ${formatReportValue(tx.fee)}`) },
  ] });
});

app.get('/api/v1/reports/plans/:id.pdf', { preHandler: [requireCapability('reports.plan.export.self'), requirePlansStore, validateUuid] }, async (request, reply) => {
  const plan = await plans.get(request.user.id, request.params.id);
  if (!plan) return fail(reply, request, 404, 'NOT_FOUND', 'Không tìm thấy kế hoạch giao dịch.');
  const snap = plan.snapshot ?? {};
  const statusLabels = { draft: 'Nháp', planned: 'Chờ vào', active: 'Đang mở', closed: 'Đã đóng', cancelled: 'Đã hủy' };
  const calc = validatePlanCalculation({ side: plan.side, entry_price: plan.entry_price, stop_price: plan.stop_price, target_price: plan.target_price }, false);
  return sendPdf(reply, `stocksense-plan-${plan.symbol}.pdf`, { title: `Kế hoạch giao dịch ${plan.symbol}`, subtitle: `Trạng thái: ${statusLabels[plan.status] ?? plan.status}${plan.close_reason ? ` · ${CLOSE_REASON_LABELS[plan.close_reason]}` : ''}`, sections: [
    { heading: 'Kế hoạch', lines: [`Chiều giao dịch: ${plan.side === 'long' ? 'Mua' : 'Bán'}`, `Vùng giá vào: ${formatReportValue(plan.entry_price)}${plan.entry_price_max ? ` – ${formatReportValue(plan.entry_price_max)}` : ''}`, `Giá cắt lỗ: ${formatReportValue(plan.stop_price)} (cách giá vào ${formatReportValue(calc.risk_pct_distance)}%)`, `Giá mục tiêu: ${formatReportValue(plan.target_price)} (cách giá vào ${formatReportValue(calc.reward_pct_distance)}%)`, `R:R: ${formatReportValue(calc.rr_ratio)}:1`, `Khối lượng: ${formatReportValue(plan.quantity)}`, `Hết hạn: ${formatReportValue(plan.expires_on)}`, `Lý do: ${plan.note || 'Không có'}`] },
    ...(plan.status === 'closed' ? [{ heading: 'Kết quả', lines: [`Giá thoát: ${formatReportValue(plan.exit_price)}`, `Lý do đóng: ${CLOSE_REASON_LABELS[plan.close_reason] ?? 'Chưa có dữ liệu'}`, `Lãi/lỗ: ${formatReportValue(plan.realized_pnl)}`, `Ghi chú: ${plan.close_note || 'Không có'}`] }] : []),
    ...(plan.revisions?.length ? [{ heading: 'Lịch sử chỉnh sửa', lines: plan.revisions.map((revision) => `${formatReportValue(revision.created_at)}: ${Object.entries(revision.changes).map(([key, value]) => `${key} ${formatReportValue(revision.previous[key])} → ${formatReportValue(value)}`).join('; ')}`) }] : []),
    { heading: 'Tuyên bố', lines: ['Trade Plan do bạn tự lập; hệ thống không đưa khuyến nghị đầu tư.'] },
    { heading: 'Snapshot lúc tạo', lines: [`Giá thị trường: ${formatReportValue(snap.market_price)}`, `Ngày giá: ${formatReportValue(snap.price_date)}`, 'Dự báo: Mô hình AI chưa sẵn sàng; không có dự báo trong snapshot.'] },
  ] });
});

app.get('/api/v1/reports/journal.pdf', { preHandler: [requireCapability('reports.journal.export.self'), requireJournalStore] }, async (request, reply) => {
  // FR-M13-04: the journal report covers the period chosen by the user (all entries when no range is given).
  const filters = parseJournalFilters({ from: request.query.from, to: request.query.to, limit: 100 });
  const [result, periods] = await Promise.all([journal.list(request.user.id, filters), journal.periodStats(request.user.id, 'month')]);
  const inRange = periods.items.filter((item) => (!filters.from || item.period_start >= filters.from.slice(0, 7) + '-01') && (!filters.to || item.period_start <= filters.to));
  const wins = result.items.filter((entry) => entry.realized_pnl > 0).length;
  const losses = result.items.filter((entry) => entry.realized_pnl < 0).length;
  const realized = result.items.reduce((sum, entry) => sum + (entry.realized_pnl ?? 0), 0);
  const entries = result.items.length ? result.items.map((entry) => `${formatReportValue(entry.decision_date ?? entry.created_at)} · ${entry.symbol} · ${entry.title}\n${entry.body || 'Không có ghi chú'}${entry.tags?.length ? `\nThẻ: ${entry.tags.join(', ')}` : ''}${entry.lesson ? `\nBài học: ${entry.lesson}` : ''}`) : ['Không có mục nhật ký trong kỳ.'];
  const periodLabel = filters.from || filters.to ? `Kỳ báo cáo: ${filters.from ?? '…'} đến ${filters.to ?? 'nay'}` : 'Toàn bộ thời gian (tối đa 100 mục gần nhất)';
  return sendPdf(reply, 'stocksense-journal.pdf', { title: 'Báo cáo nhật ký giao dịch', subtitle: periodLabel, sections: [
    { heading: 'Tổng kết kỳ', lines: [`Số mục: ${result.items.length}`, `Thắng / thua: ${wins} / ${losses}`, `Lãi/lỗ thực hiện: ${formatReportValue(realized)}`] },
    { heading: 'Theo tháng', lines: inRange.length ? inRange.map((item) => `${item.period_start.slice(0, 7)}: ${item.closed_plans} kế hoạch đóng · chạm mục tiêu ${item.target_hit_rate ?? 0}% · chạm cắt lỗ ${item.stop_hit_rate ?? 0}% · R thực tế TB ${formatReportValue(item.average_realized_r)} · lãi/lỗ ${formatReportValue(item.realized_pnl)}`) : ['Chưa có kế hoạch đóng trong kỳ.'] },
    { heading: 'Nhật ký', lines: entries },
  ] });
});

app.get('/api/v1/symbols/:symbol', { preHandler: requireCapability('symbols.read') }, async (request, reply) => {
  const item = await market.symbol(request.params.symbol);
  if (!item) return fail(reply, request, 404, 'NOT_FOUND', 'Không tìm thấy mã cổ phiếu.');
  return envelope(item);
});

app.get('/api/v1/symbols/:symbol/prices', { preHandler: requireCapability('history.read') }, async (request, reply) => {
  const symbol = request.params.symbol.toUpperCase();
  const range = request.query.range ?? '3m';
  if (!PRICE_RANGES.includes(range)) return fail(reply, request, 422, 'VALIDATION_ERROR', 'Khoảng thời gian không hợp lệ.');
  const data = await market.prices(symbol, range);
  return data ? envelope(data) : fail(reply, request, 404, 'NOT_FOUND', 'Không tìm thấy dữ liệu giá cho mã này.');
});

app.get('/api/v1/symbols/:symbol/history.csv', { preHandler: requireCapability('history.csv.export') }, async (request, reply) => {
  if (process.env.HISTORY_CSV_EXPORT_ENABLED !== 'true') return fail(reply, request, 404, 'FEATURE_DISABLED', 'CSV export is not enabled for this release.');
  const symbol = request.params.symbol.toUpperCase();
  if (!/^[A-Z0-9.-]{1,12}$/.test(symbol)) return fail(reply, request, 422, 'VALIDATION_ERROR', 'Invalid symbol.');
  const range = request.query.range ?? '6m';
  if (!['1m', '3m', '6m'].includes(range)) return fail(reply, request, 422, 'VALIDATION_ERROR', 'Invalid history range.');
  const data = await market.prices(symbol, range);
  if (!data) return fail(reply, request, 404, 'NOT_FOUND', 'Price history was not found.');
  const escapeCsv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const rows = [['symbol', 'date', 'close', 'currency', 'interval', 'source'], ...data.items.map((item) =>
    [symbol, item.date, item.close, data.currency, data.interval, data.sourceStatus])];
  const csv = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')}\r\n`;
  return reply.header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="stocksense-${symbol}-history.csv"`)
    .header('Cache-Control', 'private, no-store')
    .send(csv);
});

app.get('/api/v1/symbols/:symbol/news', { preHandler: requireCapability('news.read') }, async (request, reply) => {
  const symbol = request.params.symbol.toUpperCase();
  const data = await market.news(symbol);
  return data ? envelope(data) : fail(reply, request, 404, 'NOT_FOUND', 'Không tìm thấy mã cổ phiếu.');
});

app.get('/api/v1/watchlist', { preHandler: [requireCapability('watchlist.manage.self'), requirePersonalStore] }, async (request) =>
  envelope(await personalMarketTools.list(request.user.id)));
app.put('/api/v1/watchlist/:symbol', { preHandler: [requireCapability('watchlist.manage.self'), requirePersonalStore] }, async (request, reply) => {
  const symbol = request.params.symbol.toUpperCase();
  const note = validateNote(request.body?.note ?? '');
  reply.code(200);
  return envelope(await personalMarketTools.add(request.user.id, symbol, note));
});
app.patch('/api/v1/watchlist/:symbol', { preHandler: [requireCapability('watchlist.manage.self'), requirePersonalStore] }, async (request) => {
  if (typeof request.body?.note !== 'string') throw new ApiError(422, 'VALIDATION_ERROR', 'Thiếu ghi chú.');
  return envelope(await personalMarketTools.updateNote(request.user.id, request.params.symbol.toUpperCase(), validateNote(request.body.note)));
});
app.delete('/api/v1/watchlist/:symbol', { preHandler: [requireCapability('watchlist.manage.self'), requirePersonalStore] }, async (request) =>
  envelope(await personalMarketTools.remove(request.user.id, request.params.symbol.toUpperCase())));

app.get('/api/v1/alert-rules', { preHandler: [requireCapability('alerts.manage.self'), requirePersonalStore] }, async (request) =>
  envelope(await personalMarketTools.rules(request.user.id)));
app.post('/api/v1/alert-rules', { preHandler: [requireCapability('alerts.manage.self'), requirePersonalStore] }, async (request, reply) => {
  const { symbol, condition, target_price: targetPrice } = request.body ?? {};
  if (typeof symbol !== 'string' || !['price_above', 'price_below'].includes(condition) ||
      typeof targetPrice !== 'number' || !Number.isFinite(targetPrice) || targetPrice <= 0 || targetPrice > 100_000_000_000) {
    return fail(reply, request, 422, 'VALIDATION_ERROR', 'Quy tắc cần mã, điều kiện trên/dưới và giá mục tiêu hợp lệ.');
  }
  reply.code(201);
  return envelope(await personalMarketTools.createRule(request.user.id, { symbol: symbol.toUpperCase(), condition, target_price: targetPrice }));
});
app.patch('/api/v1/alert-rules/:id', { preHandler: [requireCapability('alerts.manage.self'), requirePersonalStore, validateUuid] }, async (request, reply) => {
  const changes = request.body ?? {};
  if ((!Object.hasOwn(changes, 'is_active') && !Object.hasOwn(changes, 'target_price')) ||
      (Object.hasOwn(changes, 'is_active') && typeof changes.is_active !== 'boolean') ||
      (Object.hasOwn(changes, 'target_price') && (typeof changes.target_price !== 'number' || !Number.isFinite(changes.target_price) || changes.target_price <= 0 || changes.target_price > 100_000_000_000))) {
    return fail(reply, request, 422, 'VALIDATION_ERROR', 'Trạng thái hoặc giá mục tiêu không hợp lệ.');
  }
  return envelope(await personalMarketTools.updateRule(request.user.id, request.params.id, changes));
});
app.delete('/api/v1/alert-rules/:id', { preHandler: [requireCapability('alerts.manage.self'), requirePersonalStore, validateUuid] }, async (request) =>
  envelope(await personalMarketTools.deleteRule(request.user.id, request.params.id)));

app.get('/api/v1/alerts', { preHandler: [requireCapability('alerts.inbox.read.self'), requirePersonalStore] }, async (request, reply) => {
  const limit = Number(request.query.limit ?? 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return fail(reply, request, 422, 'VALIDATION_ERROR', 'limit phải từ 1 đến 100.');
  return envelope(await personalMarketTools.alerts(request.user.id, limit));
});
app.get('/api/v1/alerts/unread-count', { preHandler: [requireCapability('alerts.inbox.read.self'), requirePersonalStore] }, async (request, reply) => {
  reply.header('Cache-Control', 'private, no-store');
  return envelope(await personalMarketTools.unreadCount(request.user.id));
});
app.post('/api/v1/alerts/read-all', { preHandler: [requireCapability('alerts.inbox.read.self'), requirePersonalStore] }, async (request) =>
  envelope(await personalMarketTools.markAllAlertsRead(request.user.id)));
app.patch('/api/v1/alerts/:id', { preHandler: [requireCapability('alerts.inbox.read.self'), requirePersonalStore, validateUuid] }, async (request, reply) => {
  if (request.body?.read !== true) return fail(reply, request, 422, 'VALIDATION_ERROR', 'Chỉ hỗ trợ đánh dấu cảnh báo đã đọc.');
  return envelope(await personalMarketTools.markAlertRead(request.user.id, request.params.id));
});

app.setNotFoundHandler((request, reply) => fail(reply, request, 404, 'NOT_FOUND', 'Không tìm thấy endpoint.'));

app.addHook('onClose', async () => { if (pool) await pool.end(); });
const port = Number(process.env.API_PORT || 3000);
if (pool) await pool.query('SELECT 1');
await app.listen({ port, host: process.env.API_HOST || '127.0.0.1' });
app.log.info(`Market data source: ${databaseEnabled ? 'postgres' : 'fixture'}; auth source: ${postgresAuth ? 'postgres' : 'demo-memory'}.`);
