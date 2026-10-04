// Sign in lockout rules, kept free of any database or network code so they can
// be tested on their own. The sign-in function reads the recent attempts for
// an email and asks these functions what to do.
//
// Rule: 5 wrong passwords for the same email inside any 15 minute window lock
// sign-in for that email until the oldest of those failures leaves the window.
// A successful sign in clears the earlier failures. Unknown emails are counted
// exactly the same way, so the lock never reveals whether an account exists.

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_WINDOW_MS = 15 * 60 * 1000;

/** One network address may send this many attempts in the window below, whoever they are for. */
export const IP_MAX_ATTEMPTS = 30;
export const IP_WINDOW_MS = 10 * 60 * 1000;

export interface AttemptRow {
  success: boolean;
  createdAtMs: number;
}

export interface LockState {
  locked: boolean;
  /** Seconds until sign in is allowed again; 0 when not locked. */
  retryAfterSeconds: number;
  attemptsLeft: number;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Failure times (ms) since the most recent success. `rows` must be newest first. */
export function failuresSinceLastSuccess(rows: AttemptRow[]): number[] {
  const failures: number[] = [];
  for (const row of rows) {
    if (row.success) break;
    failures.push(row.createdAtMs);
  }
  return failures;
}

export function lockState(failureTimesMs: number[], nowMs: number): LockState {
  const recent = failureTimesMs.filter((t) => nowMs - t < LOCK_WINDOW_MS).sort((a, b) => a - b);

  if (recent.length >= MAX_FAILED_ATTEMPTS) {
    // The lock ends when enough old failures leave the window to drop the count below the limit.
    const releasing = recent[recent.length - MAX_FAILED_ATTEMPTS];
    const retryAfterSeconds = Math.max(1, Math.ceil((releasing + LOCK_WINDOW_MS - nowMs) / 1000));
    return { locked: true, retryAfterSeconds, attemptsLeft: 0 };
  }

  return { locked: false, retryAfterSeconds: 0, attemptsLeft: MAX_FAILED_ATTEMPTS - recent.length };
}

export function lockMessage(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many failed sign in attempts. Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`;
}

export function ipIsThrottled(attemptsInWindow: number): boolean {
  return attemptsInWindow >= IP_MAX_ATTEMPTS;
}
