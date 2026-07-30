import { create } from 'zustand';
import { getConsentStatus, recordConsent } from '@trisakay/services';

export type ConsentGateStatus = 'unknown' | 'checking' | 'accepted' | 'required';

// React Native's fetch has no default timeout, so a connection that
// establishes but never responds (captive portal, dead rural link) would
// otherwise leave check() pending indefinitely. 10s matches the upper end of
// NFR-1's 5-10s envelope for normal operations.
const CHECK_TIMEOUT_MS = 10_000;

/**
 * Races `promise` against a timeout so a request that establishes a
 * connection but never responds (captive portal, dead link) cannot hang
 * forever. Clears the timer on either outcome so the success path never
 * leaks a pending timeout.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Consent check timed out')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

interface ConsentState {
  status: ConsentGateStatus;
  error: string | null;
  check: () => Promise<void>;
  /** Resolves true only on a confirmed write — never optimistically. */
  accept: () => Promise<boolean>;
  reset: () => void;
}

export const useConsentStore = create<ConsentState>()((set) => ({
  status: 'unknown',
  error: null,

  check: async () => {
    // Set synchronously so concurrent callers (the root layout and the splash
    // screen both trigger this on cold start) see 'checking' and skip.
    set({ status: 'checking', error: null });

    try {
      const { status, error } = await withTimeout(getConsentStatus(), CHECK_TIMEOUT_MS);

      if (error || !status) {
        // Fail closed. An unverifiable consent state is treated as not accepted,
        // so a network blip can never let a user past a legal gate. Re-accepting
        // costs nothing — user_consents is append-only.
        set({ status: 'required', error: error ?? 'Could not verify your acceptance.' });
        return;
      }

      set({ status: status.bothAccepted ? 'accepted' : 'required', error: null });
    } catch {
      // A rejected getConsentStatus() (or the timeout above) must land in the
      // same fail-closed branch as a returned { error } — otherwise `status`
      // is stuck on 'checking' forever and both call sites (which await/hold
      // on this store with no deadline of their own) strand the user.
      set({ status: 'required', error: 'Could not verify your acceptance.' });
    }
  },

  accept: async () => {
    set({ error: null });
    const { error } = await recordConsent();
    if (error) {
      set({ error });
      return false;
    }
    set({ status: 'accepted', error: null });
    return true;
  },

  reset: () => set({ status: 'unknown', error: null }),
}));
