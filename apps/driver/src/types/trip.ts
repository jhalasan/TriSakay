import type { PaymentMethod } from './request';

/** FR-2.5c mid-trip pickup — one passenger's leg on a trip, closable independently of any other passenger aboard. */
export interface ActivePassenger {
  /** ride_requests.id — used for complete/cancel/cash-confirm calls. */
  id: string;
  /** Populated by the same setPassengerInfo() follow-up fetch as passengerName/passengerAvatarUrl. */
  passengerId: string | null;
  passengerName: string | null;
  passengerAvatarUrl: string | null;
  seats: number;
  paymentMethod: PaymentMethod;
  fare: number | null;
  cashConfirmed: boolean;
  /** 'assigned' (needs Start) or 'ongoing' (picked up, needs Complete). */
  status: 'assigned' | 'ongoing';
  /**
   * P1-14 (2026-09-15 launch audit): the active-trip map's routing target —
   * this passenger's pickup point while 'assigned', or their destination
   * once 'ongoing'. Nullable because the request board's response can omit
   * them in edge cases (see PendingRequest); the map degrades to no
   * marker/route rather than crashing when null.
   */
  pickupLat: number | null;
  pickupLng: number | null;
  destLat: number | null;
  destLng: number | null;
}

/**
 * trips.status='active' means "driver is out working," independent of how
 * many passengers happen to be aboard right now — `passengers` can be an
 * empty array between pickups (FR-2.5c's "stay parked" model), not just a
 * transient state on the way to ending the trip.
 */
export interface ActiveTrip {
  tripId: string;
  startedAt: string;
  passengers: ActivePassenger[];
}
