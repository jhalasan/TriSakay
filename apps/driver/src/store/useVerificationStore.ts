import '../lib/supabase.ts';
import { create } from 'zustand';
import { getDriverVerificationStatus } from '@trisakay/services';
import { REQUEST_TIMEOUT_MS, withTimeout } from '../utils/withTimeout.ts';

/**
 * Mirrors the four DB statuses directly rather than collapsing 'unsubmitted'
 * into 'pending' — the gate (useProtectedRoute) still treats anything but
 * 'approved' as "not cleared to enter yet", but verification-pending.tsx
 * needs to tell the two apart: 'unsubmitted' means the driver never got to
 * upload documents (e.g. registered on the check_email path) and shows an
 * upload form there instead of "your documents are under review" copy.
 */
export type VerificationGateStatus = 'unknown' | 'checking' | 'approved' | 'unsubmitted' | 'pending' | 'rejected';

const TIMEOUT_MESSAGE = 'Verification check timed out';

interface VerificationState {
  status: VerificationGateStatus;
  error: string | null;
  check: () => Promise<void>;
  reset: () => void;
}

export const useVerificationStore = create<VerificationState>()((set) => {
  let requestEpoch = 0;

  return {
    status: 'unknown',
    error: null,

    check: async () => {
      const epoch = ++requestEpoch;
      set({ status: 'checking', error: null });

      try {
        const { status, error } = await withTimeout(getDriverVerificationStatus(), REQUEST_TIMEOUT_MS, TIMEOUT_MESSAGE);
        if (epoch !== requestEpoch) return;

        if (error || !status) {
          set({ status: 'pending', error });
          return;
        }

        set({ status, error: null });
      } catch {
        if (epoch !== requestEpoch) return;
        set({ status: 'pending', error: TIMEOUT_MESSAGE });
      }
    },

    reset: () => {
      requestEpoch++;
      set({ status: 'unknown', error: null });
    },
  };
});
