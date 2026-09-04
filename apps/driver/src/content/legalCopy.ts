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
  'Terms of Service. By registering as a TriSakay driver, you agree to complete PSO verification before accepting rides, keep your tricycle’s registration and franchise current, and charge only the fare TriSakay computes and displays at trip completion, set under City Ordinance No. 08, s. 2023. You may accept or decline any ride request; once accepted, you agree to complete it in good faith and treat every passenger with courtesy and respect. Your assigned pickup zone follows the tricycle cluster rules of City Ordinance No. 37, s. 2018. PSO staff may suspend or deactivate your account for verified misconduct, safety violations, or repeated passenger complaints.',
  'Privacy Policy. TriSakay collects only what running the tricycle service requires: your name and contact number, your live location while you are online or on a trip, your tricycle and franchise details, your verification documents, and your trip and earnings history. Your location is transmitted only while you are marked available or on an active trip — TriSakay does not keep a location trail once you go offline. A matched passenger sees your name and plate number only, never your verification documents. PSO staff can view your documents, trip history, and ratings as part of overseeing the tricycle service. You may request a copy or deletion of your data by contacting PSO directly.',
  'Limitations. TriSakay is a prototype built for academic evaluation, piloted in Barangay Dadiangas West, General Santos City. Matching, fare, and location features are best-effort and may not reflect the reliability of a commercial dispatch system. Service availability, uptime, and data retention carry no formal guarantee. In an emergency, always contact 911 or PNP directly — the in-app SOS alert notifies PSO for record-keeping only and is not a substitute for calling emergency services.',
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
