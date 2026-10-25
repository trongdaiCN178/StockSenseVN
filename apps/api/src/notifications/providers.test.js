import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { emailProviderConfigured, telegramProviderConfigured } from './providers.js';

const SMTP_VARS = ['SMTP_HOST', 'SMTP_FROM', 'SMTP_USER', 'SMTP_PASS'];
const TELEGRAM_VARS = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_USERNAME', 'TELEGRAM_WEBHOOK_SECRET'];
const ALL_VARS = [...SMTP_VARS, ...TELEGRAM_VARS];

let savedEnv;

beforeEach(() => {
  savedEnv = Object.fromEntries(ALL_VARS.map((key) => [key, process.env[key]]));
  for (const key of ALL_VARS) delete process.env[key];
});

afterEach(() => {
  for (const key of ALL_VARS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe('emailProviderConfigured', () => {
  it('is false when no SMTP variables are set', () => {
    expect(emailProviderConfigured()).toBe(false);
  });

  it('is false when only some SMTP variables are set', () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_FROM = 'noreply@example.com';
    expect(emailProviderConfigured()).toBe(false);
  });

  it('is true when all SMTP variables are set', () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_FROM = 'noreply@example.com';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASS = 'pass';
    expect(emailProviderConfigured()).toBe(true);
  });
});

describe('telegramProviderConfigured', () => {
  it('is false when no Telegram variables are set', () => {
    expect(telegramProviderConfigured()).toBe(false);
  });

  it('is true when all Telegram variables are set', () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token';
    process.env.TELEGRAM_BOT_USERNAME = 'bot';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'secret';
    expect(telegramProviderConfigured()).toBe(true);
  });
});
