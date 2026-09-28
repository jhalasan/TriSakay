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
  /**
   * Which of the new-complaint flow's two local steps the tour is
   * spotlighting right now — the 'complaint' screen has two coach marks
   * (trip-and-category on step 1, evidence-and-submit on step 2), so the
   * screen must force its own `step` state to match whichever is current
   * rather than always resting on step 1.
   */
  step: 1 | 2 | null;
  data: { relatedTripLabel: string; pickup: string; dropoff: string; fare: number; category: 'fare' };
}

export function useComplaintFormTutorialDemo(): ComplaintFormTutorialDemo {
  const { active, currentStep } = useTutorial();
  const onScreen = active && currentStep?.screen === 'complaint';
  return {
    active: onScreen,
    step: onScreen ? (currentStep?.targetId === 'evidence-and-submit' ? 2 : 1) : null,
    data: {
      relatedTripLabel: 'Juan Dela Cruz · Sep 12',
      pickup: 'Home, Purok 5',
      dropoff: 'Public Market, Stall 14',
      fare: 45,
      category: 'fare',
    },
  };
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
