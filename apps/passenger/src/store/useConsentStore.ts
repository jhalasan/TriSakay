import { create } from 'zustand';
import { getConsentStatus, recordConsent } from '@trisakay/services';

export type ConsentGateStatus = 'unknown' | 'checking' | 'accepted' | 'required';

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

    const { status, error } = await getConsentStatus();

    if (error || !status) {
      // Fail closed. An unverifiable consent state is treated as not accepted,
      // so a network blip can never let a user past a legal gate. Re-accepting
      // costs nothing — user_consents is append-only.
      set({ status: 'required', error: error ?? 'Could not verify your acceptance.' });
      return;
    }

    set({ status: status.bothAccepted ? 'accepted' : 'required', error: null });
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
