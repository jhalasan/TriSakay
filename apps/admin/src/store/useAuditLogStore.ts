import { create } from 'zustand';
import { listAccountActions, listReviewDecisions } from '../services/auditLog';
import type { AccountActionRow, ReviewDecisionRow } from '../services/auditLog';

interface AuditLogState {
  actions: AccountActionRow[];
  loading: boolean;
  error: string | null;
  /** P1-22 (2026-09-15 launch audit): true when the server-side row cap was hit for the current date range — see listAccountActions. */
  truncated: boolean;
  decisions: ReviewDecisionRow[];
  decisionsLoading: boolean;
  /**
   * `days`: '7' | '30' | 'all', mirrors AuditLog.tsx's date-range filter.
   * P1-22 (2026-09-15 launch audit): this used to fetch the entire table
   * once and filter the date range client-side — now the range is applied
   * server-side, so re-fetch (not just re-filter) whenever it changes.
   */
  fetch: (days: string) => Promise<void>;
}

function sinceIsoForDays(days: string): string | null {
  if (days === 'all') return null;
  return new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000).toISOString();
}

export const useAuditLogStore = create<AuditLogState>()((set) => ({
  actions: [],
  loading: false,
  error: null,
  truncated: false,
  decisions: [],
  decisionsLoading: false,

  fetch: async (days) => {
    set({ loading: true, decisionsLoading: true, error: null });
    const [{ data: actions, error: actionsError, truncated }, { data: decisions, error: decisionsError }] = await Promise.all([
      listAccountActions(sinceIsoForDays(days)),
      listReviewDecisions(),
    ]);
    set({
      actions,
      loading: false,
      truncated,
      decisions,
      decisionsLoading: false,
      error: actionsError ?? decisionsError,
    });
  },
}));
