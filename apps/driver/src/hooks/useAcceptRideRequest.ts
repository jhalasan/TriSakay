import { useState } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { getTripPassengerInfo } from '@trisakay/services';
import { useAuthStore } from '../store/useAuthStore.ts';
import { useRequestsStore } from '../store/useRequestsStore.ts';
import { useTripStore } from '../store/useTripStore.ts';

/**
 * Shared by Dashboard's incoming-request card, the Requests tab, and the
 * mid-trip request board on trip/active.tsx (FR-2.5c) — all three accept a
 * pending request the same way and all need the passenger's name/photo
 * fetched right after, or the trip screen shows a blank "Passenger"
 * placeholder for that leg. acceptRideRequest() (packages/services) already
 * attaches the request to an existing active trip server-side when one
 * exists — this hook just mirrors that onto the client: addPassenger() when
 * a trip is already underway, startTrip() only for the very first passenger.
 *
 * `acceptingId` tracks which request id (if any) is currently mid-accept, so
 * callers rendering a list (Requests tab) can disable/spin just that card's
 * button rather than a single screen-wide flag — without it, a fast
 * double-tap could fire the accept RPC for the same request twice.
 */
export function useAcceptRideRequest() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const accept = useRequestsStore((state) => state.accept);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  async function acceptRideRequest(id: string) {
    if (!user || acceptingId) return;
    setAcceptingId(id);
    const accepted = await accept(id, user.id);
    setAcceptingId(null);
    if (accepted) {
      if (useTripStore.getState().current) {
        useTripStore.getState().addPassenger(accepted);
      } else {
        useTripStore.getState().startTrip(accepted, accepted.tripId);
      }
      // A mid-trip pickup (FR-2.5c) is accepted from trip/active.tsx's own
      // request board — pushing here again would stack a duplicate instance
      // of the screen the driver is already standing on.
      if (pathname !== '/trip/active') router.push('/trip/active');

      // Non-blocking — the trip screen renders immediately with a null
      // name/photo (Avatar already handles that) and fills in once this
      // resolves, same pattern as the passenger app's finding-driver.tsx.
      const { data } = await getTripPassengerInfo(accepted.id).catch(() => ({ data: null }));
      if (data) {
        useTripStore.getState().setPassengerInfo(accepted.id, data.passengerId, data.passengerName, data.avatarUrl);
      }
    }
  }

  return { acceptRideRequest, acceptingId };
}
