import { getActiveRideForPassenger, getTripDriverInfo } from '@trisakay/services';
import { useBookingStore } from '../store/useBookingStore';
import { REQUEST_TIMEOUT_MS, withTimeout } from './withTimeout';

/**
 * Re-hydrates useBookingStore from the passenger's own most recent
 * `pending`/`assigned`/`ongoing` ride request, if any, and returns where to
 * send them. Without this, useBookingStore always boots empty — a passenger
 * whose app restarted mid-ride would land on Home with a clean slate and
 * could start an entirely new booking while the backend still has their old
 * one active and a driver who thinks they still have this passenger.
 *
 * Stops at 'ongoing' — a 'completed' ride's payment/rating recovery is a
 * separate, already-tracked gap (both are still mock/local on those
 * screens), not something re-hydrating the booking store can fix. 'ongoing'
 * itself must be handled here (routed to /booking/trip, same as 'assigned')
 * because a ride now spends its entire in-tricycle duration in that state,
 * not just an instant.
 *
 * Shared between splash.tsx (cold start) and _layout.tsx (same-session
 * sign-in and foreground resync, R5 UAT audit) — one tested code path for
 * every way a passenger can land back in the app with a ride already live.
 */
export async function resolveActiveRideRoute(
  passengerId: string,
): Promise<{ pathname: '/booking/trip'; status: 'assigned' | 'ongoing' } | { pathname: '/booking/finding-driver' } | null> {
  const { data } = await withTimeout(getActiveRideForPassenger(passengerId), REQUEST_TIMEOUT_MS, 'Active ride lookup timed out').catch(
    () => ({ data: null }),
  );
  if (!data) return null;

  useBookingStore.setState({
    rideRequestId: data.id,
    pickup: {
      label: data.pickupLabel ?? 'Pickup',
      address: data.pickupLabel ?? 'Pickup',
      latitude: data.pickupLat,
      longitude: data.pickupLng,
    },
    dropoff: {
      label: data.destLabel ?? 'Drop-off',
      address: data.destLabel ?? 'Drop-off',
      latitude: data.destLat,
      longitude: data.destLng,
    },
    seats: data.seats,
    fare: data.estimatedFare,
    paymentMethod: data.preferredMethod,
  });

  if (data.status !== 'assigned' && data.status !== 'ongoing') {
    useBookingStore.setState({ tripStatus: 'searching' });
    return { pathname: '/booking/finding-driver' };
  }

  const { data: driverInfo } = await withTimeout(getTripDriverInfo(data.id), REQUEST_TIMEOUT_MS, 'Driver lookup timed out').catch(() => ({
    data: null,
  }));
  useBookingStore.setState({
    driver: {
      id: driverInfo?.driverId ?? '',
      name: driverInfo?.driverName ?? '',
      plateNumber: driverInfo?.plateNo ?? '',
      rating: driverInfo?.ratingAvg ?? null,
      etaMinutes: null,
      avatarUrl: driverInfo?.avatarUrl ?? null,
    },
    tripStatus: 'matched',
  });
  return { pathname: '/booking/trip', status: data.status };
}
