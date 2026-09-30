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
  /** D2: when the ride was accepted / picked up, and its booked distance — the nearest-next-stop sort's overdue rule. */
  assignedAt: string | null;
  pickedUpAt: string | null;
  distanceKm: number | null;
  /** F4: set once the driver taps "I've arrived" at this passenger's pickup point. */
  arrivedAt: string | null;
  /** D1: set only while an after-pickup transfer TO this driver is accepted but not yet handoff-confirmed — where to meet the previous driver. */
  handoffLat: number | null;
  handoffLng: number | null;
  /** Set once the driver has asked this passenger to pay by GCash; the passenger's app then opens its payment screen. */
  paymentRequestedAt: string | null;
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
