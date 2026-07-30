// Side-effect import: guarantees initSupabase() has run before any action here
// calls getSupabaseClient(). Mirrors useAuthStore — without it this store is
// only safe because some other module happened to be imported first, and a
// deep link straight to /consent breaks that assumption.
import '../lib/supabase';
import { create } from 'zustand';
import { getConsentStatus, recordConsent } from '@trisakay/services';

export type ConsentGateStatus = 'unknown' | 'checking' | 'accepted' | 'required';

// React Native's fetch has no default timeout, so a connection that
// establishes but never responds (captive portal, dead rural link) would
// otherwise leave a request pending indefinitely — check() stuck on 'checking',
// or accept() stuck with its button spinning on a gate that has no way back.
// 10s matches the upper end of NFR-1's 5-10s envelope for normal operations.
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * The single user-facing failure message. Both a failed verification and a
 * failed write say the same thing because they mean the same thing to the
 * user: the app could not confirm their acceptance, and retrying is safe
 * (`user_consents` is append-only).
 */
const UNVERIFIED_MESSAGE = 'Could not verify your acceptance.';

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

export const useConsentStore = create<ConsentState>()((set) => {
  // Staleness guard, mirroring useAuthStore's authEpoch. Every request claims
  // a new epoch synchronously and applies its result only while that epoch is
  // still current; reset() bumps it without starting anything. Without this, a
  // check() started for user A can land after A's session has been replaced —
  // by a second sign-in on the same client, which fires SIGNED_IN without
  // isAuthenticated ever flipping — and hand A's verdict to whoever is signed
  // in now. On a legal gate that means a user reaching Home with no consent
  // rows at all.
  //
  // Dropping a superseded write means nothing re-settles `status` on its own,
  // so every waiter must have an escape that does not depend on the stale
  // request landing. See splash.tsx's waitUntilConsentResolved, which also
  // resolves when the session drops.
  let requestEpoch = 0;

  return {
    status: 'unknown',
    error: null,

    check: async () => {
      const epoch = ++requestEpoch;
      // Set synchronously so concurrent callers (the root layout and the splash
      // screen both trigger this on cold start) see 'checking' and skip.
      set({ status: 'checking', error: null });

      try {
        const { status, error } = await withTimeout(getConsentStatus(), REQUEST_TIMEOUT_MS);
        if (epoch !== requestEpoch) return; // superseded: a different user's answer now

        if (error || !status) {
          // Fail closed. An unverifiable consent state is treated as not accepted,
          // so a network blip can never let a user past a legal gate. Re-accepting
          // costs nothing — user_consents is append-only.
          set({ status: 'required', error: error ?? UNVERIFIED_MESSAGE });
          return;
        }

        set({ status: status.bothAccepted ? 'accepted' : 'required', error: null });
      } catch {
        // A rejected getConsentStatus() (or the timeout above) must land in the
        // same fail-closed branch as a returned { error } — otherwise `status`
        // is stuck on 'checking' forever and both call sites (which await/hold
        // on this store with no deadline of their own) strand the user.
        if (epoch !== requestEpoch) return;
        set({ status: 'required', error: UNVERIFIED_MESSAGE });
      }
    },

    accept: async () => {
      const epoch = ++requestEpoch;
      set({ error: null });

      let error: string | null;
      try {
        ({ error } = await withTimeout(recordConsent(), REQUEST_TIMEOUT_MS));
      } catch {
        // recordConsent() rejecting rather than returning { error } — a throwing
        // getSupabaseClient(), a rejected auth.getSession(), a fetch-level
        // failure, or the timeout above — must not propagate. The caller awaits
        // this inside its submit handler, and a rejection there leaves the only
        // button on a screen with no back navigation spinning forever.
        error = UNVERIFIED_MESSAGE;
      }

      // The session this write was made for is gone (sign-out mid-submit).
      // Report failure rather than marking a stale identity accepted.
      if (epoch !== requestEpoch) return false;

      if (error) {
        set({ error });
        return false;
      }
      set({ status: 'accepted', error: null });
      return true;
    },

    reset: () => {
      requestEpoch++;
      set({ status: 'unknown', error: null });
    },
  };
});
