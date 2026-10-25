// FR-M0-06: 8-64 characters with at least one letter, one digit and one special character.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;
export const PASSWORD_POLICY_TEXT = `Mật khẩu dài ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} ký tự, gồm chữ, số và ít nhất 1 ký tự đặc biệt.`;

export function isStrongPassword(password) {
  return typeof password === 'string' && password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH &&
    /[A-Za-z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password);
}
