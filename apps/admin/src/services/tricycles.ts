import { listTricyclesForAdmin } from '@trisakay/services';
import type { TricycleRow } from '../types/tricycle';
import type { ServiceResult } from './drivers';

export async function listTricycles(): Promise<ServiceResult<TricycleRow[]>> {
  const { data, error } = await listTricyclesForAdmin();
  if (error) return { data: [], error };

  const tricycles: TricycleRow[] = data.map((t) => ({
    id: t.id,
    driverId: t.driverId,
    driverName: t.driverName ?? 'Unknown',
    driverContactNo: t.driverContactNo ?? '',
    driverAccountStatus: t.driverAccountStatus,
    plateNo: t.plateNo,
    bodyNo: t.bodyNo ?? '',
    seatCapacity: t.seatCapacity,
    cluster: t.cluster,
    verificationStatus: t.verificationStatus,
    mtopNo: t.mtopNo ?? '',
    mtopExpiryDate: t.mtopExpiryDate,
    createdAt: t.createdAt,
  }));

  return { data: tricycles, error: null };
}
