// Side-effect import: guarantees initSupabase() has run before getMfaGate() reads the client.
import '../lib/supabase.ts';
import { create } from 'zustand';
import { getMfaGate } from '@trisakay/services';

export type MfaGateStatus = 'unknown' | 'ok' | 'challenge';

interface MfaState {
  status: MfaGateStatus;
  /** Reads the session's MFA level (local, no network). 'challenge' means a verified factor still needs its code. */
  check: () => Promise<void>;
  /** Called after a correct code, once the session is at aal2. */
  markOk: () => void;
  reset: () => void;
}

export const useMfaStore = create<MfaState>()((set) => {
  // A superseded check (the session was replaced while it ran) must not hand its answer to the next user.
  let epoch = 0;

  return {
    status: 'unknown',

    check: async () => {
      const mine = ++epoch;
      const gate = await getMfaGate().catch(() => 'ok' as const);
      if (mine !== epoch) return;
      set({ status: gate });
    },

    markOk: () => {
      epoch++;
      set({ status: 'ok' });
    },

    reset: () => {
      epoch++;
      set({ status: 'unknown' });
    },
  };
});
