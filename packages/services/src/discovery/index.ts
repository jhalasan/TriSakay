import { getSupabaseClient } from '../supabase/client.ts';

export interface NearbyDriverCountResult {
  count: number | null;
  error: string | null;
}

/** Backs the passenger Home CTA's "· N nearby" chip. Returns count: null (not 0) on any failure so the UI can omit the segment rather than claim zero drivers are nearby. */
export async function getNearbyDriverCount(lat: number, lng: number): Promise<NearbyDriverCountResult> {
  const { data, error } = await getSupabaseClient().functions.invoke('nearby-driver-count', {
    body: { lat, lng },
  });
  if (error) return { count: null, error: error.message };
  return { count: data?.count ?? null, error: null };
}
