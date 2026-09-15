import { getSupabaseClient } from '../supabase/client.ts';

export interface AdminDriverRow {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  contactNo: string | null;
  email: string;
  accountStatus: 'active' | 'flagged' | 'suspended' | 'deactivated';
  verificationStatus: 'unsubmitted' | 'pending' | 'approved' | 'rejected';
  ratingAvg: number;
  ratingCount: number;
  plateNo: string | null;
  cluster: 'red' | 'white' | 'apple_green' | 'melting_pot' | null;
  tripCount: number;
  createdAt: string;
}

export interface ListDriversForAdminResult {
  data: AdminDriverRow[];
  error: string | null;
}

/**
 * users (role='driver') + driver_profiles + tricycles + a trip tally,
 * merged client-side rather than a nested PostgREST embed — same "no
 * multi-hop embed" convention as admin/dashboard.ts's resolveUserNames().
 * A driver commonly has no tricycle row yet (verification not started) and
 * possibly no driver_profiles values worth trusting until then, so both
 * joins tolerate a miss rather than dropping the driver from the list.
 *
 * tripCount was originally one (id-only) row per trip tallied client-side —
 * a real correctness bug at scale (P1-22, 2026-09-15 launch audit):
 * PostgREST's default max-rows silently truncates that fetch once total
 * historical trips city-wide exceed it, making every driver's count quietly
 * wrong rather than just slow. Replaced with a real server-side aggregate
 * (get_driver_trip_counts, GROUP BY on the trips table). The users/
 * driver_profiles/tricycles fetches stay full-list-client-side, same as
 * this app's other screens — those scale with headcount, not ride volume,
 * and a barangay pilot's driver roster is realistically bounded.
 */
export async function listDriversForAdmin(): Promise<ListDriversForAdminResult> {
  const client = getSupabaseClient();

  const { data: users, error: usersError } = await client
    .from('users')
    .select('id, first_name, last_name, full_name, contact_no, email, status, created_at')
    .eq('role', 'driver')
    .order('created_at', { ascending: false });

  if (usersError) return { data: [], error: usersError.message };
  if (!users || users.length === 0) return { data: [], error: null };

  const ids = users.map((u) => u.id);

  const [
    { data: profiles, error: profilesError },
    { data: tricycles, error: tricyclesError },
    { data: tripCounts, error: tripsError },
  ] = await Promise.all([
    client.from('driver_profiles').select('user_id, verification_status, rating_avg, rating_count').in('user_id', ids),
    client.from('tricycles').select('driver_id, plate_no, cluster').in('driver_id', ids),
    client.rpc('get_driver_trip_counts', { p_driver_ids: ids }),
  ]);

  if (profilesError) return { data: [], error: profilesError.message };
  if (tricyclesError) return { data: [], error: tricyclesError.message };
  if (tripsError) return { data: [], error: tripsError.message };

  const profileByUserId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const tricycleByDriverId = new Map((tricycles ?? []).map((t) => [t.driver_id, t]));
  const tripCountByDriverId = new Map((tripCounts ?? []).map((r) => [r.driver_id, Number(r.trip_count)]));

  const rows = users.map((u) => {
    const profile = profileByUserId.get(u.id);
    const tricycle = tricycleByDriverId.get(u.id);
    return {
      id: u.id,
      firstName: u.first_name,
      lastName: u.last_name,
      fullName: u.full_name!,
      contactNo: u.contact_no,
      email: u.email,
      accountStatus: u.status,
      verificationStatus: profile?.verification_status ?? 'unsubmitted',
      ratingAvg: profile ? Number(profile.rating_avg) : 0,
      ratingCount: profile?.rating_count ?? 0,
      plateNo: tricycle?.plate_no ?? null,
      cluster: tricycle?.cluster ?? null,
      tripCount: tripCountByDriverId.get(u.id) ?? 0,
      createdAt: u.created_at,
    };
  });

  return { data: rows, error: null };
}
