/**
 * Admin-portal-facing roles — the three of the five docs/CONTEXT.MD §6
 * `user_role` values that can sign in to this app. Passenger/Driver never
 * reach the admin portal.
 */
export type AdminRole = 'pso_staff' | 'pso_supervisor' | 'admin';

export interface AdminSessionUser {
  id: string;
  fullName: string;
  email: string;
  role: AdminRole;
  avatarUrl?: string;
}
