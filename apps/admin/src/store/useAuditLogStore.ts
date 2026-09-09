import { create } from 'zustand';
import { listAccountActions } from '../services/auditLog';
import type { AccountActionRow } from '../services/auditLog';

interface AuditLogState {
  actions: AccountActionRow[];
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
}

export const useAuditLogStore = create<AuditLogState>()((set) => ({
  actions: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    const { data, error } = await listAccountActions();
    set({ actions: data, loading: false, error });
  },
}));
