import type { AccountStatus, TricycleCluster, VerificationStatus } from './driver';

export interface TricycleRow {
  id: string; // tricycles.id
  driverId: string;
  driverName: string;
  driverContactNo: string;
  driverAccountStatus: AccountStatus | null;
  plateNo: string;
  bodyNo: string;
  seatCapacity: number;
  cluster: TricycleCluster | null;
  verificationStatus: VerificationStatus;
  mtopNo: string;
  mtopExpiryDate: string | null; // ISO date (YYYY-MM-DD), null when not yet transcribed
  createdAt: string; // ISO
}

/** Positive = days remaining, 0 = expires today, negative = days lapsed. Null when no expiry date is on file. */
export function daysUntilExpiry(mtopExpiryDate: string | null): number | null {
  if (!mtopExpiryDate) return null;
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const expiryUtc = Date.parse(mtopExpiryDate);
  return Math.round((expiryUtc - todayUtc) / 86_400_000);
}
