import { listAccountActions as listAccountActionsShared } from '@trisakay/services';
import type { AccountActionRow } from '@trisakay/services';
import type { ServiceResult } from './drivers';

export type { AccountActionRow };

/** Thin wrapper over packages/services/src/admin/auditLog.ts, matching this app's one-file-per-feature convention. */
export async function listAccountActions(): Promise<ServiceResult<AccountActionRow[]>> {
  const { data, error } = await listAccountActionsShared();
  return { data, error };
}
