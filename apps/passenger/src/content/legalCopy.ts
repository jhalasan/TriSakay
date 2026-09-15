/**
 * Shared between the registration flow (shown before account creation) and
 * the post-signin consent gate (`app/consent.tsx`, the fallback for the
 * check_email path and re-consent on a legal version bump) and the Legal
 * screen (`app/profile/legal.tsx`) — kept in one place so all three can
 * never drift apart.
 *
 * A full, numbered Terms of Service and Privacy Policy modeled on how a
 * real consumer app structures these documents, written to accurately
 * reflect this app's actual data practices (see docs/SCHEMA.MD's RLS
 * policies). This is still drafted copy for an academic capstone project,
 * not a document reviewed by a lawyer, and should get real legal review
 * before this app is ever used outside a supervised pilot.
 */
export interface PolicySection {
  heading: string;
  body: string;
}

export const TERMS_OF_SERVICE: PolicySection[] = [
  {
    heading: '1. Acceptance of these Terms',
    body: 'By creating a TriSakay account or booking a ride, you agree to be bound by these Terms of Service and the Privacy Policy below. If you do not agree, please do not use the app.',
  },
  {
    heading: '2. What TriSakay Is',
    body: 'TriSakay is a mobile booking service that connects passengers with independently operated tricycle drivers within its pilot service area. TriSakay does not own or operate any tricycle. The trip itself is provided by the driver you are matched with, not by TriSakay.',
  },
  {
    heading: '3. Eligibility',
    body: 'You must be at least 18 years old, or booking with the help of a parent or guardian, to create a TriSakay account. You are responsible for the accuracy of the information you register with and for keeping your account credentials confidential.',
  },
  {
    heading: '4. Booking and Matching',
    body: 'When you request a ride, TriSakay matches you with an available driver based on proximity, route direction, and the tricycle cluster rules set by City Ordinance No. 37, series of 2018. A match is not guaranteed, and TriSakay may be unable to find an available driver during periods of high demand.',
  },
  {
    heading: '5. Fares and Payment',
    body: 'Your fare is calculated under the rates set by City Ordinance No. 08, series of 2023, and shown to you before and after the trip. You agree to pay the fare in full, using either cash paid directly to your driver or GCash processed through the app. TriSakay does not set fares on its own and cannot guarantee that an estimate shown before a trip will exactly match the amount due at completion.',
  },
  {
    heading: '6. Fare Discounts',
    body: 'Senior citizens, persons with disabilities, and students may apply for the discount provided under City Ordinance No. 08 by submitting a valid supporting identification document for review. TriSakay and the Public Safety Office, referred to as PSO, may deny or revoke a discount found to be fraudulent, and may suspend an account that submits false discount documentation.',
  },
  {
    heading: '7. Cancellations',
    body: 'You may cancel a ride request at any time before your driver arrives. Please cancel as early as possible if you no longer need the ride, so it can be offered to another passenger. Repeated late cancellations or failing to show up for a confirmed ride may lead to a warning or a temporary restriction on your account.',
  },
  {
    heading: '8. Your Conduct',
    body: 'You agree to treat every driver with courtesy and respect, to be present and ready at your stated pickup point, and to avoid any behavior that is abusive, discriminatory, or unsafe. You may not use TriSakay for any unlawful purpose.',
  },
  {
    heading: '9. Suspension and Termination',
    body: 'PSO may suspend, restrict, or close your account if you violate these terms, submit fraudulent information, behave abusively toward a driver, or misuse the emergency alert feature. You may stop using TriSakay and ask PSO to close your account at any time.',
  },
  {
    heading: '10. A Pilot Service',
    body: 'TriSakay is a pilot service built as an academic capstone project, currently piloted in Barangay Dadiangas West, General Santos City. It is provided on a best effort basis. TriSakay does not promise continuous or error free availability, and its matching, location, and fare estimation features may not perform with the reliability of a commercial dispatch platform.',
  },
  {
    heading: '11. Emergencies',
    body: 'The SOS feature notifies PSO of your reported location for recordkeeping and coordination only. It is not a substitute for contacting emergency services directly. In an emergency, call 911 or the Philippine National Police immediately.',
  },
  {
    heading: '12. Limitation of Liability',
    body: 'To the fullest extent the law allows, TriSakay and the academic institution supporting its development are not liable for injury, loss, delay, or damage arising from your use of the app or from the conduct of a driver or another passenger, except where such liability cannot be limited under Philippine law.',
  },
  {
    heading: '13. Changes to these Terms',
    body: 'TriSakay may update these terms from time to time. If a change is material, you will be asked to review and accept the updated terms again before you can keep using the app.',
  },
  {
    heading: '14. Governing Law',
    body: 'These terms are governed by the laws of the Republic of the Philippines and the ordinances of the City of General Santos, including City Ordinance No. 08, series of 2023, and City Ordinance No. 37, series of 2018.',
  },
  {
    heading: '15. Contact',
    body: 'Questions about these terms can be sent to the Public Safety Office administering TriSakay, through the contact channel provided in the app.',
  },
];

export const PRIVACY_POLICY: PolicySection[] = [
  {
    heading: '1. Information We Collect',
    body: 'To create your account, TriSakay collects your name, contact number, and email address. When you book a trip, TriSakay collects your pickup and drop off locations and your trip and payment history. If you apply for a fare discount, TriSakay also collects a photo of your supporting identification document.',
  },
  {
    heading: '2. Your Location',
    body: 'TriSakay collects your device location only while a ride request is active or a trip is in progress, so a driver can be matched to you and find your pickup point. TriSakay does not track or store your location once your trip has ended, and does not collect your location while the app is closed.',
  },
  {
    heading: '3. How We Use Your Information',
    body: 'TriSakay uses your information to match you with a driver, calculate your fare, process your payment, respond to a complaint or emergency alert you submit, and keep a record of your trips for PSO oversight of the tricycle service.',
  },
  {
    heading: '4. Who We Share It With',
    body: 'A driver you are matched with sees your name and pickup location only, and only for that trip. PSO staff may view your ride history, complaint records, and discount documents as part of their duty to oversee the tricycle service under City Ordinance No. 37. TriSakay does not sell your personal information and does not share it with anyone for advertising.',
  },
  {
    heading: '5. Payment Information',
    body: 'If you pay by GCash, your payment is processed directly by GCash and its payment partners. TriSakay receives confirmation that a payment was made, but never receives or stores your GCash account credentials.',
  },
  {
    heading: '6. How Long We Keep It',
    body: 'TriSakay keeps your trip and payment history for as long as your account stays active, and for a reasonable period afterward for recordkeeping and to resolve any dispute. A discount identification document is kept only for as long as needed to verify and administer that discount.',
  },
  {
    heading: '7. Your Rights',
    body: 'You may ask PSO to give you a copy of, correct, or delete your personal data. TriSakay will respond to a verified request within a reasonable period, subject to any recordkeeping duty under applicable law or city ordinance.',
  },
  {
    heading: '8. How We Protect It',
    body: 'TriSakay stores your data with the access controls and encryption provided by its hosting infrastructure, and limits access to the PSO personnel who need it to do their job. No method of electronic storage is completely secure, and TriSakay cannot guarantee absolute security.',
  },
  {
    heading: "9. Children's Privacy",
    body: 'TriSakay is not intended for use by children under 13. If you believe a child has given TriSakay personal information without appropriate consent, please contact PSO so it can be removed.',
  },
  {
    heading: '10. Changes to this Policy',
    body: 'TriSakay may update this policy as its data practices change. If a change is material, you will be asked to review and accept the updated policy again before you can keep using the app.',
  },
  {
    heading: '11. Contact',
    body: 'Questions about this policy or your personal data can be sent to the Public Safety Office administering TriSakay, through the contact channel provided in the app.',
  },
];

/** FR-11.2 — the quick glance disclosures shown alongside the full policy above. */
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
