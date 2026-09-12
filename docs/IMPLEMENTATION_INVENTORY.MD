# TriSakay — Implementation Inventory (as of 2026-09-12)

**Purpose of this document:** a factual, screen-by-screen and feature-by-feature account of what is *actually built* in the codebase right now, independent of the planning document (`docs/CONTEXT.MD`). Use this alongside CONTEXT.MD when asking a fresh conversation to check whether the built system still serves the research objectives in Section 1 of CONTEXT.MD — CONTEXT.MD says what was *planned*, this says what *exists*.

This is a prototype for an undergraduate BSIT capstone, not a production system — see CONTEXT.MD Section 1–2 for the study context.

---

## 1. Passenger App (`apps/passenger`)

**Auth & onboarding:**
- Splash screen, first-launch walkthrough, landing page
- Register / Login / Forgot password / Reset password
- Terms of Service & Privacy Policy consent screen (auditable — recorded to `user_consents`)
- Location permission gate

**Home & booking:**
- Home dashboard: branded hero panel, stats strip (real trip/discount data), Saved Places shortcuts, "Request a Tricycle" CTA with a nearby-driver-count chip
- Set pickup (GPS or manual search) / Set destination (map tap or name search)
- Save-place bookmarking directly from pickup/destination search results, plus a dedicated Saved Places management screen (fully custom-named places, no fixed Home/Work slots)
- Confirm Ride screen (full-bleed map, fare estimate, pickup/destination with Change links)
- Finding-driver state, No-drivers-nearby state
- Active trip screen: live driver location marker, straight-line ETA, trip status, per-passenger pickup/drop-off status (for shared/pooled rides)
- Ride-cancelled state
- Trip-complete screen (distinct step before rating)
- Rate Driver (1–5 stars + comment)
- Emergency/SOS screen reachable during an active trip (dials 911/PNP, separately logs an incident to PSO)

**History & account:**
- Ride History (card-based route timeline) + ride detail screen
- Payment: payment methods, payment history, Cash/GCash selection at booking
- Apply for Fare Discount (ID upload) + view fare matrix
- Complaints: submit against driver/ride, with category picker and evidence attachments
- Notifications (typed icons, filters, tap-to-read) + Expo push token registration
- Profile / Settings (grouped sections)
- Logout

## 2. Driver App (`apps/driver`)

**Auth & onboarding:**
- Splash (live map ground + entrance animation), Login/Register/Forgot/Reset password
- Consent screen, location permission gate
- Verification-pending screen (locked out of ride-matching until PSO approves — FR-1.6)
- Account-suspended screen

**Core driving flow:**
- Dashboard: availability toggle, real computed Accept-rate stat, request board
- Requests tab: pending ride requests, persisted declines so declined requests don't resurface
- Active trip screen: per-passenger Start action before Complete (supports mid-trip multi-passenger pickup), cash-received confirmation step, foreground location sync while online (`watchPositionAsync`)
- Emergency/SOS screen (same dial-out + PSO incident-log pattern as passenger)

**Account & earnings:**
- Earnings tab: simulated/tracked earnings, plus a peak-demand-hours chart (FR-2.12) backed by a city-wide aggregate RPC — replaces the earlier settlement-notice button
- Trip history
- Ratings (own ratings view)
- Profile (brought to parity with passenger's) / Settings
- Complaints (submit against passenger/ride)
- Notifications
- Logout

## 3. Admin Web App (`apps/admin`)

Shared across PSO Staff / PSO Supervisor / Admin, with role-gated actions:

- **Dashboard** — overview stats, cross-links into other screens
- **Drivers / Passengers directories** — search, filter, inline detail panels, bulk actions, CSV export
- **Driver Verification** — review queue for driver/tricycle documents, approve/reject, MTOP number + expiry transcription fields (FR-1.4a), in-app notification to driver on decision
- **Fare Discount review** (`DiscountReview`) — review queue for passenger discount ID uploads, approve/reject, ID transcription fields
- **Ride Monitoring** — auto-refreshing live view of active rides with a real map
- **Emergency Alerts** — list + detail with a real map (replacing an earlier placeholder box), mark-reviewed action (Supervisor+)
- **Complaints** — triage, categorize, and now full MTFRB mediation workflow: schedule mediation meeting (date/time/location), record outcome/settlement, status flow through `resolved`/`dismissed`
- **Rating Oversight** — view rating trends, review flagged low ratings
- **Reports** — ride volume / complaints / driver activity analytics by date range, with error handling and pagination
- **Audit Log** — reads `account_actions`, shows verification/discount decision history
- **Barangays** — CRUD screen for the barangay reference data backing the cluster/pilot-area model
- **PSO Users** — PSO Staff/Supervisor account management (Admin only), session/device visibility and revocation, forced password change on first login
- **System Settings** — fare parameters, matching-tolerance parameters
- Global cross-entity search in the top bar, notification bell, self-service profile menu, toast/error-banner feedback system throughout

The entire Admin UI went through a full multi-phase visual redesign (shell/nav, dashboard, directory, review queues, live ops, casework, audit log, barangays, feedback system) — functionality above reflects the current, redesigned state, not the earlier wireframe-era screens.

## 4. Shared Backend (Supabase)

**Database (`docs/SCHEMA.MD`, 15 migrations applied):**
`users`, `driver_profiles`, `tricycles`, `driver_documents`, `passenger_discounts`, `trips`, `barangays`, `ride_requests`, `transactions`, `ratings`, `complaints`, `complaint_attachments`, `account_actions` (append-only audit log), `fare_config`, `system_settings`, `notifications`, `saved_places`, `user_consents`, `emergency_alerts` — all with RLS enabled.

**Edge Functions:**
- `match-ride-request` — bearing/detour-tolerance matching heuristic (cluster-authorization hard filter + soft geometric check)
- `paymongo-webhook` — signature-verified GCash payment confirmation (test mode only)
- `create-gcash-checkout` — creates the PayMongo Checkout Session
- `nearby-driver-count` — powers the passenger Home CTA chip
- `admin-create-pso-user` — provisions PSO Staff/Supervisor accounts

**Scheduled jobs (pg_cron):** MTOP franchise-expiry notification job.

**Notable backend capabilities beyond the original ERD/architecture sections of CONTEXT.MD:**
- Live location tracking end-to-end: driver push + passenger subscription, with an RLS fix (`20260831012119_fix_driver_location_pii_exposure.sql`) specifically closing a PII leak to unmatched users
- `start_ride_leg` RPC and per-passenger ride-leg status (supports mid-trip pooled pickups)
- `get_peak_hour_histogram` RPC (aggregate-only, Asia/Manila local time) backing the driver Earnings peak-hours chart (FR-2.12). The earlier `settlements` table/trigger backing the removed "Notify PSO" action are left in the database, unused, rather than dropped.
- Ride-request decline persistence (`ride_request_declines`)
- Driver accept-rate computed via `get_driver_accept_rate`
- Admin session-management RPCs, PSO last-sign-in RPC, forced-password-change flag
- English/Filipino i18n (`packages/shared/src/i18n`)

## 5. What to check against the research objectives

When you paste this into a fresh conversation, the useful question is whether the above still maps cleanly onto CONTEXT.MD Section 1's SOP objectives and the locked FR-1–FR-12 / NFR-1–NFR-8:

- **Saved Places** (passenger) has no corresponding FR in CONTEXT.MD — it's a real, shipped feature with its own table, service module, and three screens' worth of UI. Decide: formally document as an FR, or frame as a UX convenience under FR-2.1/2.2.
- MTFRB mediation scheduling/outcome recording (admin Complaints) is *more* fully built than FR-4.5/4.6 describe — worth confirming the UI matches PSO-MTPS-PR-03's actual workflow.
- Live driver tracking, settlement tracking, and the i18n layer are all real, working code, not just design intent — Sections 9/14 of CONTEXT.MD undersell how far along these are.
- The Admin, Passenger, and Driver apps have all been through complete visual redesigns since the wireframe-kit review in CONTEXT.MD Section 11 — that section's screen-by-screen change list is describing an earlier version of the UI, not the current one.
