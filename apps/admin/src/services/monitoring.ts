import { getActiveTricycleLocations as getActiveTricycleLocationsShared, listActiveTricyclesForAdmin } from '@trisakay/services';
import type { ActiveTricycleLocationCell } from '@trisakay/services';
import type { ActiveTricycleRow } from '../types/ride';
import type { ServiceResult } from './drivers';

export type { ActiveTricycleLocationCell };

/** Read-only (FR-5.1, 5.2). Location stays coarse per NFR-2.5. */
export async function listActiveTricycles(): Promise<ServiceResult<ActiveTricycleRow[]>> {
  const { data, error } = await listActiveTricyclesForAdmin();
  return { data, error };
}

export async function getActiveTricycleLocations(): Promise<ServiceResult<ActiveTricycleLocationCell[]>> {
  const { data, error } = await getActiveTricycleLocationsShared();
  return { data, error };
}
