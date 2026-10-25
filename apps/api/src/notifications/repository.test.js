import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { validateNotificationPreferences, hashVerificationCode } from './repository.js';
import { ApiError } from '../errors.js';

describe('validateNotificationPreferences', () => {
  it('accepts a fully-specified boolean preferences object', () => {
    const input = { in_app_enabled: true, email_enabled: false, telegram_enabled: true };
    expect(validateNotificationPreferences(input)).toEqual(input);
  });

  it('rejects missing keys', () => {
    expect(() => validateNotificationPreferences({ in_app_enabled: true, email_enabled: false }))
      .toThrow(ApiError);
  });

  it('rejects extra keys', () => {
    expect(() => validateNotificationPreferences({
      in_app_enabled: true, email_enabled: false, telegram_enabled: true, extra: true,
    })).toThrow(ApiError);
  });

  it('rejects non-boolean values', () => {
    expect(() => validateNotificationPreferences({ in_app_enabled: 'yes', email_enabled: false, telegram_enabled: true }))
      .toThrow(ApiError);
  });

  it('rejects arrays and non-objects', () => {
    expect(() => validateNotificationPreferences(null)).toThrow(ApiError);
    expect(() => validateNotificationPreferences([])).toThrow(ApiError);
    expect(() => validateNotificationPreferences('nope')).toThrow(ApiError);
  });
});

describe('hashVerificationCode', () => {
  it('produces a deterministic sha256 digest of the code', () => {
    const expected = createHash('sha256').update('123456').digest();
    expect(hashVerificationCode('123456').equals(expected)).toBe(true);
  });

  it('produces different digests for different codes', () => {
    expect(hashVerificationCode('111111').equals(hashVerificationCode('222222'))).toBe(false);
  });
});
