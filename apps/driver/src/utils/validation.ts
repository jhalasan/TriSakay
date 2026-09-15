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
