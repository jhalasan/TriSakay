import { MOCK_PSO_USERS } from '../mocks/psoUsers.ts';
import { wait } from '../mocks/delay.ts';
import type { PsoUserRow } from '../types/psoUser';
import type { AdminRole } from '../types/role';
import type { ServiceResult } from './drivers';

let psoUsers = [...MOCK_PSO_USERS];

/** Admin-only screen (FR-6.3). Gated at the route level via RoleGate, not here. */
export async function listPsoUsers(): Promise<ServiceResult<PsoUserRow[]>> {
  await wait();
  return { data: psoUsers, error: null };
}

export async function addPsoUser(input: { fullName: string; email: string; role: AdminRole }): Promise<ServiceResult<null>> {
  await wait();
  psoUsers = [
    ...psoUsers,
    {
      id: `pso-${String(psoUsers.length + 1).padStart(3, '0')}`,
      ...input,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ];
  return { data: null, error: null };
}

export async function togglePsoUserActive(id: string): Promise<ServiceResult<null>> {
  await wait();
  psoUsers = psoUsers.map((u) => (u.id === id ? { ...u, isActive: !u.isActive } : u));
  return { data: null, error: null };
}
