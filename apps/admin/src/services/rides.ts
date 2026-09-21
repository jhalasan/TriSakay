import { listRideLogForAdmin } from '@trisakay/services';
import type { RideLogRow } from '../types/ride';
import type { ServiceResult } from './drivers';
import { dateRangeSinceIso, type ReportDateRange } from './reports';

export async function listRideLog(range: ReportDateRange): Promise<ServiceResult<RideLogRow[]>> {
  const { data, error } = await listRideLogForAdmin(dateRangeSinceIso(range));
  return { data, error };
}
