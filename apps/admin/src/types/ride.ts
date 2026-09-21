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
  cluster: 'red' | 'white' | 'apple_green' | 'melting_pot' | null;
  tripStatus: 'active' | 'idle';
  seatsTaken: number;
  maxSeats: number;
}

export type RideLogStatus = 'pending' | 'assigned' | 'ongoing' | 'completed' | 'cancelled';

/**
 * One row on the Ride Log screen (UAT A3) — a searchable, date-bounded
 * ride_requests read, distinct from Ride Monitoring's live-only tricycle
 * roster and Reports' paid-transactions-only view. Covers every status,
 * including cancelled/in-progress rides that never produce a transaction.
 */
export interface RideLogRow {
  id: string;
  passengerName: string | null;
  driverName: string | null;
  status: RideLogStatus;
  pickupLabel: string | null;
  destLabel: string | null;
  requestedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  finalFare: number | null;
  hasEmergencyAlert: boolean;
}
