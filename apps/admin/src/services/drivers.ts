import { MOCK_DRIVERS } from '../mocks/drivers.ts';
import { wait } from '../mocks/delay.ts';
import type { DriverRow } from '../types/driver';

/**
 * Mock-backed service layer. Function signatures are shaped to match the
 * eventual Supabase queries against `users` + `driver_profiles` +
 * `tricycles` (docs/SCHEMA.MD) — e.g. listDrivers() will become a
 * `.from('users').select(...)` join, flagDriver()/suspendDriver() will
 * become inserts into `account_actions` alongside a `users.status` update
 * (FR-6.2). No Supabase import here — this pass is frontend-only.
 */
let drivers = [...MOCK_DRIVERS];

export interface ServiceResult<T> {
  data: T;
  error: string | null;
}

export async function listDrivers(): Promise<ServiceResult<DriverRow[]>> {
  await wait();
  return { data: drivers, error: null };
}

/** PSO Staff+ action — no S+ gate required (docs/CONTEXT.MD §6). */
export async function flagDriver(driverId: string): Promise<ServiceResult<null>> {
  await wait();
  drivers = drivers.map((d) => (d.id === driverId ? { ...d, accountStatus: 'flagged' } : d));
  return { data: null, error: null };
}

/** S+ action — PSO Supervisor/Admin only (FR-6.2). */
export async function suspendDriver(driverId: string): Promise<ServiceResult<null>> {
  await wait();
  drivers = drivers.map((d) => (d.id === driverId ? { ...d, accountStatus: 'suspended' } : d));
  return { data: null, error: null };
}

/** S+ action — reverses a suspend/flag. */
export async function reactivateDriver(driverId: string): Promise<ServiceResult<null>> {
  await wait();
  drivers = drivers.map((d) => (d.id === driverId ? { ...d, accountStatus: 'active' } : d));
  return { data: null, error: null };
}
