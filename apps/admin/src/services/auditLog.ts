import { listAccountActions as listAccountActionsShared, listReviewDecisions as listReviewDecisionsShared } from '@trisakay/services';
import type { AccountActionRow, ReviewDecisionRow } from '@trisakay/services';
import type { ServiceResult } from './drivers';

export type { AccountActionRow, ReviewDecisionRow };

/** Thin wrapper over packages/services/src/admin/auditLog.ts, matching this app's one-file-per-feature convention. */
export async function listAccountActions(): Promise<ServiceResult<AccountActionRow[]>> {
  const { data, error } = await listAccountActionsShared();
  return { data, error };
}

export async function listReviewDecisions(): Promise<ServiceResult<ReviewDecisionRow[]>> {
  const { data, error } = await listReviewDecisionsShared();
  return { data, error };
}
