# TriSakay — Consolidated Project Context

**Project:** TRISAKAY: App-Based Smart Fare, Ride-Matching, and Monitoring System for Tricycle Transportation in Barangay Dadiangas West, General Santos City
**Type:** Undergraduate BSIT Capstone Project (academic prototype, not a production deployment)

> **Status note:** All phases below reflect current decisions and are subject to change as data gathering with PSO, drivers, and passengers progresses. Revisit any section as needed — nothing here is final until validated by field data.

---

## 1. Study Locale & Statement of the Problem

**Locale:** Barangay Dadiangas West, General Santos City, Philippines — selected because it sits within the city proper, contains City Hall, and has high daily commuter/tricycle activity.

**SOP objectives:**
1. Identify common problems encountered by Commuters, Tricycle Drivers, and PSO Personnel.
2. Identify necessary processes/functionalities across: Policies/Regulations/Requests, Cluster and Navigation, Monitoring and Reporting.
3. Design and develop the TriSakay system.
4. Evaluate user acceptance based on Acceptability and Usability.

---

## 2. Scope

Three separate applications sharing one backend/database:
- **Passenger Mobile App**
- **Driver Mobile App**
- **Admin Web App**

**Users:** Passenger, Tricycle Driver, PSO Personnel (Staff / Supervisor), Administrator

---

## 3. Technology Stack

| Layer | Choice |
|---|---|
| Passenger app | React Native, Expo, TypeScript |
| Driver app | React Native, Expo, TypeScript |
| Admin app | React, Vite, TypeScript |
| Backend | Supabase (PostgreSQL, Supabase Auth, Supabase Storage) |
| Maps | OpenStreetMap + MapLibre |
| State management | Zustand |
| Forms | React Hook Form |
| Validation | Zod |
| Payment | PayMongo — GCash channel, kept in Test Mode only (prototype scope, no Live Mode activation) |
| Deployment — Passenger/Driver | EAS Build → Android + iOS, internal distribution only (EAS internal / TestFlight, no public store listing) |
| Deployment — Admin | Vercel |
| Deployment — Backend | Supabase |

**Repo structure (monorepo):**
```
apps/
  passenger/
  driver/
  admin/
packages/
  shared/
  ui/
  services/
  utils/
supabase/
docs/
```

**Architecture principles:** feature-based architecture, shared packages, reusable components, strict TypeScript typing, role-based authorization, scalable folder organization, no duplicated logic between Passenger and Driver apps. Database must be relational (PostgreSQL), normalized, with foreign keys and junction tables — no NoSQL structures.

**Development rule:** work feature by feature, not all at once. Each feature covers: purpose, requirements, UI components, backend logic, database tables, API/service calls, validation, testing, future improvements.

**Planning phase order (current):**
1. Functional Requirements
2. Non-Functional Requirements
3. User Roles & Permissions (RBAC)
4. System Features
5. Use Case Diagram
6. Use Case Specifications
7. Context Diagram
8. Activity Diagrams
9. Sequence Diagrams
10. Flowcharts
11. ERD
12. Database Schema
13. Folder Architecture
14. API Design
15. Development Roadmap
16. Sprint Planning

---

## 4. Functional Requirements (FR-1 to FR-9) — LOCKED

### FR-1: User Account & Profile Management — UPDATED (verification scope clarified per Ordinance No. 21, s.2024)
- FR-1.1 Register (Passenger, Driver)
- FR-1.2 Login/logout
- FR-1.3 View/update own profile
- FR-1.4 Driver uploads verification documents (Driver's License — must be a **Professional license, Code A/A1** per Ord. 21 Sec. 16, ordinary licenses are not valid for MTH; OR/CR; Franchise/Permit i.e. the MTOP; Tricycle Photo). This bundle is intentionally narrower than the full MTOP application checklist (insurance policy, TODA membership, garage sketch, Voter's ID/residency proof, notarized undertakings) — the app **verifies an already-granted franchise**, it does not re-run PSO/MTFRB/City Council's franchise-granting process; a valid MTOP is itself evidence that vetting already happened
- FR-1.4a During review, PSO Supervisor transcribes the MTOP number, expiry date, and cluster/color code from the uploaded Franchise/Permit document into structured fields (`tricycles.mtop_no`, `mtop_expiry_date`, `cluster`) — the app does not OCR the permit
- FR-1.5 Admin/PSO Supervisor reviews, approves, or rejects Driver/Tricycle verification — entirely remote, document-based; **no face-to-face meeting or in-person inspection required**, since the underlying tricycle unit and driver were already physically inspected during the real-world MTOP application (Ord. 21 Secs. 7-8) — re-inspecting here would duplicate that
- FR-1.6 Driver barred from ride-matching until verified
- FR-1.6a *(New)* On a verification decision (approved or rejected, either overall or per-document), the Driver is notified via **in-app notification** (record of truth) **and email** — email is included because the account isn't fully usable yet, so the Driver may not otherwise think to reopen the app. SMS is deliberately excluded from this prototype: it requires a paid third-party gateway (e.g. Semaphore, Twilio) and an ongoing external dependency disproportionate to this scope; revisit only if field data shows drivers don't reliably check email
- FR-1.7 *(New)* System notifies the Driver when their MTOP franchise is within 30 days of expiry or has expired (Ord. 21 Sec. 12: renewal must be filed 30 days before expiry), via a daily scheduled job — verification approval is a point-in-time check, not a permanent one

### FR-2: Ride Request & Matching (Cluster and Navigation)
Confirmed real-world model to digitize: tricycles roam for passengers; once a driver has a passenger heading a direction, additional passengers may be picked up along the way if their destination is still along the route (shared/pooled rides, not single-hire-only). Tricycles hold up to **6 seats total**; how many to take is the driver's discretion.

Two matching moments, both governed by the same system-assisted route-corridor heuristic (bearing + distance/detour tolerance vs. nearest-driver location — Option 1, chosen for feasibility/defensibility):

- FR-2.1 Passenger sets pickup via GPS/manual pin
- FR-2.2 Passenger sets destination — either by selecting a point on the map or by searching for the location by name
- FR-2.3 System computes estimated fare before request confirmation (includes FR-3)
- FR-2.4 Passenger submits ride request
- FR-2.5 System matches request to available driver(s) via a two-stage check: **(1) hard cluster-authorization filter** — per Ordinance No. 37, Series of 2018, Section 119, a tricycle's assigned cluster (Red/White/Apple Green/Melting Pot) must be authorized to serve the pickup barangay's cluster (colored clusters serve only their own + Melting Pot; Melting Pot units serve Melting Pot only) — followed by **(2) the bearing/distance-tolerance heuristic** (soft check), both run server-side in a Supabase Edge Function
  - FR-2.5a **Pre-trip Request Board**: before starting a trip, Driver declares intended direction; system surfaces compatible pending requests
  - FR-2.5b Driver may select multiple passengers from the board, up to seat capacity, before departing
  - FR-2.5c **Mid-trip pickup**: once trip is active, system continues surfacing new compatible requests for driver to accept, subject to remaining seats
  - FR-2.5d Driver retains final discretion to accept/decline at both stages
  - FR-2.5e *(Scope note)* Cluster authorization is confirmed to apply system-wide, not just the pilot locale — pilot **testing** is limited to Barangay Dadiangas West (entirely within the Melting Pot cluster, so the constraint doesn't bind during testing itself), but the app is architecturally built to extend to other barangays/clusters
- FR-2.6 Driver toggles availability (online/offline)
- FR-2.7 Available driver(s) notified of incoming requests
- FR-2.8 Driver accepts/declines requests
- FR-2.9 Passenger views assigned driver/tricycle info post-acceptance (name, photo, tricycle plate/details — no in-app messaging or calling; contact between Passenger and Driver is out of scope)
- FR-2.10 Ride status tracked: requested → matched → ongoing → completed → cancelled
- FR-2.11 Completed/cancelled rides logged to ride history

> **Open item (pending PSO/driver/passenger data gathering):** actual bearing-tolerance and detour-ratio threshold values need field validation; documented as a stated limitation in the meantime.

### FR-3: Fare Computation — RESOLVED
Based on **General Santos City Ordinance No. 08, Series of 2023**: ₱15 for the first 4 kilometers, plus ₱1 per succeeding kilometer, per passenger (applies to tricycles under the white, apple green, and red clusters citywide).
- FR-3.1 Estimated fare = ₱15 (first 4 km) + ₱1 × (km beyond 4), computed per passenger based on trip distance
- FR-3.2 Admin can update these parameters if the ordinance is amended, rather than hardcoding them permanently
- FR-3.3 Final fare locked and passed to payment transaction upon ride completion
- FR-3.4 *(New — worth citing in your Introduction/Related Literature)* Public enforcement of this ordinance is documented as inconsistent; automated, ordinance-based fare computation directly addresses this compliance gap and strengthens your project's social value justification

**Passenger fare discounts (FR-3.10–3.15):** per the ordinance's preserved discount privileges (RA 9994 senior citizen, RA 10754 PWD; extended to students for simplicity), a passenger may apply for a fare discount by uploading a valid ID photo in-app. PSO Supervisor/Admin reviews and approves/rejects — same reviewer authority as driver verification, mirroring that same document-review pattern rather than inventing a new workflow. Once approved, a flat **20%** discount is automatically applied to that passenger's fare on every ride. The rate is Admin-configurable (`fare_config.discount_rate_percent`), not hardcoded. A passenger with no approved discount pays full fare. PSO Supervisor/Admin may revoke an approved discount if found invalid. New use cases: **UC47 — Apply for Fare Discount** (Passenger, mirrors UC18), **UC48 — Review Discount Application** (PSO Supervisor+, mirrors UC37).

### FR-4: Complaint Management — UPDATED per PSO-MTPS-PR-03 (Processing of Complaints Involving Tricycle Drivers)
Real PSO process: verify → forward to Department Head → DH directs staff to contact both parties → both parties are scheduled for and attend an **MTFRB (Motorized Tricycle Franchising and Regulatory Board) mediation meeting** for final settlement — resolution is a mediated outcome, not a self-contained digital PSO decision. **Scope note:** PSO's real-world intake spans several channels (social media, letters, phone/Facebook, a Google feedback form — PSO-MTPS-PR-03 Sec. E); TriSakay's complaint feature only covers complaints tied to an app-registered user (i.e. arising from TriSakay-mediated rides), the same app-only boundary already drawn for driver verification vs. franchise-granting. Other channels stay on PSO's existing process, untouched.
- FR-4.1 Passenger submits complaint against driver/ride
- FR-4.2 Driver submits complaint against passenger/ride
- FR-4.3 PSO Staff triages/categorizes complaints
- FR-4.3a *(New)* Department Head reviews the triaged complaint and records a directive (typically: contact both parties) — a distinct audit step from triage and from the eventual mediation outcome (PSO-MTPS-PR-03 Activity 3)
- FR-4.4 Status flow: `open` → `under_review` → `escalated` → `mediation_scheduled` → `resolved` / `dismissed`
- FR-4.5 PSO Supervisor/Admin schedules an MTFRB mediation meeting for escalated complaints, recording meeting date/time and location; both parties are notified (FR-7.3)
- FR-4.6 PSO Supervisor/Admin records the mediation outcome/settlement details after the meeting occurs, setting final status to resolved or dismissed
- FR-4.7 Complaint records and any submitted evidence are handled per RA 10173 (Data Privacy Act of 2012) — same confidentiality standard the PSO's own complaint form already cites, which TriSakay's Privacy Policy (FR-11.2) is designed to mirror rather than invent independently
- FR-4.8 *(New)* On submission, the Passenger/Driver is shown PSO's actual service standard: "processed within 3 working days" (PSO-MTPS-PR-03 Sec. C, an ARTA-mandated Simple Transaction) — a real, citable commitment, unlike the driver-verification turnaround (FR-1.5/Section 10) where no such figure exists yet. Covers submission through mediation being scheduled, not through the MTFRB meeting itself, since that date depends on MTFRB's own calendar

### FR-5: Monitoring & Reporting
- FR-5.1 Real-time ride activity dashboard (PSO Staff+)
- FR-5.2 Monitor active/ongoing rides
- FR-5.3 Generate reports (ride volume, complaints, driver activity) by date range
- FR-5.4 Analytics visualizations for PSO decision-making
- FR-5.5 *(New)* Dashboard flags complaints past the 3-business-day ARTA target (FR-4.8) still `open`/`under_review` — replaces PSO-MTPS-PR-03's manual daily checklist/logbook tracking (Section H) with a live query

### FR-6: User Management (Admin)
- FR-6.1 View/search/manage Passenger and Driver accounts
- FR-6.2 Suspend/deactivate accounts (PSO Supervisor+)
- FR-6.3 Manage PSO Staff/Supervisor accounts (Administrator only)

### FR-7: Notifications
- FR-7.1 Ride status change notifications
- FR-7.2 Driver verification status notifications
- FR-7.3 Complaint status update notifications
- FR-7.4 Payment status notifications
- FR-7.5 *(New)* MTOP franchise expiry notifications (see FR-1.7) — sent by a daily scheduled job, not user-triggered

### FR-8: System Settings
- FR-8.1 Admin configures fare parameters, zone/route tolerances, notification templates

### FR-9: Online Payment — UPDATED (PayMongo, Test Mode)
Confirmed: online GCash payments route through **PayMongo** as the payment gateway (GCash channel), kept permanently in **PayMongo Test Mode** — Live Mode activation is out of scope for this prototype, since driver payouts are simulated and no real money moves through the system (see FR-9.6). **Post-paid** (passenger pays after trip completion), **cash remains an option** alongside GCash.

- FR-9.1 Passenger selects payment method: cash or GCash, post-paid
- FR-9.2 On ride completion, if GCash was selected, system creates a PayMongo Checkout Session (test mode) for the final fare; passenger completes payment through PayMongo's hosted checkout page; PayMongo confirms payment via a signature-verified server-side webhook — payment status is never trusted from the client
- FR-9.3 System generates/stores transaction record (amount, method, status, timestamp, linked ride, PayMongo checkout session ID)
- FR-9.4 Ride payment status: pending, paid, failed, refunded
- FR-9.5 Passenger views payment/transaction history
- FR-9.6 Driver views simulated/tracked earnings records — no real money is transferred, deposited, withdrawn, or disbursed through the system at any point; actual settlement between Driver and PSO/operator (if any) happens entirely outside the system. The only real money-adjacent integration anywhere in TriSakay is the PayMongo GCash *collection* flow, test mode only (FR-9.2, Passenger → trip payment) — payout is tracking-only, never disbursement, and Live Mode is never activated.
- FR-9.7 PSO Staff+/Admin views and monitors all transactions
- FR-9.8 Failed/incomplete PayMongo/GCash payments can retry or fall back to cash
- FR-9.9 For cash payments, transaction is only marked `paid` after the Driver confirms cash received as part of completing the trip (UC24) — not from the Passenger's method selection alone; GCash payments skip this step, relying instead on the server-side PayMongo webhook confirmation (FR-9.2)

### FR-10: Rating & Merit System — LOCKED
One-directional only (Passenger rates Driver, not the reverse); low ratings always require PSO human review rather than triggering automatic action; simple 1–5 star rating with optional comment.
- FR-10.1 After a completed trip, Passenger rates the Driver (1–5 stars, optional comment)
- FR-10.2 System computes a running average rating per Driver, shown on the Driver's profile (visible to Passengers via UC8 — View Driver Info)
- FR-10.3 PSO Staff+/Admin can view rating trends per Driver as part of account oversight
- FR-10.4 Ratings below a configurable threshold flag the Driver's account for **PSO Supervisor review** (never automatic suspension — human judgment stays in the loop, consistent with UC39)

New use cases: **UC43 — Rate Driver** (Passenger, post-trip) and **UC44 — Review Flagged Rating** (PSO Supervisor+, triggered when average falls below threshold; outcome: no action / warning / escalate to suspension via UC39).

---

### FR-11: Terms of Service & Privacy Consent — LOCKED
- FR-11.1 On first launch/registration, system presents Terms of Service and Privacy Policy; user must explicitly accept before proceeding to any core feature
- FR-11.2 Privacy Policy discloses what data is collected and shared: name/contact (visible to matched Driver/Passenger during active ride only), live location (ride-scoped per NFR-2.5), ride/payment history (visible to PSO for oversight), payment details (shared with PayMongo for processing only)
- FR-11.3 System records consent as an auditable event (user, policy version, timestamp), not just a one-time popup with no trace
- FR-11.4 On app start, if location permission is not granted, system prompts the user to enable it before allowing location-dependent features, with a plain explanation of why it's needed
- FR-11.5 If the user declines, location-dependent features are disabled gracefully with a retry option, rather than crashing or failing silently

New use cases: **UC45 — Accept Terms of Service & Privacy Policy** (all roles, first launch/registration); **UC46 — Grant Location Permission** (Passenger, Driver, app startup). This is the disclosure/consent layer sitting on top of the technical enforcement already defined in NFR-2.5.

---

## 5. Non-Functional Requirements (NFR-1 to NFR-8) — LOCKED
*(Balanced scope: realistic prototype targets with explicitly stated academic limitations)*

- **NFR-1 Performance:** ride matching completes within 5–10s under normal test conditions; dashboards/reports load within 3s at pilot scale. Load/stress testing at city scale is explicitly out of scope.
- **NFR-2 Security:** Supabase Auth (hashed credentials); RBAC-enforced feature access; HTTPS/TLS for all PayMongo communication, webhook signature verification, no storage of raw payment credentials (PayMongo's hosted checkout handles card/e-wallet data — TriSakay never touches it directly); access-controlled document storage via Supabase Storage RLS. Full PCI-DSS compliance/pen testing is out of scope.
  - **NFR-2.5 (privacy):** real-time location data is only collected/shared while a Driver is marked available or while a ride is actively in progress between matched parties — never broadcast to unmatched users, never tracked continuously/in the background. This directly satisfies panel feedback on privacy risk (toggleable, purpose-limited tracking, data minimization — no persistent GPS trail logging beyond pickup/drop-off coordinates).
- **NFR-3 Usability:** simple, low-literacy-friendly UI; Filipino/English labeling; evaluated via a standard usability instrument (e.g., SUS) with actual commuters/drivers/PSO staff.
- **NFR-4 Reliability:** graceful handling of failure cases (no match found, GCash failure, lost GPS); best-effort uptime during testing/demo periods, no formal SLA.
- **NFR-5 Scalability:** architecture designed to reasonably extend to additional barangays/zones, though only tested in Barangay Dadiangas West — a "designed-for," not "load-tested," claim.
- **NFR-6 Maintainability:** strict TypeScript, SOLID principles, UI/business-logic separation, shared packages for fare calc/validation/types.
- **NFR-7 Portability:** Passenger and Driver apps support **both Android and iOS** (React Native/Expo, EAS Build for both); Admin app compatible with latest two versions of Chrome/Edge/Firefox.
- **NFR-8 Compliance:** aligns with local PSO tricycle regulation/franchise verification requirements as identified during data gathering.

---

## 6. RBAC — LOCKED

**Roles (fixed enum):** `passenger`, `driver`, `pso_staff`, `pso_supervisor`, `admin`
PSO sub-roles are a simple fixed enum (not a configurable permissions table), since permissions genuinely differ by PSO position (frontline staff vs. supervisor).

| Feature / Action | Passenger | Driver | PSO Staff | PSO Supervisor | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Register/Login/Manage own profile | ✅ | ✅ | ✅ | ✅ | ✅ |
| Request ride | ✅ | ❌ | ❌ | ❌ | ❌ |
| Accept/decline ride, toggle availability | ❌ | ✅ | ❌ | ❌ | ❌ |
| Upload driver/tricycle documents | ❌ | ✅ | ❌ | ❌ | ❌ |
| Review/approve verification | ❌ | ❌ | ❌ | ✅ | ✅ |
| Submit complaint | ✅ | ✅ | ❌ | ❌ | ❌ |
| Triage complaints (first pass) | ❌ | ❌ | ✅ | ✅ | ✅ |
| Resolve escalated complaints | ❌ | ❌ | ❌ | ✅ | ✅ |
| View ride monitoring dashboard | ❌ | ❌ | ✅ | ✅ | ✅ |
| Flag account | ❌ | ❌ | ✅ | ✅ | ✅ |
| Suspend/deactivate account | ❌ | ❌ | ❌ | ✅ | ✅ |
| Generate reports/analytics | ❌ | ❌ | ✅ (view) | ✅ | ✅ |
| Manage PSO Staff/Supervisor accounts | ❌ | ❌ | ❌ | ❌ | ✅ |
| Configure system settings | ❌ | ❌ | ❌ | ❌ | ✅ |
| View payment transactions (oversight) | own only | own only | ✅ (view) | ✅ | ✅ |

---

## 7. System Features — LOCKED

**Passenger App:** Registration & Login, Profile Management, GPS Pickup Selection, Destination Selection (map or search), Fare Estimation, Ride Request, Ride Status Tracking, Driver Info View, Ride History, Payment (Cash/GCash), Payment History, Rate Driver, Apply for Fare Discount, Complaint Submission, Notifications, Settings, Logout

**Driver App:** Registration & Login, Profile Management, Document Upload, Verification Status Tracking, Availability Toggle, Request Board, Accept/Decline Ride, Passenger Info View, Trip History, Earnings (simulated), View Own Ratings, Complaint Submission/Management, Notifications, Logout

**Admin Web App:**
- Shared (PSO Staff, Supervisor, Admin): Login, Dashboard, Complaint Handling, Reports & Analytics (view), Transaction Oversight (view), View Driver Rating Trends
- PSO Supervisor + Admin: Driver/Tricycle Verification Review, Account Suspension/Deactivation, Review Flagged Ratings, Review Fare Discount Applications
- Admin only: PSO Account Management, System Settings, Full User Management

---

## 8. Use Case Summary — LOCKED

44 total use cases (UC1–UC44) across 5 actors, with generalization: PSO Supervisor inherits PSO Staff use cases; Administrator inherits PSO Supervisor use cases. Key relationships: UC6 (Request Ride) «include»s UC5 (Estimate Fare); UC21 (Select Passengers Pre-Trip) «extend»s UC20 (View Request Board); UC23 (Accept Mid-Trip Pickup) «extend»s UC22 (Start Trip). UC43 (Rate Driver, Passenger) and UC44 (Review Flagged Rating, PSO Supervisor+) were added for the Rating & Merit System (FR-10). UC45 (Accept Terms of Service & Privacy Policy) and UC46 (Grant Location Permission) were added for FR-11. UC47 (Apply for Fare Discount, Passenger) and UC48 (Review Discount Application, PSO Supervisor+) were added for the fare discount feature, bringing the total to 48.

Full actor-by-actor use case list and all 42 formal specifications (actor, precondition, main flow, alternate flow, postcondition, business rules) were drafted in-session — priority specs covered UC6, UC10, UC20–23 in depth (matching, request board, payment), with the remaining 36 specified at standard depth. Diagrams produced: package-level use case diagrams (3, grouped by app) and full individual-oval UML-style use case diagrams (3, one per app) matching classic notation.

---

## 9. Finalized System Architecture

**Applications (3, monorepo):** Passenger App and Driver App (React Native/Expo/TypeScript, Android + iOS via EAS Build, internal distribution only), Admin Web App (React/Vite/TypeScript, Vercel).

**Shared backend:** Supabase — Auth, PostgreSQL Database, Storage, Realtime, Edge Functions.

**Edge Functions (kept minimal for feasibility):**
1. `match-ride-request` — runs the bearing/detour matching heuristic server-side when a new request comes in or a driver's route changes; pushes results via Realtime.
2. `paymongo-webhook` — receives PayMongo webhook events (test mode) server-side, verifies the webhook signature, updates transaction/ride status (payment success is never trusted from the client).

All other state changes (verification approval, complaint status, account suspension) are handled via direct database writes protected by **Row-Level Security (RLS) policies** tied to role — no additional Edge Functions needed, keeping the architecture simple to build and defend.

**Scheduled job (pg_cron, not an Edge Function):** `notify_expiring_franchises()` runs daily, checking every active tricycle's MTOP expiry date and notifying the Driver 30+ days out or once expired (Ord. 21 s.2024 Sec. 12). Kept as a Postgres-native scheduled function rather than a third Edge Function, per the "kept minimal" principle above.

**Real-time layer:** Supabase Realtime (Postgres change subscriptions) drives ride status updates, request board updates, and availability changes — not polling.

**External services:** PayMongo — GCash channel, kept in Test Mode only, no Live Mode activation (payments), OpenStreetMap + MapLibre (map rendering only — the matching heuristic itself uses lightweight trigonometry, not a routing engine call).

**Privacy-by-design for location data:** no background/idle tracking; a Driver's live GPS only transmits while availability is toggled ON; Passengers never see a Driver's exact live position pre-match; live location sharing is scoped to the matched Passenger-Driver pair and only for the active trip's duration; auto-off on trip completion/cancellation; only pickup/drop-off coordinates are persisted, not a continuous GPS trail — directly addressing panel feedback on privacy/misuse risk.

**Distribution:** EAS internal distribution (Android) + TestFlight (iOS) — no public app store listing, to avoid store-review timeline risk before the capstone defense.

---

## 10. Data & Documents Still Needed from PSO (and Drivers/Passengers)

1. **Regulatory documents:** franchise/permit requirements, official or informal fare matrix/ordinance, existing complaint-handling procedure, driver code of conduct.
2. **Operational data:** current tricycle route/terminal/zoning structure (resolves FR-2.5 tolerance assumptions), typical trip distances/durations, number of active drivers/units, peak-hour demand patterns.
3. **PSO organizational structure:** actual PSO Staff vs. Supervisor responsibilities (validates the two-tier RBAC model), existing reporting requirements to city government.
4. **Pain points (SOP Objective 1):** interviews/surveys with PSO personnel, drivers, and passengers on current problems, disputes, and any existing informal monitoring tools.
5. **Ethics compliance:** all data-gathering instruments must go through the same ERC-approved consent process already used for the study's other instruments.

**Items still pending this data gathering:**
- FR-2.5 matching tolerance parameters (bearing angle, detour ratio) — architecture/approach is locked (Option 1 heuristic), only the numeric thresholds are open.
- *(New)* Typical document verification turnaround time (how long PSO actually takes to review a driver's submitted documents) — not yet known, so the app's copy does not commit to a specific number of days (see FR-1.5, Section 11 item 7).

**Resolved:** FR-3 fare formula — now based on General Santos City Ordinance No. 08, Series of 2023 (₱15 first 4 km + ₱1/km thereafter).

---

## 11. Wireframe Kit Review — Changes Required

A low-fidelity wireframe kit (42 screens: Driver 14, Passenger 17, Admin 11) was reviewed against all locked phases. Required edits identified:
1. Remove **Call** and **Message** buttons (Driver Found screen, Active Trip screen) — no in-app messaging/calling feature exists.
2. Rename **"Request payout"** to something like "Submit settlement request" — no real money is disbursed; earnings are simulated/tracked only (see FR-9.6).
3. Add role-based visibility: Verify/Suspend (Driver Management), Approve/Reject (Verification), Block/Unblock (Passenger Management) should only be visible to PSO Supervisor/Admin — PSO Staff sees View/Flag only.
4. Add a **"Confirm cash received"** step to the Driver's trip-completion flow for cash-method trips (see FR-9.9).
5. *(New)* On the Driver's "Documents & tricycle" upload screen, add a hint under the Driver's License upload: "Must be a Professional license (Code A or A1)" — an ordinary license is not valid for MTH under Ord. 21 Sec. 16 (see FR-1.4).
6. *(New)* On the Admin/PSO Verification Review screen, add input fields for **MTOP number** and **MTOP expiry date**, filled in by the reviewer while cross-checking the uploaded Franchise/Permit document (see FR-1.4a).
7. *(New)* On the Driver's post-submission confirmation screen, use neutral, no-SLA copy — e.g. "Your documents are under PSO review. We'll notify you once a decision is made." — rather than committing to a specific number of working days, since actual PSO turnaround time isn't known yet (see FR-1.5, Section 10).

Already correctly reflected in the kit (no changes needed): map/search destination selection, seat counter, post-paid GCash/Cash screen, 1–5 star one-directional rating with comment, privacy-aware ride monitoring caption, ordinance-labeled fare matrix, PSO Staff/Supervisor role tags in User Management.

---

## 12. Phase 9: Sequence Diagrams — LOCKED

Two core sequences detailed:
- **Ride Request & Matching**: Passenger app → Backend (fare estimate) → Edge Function (query drivers, run bearing/detour heuristic) → Driver app (Realtime notification) → accept → Backend notifies Passenger with matched driver info.
- **Payment Processing (GCash-via-PayMongo path)**: Driver completes trip → Backend finalizes fare → Backend creates a PayMongo Checkout Session (test mode) → Passenger completes checkout on PayMongo's hosted page → PayMongo webhook confirms (signature-verified) → Backend records transaction → notifies both parties. Failure/abandonment branch: webhook reports failed, or passenger closes checkout without paying → Passenger is offered retry or switch to cash → Driver notified to collect cash. Cash path follows the base shape but replaces the PayMongo steps with the Driver's cash-confirmation step (FR-9.9) — no external API call needed.

---

## 13. Phase 10: Flowcharts — LOCKED

Two algorithmic flowcharts, detailed enough to hand directly to implementation:
- **Fare Computation**: distance ≤ 4km → ₱15; else → ₱15 + (distance − 4) × ₱1 (per General Santos City Ordinance No. 08, Series of 2023).
- **Matching Heuristic**: for each nearby driver, check compatibility (bearing tolerance + detour ratio + seat availability); add compatible drivers to candidates; loop until all drivers checked; surface matches via Realtime if any found, otherwise notify passenger of no match. This is the literal logic for the `match-ride-request` Edge Function.

---

## 14. Phase 11: ERD — LOCKED

**Core entities:** `users` (id, name, contact, role enum, created_at) → `driver_profiles` (1:1, user_id FK, license_no, verification_status, rating_avg) → `tricycles` (1:many, driver_id FK, plate_no, cluster, mtop_no, mtop_expiry_date, verification_status) → `driver_documents` (1:many, driver_id FK, tricycle_id nullable FK, doc_type, status, reviewed_by FK→users) and `trips` (1:many, driver_id FK, status, timestamps) → `ride_requests` (many:1 to trips via trip_id nullable FK, many:1 to users via passenger_id FK; pickup/destination coords, seats_requested, fare, status enum) → `transactions` (1:1, ride_request_id FK, amount, method, status, paymongo_session_id) and `ratings` (1:1, ride_request_id FK, stars 1-5, comment).

**Support entities (all reference `users`):** `complaints` (submitted_by, against_user_id nullable, ride_request_id nullable, category, status, dh_directive, resolved_by nullable), `fare_config` (base_fare, base_km, rate_per_km, updated_by), `system_settings` (bearing_tolerance, detour_ratio_max, updated_by), `notifications` (user_id, type, message, read_status).

No many-to-many relationships exist in this domain, so no junction tables are needed — all relationships are one-to-one or one-to-many via foreign keys, consistent with the project's normalization requirement.

---

## 15. Next Phases (Not Yet Started)

12. Database Schema
13. Folder Architecture
14. API Design
15. Development Roadmap
16. Sprint Planning

> Reminder: every phase above, including all "locked" sections, remains open to revision as the research progresses — reopen any phase explicitly when needed.