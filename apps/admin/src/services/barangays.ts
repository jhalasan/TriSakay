import {
  countRideRequestsForBarangay,
  createBarangayForAdmin,
  deleteBarangayForAdmin,
  listBarangaysForAdmin,
  updateBarangayForAdmin,
} from '@trisakay/services';
import type { BarangayInput, BarangayRow, TricycleCluster } from '@trisakay/services';
import type { ServiceResult } from './drivers';

export type { BarangayInput, BarangayRow, TricycleCluster };

/** Thin wrapper over packages/services/src/admin/barangays.ts, matching this app's one-file-per-feature convention. */
export async function listBarangays(): Promise<ServiceResult<BarangayRow[]>> {
  const { data, error } = await listBarangaysForAdmin();
  return { data, error };
}

export async function createBarangay(input: BarangayInput): Promise<ServiceResult<null>> {
  const { error } = await createBarangayForAdmin(input);
  return { data: null, error };
}

export async function updateBarangay(id: string, input: BarangayInput): Promise<ServiceResult<null>> {
  const { error } = await updateBarangayForAdmin(id, input);
  return { data: null, error };
}

export async function deleteBarangay(id: string): Promise<ServiceResult<null>> {
  const { error } = await deleteBarangayForAdmin(id);
  return { data: null, error };
}

/** UAT A19 — the real "how many ride requests reference this barangay" count shown before delete. */
export async function countBarangayRideRequests(barangayId: string): Promise<ServiceResult<number | null>> {
  const { rideRequestCount, error } = await countRideRequestsForBarangay(barangayId);
  return { data: rideRequestCount, error };
}
