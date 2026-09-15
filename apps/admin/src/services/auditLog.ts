import { listAccountActions as listAccountActionsShared, listReviewDecisions as listReviewDecisionsShared } from '@trisakay/services';
import type { AccountActionRow, ReviewDecisionRow } from '@trisakay/services';
import type { ServiceResult } from './drivers';

export type { AccountActionRow, ReviewDecisionRow };

export interface ListAccountActionsResult extends ServiceResult<AccountActionRow[]> {
  /** P1-22 (2026-09-15 launch audit) — see listAccountActions in packages/services. */
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
