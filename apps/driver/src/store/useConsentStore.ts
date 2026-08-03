import '../lib/supabase';
import { create } from 'zustand';
import { getConsentStatus, recordConsent } from '@trisakay/services';
import { REQUEST_TIMEOUT_MS, withTimeout } from '../utils/withTimeout';

export type ConsentGateStatus = 'unknown' | 'checking' | 'accepted' | 'required';

const TIMEOUT_MESSAGE = 'Consent check timed out';
const UNVERIFIED_MESSAGE = 'Could not verify your acceptance.';

interface ConsentState {
  status: ConsentGateStatus;
  error: string | null;
  check: () => Promise<void>;
  accept: () => Promise<boolean>;
  reset: () => void;
}

export const useConsentStore = create<ConsentState>()((set) => {
  let requestEpoch = 0;

  return {
    status: 'unknown',
    error: null,

    check: async () => {
      const epoch = ++requestEpoch;
      set({ status: 'checking', error: null });

      try {
        const { status, error } = await withTimeout(getConsentStatus(), REQUEST_TIMEOUT_MS, TIMEOUT_MESSAGE);
        if (epoch !== requestEpoch) return;

        if (error || !status) {
          set({ status: 'required', error: error ?? UNVERIFIED_MESSAGE });
          return;
        }

        set({ status: status.bothAccepted ? 'accepted' : 'required', error: null });
      } catch {
        if (epoch !== requestEpoch) return;
        set({ status: 'required', error: UNVERIFIED_MESSAGE });
      }
    },

    accept: async () => {
      const epoch = ++requestEpoch;
      set({ error: null });

      let error: string | null;
      try {
        ({ error } = await withTimeout(recordConsent(), REQUEST_TIMEOUT_MS, TIMEOUT_MESSAGE));
      } catch {
        error = UNVERIFIED_MESSAGE;
      }

      if (epoch !== requestEpoch) {
        set({ error: UNVERIFIED_MESSAGE });
        return false;
      }

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
