import { create } from 'zustand';
import { listAccountActions, listReviewDecisions } from '../services/auditLog';
import type { AccountActionRow, ReviewDecisionRow } from '../services/auditLog';

interface AuditLogState {
  actions: AccountActionRow[];
  loading: boolean;
  error: string | null;
  decisions: ReviewDecisionRow[];
  decisionsLoading: boolean;
  fetch: () => Promise<void>;
}

export const useAuditLogStore = create<AuditLogState>()((set) => ({
  actions: [],
  loading: false,
  error: null,
  decisions: [],
  decisionsLoading: false,

  fetch: async () => {
    set({ loading: true, decisionsLoading: true, error: null });
    const [{ data: actions, error: actionsError }, { data: decisions, error: decisionsError }] = await Promise.all([
      listAccountActions(),
      listReviewDecisions(),
    ]);
    set({
      actions,
      loading: false,
      decisions,
      decisionsLoading: false,
      error: actionsError ?? decisionsError,
    });
  },
}));
