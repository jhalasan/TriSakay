export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPassword(value: string): boolean {
  return value.trim().length >= 6;
}

export function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}
