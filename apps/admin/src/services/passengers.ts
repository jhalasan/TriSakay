import { MOCK_PASSENGERS } from '../mocks/passengers.ts';
import { wait } from '../mocks/delay.ts';
import type { PassengerRow } from '../types/passenger';
import type { ServiceResult } from './drivers';

let passengers = [...MOCK_PASSENGERS];

export async function listPassengers(): Promise<ServiceResult<PassengerRow[]>> {
  await wait();
  return { data: passengers, error: null };
}

/** S+ action. Wireframe label "Block" -> account_status='suspended' (FR-6.2). */
export async function blockPassenger(passengerId: string): Promise<ServiceResult<null>> {
  await wait();
  passengers = passengers.map((p) => (p.id === passengerId ? { ...p, accountStatus: 'suspended' } : p));
  return { data: null, error: null };
}

/** S+ action. Wireframe label "Unblock" -> account_status='active'. */
export async function unblockPassenger(passengerId: string): Promise<ServiceResult<null>> {
  await wait();
  passengers = passengers.map((p) => (p.id === passengerId ? { ...p, accountStatus: 'active' } : p));
  return { data: null, error: null };
}
