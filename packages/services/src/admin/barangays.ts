import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export type TricycleCluster = Database['public']['Enums']['tricycle_cluster'];

export interface BarangayRow {
  id: string;
  name: string;
  cluster: TricycleCluster | null;
  isSplit: boolean;
  notes: string | null;
  updatedAt: string | null;
  updatedByName: string | null;
}

export interface ListBarangaysResult {
  data: BarangayRow[];
  error: string | null;
}

/**
 * Ordinance No. 37, s.2018, Sec. 119 cluster reference data (docs/SCHEMA.MD
 * §2.5b). Any authenticated user can already read this (`barangays_read_all`)
 * — this admin surface is for the write side (`barangays_write_admin`,
 * `is_admin()` only), e.g. when the MTFRB amends cluster boundaries.
 * `updatedByName` resolves via one follow-up users lookup (same convention
 * as admin/dashboard.ts's resolveUserNames()) rather than an embed.
 */
export async function listBarangaysForAdmin(): Promise<ListBarangaysResult> {
  const client = getSupabaseClient();
  const { data, error } = await client.from('barangays').select('*').order('name', { ascending: true });

  if (error) return { data: [], error: error.message };
  if (!data || data.length === 0) return { data: [], error: null };

  const updaterIds = [...new Set(data.map((row) => row.updated_by).filter((id): id is string => !!id))];
  let nameById = new Map<string, string>();
  if (updaterIds.length > 0) {
    const { data: users, error: usersError } = await client.from('users').select('id, full_name').in('id', updaterIds);
    if (usersError) return { data: [], error: usersError.message };
    nameById = new Map((users ?? []).map((u) => [u.id, u.full_name!]));
  }

  const rows: BarangayRow[] = data.map((row) => ({
    id: row.id,
    name: row.name,
    cluster: row.cluster,
    isSplit: row.is_split,
    notes: row.notes,
    updatedAt: row.updated_at,
    updatedByName: row.updated_by ? (nameById.get(row.updated_by) ?? null) : null,
  }));

  return { data: rows, error: null };
}

export interface BarangayInput {
  name: string;
  cluster: TricycleCluster | null;
  isSplit: boolean;
  notes: string | null;
}

export interface BarangayWriteResult {
  error: string | null;
}

/** Every write stamps updated_at/updated_by from the signed-in session — the Barangays screen's "Last amended" line reads these back. */
async function currentUserId(client: ReturnType<typeof getSupabaseClient>): Promise<string | null> {
  const { data } = await client.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function createBarangayForAdmin(input: BarangayInput): Promise<BarangayWriteResult> {
  const client = getSupabaseClient();
  const userId = await currentUserId(client);
  const { error } = await client.from('barangays').insert({
    name: input.name,
    cluster: input.cluster,
    is_split: input.isSplit,
    notes: input.notes,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  });

  return { error: error?.message ?? null };
}

export async function updateBarangayForAdmin(id: string, input: BarangayInput): Promise<BarangayWriteResult> {
  const client = getSupabaseClient();
  const userId = await currentUserId(client);
  const { error } = await client
    .from('barangays')
    .update({
      name: input.name,
      cluster: input.cluster,
      is_split: input.isSplit,
      notes: input.notes,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('id', id);

  return { error: error?.message ?? null };
}

/** pickup_barangay_id (ride_requests) is `on delete set null` — safe to delete, no orphaned FK. */
export async function deleteBarangayForAdmin(id: string): Promise<BarangayWriteResult> {
  const client = getSupabaseClient();
  const { error } = await client.from('barangays').delete().eq('id', id);

  return { error: error?.message ?? null };
}

export interface BarangayUsageResult {
  rideRequestCount: number | null;
  error: string | null;
}

/**
 * UAT A19 — the panelist wants a *real* dependency check before deleting a
 * barangay, not a static warning. `pickup_barangay_id` is the only actual
 * FK referencing this table (drivers/passengers relate to a barangay only
 * indirectly, via tricycle cluster, which is not a foreign key), so a count
 * of ride_requests rows is the true "how many records will lose this
 * reference" answer.
 */
export async function countRideRequestsForBarangay(barangayId: string): Promise<BarangayUsageResult> {
  const client = getSupabaseClient();
  const { count, error } = await client
    .from('ride_requests')
    .select('id', { count: 'exact', head: true })
    .eq('pickup_barangay_id', barangayId);

  if (error) return { rideRequestCount: null, error: error.message };
  return { rideRequestCount: count ?? 0, error: null };
}
