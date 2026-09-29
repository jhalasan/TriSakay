import { create } from 'zustand';
import { listAccountActions, listLoginEvents, listReviewDecisions } from '../services/auditLog';
import type { AccountActionRow, LoginEventRow, ReviewDecisionRow } from '../services/auditLog';
import { getFareConfigHistory } from '../services/settings';
import type { FareConfigHistoryRow } from '../services/settings';
import { listRideMessageViewLog } from '../services/rideChat';
import type { RideMessageViewLogRow } from '../services/rideChat';

interface AuditLogState {
  actions: AccountActionRow[];
  loading: boolean;
  error: string | null;
  /** P1-22 (2026-09-15 launch audit): true when the server-side row cap was hit for the current date range — see listAccountActions. */
  truncated: boolean;
  decisions: ReviewDecisionRow[];
  decisionsLoading: boolean;
  /** UAT A1 — login/logout audit trail, same date-range scoping as actions above. */
  loginEvents: LoginEventRow[];
  loginEventsLoading: boolean;
  loginEventsTruncated: boolean;
  /** UAT A16 — fare_config's version history, not date-range scoped (it's naturally bounded — one row per amendment, never many). */
  fareHistory: FareConfigHistoryRow[];
  fareHistoryLoading: boolean;
  /** S1 — every PSO read of a ride's chat thread (admin_view_ride_messages), same date-range scoping as actions above. */
  rideMessageViews: RideMessageViewLogRow[];
  rideMessageViewsLoading: boolean;
  rideMessageViewsTruncated: boolean;
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
  loginEvents: [],
  loginEventsLoading: false,
  loginEventsTruncated: false,
  fareHistory: [],
  fareHistoryLoading: false,
  rideMessageViews: [],
  rideMessageViewsLoading: false,
  rideMessageViewsTruncated: false,

  fetch: async (days) => {
    set({ loading: true, decisionsLoading: true, loginEventsLoading: true, fareHistoryLoading: true, rideMessageViewsLoading: true, error: null });
    const [
      { data: actions, error: actionsError, truncated },
      { data: decisions, error: decisionsError },
      { data: loginEvents, error: loginEventsError, truncated: loginEventsTruncated },
      { data: fareHistory, error: fareHistoryError },
      { data: rideMessageViews, error: rideMessageViewsError, truncated: rideMessageViewsTruncated },
    ] = await Promise.all([
      listAccountActions(sinceIsoForDays(days)),
      listReviewDecisions(),
      listLoginEvents(sinceIsoForDays(days)),
      getFareConfigHistory(),
      listRideMessageViewLog(sinceIsoForDays(days)),
    ]);
    set({
      actions,
      loading: false,
      truncated,
      decisions,
      decisionsLoading: false,
      loginEvents,
      loginEventsLoading: false,
      loginEventsTruncated,
      fareHistory,
      fareHistoryLoading: false,
      rideMessageViews,
      rideMessageViewsLoading: false,
      rideMessageViewsTruncated,
      error: actionsError ?? decisionsError ?? loginEventsError ?? fareHistoryError ?? rideMessageViewsError,
    });
  },
}));
