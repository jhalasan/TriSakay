import { getSupabaseClient } from '../supabase/client.ts';

export interface AdminTricycleRow {
  id: string;
  driverId: string;
  driverName: string | null;
  driverContactNo: string | null;
  driverAccountStatus: 'active' | 'flagged' | 'suspended' | 'deactivated' | null;
  plateNo: string;
  bodyNo: string | null;
  seatCapacity: number;
  cluster: 'red' | 'white' | 'apple_green' | 'melting_pot' | null;
  verificationStatus: 'unsubmitted' | 'pending' | 'approved' | 'rejected';
  mtopNo: string | null;
  mtopExpiryDate: string | null;
  createdAt: string;
}

export interface ListTricyclesForAdminResult {
  data: AdminTricycleRow[];
  error: string | null;
}

/**
 * The fleet roster (every active tricycle), joined with its owning driver's
 * identity — the traceback gap the 2026-09-15 launch audit found: PSO could
 * see an "N expiring franchises" count on the Dashboard, and the driver
 * themselves got a notification, but nothing in the admin app named which
 * driver/plate/MTOP was actually behind that count outside of scrolling the
 * full Verification queue. `v_expiring_franchises` only carries the
 * expiring subset (docs/SCHEMA.MD ~L1199); this queries `tricycles` itself
 * so PSO can monitor the whole fleet's franchise/verification state, not
 * just the ones already inside the 30-day window.
 */
export async function listTricyclesForAdmin(): Promise<ListTricyclesForAdminResult> {
  const client = getSupabaseClient();

  const { data: tricycles, error: tricyclesError } = await client
    .from('tricycles')
    .select('id, driver_id, plate_no, body_no, seat_capacity, cluster, verification_status, mtop_no, mtop_expiry_date, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (tricyclesError) return { data: [], error: tricyclesError.message };
  if (!tricycles || tricycles.length === 0) return { data: [], error: null };

  const driverIds = [...new Set(tricycles.map((t) => t.driver_id))];
  const { data: drivers, error: driversError } = await client
    .from('users')
    .select('id, full_name, contact_no, status')
    .in('id', driverIds);

  if (driversError) return { data: [], error: driversError.message };

  const driverById = new Map((drivers ?? []).map((d) => [d.id, d]));

  const rows = tricycles.map((t) => {
    const driver = driverById.get(t.driver_id);
    return {
      id: t.id,
      driverId: t.driver_id,
      driverName: driver?.full_name ?? null,
      driverContactNo: driver?.contact_no ?? null,
      driverAccountStatus: driver?.status ?? null,
      plateNo: t.plate_no,
      bodyNo: t.body_no,
      seatCapacity: t.seat_capacity,
      cluster: t.cluster,
      verificationStatus: t.verification_status,
      mtopNo: t.mtop_no,
      mtopExpiryDate: t.mtop_expiry_date,
      createdAt: t.created_at,
    };
  });

  return { data: rows, error: null };
}
