import type { AdminRole } from '../types/role';

/**
 * Render-time RBAC predicates for the admin portal.
 *
 * These mirror the DB-side RLS helpers in docs/SCHEMA.MD §7 exactly
 * (public.is_pso() / public.is_supervisor() / public.is_admin()), so the UI
 * gate and the real enforcement layer agree by construction once wired.
 * UI gating here is UX only — it hides controls; it never substitutes for
 * server-side RLS.
 *
 * Wireframe convention: controls marked "S+" (Verify, Suspend, Approve,
 * Reject, Block, Unblock) require isSupervisor(). PSO Staff sees read/triage
 * actions only (View, Flag). Admin-only screens (PSO user management,
 * System settings) require isAdmin().
 */
export const isPso = (_role: AdminRole): boolean => true; // any signed-in admin-portal user

export const isSupervisor = (role: AdminRole): boolean =>
  role === 'pso_supervisor' || role === 'admin';

export const isAdmin = (role: AdminRole): boolean => role === 'admin';

export type RoleGateLevel = 'staff' | 'supervisor' | 'admin';

export function meetsRoleGate(role: AdminRole, min: RoleGateLevel): boolean {
  if (min === 'staff') return isPso(role);
  if (min === 'supervisor') return isSupervisor(role);
  return isAdmin(role);
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  pso_staff: 'PSO Staff',
  pso_supervisor: 'PSO Supervisor',
  admin: 'Administrator',
};
