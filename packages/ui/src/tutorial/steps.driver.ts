import type { TutorialStep } from './types';

/**
 * Driver tour — 8 steps, 4 screens. Copy and frames are verbatim from
 * docs/design_handoff_trisakay_tutorials/{README.md,CLAUDE_CODE_PROMPT.md}
 * (locked 2026-09-14) — do not paraphrase, re-punctuate, or "improve" it.
 * `screen` keys are consumed by apps/driver/src/hooks/useDriverTutorialNavigation.ts
 * to route before painting each coach mark.
 */
export const DRIVER_STEPS: TutorialStep[] = [
  {
    screen: 'dashboard',
    targetId: 'duty-console',
    tip: 'below',
    frame: { top: 118, left: 12, width: 366, height: 203, radius: 24 },
    title: 'Go online',
    body: 'This switch is the whole job. Flip it on and requests start reaching you; offline, nothing comes through and your day is paused.',
  },
  {
    screen: 'dashboard',
    targetId: 'earnings-today',
    tip: 'below',
    frame: { top: 184, left: 24, width: 210, height: 80, radius: 14 },
    title: 'Earnings today',
    body: 'What you have collected so far today, with trips, rating and acceptance rate under the line. The app never holds the money — fares are paid to you directly.',
  },
  {
    screen: 'dashboard',
    targetId: 'incoming-request',
    tip: 'below',
    frame: { top: 359, left: 12, width: 366, height: 242, radius: 24 },
    title: 'Accept or decline',
    body: 'Every request shows the fare, the payment method, how far the pickup is and where it ends before you decide. Accept locks the ride to you; the countdown passes it on if you wait.',
  },
  {
    screen: 'dashboard',
    targetId: 'tab-bar',
    tip: 'above',
    frame: { top: 778, left: 6, width: 378, height: 66, radius: 22 },
    title: 'Move around the app',
    body: 'Requests for the full queue, History for finished trips, Earnings for your records, Profile for your documents and account.',
  },
  {
    screen: 'requests',
    targetId: 'scope-filters',
    tip: 'below',
    frame: { top: 118, left: 12, width: 366, height: 48, radius: 26 },
    title: 'Filter the queue',
    body: 'Along route keeps requests pointed the way you are already driving. Nearby widens it to anything close, All shows the whole barangay.',
  },
  {
    screen: 'activeTrip',
    targetId: 'passenger-card',
    tip: 'above',
    frame: { top: 460, left: 16, width: 358, height: 210, radius: 22 },
    title: 'Run the trip',
    body: 'Tick Confirm cash received when the passenger pays, then Complete. More than one passenger can ride the same trip — each has their own row.',
  },
  {
    screen: 'activeTrip',
    targetId: 'sos',
    tip: 'above',
    frame: { top: 672, left: 20, width: 350, height: 86, radius: 18 },
    title: 'Emergency SOS',
    body: 'Press and hold if you are in immediate danger. It alerts the operator with your location and opens the call to 911 / PNP.',
  },
  {
    screen: 'earnings',
    targetId: 'tracked-total',
    tip: 'below',
    frame: { top: 117, left: 12, width: 366, height: 94, radius: 18 },
    title: 'Your earnings record',
    body: 'Weekly total, a bar per day and a settlement log you can show the operator. This is record-keeping, not a wallet.',
  },
];

/** Greeting is "Hi {firstName}!" at runtime — the handoff's "Hi Jomar!" is the locked example, not a literal string to ship. */
export const DRIVER_WELCOME_BODY =
  'Your account is verified. Eight taps and you will know the whole app — going online, taking a request, running the trip, and reading your earnings.';

export const DRIVER_FINISHED_MESSAGE = "You're set. Drive safe out there!";
