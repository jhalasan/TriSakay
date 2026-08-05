import { MOCK_VERIFICATION_CASES } from '../mocks/verification.ts';
import { wait } from '../mocks/delay.ts';
import type { VerificationCase } from '../types/verification';
import type { ServiceResult } from './drivers';

let cases = [...MOCK_VERIFICATION_CASES];

export async function listVerificationCases(): Promise<ServiceResult<VerificationCase[]>> {
  await wait();
  return { data: cases, error: null };
}

/** PSO Supervisor/Admin transcribing MTOP fields while reviewing the uploaded Franchise/Permit (FR-1.4a). Not S+ gated by itself — editing notes/fields is part of review, distinct from the Approve/Reject decision. */
export async function updateVerificationCase(
  driverId: string,
  patch: Partial<Pick<VerificationCase, 'mtopNo' | 'mtopExpiryDate' | 'cluster' | 'notes'>>
): Promise<ServiceResult<null>> {
  await wait(150);
  cases = cases.map((c) => (c.driverId === driverId ? { ...c, ...patch } : c));
  return { data: null, error: null };
}

/** S+ action (FR-1.5). */
export async function approveVerification(driverId: string): Promise<ServiceResult<null>> {
  await wait();
  cases = cases.map((c) => (c.driverId === driverId ? { ...c, overallStatus: 'approved' } : c));
  return { data: null, error: null };
}

/** S+ action (FR-1.5). */
export async function rejectVerification(driverId: string): Promise<ServiceResult<null>> {
  await wait();
  cases = cases.map((c) => (c.driverId === driverId ? { ...c, overallStatus: 'rejected' } : c));
  return { data: null, error: null };
}
