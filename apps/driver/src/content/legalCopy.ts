/**
 * Shared between the registration flow (shown before account creation) and
 * the post-signin consent gate (`app/consent.tsx`, the fallback for the
 * check_email path and re-consent on a legal version bump) and the Legal
 * screen (`app/profile/legal.tsx`) — kept in one place so all three can
 * never drift apart.
 *
 * A full, numbered Terms of Service and Privacy Policy modeled on how a
 * real driver facing app structures these documents, written to accurately
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
    body: 'By registering as a TriSakay driver, you agree to be bound by these Terms of Service and the Privacy Policy below. If you do not agree, please do not use the app.',
  },
  {
    heading: '2. What TriSakay Is',
    body: 'TriSakay is a dispatch platform that connects independent tricycle drivers, such as you, with passengers requesting a ride within its pilot service area. You operate your tricycle as an independent operator, not as an employee or agent of TriSakay or the Public Safety Office, referred to as PSO.',
  },
  {
    heading: '3. Verification',
    body: "Before you can accept rides, PSO reviews your submitted documents, including a valid professional driver's license of Code A or A1, your tricycle's Official Receipt and Certificate of Registration, and a valid Motorized Tricycle Operator's Permit franchise. PSO may request additional documents or reverify your account at any time.",
  },
  {
    heading: '4. Your Tricycle and Franchise',
    body: 'You agree to keep your registration and franchise current, and to notify PSO promptly of any renewal or expiration. You agree to operate only the tricycle registered to your account, and only within the pickup cluster assigned to it under City Ordinance No. 37, series of 2018.',
  },
  {
    heading: '5. Accepting and Completing Rides',
    body: 'You may accept or decline any ride request shown to you. Once you accept a request, you agree to complete the trip in good faith, take a reasonable route, and remain available to your passenger until the trip is finished or lawfully cancelled.',
  },
  {
    heading: '6. Fares',
    body: 'You agree to charge only the fare that TriSakay calculates and displays when a trip is completed, computed under the rates set by City Ordinance No. 08, series of 2023. You may not charge more than the displayed fare, arrange a fare outside the app for a trip booked through TriSakay, or refuse a passenger a discount they are entitled to under that ordinance.',
  },
  {
    heading: '7. Your Conduct',
    body: 'You agree to treat every passenger with courtesy and respect, to drive safely, and to avoid any behavior that is abusive, discriminatory, or unsafe. You may not use TriSakay for any unlawful purpose.',
  },
  {
    heading: '8. Ratings and Complaints',
    body: 'A passenger may rate a completed trip and may submit a complaint about your conduct. PSO reviews every complaint and may take action ranging from a warning to suspension, depending on the severity and pattern of the conduct reported.',
  },
  {
    heading: '9. Suspension and Termination',
    body: 'PSO may suspend or deactivate your account for verified misconduct, a safety violation, an expired license or franchise, repeated passenger complaints, or false information given during verification. You may stop driving for TriSakay and ask PSO to close your account at any time.',
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
    body: 'To the fullest extent the law allows, TriSakay and the academic institution supporting its development are not liable for injury, loss, delay, or damage arising from your use of the app, from your operation of your tricycle, or from the conduct of a passenger, except where such liability cannot be limited under Philippine law.',
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
    body: "To verify your eligibility to drive, TriSakay collects your name, contact number, email address, driver's license details, tricycle registration and franchise details, and a photo of each document you submit. TriSakay also collects your trip and earnings history and any rating or complaint recorded against your account.",
  },
  {
    heading: '2. Your Location',
    body: 'TriSakay collects your device location while you are marked available to accept rides and while a trip is in progress, so a passenger can be matched to you and see you approaching. TriSakay stops collecting your location as soon as you go offline, and does not keep a continuous location trail.',
  },
  {
    heading: '3. How We Use Your Information',
    body: 'TriSakay uses your information to verify your eligibility to drive, match you with a passenger, calculate the fare you are owed, respond to a complaint or emergency alert, and keep a record of your trips and earnings for PSO oversight of the tricycle service.',
  },
  {
    heading: '4. Who We Share It With',
    body: 'A passenger you are matched with sees your name and tricycle plate number only, and never your verification documents. PSO staff may view your verification documents, trip history, earnings summary, and ratings as part of their duty to oversee the tricycle service under City Ordinance No. 37. TriSakay does not sell your personal information and does not share it with anyone for advertising.',
  },
  {
    heading: '5. How Long We Keep It',
    body: 'TriSakay keeps your verification documents, trip history, and earnings records for as long as your account stays active, and for a reasonable period afterward for recordkeeping and to resolve any dispute.',
  },
  {
    heading: '6. Your Rights',
    body: 'You may ask PSO to give you a copy of, correct, or delete your personal data. TriSakay will respond to a verified request within a reasonable period, subject to any recordkeeping duty under applicable law or city ordinance.',
  },
  {
    heading: '7. How We Protect It',
    body: 'TriSakay stores your data with the access controls and encryption provided by its hosting infrastructure, and limits access to the PSO personnel who need it to do their job. No method of electronic storage is completely secure, and TriSakay cannot guarantee absolute security.',
  },
  {
    heading: '8. Changes to this Policy',
    body: 'TriSakay may update this policy as its data practices change. If a change is material, you will be asked to review and accept the updated policy again before you can keep using the app.',
  },
  {
    heading: '9. Contact',
    body: 'Questions about this policy or your personal data can be sent to the Public Safety Office administering TriSakay, through the contact channel provided in the app.',
  },
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
    body: 'Your license, registration, franchise, and tricycle photo are visible to PSO staff for review only.',
  },
];
