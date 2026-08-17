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
  tripStatus: 'active' | 'idle';
  seatsTaken: number;
  maxSeats: number;
}
