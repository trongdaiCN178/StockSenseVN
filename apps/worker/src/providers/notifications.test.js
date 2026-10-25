import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { emailProviderConfigured } from './notifications.js';

const SMTP_VARS = ['SMTP_HOST', 'SMTP_FROM', 'SMTP_USER', 'SMTP_PASS'];

let savedEnv;

beforeEach(() => {
  savedEnv = Object.fromEntries(SMTP_VARS.map((key) => [key, process.env[key]]));
  for (const key of SMTP_VARS) delete process.env[key];
});

afterEach(() => {
  for (const key of SMTP_VARS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe('emailProviderConfigured (worker)', () => {
  it('is false when no SMTP variables are set', () => {
    expect(emailProviderConfigured()).toBe(false);
  });

  it('is true only when all SMTP variables are set', () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_FROM = 'noreply@example.com';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASS = 'pass';
    expect(emailProviderConfigured()).toBe(true);
  });
});
