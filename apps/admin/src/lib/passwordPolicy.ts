/**
 * Single password-policy source for both ForcePasswordChange and
 * ProfileMenu's password change (Phase 2 of the admin redesign — README
 * §02's live requirements checklist must derive from the same predicates
 * the submit handler enforces, so a rule can never show as met and then be
 * rejected on submit). Previously each screen re-implemented its own
 * `length < 8` check; this replaces both with one shared, stricter policy.
 *
 * The mock's checklist has a 4th rule, "not the temporary one" — dropped
 * here rather than implemented, since the client never has the temporary
 * password's value after it's been consumed to authenticate, and the
 * mock's own "Temporary password" field is spec'd read-only. There is no
 * way to check that rule live without a server round trip, which would
 * violate the "never shown-met-then-rejected" guarantee this file exists
 * to preserve.
 */
export const MIN_PASSWORD_LENGTH = 10;

export interface PasswordRequirement {
  key: string;
  label: string;
  met: (password: string) => boolean;
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { key: 'length', label: `At least ${MIN_PASSWORD_LENGTH} characters`, met: (p) => p.length >= MIN_PASSWORD_LENGTH },
  { key: 'case', label: 'Upper and lower case', met: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { key: 'numberOrSymbol', label: 'One number or symbol', met: (p) => /\d/.test(p) || /[^A-Za-z0-9]/.test(p) },
];

/** null if the password satisfies every requirement; otherwise one form-level message naming all of them. */
export function passwordPolicyError(password: string): string | null {
  if (PASSWORD_REQUIREMENTS.every((r) => r.met(password))) return null;
  return `Password must be at least ${MIN_PASSWORD_LENGTH} characters and include upper and lower case letters plus a number or symbol.`;
}

export type PasswordStrength = 'weak' | 'fair' | 'strong';

/** Bucketed by how many requirements are met — feeds the strength bar's fill and word label. */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return 'weak';
  const metCount = PASSWORD_REQUIREMENTS.filter((r) => r.met(password)).length;
  if (metCount >= 3) return 'strong';
  if (metCount === 2) return 'fair';
  return 'weak';
}
