import { listActiveTricyclesForAdmin } from '@trisakay/services';
import type { ActiveTricycleRow } from '../types/ride';
import type { ServiceResult } from './drivers';

/** Read-only (FR-5.1, 5.2). Location stays coarse per NFR-2.5. */
export async function listActiveTricycles(): Promise<ServiceResult<ActiveTricycleRow[]>> {
  const { data, error } = await listActiveTricyclesForAdmin();
  return { data, error };
}
