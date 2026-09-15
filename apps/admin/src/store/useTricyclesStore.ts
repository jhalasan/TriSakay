import { create } from 'zustand';
import { listTricycles } from '../services/tricycles';
import type { TricycleRow } from '../types/tricycle';
import type { TricycleCluster, VerificationStatus } from '../types/driver';

/**
 * 'dueSoon' isn't a strip cell — it's the deep-link target from the
 * Dashboard's "Expiring franchises" card, whose count (like
 * v_expiring_franchises) unions lapsed + expiring-within-30-days. The strip
 * keeps those two as separate, mutually exclusive cells for browsing.
 */
export type ExpiryFilter = 'all' | 'lapsed' | 'expiring' | 'ok' | 'dueSoon';

interface TricyclesState {
  tricycles: TricycleRow[];
  loading: boolean;
  error: string | null;
  search: string;
  expiryFilter: ExpiryFilter;
  verificationFilter: VerificationStatus | 'all';
  clusterFilter: TricycleCluster | 'all';
  page: number;
  fetch: () => Promise<void>;
  setSearch: (value: string) => void;
  setExpiryFilter: (value: ExpiryFilter) => void;
  setVerificationFilter: (value: VerificationStatus | 'all') => void;
  setClusterFilter: (value: TricycleCluster | 'all') => void;
  setPage: (page: number) => void;
}

export const useTricyclesStore = create<TricyclesState>()((set) => ({
  tricycles: [],
  loading: false,
  error: null,
  search: '',
  expiryFilter: 'all',
  verificationFilter: 'all',
  clusterFilter: 'all',
  page: 1,

  fetch: async () => {
    set({ loading: true, error: null });
    const { data, error } = await listTricycles();
    set({ tricycles: data, loading: false, error });
  },

  setSearch: (value) => set({ search: value, page: 1 }),
  setExpiryFilter: (value) => set({ expiryFilter: value, page: 1 }),
  setVerificationFilter: (value) => set({ verificationFilter: value, page: 1 }),
  setClusterFilter: (value) => set({ clusterFilter: value, page: 1 }),
  setPage: (page) => set({ page }),
}));
