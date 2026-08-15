import { listDriversForAdmin, performAccountAction } from '@trisakay/services';
import type { DriverRow } from '../types/driver';

export interface ServiceResult<T> {
  data: T;
  error: string | null;
}

export async function listDrivers(): Promise<ServiceResult<DriverRow[]>> {
  const { data, error } = await listDriversForAdmin();
  if (error) return { data: [], error };

  const drivers: DriverRow[] = data.map((d) => ({
    id: d.id,
    fullName: d.fullName,
    contactNo: d.contactNo ?? '',
    email: d.email,
    accountStatus: d.accountStatus,
    verificationStatus: d.verificationStatus,
    ratingAvg: d.ratingAvg,
    ratingCount: d.ratingCount,
    plateNo: d.plateNo ?? '—',
    cluster: d.cluster,
    createdAt: d.createdAt,
  }));

  return { data: drivers, error: null };
}

/** PSO Staff+ action — no S+ gate required (docs/CONTEXT.MD §6). */
export async function flagDriver(driverId: string, reason: string): Promise<ServiceResult<null>> {
  const { error } = await performAccountAction(driverId, 'flag', reason);
  return { data: null, error };
}

/** S+ action — PSO Supervisor/Admin only (FR-6.2). */
export async function suspendDriver(driverId: string, reason: string): Promise<ServiceResult<null>> {
  const { error } = await performAccountAction(driverId, 'suspend', reason);
  return { data: null, error };
}

/** S+ action — reverses a suspend/flag. */
export async function reactivateDriver(driverId: string, reason: string): Promise<ServiceResult<null>> {
  const { error } = await performAccountAction(driverId, 'reactivate', reason);
  return { data: null, error };
}
