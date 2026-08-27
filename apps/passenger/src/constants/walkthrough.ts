/** AsyncStorage key marking the first-launch walkthrough as seen. Shared between splash.tsx (reads it to decide routing) and walkthrough.tsx (writes it on Skip/Get Started). */
export const WALKTHROUGH_SEEN_KEY = 'trisakay_walkthrough_seen';

/**
 * Set after the first successful sign-in on this device. Distinct from
 * WALKTHROUGH_SEEN_KEY, which is written before login (by walkthrough.tsx's
 * Skip/Get Started) and so cannot answer "has this rider ever signed in
 * here" — this key is what login.tsx reads to decide between "Welcome back"
 * and a first-visit greeting.
 */
export const HAS_SIGNED_IN_KEY = 'trisakay_has_signed_in';

export type WalkthroughIllustration = 'route' | 'fare' | 'verified';

export interface WalkthroughSlide {
  illustration: WalkthroughIllustration;
  title: string;
  subtitle: string;
}

export const WALKTHROUGH_SLIDES: WalkthroughSlide[] = [
  {
    illustration: 'route',
    title: 'Book a ride\nin seconds',
    subtitle: 'Set your pickup and drop-off. A nearby verified driver is on the way.',
  },
  {
    illustration: 'fare',
    title: 'Know the fare\nbefore you go',
    subtitle: 'Pricing follows the approved fare matrix, broken down in full before you confirm. No haggling.',
  },
  {
    illustration: 'verified',
    title: 'Every driver,\nverified',
    subtitle: 'Checked by the PSO before they can accept a ride. Track your trip in real time, pickup to drop-off.',
  },
];
