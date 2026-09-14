import type { TutorialStep } from './types';

/**
 * Passenger tour — 10 steps, 6 screens. Copy and frames are verbatim from
 * docs/design_handoff_trisakay_tutorials/{README.md,CLAUDE_CODE_PROMPT.md}
 * (locked 2026-09-14) — do not paraphrase, re-punctuate, or "improve" it.
 * `screen` keys are consumed by apps/passenger/src/hooks/usePassengerTutorialNavigation.ts
 * to route before painting each coach mark.
 */
export const PASSENGER_STEPS: TutorialStep[] = [
  {
    screen: 'home',
    targetId: 'greeting-header',
    tip: 'below',
    frame: { top: 44, left: 10, width: 370, height: 164, radius: 26 },
    title: 'Your header',
    body: 'Your name, trips so far and your fare discount. The bell shows ride updates and driver messages.',
  },
  {
    screen: 'home',
    targetId: 'request-cta',
    tip: 'below',
    frame: { top: 226, left: 10, width: 370, height: 102, radius: 24 },
    title: 'Book a ride',
    body: 'Tap Request a Tricycle. This is the only way in — it shows the starting fare and how many drivers are nearby.',
  },
  {
    screen: 'home',
    targetId: 'saved-places',
    tip: 'below',
    frame: { top: 332, left: 8, width: 374, height: 268, radius: 20 },
    title: 'Saved places',
    body: 'Home, Work and Campus book in one tap. Add or rename them any time from Manage.',
  },
  {
    screen: 'home',
    targetId: 'tab-bar',
    tip: 'above',
    frame: { top: 778, left: 6, width: 378, height: 66, radius: 22 },
    title: 'Move around the app',
    body: 'History for past rides and receipts, Complaints to report a trip, Profile and Settings for your account.',
  },
  {
    screen: 'book',
    targetId: 'route-card',
    tip: 'below',
    frame: { top: 52, left: 10, width: 370, height: 142, radius: 24 },
    title: 'Set pickup and destination',
    body: 'Pickup fills in from your location — tap the second row to choose where you are going, or pick a suggestion below.',
  },
  {
    screen: 'confirm',
    targetId: 'fare-sheet',
    tip: 'above',
    frame: { top: 599, left: 10, width: 370, height: 238, radius: 28 },
    title: 'Check the fare first',
    body: 'You see the exact fare, your discount and the payment method before anything is booked. Tap Confirm ride when it looks right.',
  },
  {
    screen: 'trip',
    targetId: 'driver-card',
    tip: 'above',
    frame: { top: 694, left: 10, width: 370, height: 140, radius: 28 },
    title: 'Your driver, and safety',
    body: 'Follow the tricycle on the map and check the plate before you board. Hold Emergency SOS to alert the operator and your emergency contact.',
  },
  {
    screen: 'complaint',
    targetId: 'trip-and-category',
    tip: 'below',
    frame: { top: 127, left: 10, width: 370, height: 188, radius: 22 },
    title: 'Report a problem',
    body: 'Open Complaints, pick the trip it happened on and choose a category — fare dispute, driver conduct, safety or vehicle condition.',
  },
  {
    screen: 'complaint',
    targetId: 'evidence-and-submit',
    tip: 'above',
    frame: { top: 528, left: 10, width: 370, height: 188, radius: 22 },
    title: 'Add proof, then submit',
    body: 'Attach up to three photos of the receipt or the tricycle. Submit sends it straight to the operator with your trip details already attached.',
  },
  {
    screen: 'status',
    targetId: 'progress-card',
    tip: 'below',
    frame: { top: 200, left: 10, width: 370, height: 231, radius: 24 },
    title: 'Follow your case',
    body: 'Every complaint gets a reference number and a status you can track — received, under review, resolved. You are notified at each step.',
  },
];

/** Greeting is "Hi {firstName}!" at runtime — the handoff's "Hi Maria!" is the locked example, not a literal string to ship. */
export const PASSENGER_WELCOME_BODY =
  'Welcome to TriSakay. Let us walk you through one full booking — seven taps and you will know how the whole app works.';

export const PASSENGER_FINISHED_MESSAGE = 'That is the whole app. Enjoy the ride!';
