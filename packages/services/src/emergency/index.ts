import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export type EmergencyRole = Database['public']['Enums']['emergency_role'];

async function getSignedInUserId(): Promise<string | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.user.id ?? null;
}

export interface TriggerEmergencyAlertInput {
  rideRequestId: string | null;
  triggeredRole: EmergencyRole;
  counterpartId: string | null;
  lat: number;
  lng: number;
}

export interface TriggerEmergencyAlertResult {
  error: string | null;
}

/**
 * FR-12.3 — logs an incident record for PSO's post-event review
 * (`triggered_by = auth.uid()`, enforced by the `emergency_insert_own` RLS
 * policy; `notify_pso_on_emergency()` fans this out to every PSO Staff+
 * account automatically). This is the record-keeping half of the feature
 * only — the actual safety action (dialing 911/PNP) happens entirely
 * client-side and never touches this function; per NFR-4, callers must
 * never let a failure here block or delay that dial-out.
 */
export async function triggerEmergencyAlert({
  rideRequestId,
  triggeredRole,
  counterpartId,
  lat,
  lng,
}: TriggerEmergencyAlertInput): Promise<TriggerEmergencyAlertResult> {
  const userId = await getSignedInUserId();
  if (!userId) return { error: 'Not signed in' };

  const { error } = await getSupabaseClient()
    .from('emergency_alerts')
    .insert({
      ride_request_id: rideRequestId,
      triggered_by: userId,
      triggered_role: triggeredRole,
      counterpart_id: counterpartId,
      lat,
      lng,
    });

  return { error: error?.message ?? null };
}
