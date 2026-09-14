import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSegments } from 'expo-router';
import { useTutorial } from '@trisakay/ui';
import { PASSENGER_TUTORIAL_SEEN_KEY } from '../constants/tutorial';
import { useAuthStore } from '../store/useAuthStore';
import { useConsentStore } from '../store/useConsentStore';

/**
 * Auto-starts the coach-mark tour once, on the first launch after login —
 * authenticated, consent accepted, and landed on the Home tab (where the
 * welcome sheet and the tour's first step live). Runs once per qualifying
 * sessionUserId; the actual *TutorialSeenAt write happens in the
 * TutorialProvider's onSkip/onFinish (app/_layout.tsx), since those fire
 * regardless of whether this hook or Settings → Help → Replay app tour
 * started the tour.
 */
export function usePassengerTutorialTrigger() {
  const { active, start } = useTutorial();
  const sessionUserId = useAuthStore((state) => state.sessionUserId);
  const consentStatus = useConsentStore((state) => state.status);
  const segments = useSegments() as string[];
  const onHomeTab = segments[0] === '(tabs)' && (segments[1] === 'home' || segments[1] === undefined);
  const attemptedForUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionUserId || active) return;
    if (consentStatus !== 'accepted') return;
    if (!onHomeTab) return;
    if (attemptedForUserId.current === sessionUserId) return;

    attemptedForUserId.current = sessionUserId;
    AsyncStorage.getItem(PASSENGER_TUTORIAL_SEEN_KEY)
      .catch(() => null)
      .then((value) => {
        if (value === null) start();
      });
  }, [sessionUserId, active, consentStatus, onHomeTab, start]);
}
