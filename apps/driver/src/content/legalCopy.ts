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
  'Placeholder — Terms of Service. By driving for TriSakay you agree to accept ride requests in good faith, treat passengers with respect, and follow the fare shown at trip completion. Fares follow City Ordinance No. 08, s. 2023.',
  'Placeholder — Privacy Policy. TriSakay collects only what matching a ride needs. The summary below is the short version; the full policy will describe each item, how long it is kept, and how to request deletion.',
  'Placeholder — Limitations. TriSakay is a prototype built for academic evaluation in Barangay Dadiangas West. Service availability is best-effort and carries no formal guarantee.',
];

export const DISCLOSURES: { title: string; body: string }[] = [
  {
    title: 'Your name and contact number',
    body: 'Shared with a matched passenger only after acceptance, and only for that ride.',
  },
  {
    title: 'Your live location',
    body: 'Transmitted only while you are marked available or on an active trip. TriSakay does not keep a trail of where you go.',
  },
  {
    title: 'Trip and payment history',
    body: 'Kept on your account. PSO staff can see it as part of overseeing the tricycle service.',
  },
  {
    title: 'Verification documents',
    body: "Your license, OR/CR, franchise, and tricycle photo are visible to PSO staff for review only.",
  },
];
