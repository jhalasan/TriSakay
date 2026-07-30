/**
 * Races `promise` against a timeout so a request that establishes a
 * connection but never responds (captive portal, dead rural link) cannot hang
 * forever. React Native's fetch has no default timeout of its own, so without
 * this a pending request has no upper bound at all.
 *
 * Clears the timer on either outcome so the success path never leaks a
 * pending timeout.
 *
 * Lives here rather than in either store because both useConsentStore and
 * useAuthStore need it, and a store importing another store's internals would
 * couple two gates that are deliberately independent.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message = 'Request timed out'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Upper bound for a single network request made behind a blocking gate.
 * 10s matches the upper end of NFR-1's 5-10s envelope for normal operations.
 */
export const REQUEST_TIMEOUT_MS = 10_000;
