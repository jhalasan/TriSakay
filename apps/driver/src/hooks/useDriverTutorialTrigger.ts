import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTutorial } from '@trisakay/ui';
import { DRIVER_TUTORIAL_SEEN_KEY } from '../constants/tutorial';
import { useAuthStore } from '../store/useAuthStore';
import { useRequestsStore } from '../store/useRequestsStore';
import { useTripStore } from '../store/useTripStore';
import { useVerificationStore } from '../store/useVerificationStore';

/**
 * Auto-starts the coach-mark tour the first time a driver reaches a state
 * where the duty switch actually works: authenticated, verification
 * approved, account not blocked, and — so the tour never hijacks a screen
 * the driver is mid-decision on — no active trip and no pending request
 * currently on screen. Runs once per qualifying sessionUserId; the actual
 * *TutorialSeenAt write happens in the TutorialProvider's onSkip/onFinish
 * (app/_layout.tsx), since those fire regardless of whether this hook or
 * Settings → Help → Replay app tour started the tour.
 */
export function useDriverTutorialTrigger() {
  const { active, start } = useTutorial();
  const sessionUserId = useAuthStore((state) => state.sessionUserId);
  const accountStatus = useAuthStore((state) => state.user?.accountStatus);
  const verificationStatus = useVerificationStore((state) => state.status);
  const hasActiveTrip = useTripStore((state) => state.current !== null);
  const hasPendingRequest = useRequestsStore((state) => state.pending.length > 0);
  const attemptedForUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionUserId || active) return;
    if (verificationStatus !== 'approved') return;
    if (accountStatus === 'suspended' || accountStatus === 'deactivated') return;
    if (hasActiveTrip || hasPendingRequest) return;
    if (attemptedForUserId.current === sessionUserId) return;

    attemptedForUserId.current = sessionUserId;
    AsyncStorage.getItem(DRIVER_TUTORIAL_SEEN_KEY)
      .catch(() => null)
      .then((value) => {
        if (value === null) start();
      });
  }, [sessionUserId, active, verificationStatus, accountStatus, hasActiveTrip, hasPendingRequest, start]);
}
