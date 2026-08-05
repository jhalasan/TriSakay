import type { ReactNode } from 'react';
import { useSessionStore } from '../../store/useSessionStore';
import { meetsRoleGate, type RoleGateLevel } from '../../lib/rbac';

export interface RoleGateProps {
  /** Minimum role required to render children — 'staff' (any signed-in PSO user), 'supervisor' (S+ actions), or 'admin' (PSO user management, System settings). */
  min: RoleGateLevel;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Render-time RBAC wrapper for the wireframe's "S+"-marked controls
 * (Verify, Suspend, Approve, Reject, Block, Unblock) and Admin-only
 * screens. This is UX only — it hides a control, it never substitutes for
 * the server-side RLS enforcement described in docs/SCHEMA.MD §7
 * (is_pso() / is_supervisor() / is_admin()).
 */
export function RoleGate({ min, children, fallback = null }: RoleGateProps) {
  const role = useSessionStore((state) => state.user?.role);
  if (!role || !meetsRoleGate(role, min)) return <>{fallback}</>;
  return <>{children}</>;
}
