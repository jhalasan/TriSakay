/** Mirrors docs/SCHEMA.MD `emergency_role` / `emergency_status` enums. */
export type EmergencyRole = 'passenger' | 'driver';

export type EmergencyStatus = 'logged' | 'reviewed' | 'closed';

export interface EmergencyAlertRow {
  id: string;
  triggeredById: string;
  triggeredByName: string;
  triggeredRole: EmergencyRole;
  counterpartId: string | null;
  counterpartName: string | null;
  tricyclePlateNo: string | null;
  rideRequestId: string | null;
  lat: number;
  lng: number;
  status: EmergencyStatus;
  reviewedByName: string | null;
  reviewedAt: string | null;
  closedByName: string | null;
  closedAt: string | null;
  notes: string | null;
  createdAt: string;
}
