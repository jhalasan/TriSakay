/**
 * Where the passenger goes around payment. Pure so the decisions can be tested.
 */

/**
 * The driver has asked for payment: only an ongoing ride that is still GCash
 * and whose payment was requested. A ride the driver switched to cash keeps
 * its old `payment_requested_at`, but must never open a GCash checkout.
 */
export function shouldOpenPaymentScreen(row: {
  status: string;
  preferred_method?: 'cash' | 'gcash';
  payment_requested_at?: string | null;
}): boolean {
  return row.status === 'ongoing' && row.preferred_method === 'gcash' && !!row.payment_requested_at;
}

/**
 * After a payment succeeds: if the driver has already completed the ride the
 * passenger is done, otherwise (paid mid-ride, driver still to tap Complete)
 * they go back to the ride screen, which moves on when the ride completes.
 * Unknown states go to the ride screen, which resolves the real state itself.
 */
export function routeAfterPayment(rideStatus: string | null): '/booking/trip' | '/booking/trip-complete' {
  return rideStatus === 'completed' ? '/booking/trip-complete' : '/booking/trip';
}
