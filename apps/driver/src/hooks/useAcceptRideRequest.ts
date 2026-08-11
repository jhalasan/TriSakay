import { useRouter } from 'expo-router';
import { getTripPassengerInfo } from '@trisakay/services';
import { useAuthStore } from '../store/useAuthStore';
import { useRequestsStore } from '../store/useRequestsStore';
import { useTripStore } from '../store/useTripStore';

/**
 * Shared by Dashboard's incoming-request card and the Requests tab — both
 * accept a pending request the same way and both need the passenger's
 * name/photo fetched right after, or one of the two entry points silently
 * leaves the trip screen showing a blank "Passenger" placeholder for the
 * whole trip.
 */
export function useAcceptRideRequest() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const accept = useRequestsStore((state) => state.accept);
  const startTrip = useTripStore((state) => state.startTrip);

  return async function acceptRideRequest(id: string) {
    if (useTripStore.getState().current) {
      router.push('/trip/active');
      return;
    }
    if (!user) return;
    const accepted = await accept(id, user.id);
    if (accepted) {
      startTrip(accepted, accepted.tripId);
      router.push('/trip/active');

      // Non-blocking — the trip screen renders immediately with a null
      // name/photo (Avatar already handles that) and fills in once this
      // resolves, same pattern as the passenger app's finding-driver.tsx.
      const { data } = await getTripPassengerInfo(accepted.id).catch(() => ({ data: null }));
      if (data) {
        useTripStore.getState().setPassengerInfo(data.passengerName, data.avatarUrl);
      }
    }
  };
}
