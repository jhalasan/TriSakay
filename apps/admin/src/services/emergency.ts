import { listEmergencyAlertsForAdmin, markEmergencyAlertReviewed } from '@trisakay/services';
import type { EmergencyAlertRow } from '../types/emergency';
import type { ServiceResult } from './drivers';

export async function listEmergencyAlerts(): Promise<ServiceResult<EmergencyAlertRow[]>> {
  const { data, error } = await listEmergencyAlertsForAdmin();
  if (error) return { data: [], error };
  return { data, error: null };
}

/** FR-12.5 — PSO Supervisor+ only, enforced both by RoleGate in the route and by the RLS policy underneath. */
export async function markAlertReviewed(id: string, notes?: string): Promise<ServiceResult<null>> {
  const { error } = await markEmergencyAlertReviewed(id, notes);
  return { data: null, error };
}
