import { getSupabaseClient } from '../supabase/client.ts';

export interface AdminPassengerDiscount {
  category: 'senior_citizen' | 'pwd' | 'student';
  status: 'unsubmitted' | 'pending' | 'approved' | 'rejected';
}

export interface AdminPassengerRow {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  contactNo: string | null;
  email: string | null;
  accountStatus: 'active' | 'flagged' | 'suspended' | 'deactivated';
  totalRides: number;
  discount: AdminPassengerDiscount | null;
  createdAt: string;
}

export interface ListPassengersForAdminResult {
  data: AdminPassengerRow[];
  error: string | null;
}

/**
 * users (role='passenger') + a completed-ride count from ride_requests +
 * each passenger's own discount application (category + review status,
 * not just an approved/not flag) from passenger_discounts, merged
 * client-side. The ride count was originally a row-per-ride fetch reduced
 * in JS — a real correctness bug at scale (P1-22, 2026-09-15 launch audit):
 * PostgREST's default max-rows silently truncates that fetch once total
 * completed rides city-wide exceed it, making every passenger's count
 * quietly wrong rather than just slow. Replaced with a real server-side
 * aggregate (get_passenger_completed_ride_counts, GROUP BY on
 * ride_requests). The users/passenger_discounts fetches stay full-list-
 * client-side, same as this app's other screens — those scale with
 * headcount, not ride volume. A passenger applies for at most one discount
 * in practice; ordering by submitted_at desc and keeping the first row seen
 * per passenger picks their latest application if more than one exists.
 */
export async function listPassengersForAdmin(): Promise<ListPassengersForAdminResult> {
  const client = getSupabaseClient();

  const { data: users, error: usersError } = await client
    .from('admin_passenger_directory')
    .select('id, first_name, last_name, full_name, contact_no, email, status, created_at')
    .order('created_at', { ascending: false });

  if (usersError) return { data: [], error: usersError.message };
  if (!users || users.length === 0) return { data: [], error: null };

  const ids = users.map((u) => u.id!);

  const [{ data: rideCounts, error: ridesError }, { data: discounts, error: discountsError }] = await Promise.all([
    client.rpc('get_passenger_completed_ride_counts', { p_passenger_ids: ids }),
    client.from('passenger_discounts').select('passenger_id, category, status').in('passenger_id', ids).order('submitted_at', { ascending: false }),
  ]);

  if (ridesError) return { data: [], error: ridesError.message };
  if (discountsError) return { data: [], error: discountsError.message };

  const rideCountByPassengerId = new Map((rideCounts ?? []).map((r) => [r.passenger_id, Number(r.ride_count)]));
  const discountByPassengerId = new Map<string, AdminPassengerDiscount>();
  for (const row of discounts ?? []) {
    if (!discountByPassengerId.has(row.passenger_id)) {
      discountByPassengerId.set(row.passenger_id, { category: row.category, status: row.status });
    }
  }

  const rows = users.map((u) => ({
    id: u.id!,
    firstName: u.first_name!,
    lastName: u.last_name!,
    fullName: u.full_name!,
    contactNo: u.contact_no,
    email: u.email,
    accountStatus: u.status!,
    totalRides: rideCountByPassengerId.get(u.id!) ?? 0,
    discount: discountByPassengerId.get(u.id!) ?? null,
    createdAt: u.created_at!,
  }));

  return { data: rows, error: null };
}
