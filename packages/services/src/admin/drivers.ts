import { getSupabaseClient } from '../supabase/client.ts';

export interface AdminDriverRow {
  id: string;
  fullName: string;
  contactNo: string | null;
  email: string;
  accountStatus: 'active' | 'flagged' | 'suspended' | 'deactivated';
  verificationStatus: 'unsubmitted' | 'pending' | 'approved' | 'rejected';
  ratingAvg: number;
  ratingCount: number;
  plateNo: string | null;
  cluster: 'red' | 'white' | 'apple_green' | 'melting_pot' | null;
  createdAt: string;
}

export interface ListDriversForAdminResult {
  data: AdminDriverRow[];
  error: string | null;
}

/**
 * users (role='driver') + driver_profiles + tricycles, merged client-side
 * rather than a nested PostgREST embed — same "no multi-hop embed"
 * convention as admin/dashboard.ts's resolveUserNames(). A driver commonly
 * has no tricycle row yet (verification not started) and possibly no
 * driver_profiles values worth trusting until then, so both joins tolerate
 * a miss rather than dropping the driver from the list.
 */
export async function listDriversForAdmin(): Promise<ListDriversForAdminResult> {
  const client = getSupabaseClient();

  const { data: users, error: usersError } = await client
    .from('users')
    .select('id, full_name, contact_no, email, status, created_at')
    .eq('role', 'driver')
    .order('created_at', { ascending: false });

  if (usersError) return { data: [], error: usersError.message };
  if (!users || users.length === 0) return { data: [], error: null };

  const ids = users.map((u) => u.id);

  const [{ data: profiles, error: profilesError }, { data: tricycles, error: tricyclesError }] = await Promise.all([
    client.from('driver_profiles').select('user_id, verification_status, rating_avg, rating_count').in('user_id', ids),
    client.from('tricycles').select('driver_id, plate_no, cluster').in('driver_id', ids),
  ]);

  if (profilesError) return { data: [], error: profilesError.message };
  if (tricyclesError) return { data: [], error: tricyclesError.message };

  const profileByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const tricycleByDriverId = new Map((tricycles ?? []).map((t) => [t.driver_id, t]));

  const rows = users.map((u) => {
    const profile = profileByUserId.get(u.id);
    const tricycle = tricycleByDriverId.get(u.id);
    return {
      id: u.id,
      fullName: u.full_name,
      contactNo: u.contact_no,
      email: u.email,
      accountStatus: u.status,
      verificationStatus: profile?.verification_status ?? 'unsubmitted',
      ratingAvg: profile ? Number(profile.rating_avg) : 0,
      ratingCount: profile?.rating_count ?? 0,
      plateNo: tricycle?.plate_no ?? null,
      cluster: tricycle?.cluster ?? null,
      createdAt: u.created_at,
    };
  });

  return { data: rows, error: null };
}
