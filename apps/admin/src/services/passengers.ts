import { listPassengersForAdmin, performAccountAction } from '@trisakay/services';
import type { PassengerRow } from '../types/passenger';
import type { ServiceResult } from './drivers';

export async function listPassengers(): Promise<ServiceResult<PassengerRow[]>> {
  const { data, error } = await listPassengersForAdmin();
  if (error) return { data: [], error };

  const passengers: PassengerRow[] = data.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    contactNo: p.contactNo ?? '',
    email: p.email,
    accountStatus: p.accountStatus,
    totalRides: p.totalRides,
    hasApprovedDiscount: p.hasApprovedDiscount,
    createdAt: p.createdAt,
  }));

  return { data: passengers, error: null };
}

/** S+ action. Wireframe label "Block" -> account_status='suspended' (FR-6.2). */
export async function blockPassenger(passengerId: string, reason: string): Promise<ServiceResult<null>> {
  const { error } = await performAccountAction(passengerId, 'suspend', reason);
  return { data: null, error };
}

/** S+ action. Wireframe label "Unblock" -> account_status='active'. */
export async function unblockPassenger(passengerId: string, reason: string): Promise<ServiceResult<null>> {
  const { error } = await performAccountAction(passengerId, 'reactivate', reason);
  return { data: null, error };
}
