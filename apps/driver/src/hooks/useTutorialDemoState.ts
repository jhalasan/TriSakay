import { useTutorial } from '@trisakay/ui';
import type { PendingRequest } from '@trisakay/ui';
import type { ActiveTrip } from '../types/trip';

/**
 * Fixed demo content for the driver coach-mark tour (docs/design_handoff_trisakay_tutorials).
 * Every value here is display-only — screens substitute it for their real
 * store-derived state while the tour is on that exact screen, and every
 * Accept/Decline/Complete/Confirm-cash/SOS handler becomes a no-op for the
 * duration. Never touches a live query, never a real mutation.
 */

const DEMO_REQUEST: PendingRequest = {
  id: '__tutorial_demo_request__',
  seats: 2,
  paymentMethod: 'cash',
  pickupLabel: 'Poblacion Plaza, waiting shed',
  dropoffLabel: 'Public Market, Stall 14',
  fare: 45,
  createdAt: new Date().toISOString(),
  pickupDistanceMeters: 400,
  expiresAt: null,
};

const DEMO_REQUEST_2: PendingRequest = {
  id: '__tutorial_demo_request_2__',
  seats: 1,
  paymentMethod: 'gcash',
  pickupLabel: 'Dadiangas West Elementary',
  dropoffLabel: 'Bulaong Terminal',
  fare: 25,
  createdAt: new Date().toISOString(),
  pickupDistanceMeters: 850,
  expiresAt: null,
};

const DEMO_TRIP: ActiveTrip = {
  tripId: '__tutorial_demo_trip__',
  startedAt: new Date().toISOString(),
  passengers: [
    {
      id: '__tutorial_demo_passenger__',
      passengerId: null,
      passengerName: 'Maria Reyes',
      passengerAvatarUrl: null,
      seats: 2,
      paymentMethod: 'cash',
      fare: 45,
      cashConfirmed: false,
      status: 'ongoing',
      // Demo-only coordinates near the app's default map center (Barangay
      // Dadiangas West) — this passenger never touches the backend.
      pickupLat: 6.1128,
      pickupLng: 125.1717,
      destLat: 6.1188,
      destLng: 125.1655,
    },
  ],
};

/** True only while the tour is active AND its current step targets this screen key. */
function useIsTutorialScreen(screen: string): boolean {
  const { active, currentStep } = useTutorial();
  return active && currentStep?.screen === screen;
}

export interface DashboardTutorialDemo {
  active: boolean;
  data: {
    isAvailable: true;
    todayEarnings: number;
    todayTrips: number;
    rating: number;
    ratingCount: number;
    acceptRate: number;
    pending: PendingRequest[];
    countdown: number;
  };
}

export function useDashboardTutorialDemo(): DashboardTutorialDemo {
  return {
    active: useIsTutorialScreen('dashboard'),
    data: {
      isAvailable: true,
      todayEarnings: 845,
      todayTrips: 12,
      rating: 4.8,
      ratingCount: 40,
      acceptRate: 0.92,
      pending: [DEMO_REQUEST],
      countdown: 18,
    },
  };
}

export interface RequestsTutorialDemo {
  active: boolean;
  data: { pending: PendingRequest[] };
}

export function useRequestsTutorialDemo(): RequestsTutorialDemo {
  return { active: useIsTutorialScreen('requests'), data: { pending: [DEMO_REQUEST, DEMO_REQUEST_2] } };
}

export interface ActiveTripTutorialDemo {
  active: boolean;
  data: ActiveTrip;
}

export function useActiveTripTutorialDemo(): ActiveTripTutorialDemo {
  return { active: useIsTutorialScreen('activeTrip'), data: DEMO_TRIP };
}

export interface EarningsTutorialDemo {
  active: boolean;
  data: { totalTracked: number };
}

export function useEarningsTutorialDemo(): EarningsTutorialDemo {
  return { active: useIsTutorialScreen('earnings'), data: { totalTracked: 4320 } };
}
