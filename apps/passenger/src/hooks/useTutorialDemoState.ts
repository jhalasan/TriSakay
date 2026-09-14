import { useTutorial } from '@trisakay/ui';
import type { Driver } from '../types/driver';
import type { LocationPoint } from '../types/booking';

/**
 * Fixed demo content for the passenger coach-mark tour (docs/design_handoff_trisakay_tutorials).
 * Every value here is display-only — screens substitute it for their real
 * store-derived state while the tour is on that exact screen, and every
 * Confirm ride / Submit / SOS handler becomes a no-op for the duration.
 * Never touches a live query, never a real mutation, never writes to a
 * shared store (each screen keeps its own local override instead).
 */

/** The id booking/complaints screens seed for the tour's fake complaint — also what the navigation hook routes to for the "status" step. */
export const TUTORIAL_DEMO_COMPLAINT_ID = '__tutorial_demo_complaint__';

/** True only while the tour is active AND its current step targets this screen key. */
function useIsTutorialScreen(screen: string): boolean {
  const { active, currentStep } = useTutorial();
  return active && currentStep?.screen === screen;
}

const DEMO_DROPOFF: LocationPoint = {
  label: 'Public Market, Stall 14',
  address: 'Public Market, Stall 14, Barangay Poblacion',
  latitude: 6.1128,
  longitude: 125.1716,
};

export interface ConfirmTutorialDemo {
  active: boolean;
  data: {
    dropoff: LocationPoint;
    fare: number;
    discountApproved: true;
    discountRatePercent: number;
    paymentMethod: 'cash';
  };
}

export function useConfirmTutorialDemo(): ConfirmTutorialDemo {
  return {
    active: useIsTutorialScreen('confirm'),
    data: { dropoff: DEMO_DROPOFF, fare: 45, discountApproved: true, discountRatePercent: 20, paymentMethod: 'cash' },
  };
}

const DEMO_DRIVER: Driver = {
  id: '__tutorial_demo_driver__',
  name: 'Juan Dela Cruz',
  plateNumber: 'TRK 2841',
  rating: 4.9,
  etaMinutes: 4,
  avatarUrl: null,
};

export interface TripTutorialDemo {
  active: boolean;
  data: { driver: Driver; seats: number; fare: number };
}

export function useTripTutorialDemo(): TripTutorialDemo {
  return { active: useIsTutorialScreen('trip'), data: { driver: DEMO_DRIVER, seats: 2, fare: 45 } };
}

export interface ComplaintFormTutorialDemo {
  active: boolean;
  data: { relatedTripLabel: string; category: 'fare' };
}

export function useComplaintFormTutorialDemo(): ComplaintFormTutorialDemo {
  return { active: useIsTutorialScreen('complaint'), data: { relatedTripLabel: 'Juan Dela Cruz · Sep 12', category: 'fare' } };
}

export interface ComplaintStatusTutorialDemo {
  active: boolean;
  data: {
    id: string;
    subject: string;
    status: 'under_review';
    categoryLabel: string;
    filedLabel: string;
    receivedAtLabel: string;
  };
}

export function useComplaintStatusTutorialDemo(): ComplaintStatusTutorialDemo {
  const { active, currentStep } = useTutorial();
  return {
    active: active && currentStep?.screen === 'status',
    data: {
      id: TUTORIAL_DEMO_COMPLAINT_ID,
      subject: 'Charged above the fare matrix',
      status: 'under_review',
      categoryLabel: 'Fare dispute',
      filedLabel: 'Sep 12',
      receivedAtLabel: 'Sep 12, 9:14 AM',
    },
  };
}
