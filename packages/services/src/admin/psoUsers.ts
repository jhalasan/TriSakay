import { getSupabaseClient } from '../supabase/client.ts';

export type AdminPsoRole = 'pso_staff' | 'pso_supervisor' | 'admin';

export interface AdminPsoUserRow {
  id: string;
  fullName: string;
  email: string;
  role: AdminPsoRole;
  isActive: boolean;
  createdAt: string;
}

export interface ListPsoUsersForAdminResult {
  data: AdminPsoUserRow[];
  error: string | null;
}

/** FR-6.3 — every PSO-portal account (staff, supervisor, admin), newest first. */
export async function listPsoUsersForAdmin(): Promise<ListPsoUsersForAdminResult> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('users')
    .select('id, full_name, email, role, status, created_at')
    .in('role', ['pso_staff', 'pso_supervisor', 'admin'])
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message };

  const rows: AdminPsoUserRow[] = (data ?? []).map((u) => ({
    id: u.id,
    fullName: u.full_name,
    email: u.email,
    role: u.role as AdminPsoRole,
    isActive: u.status === 'active',
    createdAt: u.created_at,
  }));

  return { data: rows, error: null };
}

export interface CreatePsoUserInput {
  fullName: string;
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
