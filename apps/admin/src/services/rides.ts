import { listRideLogForAdmin } from '@trisakay/services';
import type { RideLogRow } from '../types/ride';
import type { ServiceResult } from './drivers';
import { dateRangeSinceIso, type ReportDateRange } from './reports';

export interface ListRideLogResult extends ServiceResult<RideLogRow[]> {
  truncated: boolean;
}

export async function listRideLog(range: ReportDateRange): Promise<ListRideLogResult> {
  const { data, error, truncated } = await listRideLogForAdmin(dateRangeSinceIso(range));
  return { data, error, truncated };
}
