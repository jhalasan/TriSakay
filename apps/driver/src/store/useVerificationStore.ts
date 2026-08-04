import '../lib/supabase';
import { create } from 'zustand';
import { getDriverVerificationStatus, type VerificationStatus } from '@trisakay/services';
import { REQUEST_TIMEOUT_MS, withTimeout } from '../utils/withTimeout';

/** Collapses the four DB statuses into what the app gate cares about: only 'approved' unblocks entry. */
export type VerificationGateStatus = 'unknown' | 'checking' | 'approved' | 'pending' | 'rejected';

const TIMEOUT_MESSAGE = 'Verification check timed out';

interface VerificationState {
  status: VerificationGateStatus;
  error: string | null;
  check: () => Promise<void>;
  reset: () => void;
}

function toGateStatus(status: VerificationStatus): VerificationGateStatus {
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  return 'pending'; // 'unsubmitted' | 'pending' both read as "not cleared to enter yet"
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

        set({ status: toGateStatus(status), error: null });
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
