/**
 * App-level Driver shape for the admin portal. Field names and enum values
 * are kept identical to docs/SCHEMA.MD's `users` + `driver_profiles` +
 * `tricycles` tables (and the matching enums in
 * packages/services/src/supabase/database.types.ts) so that, when this
 * screen is wired to Supabase, only the query/mapper changes — not this
 * shape. No backend code is imported this pass.
 */
export type AccountStatus = 'active' | 'flagged' | 'suspended' | 'deactivated';
export type VerificationStatus = 'unsubmitted' | 'pending' | 'approved' | 'rejected';
export type TricycleCluster = 'red' | 'white' | 'apple_green' | 'melting_pot';

export interface DriverRow {
  id: string; // users.id
  fullName: string;
  contactNo: string;
  email: string;
  accountStatus: AccountStatus;
  verificationStatus: VerificationStatus;
  ratingAvg: number; // driver_profiles.rating_avg, 0-5
  ratingCount: number;
  plateNo: string;
  cluster: TricycleCluster | null; // null when the driver has no tricycle on file yet
  createdAt: string; // ISO
}
