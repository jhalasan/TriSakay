import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export type AdminEmergencyRole = Database['public']['Enums']['emergency_role'];
export type AdminEmergencyStatus = Database['public']['Enums']['emergency_status'];

export interface AdminEmergencyAlertRow {
  id: string;
  triggeredById: string;
  triggeredByName: string;
  triggeredRole: AdminEmergencyRole;
  counterpartId: string | null;
  counterpartName: string | null;
  tricyclePlateNo: string | null;
  rideRequestId: string | null;
  lat: number;
  lng: number;
  status: AdminEmergencyStatus;
  reviewedByName: string | null;
  reviewedAt: string | null;
  /** Who closed the alert and when; null until it is closed. */
  closedByName: string | null;
  closedAt: string | null;
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
    .select('id, ride_request_id, triggered_by, triggered_role, counterpart_id, lat, lng, status, reviewed_by, reviewed_at, closed_by, closed_at, notes, created_at')
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message };
  if (!data || data.length === 0) return { data: [], error: null };

  const ids = [
    ...new Set(
      data.flatMap((a) => [a.triggered_by, a.counterpart_id, a.reviewed_by, a.closed_by].filter((id): id is string => !!id))
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
    triggeredById: a.triggered_by,
    triggeredByName: nameById.get(a.triggered_by) ?? '—',
    triggeredRole: a.triggered_role,
    counterpartId: a.counterpart_id,
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
    closedByName: a.closed_by ? (nameById.get(a.closed_by) ?? null) : null,
    closedAt: a.closed_at,
    notes: a.notes,
    createdAt: a.created_at,
  }));

  return { data: rows, error: null };
}

export interface MarkEmergencyAlertReviewedResult {
  error: string | null;
}

/**
 * FR-12.5 — PSO Supervisor+ marks an alert reviewed. A note saying what was done is required.
 * Who reviewed it and when are recorded by the database (trg_emergency_review_stamps), not taken
 * from this request, so they cannot be set to someone else or a different time
 * (`emergency_review_supervisor` RLS: `is_supervisor()`).
 */
export async function markEmergencyAlertReviewed(id: string, notes: string): Promise<MarkEmergencyAlertReviewedResult> {
  const trimmed = notes.trim();
  if (!trimmed) return { error: 'Add a note describing what was done before marking this alert reviewed.' };

  const { error } = await getSupabaseClient().from('emergency_alerts').update({ status: 'reviewed', notes: trimmed }).eq('id', id);
  return { error: error?.message ?? null };
}

/**
 * Closing a reviewed alert once follow-up is done (UAT panelist review, 2026-09-21). Same RLS tier as
 * review; the database records who closed it and when, and only allows it from `reviewed`.
 */
export async function markEmergencyAlertClosed(id: string): Promise<MarkEmergencyAlertReviewedResult> {
  const { error } = await getSupabaseClient().from('emergency_alerts').update({ status: 'closed' }).eq('id', id);
  return { error: error?.message ?? null };
}
