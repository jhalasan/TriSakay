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
