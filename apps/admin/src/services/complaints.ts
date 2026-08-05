import { MOCK_COMPLAINTS } from '../mocks/complaints.ts';
import { wait } from '../mocks/delay.ts';
import type { ComplaintRow, ComplaintStatus } from '../types/complaint';
import type { ServiceResult } from './drivers';

let complaints = [...MOCK_COMPLAINTS];

export async function listComplaints(): Promise<ServiceResult<ComplaintRow[]>> {
  await wait();
  return { data: complaints, error: null };
}

/** PSO Staff triage step (FR-4.3) — not S+ gated. */
export async function setComplaintStatus(id: string, status: ComplaintStatus): Promise<ServiceResult<null>> {
  await wait();
  complaints = complaints.map((c) => (c.id === id ? { ...c, status } : c));
  return { data: null, error: null };
}

/** Department Head directive step (FR-4.3a) — distinct audit record from triage and from the eventual mediation outcome. */
export async function recordDhDirective(id: string, directive: string): Promise<ServiceResult<null>> {
  await wait();
  complaints = complaints.map((c) => (c.id === id ? { ...c, dhDirective: directive } : c));
  return { data: null, error: null };
}
