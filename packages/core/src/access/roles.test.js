import { describe, it, expect } from 'vitest';
import { ROLES, ROLE_CAPABILITIES, ROLE_LABELS, hasCapability } from './roles.js';

describe('hasCapability', () => {
  it('returns true when the role has the capability', () => {
    expect(hasCapability(ROLES.RETAIL, 'market.read')).toBe(true);
    expect(hasCapability(ROLES.ADMIN, 'admin.users.manage')).toBe(true);
  });

  it('returns false when the role lacks the capability', () => {
    expect(hasCapability(ROLES.RETAIL, 'admin.users.manage')).toBe(false);
    expect(hasCapability(ROLES.TRADER, 'admin.jobs.read')).toBe(false);
  });

  it('returns false for an unknown role instead of throwing', () => {
    expect(hasCapability('not-a-role', 'market.read')).toBe(false);
    expect(hasCapability(undefined, 'market.read')).toBe(false);
  });

  it('every role capability list only contains unique, known strings', () => {
    for (const role of Object.values(ROLES)) {
      const capabilities = ROLE_CAPABILITIES[role];
      expect(new Set(capabilities).size).toBe(capabilities.length);
      expect(ROLE_LABELS[role]).toBeTypeOf('string');
    }
  });

  it('admin does not inherit the self-service capabilities granted to other roles', () => {
    expect(hasCapability(ROLES.ADMIN, 'watchlist.manage.self')).toBe(false);
  });

  it('admin can manage own notification channels to receive job-failure alerts', () => {
    expect(hasCapability(ROLES.ADMIN, 'notifications.channels.manage.self')).toBe(true);
  });
});
