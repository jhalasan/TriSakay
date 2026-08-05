/** Mirrors docs/SCHEMA.MD `trip_status` enum. */
export type TripStatus = 'forming' | 'active' | 'completed' | 'cancelled';

/**
 * One row on the Ride Monitoring live list — a Driver currently on the
 * clock. Location is intentionally coarse (barangay-level), consistent
 * with NFR-2.5 (no persisted GPS trail, privacy-by-design); the admin
 * portal only needs to show "on trip" vs "idle", not exact coordinates.
 */
export interface ActiveTricycleRow {
  driverId: string;
  driverFullName: string;
  plateNo: string;
  tripStatus: TripStatus;
  seatsTaken: number;
  maxSeats: number;
}

export interface RecentActivityRow {
  id: string;
  driverFullName: string;
  status: TripStatus | 'completed';
  time: string; // relative label, e.g. '5 min ago'
}
