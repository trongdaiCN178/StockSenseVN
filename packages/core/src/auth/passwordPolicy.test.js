import { describe, it, expect } from 'vitest';
import { isStrongPassword } from './passwordPolicy.js';

describe('isStrongPassword', () => {
  it('accepts 8-64 characters with a letter, digit and special character', () => {
    expect(isStrongPassword('abc123!x')).toBe(true);
    expect(isStrongPassword(`a1!${'x'.repeat(61)}`)).toBe(true);
  });

  it('rejects passwords outside the length range or missing a character class', () => {
    expect(isStrongPassword('ab12!xy')).toBe(false);
    expect(isStrongPassword(`a1!${'x'.repeat(62)}`)).toBe(false);
    expect(isStrongPassword('abcdefgh1')).toBe(false);
    expect(isStrongPassword('abcdefgh!')).toBe(false);
    expect(isStrongPassword('12345678!')).toBe(false);
  });
});
