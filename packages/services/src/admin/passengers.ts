import { getSupabaseClient } from '../supabase/client.ts';

export interface AdminPassengerRow {
  id: string;
  fullName: string;
  contactNo: string | null;
  email: string;
  accountStatus: 'active' | 'flagged' | 'suspended' | 'deactivated';
  totalRides: number;
  hasApprovedDiscount: boolean;
  createdAt: string;
}

export interface ListPassengersForAdminResult {
  data: AdminPassengerRow[];
  error: string | null;
}

/**
 * users (role='passenger') + a completed-ride count from ride_requests +
 * an approved-discount flag from passenger_discounts, merged client-side.
 * PostgREST has no GROUP BY, so the ride count is a row fetch reduced in
 * JS rather than an aggregate query — fine at this app's pilot-barangay
 * scale (same tradeoff admin/dashboard.ts makes for its follow-up lookups).
 */
export async function listPassengersForAdmin(): Promise<ListPassengersForAdminResult> {
  const client = getSupabaseClient();

  const { data: users, error: usersError } = await client
    .from('users')
    .select('id, full_name, contact_no, email, status, created_at')
    .eq('role', 'passenger')
    .order('created_at', { ascending: false });

  if (usersError) return { data: [], error: usersError.message };
  if (!users || users.length === 0) return { data: [], error: null };

  const ids = users.map((u) => u.id);

  const [{ data: completedRides, error: ridesError }, { data: discounts, error: discountsError }] = await Promise.all([
    client.from('ride_requests').select('passenger_id').eq('status', 'completed').in('passenger_id', ids),
    client.from('passenger_discounts').select('passenger_id').eq('status', 'approved').in('passenger_id', ids),
  ]);

  if (ridesError) return { data: [], error: ridesError.message };
  if (discountsError) return { data: [], error: discountsError.message };

  const rideCountByPassengerId = new Map<string, number>();
  for (const row of completedRides ?? []) {
    rideCountByPassengerId.set(row.passenger_id, (rideCountByPassengerId.get(row.passenger_id) ?? 0) + 1);
  }
  const approvedDiscountIds = new Set((discounts ?? []).map((d) => d.passenger_id));

  const rows = users.map((u) => ({
    id: u.id,
    fullName: u.full_name,
    contactNo: u.contact_no,
    email: u.email,
    accountStatus: u.status,
    totalRides: rideCountByPassengerId.get(u.id) ?? 0,
    hasApprovedDiscount: approvedDiscountIds.has(u.id),
    createdAt: u.created_at,
  }));

  return { data: rows, error: null };
}
