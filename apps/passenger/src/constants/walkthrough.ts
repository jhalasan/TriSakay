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
