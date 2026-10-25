import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { processNotificationOutbox } from './notification-delivery.js';

const PROVIDER_VARS = ['SMTP_HOST', 'SMTP_FROM', 'SMTP_USER', 'SMTP_PASS', 'TELEGRAM_BOT_TOKEN'];

let savedEnv;

beforeEach(() => {
  savedEnv = Object.fromEntries(PROVIDER_VARS.map((key) => [key, process.env[key]]));
  for (const key of PROVIDER_VARS) delete process.env[key];
});

afterEach(() => {
  for (const key of PROVIDER_VARS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe('processNotificationOutbox', () => {
  it('rejects an out-of-range batchSize before touching the pool', async () => {
    const pool = { connect: () => { throw new Error('pool.connect should not be called'); } };
    await expect(processNotificationOutbox({ pool, batchSize: 0 })).rejects.toThrow('batchSize must be from 1 to 100.');
    await expect(processNotificationOutbox({ pool, batchSize: 101 })).rejects.toThrow('batchSize must be from 1 to 100.');
    await expect(processNotificationOutbox({ pool, batchSize: 1.5 })).rejects.toThrow('batchSize must be from 1 to 100.');
  });

  it('returns waiting_for_provider without touching the pool when no provider is configured', async () => {
    const pool = { connect: () => { throw new Error('pool.connect should not be called'); } };
    const result = await processNotificationOutbox({ pool });
    expect(result).toEqual({ claimed: 0, sent: 0, skipped: 0, retrying: 0, failed: 0, waiting_for_provider: true });
  });
});
