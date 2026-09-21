import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export type AdminEmergencyRole = Database['public']['Enums']['emergency_role'];
export type AdminEmergencyStatus = Database['public']['Enums']['emergency_status'];

export interface AdminEmergencyAlertRow {
  id: string;
  triggeredByName: string;
  triggeredRole: AdminEmergencyRole;
  counterpartName: string | null;
  tricyclePlateNo: string | null;
  rideRequestId: string | null;
  lat: number;
  lng: number;
  status: AdminEmergencyStatus;
  reviewedByName: string | null;
  reviewedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ListEmergencyAlertsForAdminResult {
  data: AdminEmergencyAlertRow[];
  error: string | null;
}

/**
 * FR-12.4 — every emergency alert, newest first, visible to any PSO Staff+
 * account (`emergency_read` RLS: `triggered_by = auth.uid() or is_pso()`).
 * Name resolution follows the same "no multi-hop embed, one follow-up users
 * lookup" convention as admin/complaints.ts's listComplaintsForAdmin(). A
 * one-shot fetch, not a Realtime subscription — matches every other admin
 * screen, and FR-12.7 explicitly says this isn't meant to be 24/7-monitored.
 */
export async function listEmergencyAlertsForAdmin(): Promise<ListEmergencyAlertsForAdminResult> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('emergency_alerts')
    .select('id, ride_request_id, triggered_by, triggered_role, counterpart_id, lat, lng, status, reviewed_by, reviewed_at, notes, created_at')
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message };
  if (!data || data.length === 0) return { data: [], error: null };

  const ids = [
    ...new Set(
      data.flatMap((a) => [a.triggered_by, a.counterpart_id, a.reviewed_by].filter((id): id is string => !!id))
    ),
  ];
  const { data: users, error: usersError } = await client.from('users').select('id, full_name').in('id', ids);
  if (usersError) return { data: [], error: usersError.message };

  const nameById = new Map((users ?? []).map((u) => [u.id, u.full_name]));

  // The driver in the pair is whoever triggered it (if a driver) or the
  // counterpart (if a passenger triggered it) — same "no multi-hop embed,
  // one follow-up lookup" convention as the users query above.
  const driverIdByAlertId = new Map(
    data.map((a) => [a.id, a.triggered_role === 'driver' ? a.triggered_by : a.counterpart_id])
  );
  const driverIds = [...new Set([...driverIdByAlertId.values()].filter((id): id is string => !!id))];
  let plateByDriverId = new Map<string, string>();
  if (driverIds.length > 0) {
    const { data: tricycles, error: tricyclesError } = await client
      .from('tricycles')
      .select('driver_id, plate_no')
      .in('driver_id', driverIds);
    if (tricyclesError) return { data: [], error: tricyclesError.message };
    plateByDriverId = new Map((tricycles ?? []).map((t) => [t.driver_id, t.plate_no]));
  }

  const rows: AdminEmergencyAlertRow[] = data.map((a) => ({
    id: a.id,
    triggeredByName: nameById.get(a.triggered_by) ?? '—',
    triggeredRole: a.triggered_role,
    counterpartName: a.counterpart_id ? (nameById.get(a.counterpart_id) ?? null) : null,
    tricyclePlateNo: (() => {
      const driverId = driverIdByAlertId.get(a.id);
      return driverId ? (plateByDriverId.get(driverId) ?? null) : null;
    })(),
    rideRequestId: a.ride_request_id,
    lat: a.lat,
    lng: a.lng,
    status: a.status,
    reviewedByName: a.reviewed_by ? (nameById.get(a.reviewed_by) ?? null) : null,
    reviewedAt: a.reviewed_at,
    notes: a.notes,
    createdAt: a.created_at,
  }));

  return { data: rows, error: null };
}

export interface MarkEmergencyAlertReviewedResult {
  error: string | null;
}

/**
 * FR-12.5 — PSO Supervisor+ marks an alert reviewed, with optional notes
 * (`emergency_review_supervisor` RLS: `is_supervisor()`, no new RPC needed,
 * same as Discount Review's direct-update pattern).
 */
export async function markEmergencyAlertReviewed(id: string, notes?: string): Promise<MarkEmergencyAlertReviewedResult> {
  const client = getSupabaseClient();
  const { data: sessionData } = await client.auth.getSession();
  const reviewerId = sessionData.session?.user.id;
  if (!reviewerId) return { error: 'Not signed in' };

  const { error } = await client
    .from('emergency_alerts')
    .update({
      status: 'reviewed',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      ...(notes ? { notes } : {}),
    })
    .eq('id', id);

  return { error: error?.message ?? null };
}

/**
 * `emergency_status`'s third value, `closed`, was originally left unwired
 * (see docs/superpowers/specs/2026-08-21-emergency-sos-alert-design.md,
 * section E) since the wireframe review named only "Mark Reviewed" — noted
 * there as worth revisiting if a real product need for a distinct closing
 * step showed up. UAT panelist review (2026-09-21) is that need: PSO wants
 * to explicitly close out a reviewed alert once follow-up is done, not leave
 * it sitting as "Reviewed" indefinitely. Same RLS/role tier as review
 * (`emergency_review_supervisor`), only reachable from `reviewed` — the
 * route enforces that transition, this function doesn't re-check it.
 */
export async function markEmergencyAlertClosed(id: string): Promise<MarkEmergencyAlertReviewedResult> {
  const client = getSupabaseClient();
  const { error } = await client.from('emergency_alerts').update({ status: 'closed' }).eq('id', id);
  return { error: error?.message ?? null };
}
