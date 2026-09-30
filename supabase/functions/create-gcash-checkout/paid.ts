// Pure helpers for create-gcash-checkout, kept free of Deno APIs so they can
// be unit-tested with node (see paid.test.ts).

export type SessionPaidState = 'paid' | 'pending' | 'mismatch';

/**
 * Reads a PayMongo "retrieve a checkout session" response and says whether
 * the session was paid for exactly `expectedCentavos`. `payments` is only
 * returned to a secret key, which the edge function holds. A paid payment
 * with a missing or different amount is a 'mismatch' (fails closed): the
 * caller must never mark such a transaction paid.
 */
export function isSessionPaid(session: unknown, expectedCentavos: number): SessionPaidState {
  const payments = (session as { data?: { attributes?: { payments?: unknown } } } | null)?.data?.attributes?.payments;
  if (!Array.isArray(payments)) return 'pending';

  const paid = payments.filter(
    (payment) => (payment as { attributes?: { status?: unknown } } | null)?.attributes?.status === 'paid',
  ) as { attributes: { amount?: unknown } }[];
  if (paid.length === 0) return 'pending';

  return paid.some((payment) => payment.attributes.amount === expectedCentavos) ? 'paid' : 'mismatch';
}

export interface FareRideRow {
  status: string;
  final_fare: number | null;
  estimated_fare: number | null;
  payment_requested_at: string | null;
}

/**
 * The fare a GCash checkout may charge for this ride, or null when the ride
 * cannot be paid right now. A completed ride charges its locked final fare.
 * An ongoing ride charges the estimated fare (which becomes the final fare on
 * completion) but only after the driver has asked for payment.
 */
export function fareForRide(ride: FareRideRow): number | null {
  if (ride.status === 'completed') return ride.final_fare;
  if (ride.status === 'ongoing' && ride.payment_requested_at) return ride.estimated_fare;
  return null;
}
