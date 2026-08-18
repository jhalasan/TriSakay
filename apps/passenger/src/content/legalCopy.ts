/**
 * Shared between the registration flow (shown before account creation) and
 * the post-signin consent gate (`app/consent.tsx`, the fallback for the
 * check_email path and future re-consent on a legal version bump) — kept in
 * one place so the two can never drift apart.
 *
 * Placeholder. Final legal copy is being drafted separately and replaces
 * this verbatim.
 */
export const POLICY_BODY = [
  'Placeholder — Terms of Service. By using TriSakay you agree to book rides in good faith, to treat drivers with respect, and to pay the fare shown at the end of each trip. Fares follow City Ordinance No. 08, s. 2023.',
  'Placeholder — Privacy Policy. TriSakay collects only what a ride needs. The summary below is the short version; the full policy will describe each item, how long it is kept, and how to request deletion.',
  'Placeholder — Limitations. TriSakay is a prototype built for academic evaluation in Barangay Dadiangas West. Service availability is best-effort and carries no formal guarantee.',
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
