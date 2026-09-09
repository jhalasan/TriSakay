import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export type TricycleCluster = Database['public']['Enums']['tricycle_cluster'];

export interface BarangayRow {
  id: string;
  name: string;
  cluster: TricycleCluster | null;
  isSplit: boolean;
  notes: string | null;
}

export interface ListBarangaysResult {
  data: BarangayRow[];
  error: string | null;
}

function toRow(row: Database['public']['Tables']['barangays']['Row']): BarangayRow {
  return { id: row.id, name: row.name, cluster: row.cluster, isSplit: row.is_split, notes: row.notes };
}

/**
 * Ordinance No. 37, s.2018, Sec. 119 cluster reference data (docs/SCHEMA.MD
 * §2.5b). Any authenticated user can already read this (`barangays_read_all`)
 * — this admin surface is for the write side (`barangays_write_admin`,
 * `is_admin()` only), e.g. when the MTFRB amends cluster boundaries.
 */
export async function listBarangaysForAdmin(): Promise<ListBarangaysResult> {
  const client = getSupabaseClient();
  const { data, error } = await client.from('barangays').select('*').order('name', { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map(toRow), error: null };
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

export async function createBarangayForAdmin(input: BarangayInput): Promise<BarangayWriteResult> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('barangays')
    .insert({ name: input.name, cluster: input.cluster, is_split: input.isSplit, notes: input.notes });

  return { error: error?.message ?? null };
}

export async function updateBarangayForAdmin(id: string, input: BarangayInput): Promise<BarangayWriteResult> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('barangays')
    .update({ name: input.name, cluster: input.cluster, is_split: input.isSplit, notes: input.notes })
    .eq('id', id);

  return { error: error?.message ?? null };
}

/** pickup_barangay_id (ride_requests) is `on delete set null` — safe to delete, no orphaned FK. */
export async function deleteBarangayForAdmin(id: string): Promise<BarangayWriteResult> {
  const client = getSupabaseClient();
  const { error } = await client.from('barangays').delete().eq('id', id);

  return { error: error?.message ?? null };
}
