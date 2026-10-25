import { promisify } from 'node:util';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { scrypt as scryptCallback } from 'node:crypto';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  const [algorithm, saltHex, keyHex, extra] = String(encoded ?? '').split('$');
  if (algorithm !== 'scrypt' || !saltHex || !keyHex || extra !== undefined || !/^[a-f\d]+$/i.test(saltHex) || !/^[a-f\d]+$/i.test(keyHex)) return false;
  const expected = Buffer.from(keyHex, 'hex');
  if (expected.length !== KEY_LENGTH) return false;
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(expected, actual);
}
