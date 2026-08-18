import type { TricycleCluster, VerificationStatus } from './driver';

/** Mirrors docs/SCHEMA.MD `document_type` enum. */
export type DocumentType = 'drivers_license' | 'or_cr' | 'franchise_permit' | 'tricycle_photo';

export interface DriverDocument {
  id: string;
  docType: DocumentType;
  label: string;
  status: VerificationStatus;
  storagePath: string;
}

/**
 * One Driver's pending (or reviewed) verification case — documents +
 * MTOP transcription fields per FR-1.4a (docs/CONTEXT.MD §11 item 6): the
 * app does not OCR the Franchise/Permit document, so PSO Supervisor/Admin
 * types the MTOP number, expiry date, and cluster in by hand while
 * reviewing the uploaded document.
 */
export interface VerificationCase {
  driverId: string;
  driverFullName: string;
  plateNo: string;
  documents: DriverDocument[];
  mtopNo: string;
  mtopExpiryDate: string; // ISO date, '' if not yet transcribed
  cluster: TricycleCluster | '';
  overallStatus: VerificationStatus;
  notes: string;
}
