export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPassword(value: string): boolean {
  return value.trim().length >= 6;
}

export function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

/** PH mobile number after the +63 prefix: 10 digits, starting with 9. */
export function isValidMobile(value: string): boolean {
  return /^9\d{9}$/.test(value.trim());
}

/** PH mobile number, local format: 11 digits starting with 09 (e.g. 09224444955). */
export function isValidLocalMobile(value: string): boolean {
  return /^09\d{9}$/.test(value.replace(/\s+/g, ''));
}
