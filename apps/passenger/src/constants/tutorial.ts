/**
 * AsyncStorage key marking the in-app coach-mark tour as seen (or skipped) by one account on this device.
 * Per account, not per device, so a brand new account on a phone that already ran the tour still gets it once.
 * Written on finish()/skip() by the TutorialProvider in app/_layout.tsx, read by usePassengerTutorialTrigger.
 */
export function passengerTutorialSeenKey(userId: string): string {
  return `trisakay_passenger_tutorial_seen_at:${userId}`;
}
