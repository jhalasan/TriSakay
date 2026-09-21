import {
  listAccountActions as listAccountActionsShared,
  listLoginEvents as listLoginEventsShared,
  listReviewDecisions as listReviewDecisionsShared,
} from '@trisakay/services';
import type { AccountActionRow, LoginEventRow, ReviewDecisionRow } from '@trisakay/services';
import type { ServiceResult } from './drivers';

export type { AccountActionRow, LoginEventRow, ReviewDecisionRow };

export interface ListAccountActionsResult extends ServiceResult<AccountActionRow[]> {
  /** P1-22 (2026-09-15 launch audit) — see listAccountActions in packages/services. */
  truncated: boolean;
}

export interface ListLoginEventsResult extends ServiceResult<LoginEventRow[]> {
  truncated: boolean;
}

/**
 * Thin wrapper over packages/services/src/admin/auditLog.ts, matching this
 * app's one-file-per-feature convention. `sinceIso` (null = all time) scopes
 * the query server-side — see the shared function's own doc comment.
 */
export async function listAccountActions(sinceIso: string | null = null): Promise<ListAccountActionsResult> {
  const { data, error, truncated } = await listAccountActionsShared(sinceIso);
  return { data, error, truncated };
}

export async function listReviewDecisions(): Promise<ServiceResult<ReviewDecisionRow[]>> {
  const { data, error } = await listReviewDecisionsShared();
  return { data, error };
}

/** UAT A1 — login/logout audit trail, same sinceIso/truncated shape as listAccountActions above. */
export async function listLoginEvents(sinceIso: string | null = null): Promise<ListLoginEventsResult> {
  const { data, error, truncated } = await listLoginEventsShared(sinceIso);
  return { data, error, truncated };
}
