import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useTutorial } from '@trisakay/ui';
import { TUTORIAL_DEMO_COMPLAINT_ID } from './useTutorialDemoState';

const ROUTE_BY_SCREEN: Record<string, string> = {
  home: '/(tabs)/home',
  book: '/booking/request',
  confirm: '/booking/confirm',
  trip: '/booking/trip',
  complaint: '/(tabs)/complaints',
  status: `/complaints/${TUTORIAL_DEMO_COMPLAINT_ID}`,
};

/**
 * The tour drives navigation, not the rider: whenever the current step's
 * `screen` differs from the previous one, this replaces the route before the
 * coach mark paints on it. Kept out of packages/ui (which has no
 * expo-router dependency) — mounted once in app/_layout.tsx.
 */
export function usePassengerTutorialNavigation() {
  const router = useRouter();
  const { active, currentStep } = useTutorial();
  const lastScreen = useRef<string | null>(null);

  useEffect(() => {
    if (!active || !currentStep) {
      lastScreen.current = null;
      return;
    }
    if (currentStep.screen === lastScreen.current) return;
    lastScreen.current = currentStep.screen;

    const route = ROUTE_BY_SCREEN[currentStep.screen];
    if (route) router.replace(route);
  }, [active, currentStep, router]);
}
