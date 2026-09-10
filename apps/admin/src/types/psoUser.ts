import type { AdminRole } from './role';

/** Mirrors docs/SCHEMA.MD `users` where role in ('pso_staff','pso_supervisor','admin'). */
export interface PsoUserRow {
  id: string;
  fullName: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  lastSignInAt: string | null;
  createdAt: string;
}
