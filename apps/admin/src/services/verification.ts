import {
  approveVerification as approveVerificationReal,
  listPendingVerifications,
  rejectVerification as rejectVerificationReal,
  updateVerificationFields as updateVerificationFieldsReal,
} from '@trisakay/services';
import type { VerificationCase, DocumentType } from '../types/verification';
import type { ServiceResult } from './drivers';

const DOCUMENT_LABEL: Record<DocumentType, string> = {
  drivers_license: "Driver's License",
  or_cr: 'OR / CR',
  franchise_permit: 'Franchise / Permit',
  tricycle_photo: 'Tricycle Photo',
};

export async function listVerificationCases(): Promise<ServiceResult<VerificationCase[]>> {
  const { data, error } = await listPendingVerifications();
  if (error) return { data: [], error };

  const cases: VerificationCase[] = data.map((c) => ({
    driverId: c.driverId,
    driverFullName: c.driverFullName,
    plateNo: c.plateNo,
    documents: c.documents.map((d) => ({
      id: d.id,
      docType: d.docType,
      label: DOCUMENT_LABEL[d.docType],
      status: d.status,
      storagePath: d.storagePath,
    })),
    mtopNo: c.mtopNo ?? '',
    mtopExpiryDate: c.mtopExpiryDate ?? '',
    cluster: c.cluster ?? '',
    overallStatus: c.overallStatus,
    notes: c.notes ?? '',
  }));

  return { data: cases, error: null };
}

/** PSO Staff+ — transcription only, not an S+ decision (see updateVerificationFields's own doc comment on the RLS boundary). */
export async function updateVerificationCase(
  driverId: string,
  patch: Partial<Pick<VerificationCase, 'mtopNo' | 'mtopExpiryDate' | 'cluster' | 'notes'>>
): Promise<ServiceResult<null>> {
  const { mtopNo, mtopExpiryDate, cluster } = patch;
  const { error } = await updateVerificationFieldsReal(driverId, {
    ...(mtopNo !== undefined && { mtopNo }),
    ...(mtopExpiryDate !== undefined && { mtopExpiryDate }),
    ...(cluster !== undefined && cluster !== '' && { cluster }),
  });
  return { data: null, error };
}

/** S+ action (FR-1.5). */
export async function approveVerification(driverId: string, notes?: string): Promise<ServiceResult<null>> {
  const { error } = await approveVerificationReal(driverId, notes);
  return { data: null, error };
}

/** S+ action (FR-1.5). */
export async function rejectVerification(driverId: string, notes: string): Promise<ServiceResult<null>> {
  const { error } = await rejectVerificationReal(driverId, notes);
  return { data: null, error };
}
