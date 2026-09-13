import { getSupabaseClient } from '../supabase/client.ts';

export type AdminPsoRole = 'pso_staff' | 'pso_supervisor' | 'admin';

export interface AdminPsoUserRow {
  id: string;
  fullName: string;
  email: string;
  role: AdminPsoRole;
  isActive: boolean;
  lastSignInAt: string | null;
  createdAt: string;
}

export interface ListPsoUsersForAdminResult {
  data: AdminPsoUserRow[];
  error: string | null;
}

/**
 * FR-6.3 — every PSO-portal account (staff, supervisor, admin), newest
 * first. `lastSignInAt` comes from the admin_list_pso_last_sign_in RPC
 * (SECURITY DEFINER, is_admin()-gated) since auth.users isn't exposed to
 * PostgREST — same reasoning as listPsoUserSessions() below, but bulk since
 * the whole roster needs it at once rather than one account at a time. A
 * failure there degrades every row's lastSignInAt to null instead of
 * failing the roster fetch — sign-in history is a nice-to-have column, not
 * the point of this screen.
 */
export async function listPsoUsersForAdmin(): Promise<ListPsoUsersForAdminResult> {
  const client = getSupabaseClient();

  const [{ data, error }, { data: lastSignIns }] = await Promise.all([
    client
      .from('users')
      .select('id, full_name, email, role, status, created_at')
      .in('role', ['pso_staff', 'pso_supervisor', 'admin'])
      .order('created_at', { ascending: false }),
    client.rpc('admin_list_pso_last_sign_in'),
  ]);

  if (error) return { data: [], error: error.message };

  const lastSignInByUserId = new Map((lastSignIns ?? []).map((row) => [row.user_id, row.last_sign_in_at]));

  const rows: AdminPsoUserRow[] = (data ?? []).map((u) => ({
    id: u.id,
    fullName: u.full_name!,
    email: u.email,
    role: u.role as AdminPsoRole,
    isActive: u.status === 'active',
    lastSignInAt: lastSignInByUserId.get(u.id) ?? null,
    createdAt: u.created_at,
  }));

  return { data: rows, error: null };
}

export interface CreatePsoUserInput {
  firstName: string;
  lastName: string;
  email: string;
  role: AdminPsoRole;
}

export interface CreatePsoUserResult {
  userId: string | null;
  tempPassword: string | null;
  error: string | null;
}

/**
 * Same non-2xx-body-parsing need as createGcashCheckout
 * (packages/services/src/payments/index.ts) — the Supabase JS client's
 * generic FunctionsHttpError doesn't parse the response body itself.
 */
async function extractFunctionErrorMessage(error: { message: string; context?: unknown }): Promise<string> {
  const context = error.context as { json?: () => Promise<unknown> } | undefined;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.json();
      if (body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
        return (body as { error: string }).error;
      }
    } catch {
      // fall through to the generic message below
    }
  }
  return error.message;
}

/**
 * Invokes the admin-create-pso-user Edge Function — creating another
 * person's auth account needs the service-role key, which must never reach
 * this browser client, so this can only happen server-side (FR-6.3, no
 * email/invite infra exists yet — see docs/ADMIN_TODO.MD open decision #3).
 * Returns a one-time temp password for the caller to display once; nothing
 * about it is persisted client-side beyond the returned value itself.
 */
export async function createPsoUserForAdmin(input: CreatePsoUserInput): Promise<CreatePsoUserResult> {
  const { data, error } = await getSupabaseClient().functions.invoke('admin-create-pso-user', {
    body: input,
  });

  if (error) return { userId: null, tempPassword: null, error: await extractFunctionErrorMessage(error) };

  const result = data as CreatePsoUserResult;
  return { userId: result.userId ?? null, tempPassword: result.tempPassword ?? null, error: result.error ?? null };
}

export interface PsoUserSessionRow {
  id: string;
  createdAt: string;
  updatedAt: string;
  userAgent: string | null;
  ip: string | null;
}

export interface ListPsoUserSessionsResult {
  data: PsoUserSessionRow[];
  error: string | null;
}

/**
 * A password change or account disable doesn't invalidate a session the
 * account is already logged into — Supabase's access/refresh tokens stay
 * valid independent of either. Goes through the admin_list_user_sessions
 * RPC (SECURITY DEFINER, is_admin()-gated) since auth.sessions isn't
 * exposed to PostgREST at all.
 */
export async function listPsoUserSessions(userId: string): Promise<ListPsoUserSessionsResult> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('admin_list_user_sessions', { p_user_id: userId });

  if (error) return { data: [], error: error.message };

  const rows: PsoUserSessionRow[] = (data ?? []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userAgent: row.user_agent,
    ip: row.ip as string | null,
  }));

  return { data: rows, error: null };
}

export interface RevokePsoUserSessionResult {
  error: string | null;
}

/** Deletes the session row via admin_revoke_user_session — the same mechanism Supabase Auth itself uses to terminate a session on sign-out. */
export async function revokePsoUserSession(sessionId: string): Promise<RevokePsoUserSessionResult> {
  const { error } = await getSupabaseClient().rpc('admin_revoke_user_session', { p_session_id: sessionId });
  return { error: error?.message ?? null };
}
