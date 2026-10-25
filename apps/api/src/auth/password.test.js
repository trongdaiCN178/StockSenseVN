import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('hashPassword / verifyPassword', () => {
  it('produces a scrypt-encoded hash with the expected shape', async () => {
    const encoded = await hashPassword('Demo123!');
    const parts = encoded.split('$');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('scrypt');
    expect(parts[1]).toMatch(/^[a-f0-9]{32}$/);
    expect(parts[2]).toMatch(/^[a-f0-9]{128}$/);
  });

  it('verifies the correct password', async () => {
    const encoded = await hashPassword('Demo123!');
    expect(await verifyPassword('Demo123!', encoded)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const encoded = await hashPassword('Demo123!');
    expect(await verifyPassword('wrong-password', encoded)).toBe(false);
  });

  it('produces different salts/hashes for the same password', async () => {
    const first = await hashPassword('Demo123!');
    const second = await hashPassword('Demo123!');
    expect(first).not.toBe(second);
  });

  it('rejects malformed encoded hashes instead of throwing', async () => {
    expect(await verifyPassword('Demo123!', 'not-a-valid-hash')).toBe(false);
    expect(await verifyPassword('Demo123!', undefined)).toBe(false);
    expect(await verifyPassword('Demo123!', 'scrypt$nothex$nothex')).toBe(false);
    expect(await verifyPassword('Demo123!', 'scrypt$abcd$abcd$extra')).toBe(false);
  });
});
