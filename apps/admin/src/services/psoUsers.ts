import { createPsoUserForAdmin, listPsoUsersForAdmin, performAccountAction } from '@trisakay/services';
import type { PsoUserRow } from '../types/psoUser';
import type { AdminRole } from '../types/role';
import type { ServiceResult } from './drivers';

/** Admin-only screen (FR-6.3). Gated at the route level via RoleGate, not here. */
export async function listPsoUsers(): Promise<ServiceResult<PsoUserRow[]>> {
  const { data, error } = await listPsoUsersForAdmin();
  if (error) return { data: [], error };

  const rows: PsoUserRow[] = data.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
  }));

  return { data: rows, error: null };
}

export interface AddPsoUserResult {
  tempPassword: string | null;
  error: string | null;
}

export async function addPsoUser(input: { fullName: string; email: string; role: AdminRole }): Promise<AddPsoUserResult> {
  const { tempPassword, error } = await createPsoUserForAdmin(input);
  return { tempPassword, error };
}

/** Reuses the same account_actions-audited RPC as Driver/Passenger Management (perform_account_action doesn't restrict by target role). */
export async function disablePsoUser(id: string, reason: string): Promise<ServiceResult<null>> {
  const { error } = await performAccountAction(id, 'suspend', reason);
  return { data: null, error };
}

export async function enablePsoUser(id: string, reason: string): Promise<ServiceResult<null>> {
  const { error } = await performAccountAction(id, 'reactivate', reason);
  return { data: null, error };
}
