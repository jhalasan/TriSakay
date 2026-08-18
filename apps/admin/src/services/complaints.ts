import { listComplaintsForAdmin, recordDhDirectiveForAdmin, setComplaintStatusForAdmin } from '@trisakay/services';
import { businessDaysSince } from '../lib/format.ts';
import type { ComplaintRow, ComplaintStatus } from '../types/complaint';
import type { ServiceResult } from './drivers';

export async function listComplaints(): Promise<ServiceResult<ComplaintRow[]>> {
  const { data, error } = await listComplaintsForAdmin();
  if (error) return { data: [], error };

  const rows: ComplaintRow[] = data.map((c) => ({
    id: c.id,
    subject: c.subject,
    submittedByName: c.submittedByName,
    againstUserName: c.againstUserName,
    category: c.category,
    status: c.status,
    dhDirective: c.dhDirective,
    businessDaysElapsed: businessDaysSince(c.createdAt),
    createdAt: c.createdAt,
  }));

  return { data: rows, error: null };
}

/** PSO Staff triage step (FR-4.3) — not S+ gated. */
export async function setComplaintStatus(id: string, status: ComplaintStatus): Promise<ServiceResult<null>> {
  const { error } = await setComplaintStatusForAdmin(id, status);
  return { data: null, error };
}

/** Department Head directive step (FR-4.3a) — distinct audit record from triage and from the eventual mediation outcome. */
export async function recordDhDirective(id: string, directive: string): Promise<ServiceResult<null>> {
  const { error } = await recordDhDirectiveForAdmin(id, directive);
  return { data: null, error };
}
