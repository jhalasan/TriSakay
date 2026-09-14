import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useTutorial } from '@trisakay/ui';

const ROUTE_BY_SCREEN: Record<string, string> = {
  dashboard: '/(tabs)/dashboard',
  requests: '/(tabs)/requests',
  activeTrip: '/trip/active',
  earnings: '/(tabs)/earnings',
};

/**
 * The tour drives navigation, not the driver: whenever the current step's
 * `screen` differs from the previous one, this replaces the route before the
 * coach mark paints on it. Kept out of packages/ui (which has no
 * expo-router dependency) — mounted once in app/_layout.tsx.
 */
export function useDriverTutorialNavigation() {
  const router = useRouter();
  const { active, currentStep } = useTutorial();
  const lastScreen = useRef<string | null>(null);

  useEffect(() => {
    if (!active || !currentStep) {
      // The tour drove us onto a demo screen (e.g. the active-trip step) that
      // the driver never really navigated to — leaving them stranded there
      // once the tour ends (finished toast or Skip tour) would be confusing.
      // Only fires once the tour has actually moved a screen (lastScreen set);
      // a fresh, never-started tour leaves ordinary navigation untouched.
      if (lastScreen.current !== null) router.replace('/(tabs)/dashboard');
      lastScreen.current = null;
      return;
    }
    if (currentStep.screen === lastScreen.current) return;
    lastScreen.current = currentStep.screen;

    const route = ROUTE_BY_SCREEN[currentStep.screen];
    if (route) router.replace(route);
  }, [active, currentStep, router]);
}
