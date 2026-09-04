/**
 * Shared between the registration flow (shown before account creation) and
 * the post-signin consent gate (`app/consent.tsx`, the fallback for the
 * check_email path and future re-consent on a legal version bump) — kept in
 * one place so the two can never drift apart.
 *
 * Drafted prototype copy, not yet reviewed/finalized by the project owner —
 * replaces the earlier literal "Placeholder —" text. Written to accurately
 * reflect this app's actual data practices (see DISCLOSURES below and
 * docs/SCHEMA.MD's RLS policies), but still pending sign-off before being
 * treated as final.
 */
export const POLICY_BODY = [
  'Terms of Service. By using TriSakay to book a ride, you agree to pay the fare shown at trip completion, computed under City Ordinance No. 08, s. 2023, using either cash or GCash. You agree to treat your driver with courtesy and respect, and to cancel a ride you no longer need as early as possible so it can be reassigned. A valid senior citizen, PWD, or student ID is required to claim the ordinance’s fare discount, subject to PSO review. TriSakay may suspend an account for fraudulent discount claims, repeated no-shows, or abusive behavior toward drivers.',
  'Privacy Policy. TriSakay collects only what booking and completing a ride requires: your name and contact number, your pickup and drop-off locations, your ride and payment history, and — if you apply for a fare discount — a photo of your qualifying ID. Your location is used only while a ride is active; TriSakay does not keep a trail of where you go outside a trip. A matched driver sees your name and pickup location only. Payment details are sent directly to GCash to process your fare — TriSakay never stores your GCash credentials. PSO staff can view your ride history and any discount documents as part of overseeing the tricycle service.',
  'Limitations. TriSakay is a prototype built for academic evaluation, piloted in Barangay Dadiangas West, General Santos City. Driver matching and fare estimates are best-effort and may not reflect the reliability of a commercial ride-hailing service. Service availability, uptime, and data retention carry no formal guarantee. In an emergency, always contact 911 or PNP directly — the in-app SOS alert notifies PSO for record-keeping only and is not a substitute for calling emergency services.',
];

/** FR-11.2 — the four disclosures that must be stated in plain language. */
export const DISCLOSURES: { title: string; body: string }[] = [
  {
    title: 'Your name and contact number',
    body: 'Shared with your driver only after you are matched, and only for that ride.',
  },
  {
    title: 'Your live location',
    body: 'Used only while a ride is active. TriSakay does not keep a trail of where you go.',
  },
  {
    title: 'Ride and payment history',
    body: 'Kept on your account. PSO staff can see it as part of overseeing the tricycle service.',
  },
  {
    title: 'Payment details',
    body: 'Sent to GCash to process your payment. TriSakay never stores your GCash credentials.',
  },
];
