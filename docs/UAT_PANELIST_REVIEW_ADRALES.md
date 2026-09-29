# UAT Panelist Review — Lorelyn F. Adrales

Source: second-panel UAT recommendation form (`UATRecommendation_maamlors.pdf`), panel date 2026-09-22, result **For UAT**.
This file tracks every recommendation from that panel, plus the team's own additions (chat/call, safety trail) and a security/reliability audit done while planning the work, so each item can be triaged and built individually.

Legend for **Status**: `TODO` / `IN PROGRESS` / `STRETCH` / `FUTURE` (designed, not built for this deadline) / `DONE`

**Deadline: 2 weeks.** The panel's items and the F/X/R fixes below are required. Team additions are stretch or future work — see the Timeline section.

**Audit note (2026-09-27):** a full line-by-line pass checked every item's actual code/migration content (not filenames or commit messages) against this tracker. Corrections made: F2 was actually already done (missed earlier); X11 downgraded to PARTIAL (it's a hardened policy, not F6's RPC); Y7 turned out already fixed as a side effect of X4's migration; and a naming trap was flagged under PD1 (X9's `cancel_ride_request_as_passenger` RPC is a security fix, not PD1 progress). Everything else the tracker already called TODO/STRETCH/FUTURE was confirmed still untouched — no other silent progress or regressions found.

**Audit note (2026-09-29):** re-checked every item again against current code/migrations, focused on what changed since the 09-27 pass. **C1 moved from STRETCH to DONE** — built well past the "text and quick replies only" scope-down this tracker had recorded: free text, quick replies, read receipts, a typing indicator, photo sharing (EXIF-stripped), phone-number masking (L11), rate limiting, and a push-notification trigger are all live (`supabase/migrations/20260929000001_c1_ride_chat.sql`), plus a matching UI rebuild across both apps (`docs/design_handoff_trisakay_ride_comms/`). **S1 moved from FUTURE to PARTIAL** — only its chat-thread case-view slice is built (`supabase/migrations/20260929030000_s1_pso_ride_chat_case_view.sql`), closing L16; the route trail, call log, timeline and map view are still not started. **L11 and L16 are now DONE.** Everything else on this pass matched the 09-27 audit's status exactly — no other silent progress or regressions found. Full detail on each of these is in their own rows/sections below, not repeated here.

---

## Tracker

| ID | Recommendation | Status | Kind |
|---|---|---|---|
| G1 | Proper domain | TODO | Setup |
| G2 | Use Google Maps | **UNBLOCKED (2026-09-25)** — billing verified, code done, GCP project created, enabling APIs next | Code, large |
| G3 | Screenshots of the final hosted system with the domain and Google Maps | TODO | Last step |
| G4 | Help tips for text boxes | IN PROGRESS — code done 2026-09-27 (Person 3); on-device check **handed to Person 1**, see "Handoff: Person 3 → Person 1" | Code, small |
| G5 | Scope: iOS and Android, Android preferred | TODO | Docs |
| P1 | Email receipt if the passenger agrees | TODO | Code, medium |
| P2 | Ask passengers if they'd still use the app if the fare increases | TODO | Survey |
| P3 | Suggested fare with supporting literature | TODO | Docs |
| D1 | Driver can transfer a passenger to another tricycle | **DONE 2026-09-27 (Person 1)** — migrations `20260927000006` + `20260927000007` (L8/L9 hardening), both applied and verified live. Core mechanics done; a few UI/verification sub-pieces deferred (see the D1 section for the full list). | Code, large |
| D2 | Nearest drop-off first when carrying several passengers | IN PROGRESS — code + unit tests done 2026-09-27 (Person 3); migration `20260927000001` applied live 2026-09-27 (Person 1, verified: 3 new return columns present, anon execute revoked); device test still **handed to Person 1**, see "Handoff: Person 3 → Person 1" | Code, small |
| PD1 | Cancellation policy | **DONE 2026-09-27 (Person 1)** — code + migration `20260927000005`, applied and verified live. See the PD1+PD2 section below for scope/deferrals (L1 confirm-handshake, L18 seat-adjust). | Code, medium |
| PD2 | Don't allow cancelling at every stage | **DONE 2026-09-27** — the stage gate (pending free / assigned needs a reason+strike / ongoing blocked) is enforced inside PD1's `cancel_ride_request` RPC, not a separate piece. | Part of PD1 |
| PD3 | Literature on how many cancellations to allow | TODO | Docs |
| PD4 | Ask users how they feel about cancelling | TODO | Survey |
| C1 | *(Team addition)* In-app chat between driver and passenger | **DONE 2026-09-29** — full spec (not just the text/quick-reply stretch scope): free text, quick replies, read receipts, typing indicator, photo sharing, phone masking, rate limiting, push. Two-device live test still not run — see the C1 section below. | Code, medium |
| C2 | *(Team addition)* In-app voice call with no phone numbers shared | FUTURE — intentionally excluded from this pass, to be built later | Code, large |
| S1 | *(Team addition)* Route trail, legal hold and PSO case view for safety and compliance | **PARTIAL 2026-09-29** — only the PSO chat-thread case-view slice is built (closes L16); route trail, call log, timeline and map view are still FUTURE. See the S1 section below. | Code, large |
| N1 | *(Team addition)* Ride status push notifications (assigned, arriving, arrived, transferred, completed) | STRETCH | Code, small |
| N2 | *(Team addition)* Cancellation and transfer charts for the PSO | STRETCH | Code, small |
| N3 | *(Team addition)* Share my trip: a live link for a trusted contact | FUTURE | Code, medium |

### Fixes found during exploration (required, do first)
| ID | Fix |
|---|---|
| F1 | `supabase/functions/notify-drivers-new-request/index.ts:28` has a shared secret written in the source. Move it to a Supabase secret and rotate it. |
| F2 | **DONE (2026-09-25, confirmed by audit 2026-09-27).** `cancel_ride_leg`, `end_trip`, `get_active_trip_for_driver` and `update_fare_config` are all captured in `supabase/migrations/20260925120000_remote_schema_baseline.sql` (lines 849, 902, 936, 1202). Safe for PD1/D1 to build on top of now. |
| F3 | **DONE 2026-09-27 (Person 1).** `supabase/functions/match-ride-request/index.ts` now computes `freeSeats` from `activeTrip.max_seats` minus the sum of `seats_requested` for that trip's `assigned`/`ongoing` rows — the same "taken" query `enforce_trip_seat_capacity()` uses server-side — and filters on that instead of total capacity. Deployed to the live project (`match-ride-request` version 8) and confirmed live via `get_edge_function`: the deployed source matches the local edit exactly. |
| F4 | **DONE 2026-09-27 (Person 1) — code + migration, applied and verified live.** Migration `supabase/migrations/20260927000002_f4_driver_arrived.sql` — adds `ride_requests.arrived_at`, a `mark_arrived(p_ride_request_id)` RPC (idempotent; rejects if the driver's last known position is more than ~100m from the pickup point, per L4; inserts a `ride_status` notification for the passenger), and re-extends `get_active_trip_passengers` to also return `arrived_at` (same DROP+CREATE + PUBLIC-grant-revoke pattern as D2's migration). Recorded live as version `20260927000002` (confirmed via `migration list --linked`, no drift). Verified live via three read-only queries: `has_function_privilege('anon', 'mark_arrived(uuid)', 'execute')` is `false`; `get_active_trip_passengers`'s return type now ends `..., arrived_at timestamp with time zone`; `ride_requests.arrived_at` column exists. Client side (done, not gated on the migration being live — the code degrades safely, same `?? null` pattern as D2): `markArrived()` in `packages/services/src/booking/index.ts`, wired into `apps/driver/src/store/useTripStore.ts`, with an "I've arrived" button on `apps/driver/app/trip/active.tsx` for an assigned-not-yet-arrived passenger, and an "Arrived" chip once tapped. `typecheck` clean, full test suite green (541+ tests across all 6 workspaces) after updating the `tripStore.test.js`/`booking.test.ts` fixtures for the new field. L3 (mocked-GPS rejection) deliberately NOT attempted — it's tied to R3's not-yet-built location trigger, so `mark_arrived` only trusts the position already on file, same caveat X11 already carries. |
| F6 | **DONE 2026-09-27 (Person 1) — code + migration, applied and verified live.** Migration `supabase/migrations/20260927000004_f6_accept_ride_request_rpc.sql` adds `accept_ride_request(p_ride_request_id)`: one transaction that locks the ride row `FOR UPDATE` (the actual "only one driver wins" guarantee — not just the status check), locks-or-creates the driver's trip `FOR UPDATE` (closes the double-seat-check race: a second concurrent accept by the *same* driver blocks on this same row), checks free seats against that trip's real occupancy, then assigns. Carries forward X11's availability/not-declined/cluster checks (same null-passthrough cluster convention as `match-ride-request`'s `isClusterAuthorized`, for the same reason X11 documents). Client: `acceptRideRequest(rideRequestId)` in `packages/services/src/booking/index.ts` now calls the RPC directly (dropped the now-redundant `driverId` param — the RPC uses `auth.uid()`); the client-facing error for a lost race is still exactly "This ride was just accepted by another driver." **The network-timeout resilience piece is also built:** a new `reconcileAcceptedRide(rideRequestId)` re-reads the ride's row on a caught network error/timeout — `rr_driver_read`'s own RLS makes this safe: a row is only visible while still pending (genuinely failed) or while its trip belongs to the calling driver (they won), so "no row" cleanly means "you did not win." Wired into `apps/driver/src/store/useRequestsStore.ts`'s `accept()` catch block. Recorded live as version `20260927000004` (confirmed via `migration list --linked`, no drift). Verified live: `authenticated` can execute the RPC, `anon` cannot, and `rr_driver_update` no longer exists on `ride_requests` — there is now no direct driver UPDATE path left on that table at all. `typecheck` clean, full suite green (549 tests, including 6 rewritten `acceptRideRequest`/`reconcileAcceptedRide` tests replacing the 6 obsolete multi-step-flow tests). |
| F5 | **DONE 2026-09-27 (Person 1) — code + migration, applied and verified live.** Migration `supabase/migrations/20260927000003_f5_passenger_receipt_lookup.sql` adds an optional `p_ride_request_id` parameter to `get_passenger_trip_history` (same DROP+CREATE+re-grant pattern as D2/F4; backward compatible, existing single-arg calls unaffected) so one specific ride's server record can be fetched instead of only a recent-N list. Recorded live as version `20260927000003` (confirmed via `migration list --linked`, no drift). Verified live: the 2-arg overload's return type resolves correctly, and `anon` cannot execute it. New service function `getPassengerRideReceipt(rideRequestId)` in `packages/services/src/trip-history/index.ts` (3 new tests). `trip-complete.tsx` now renders fare, distance, payment method, pickup/dropoff labels, and driver name/plate from that server record once it resolves, falling back to the local `useBookingStore` snapshot instantly on mount and on a failed/slow fetch, so the screen never blocks or blanks. `typecheck` clean, full suite green (543 tests). |

### Loopholes in the new plan (each fix belongs to the item named in brackets)
| ID | Loophole | Fix |
|---|---|---|
| L1 | **Passenger dodges a strike** by asking the driver, in chat or in person, to cancel for them, so the driver takes the strike. | [PD1] Driver reason "Passenger asked to cancel" sends the passenger a confirm prompt. If they confirm, it's recorded as a passenger cancel with a strike. If they don't confirm within 60 s, it's a driver cancel, and frequent use flags the driver. |
| L2 | **Request spam without strikes.** Cancelling while still searching is free, so someone can create and cancel requests over and over, and every one pushes a notification to drivers. | [PD1] More than 5 cancels while searching in 1 hour brings a 30-minute booking pause. The numbers go in `system_settings`. |
| L3 | **DONE 2026-09-27 (Person 1), closed as part of R3 — migrations `20260927000013`/`20260927000014`.** **Faked "I've arrived"** using a fake-GPS app. | Closed at the source rather than inside `mark_arrived`/no-show individually: both (and Y1's `start_ride_leg`/`complete_ride_leg`) read `driver_profiles.current_lat/current_lng` directly, and R3's new trigger rejects a mocked fix before it can ever land in that column — so none of those checks can be fooled by one, without touching any of them. No separate "log the mocked event" table; the write is rejected outright and the client sees the rejection. |
| L4 | **Arrive, then leave:** the driver taps "I've arrived", drives off, and claims a no-show 5 minutes later. | [PD1] The no-show cancel also requires the driver to be within about 100 m of the pickup point *at the moment of cancelling*. |
| L5 | **Transfer or release to pool used as a free cancel.** Transfers don't give the driver a strike, so a driver can dump rides they don't want. | [D1] Releasing a ride to the pool before pickup counts as a strike unless an invite was accepted. Transfers per driver are counted; more than 3 a week flags the driver for PSO review. The reason is always required and logged. |
| L6 | **Stranded passenger after a transfer after pickup:** driver 1 leaves before the new driver arrives. | [D1] Driver 1 can't accept new passengers until the handoff is done: the new driver starts the leg, the ride goes to the pool, or 5 minutes pass. The passenger has SOS and strike-free cancel throughout. |
| L7 | **Paid twice on a transfer:** driver 1 takes cash before transferring. | [D1] Cash can only be confirmed by the driver who finishes the ride. `confirmCash` is refused for a ride that is being transferred or was transferred away. |
| L8 | **Invited driver no longer eligible at accept time:** now full, suspended, offline, or documents expired. | [D1] `respond_transfer` re-checks eligibility and free seats inside the locked transaction, not only when the list was shown. |
| L9 | **Transfer during an active SOS** would move the passenger away from the emergency. | [D1] Transfers are blocked while the ride has an unresolved `emergency_alerts` row. |
| L10 | **Rating a driver who never served the ride** by abusing the "rate both drivers" change. | [D1] `validate_rating` allows a second driver only if an accepted `ride_transfers` row links them to that ride. |
| L11 | **DONE 2026-09-29.** **Chat used to share phone numbers**, which defeats the privacy design, or used for harassment. | [C1] `enforce_ride_message_insert_fields()` regex-masks `09\d{9}`/`\+639\d{9}` patterns in `body` and sets `contains_masked_phone` — ✅. `reportMessage()` in `packages/services/src/chat/index.ts` opens the existing complaints flow prefilled with the ride/message context, reusing `submitComplaint()` rather than new machinery — ✅. Rate limit: 20 messages/minute/sender, same count(*)-per-window trigger pattern as PD1 — ✅. No separate "log it" table beyond the masked-body flag itself, matching the doc's own preference for deriving rather than duplicating data. |
| L12 | **Driver keeps the passenger's home location** because pickup and drop-off stay in the driver's trip history. | [F-new] Driver-side history shows only the barangay or area after completion. Exact coordinates stay visible to the PSO only. |
| L13 | **Email spam** with the "Email me this receipt" button. | [P1] At most 3 sends per ride and 20 per day per user, enforced in `send-receipt`. Only the account's verified email is used. |
| L14 | **Abuse of the Maps proxy:** a scripted client burns through the Google quota. | [G2] ✅ Done — `maps-proxy` requires a valid Supabase JWT (verify_jwt on; confirmed live it rejects missing/malformed tokens before reaching the handler), and enforces 60 searches / 20 routes per hour per user via `increment_maps_proxy_usage`. CORS is `*` like the repo's other JWT-authenticated functions — the caller is the mobile app via a real user session, not a browser, so the JWT check is the actual gate, not CORS. Google's own daily quota caps (set in Cloud Console) remain the hard ceiling. |
| L15 | **Silent policy changes:** an admin changes strike or cooldown numbers and nobody can see who did it. | [PD1] Changes to `system_settings` and `fare_config` are written to the audit log (who, old value → new value, when). |
| L16 | **DONE 2026-09-29, scoped to the chat-thread slice of S1 — the rest of S1's case view doesn't exist yet.** **PSO case access with a junk reason**, since the reason is only free text. | [S1] `admin_view_ride_messages(ride_request_id, reason)` rejects a blank reason and writes it to a new `ride_message_view_log` audit table before returning any messages — ✅. **Deviation from the original spec, deliberate:** the reason is free text, not chosen from a fixed list — matches how every other reason field in this app already works (complaint resolution notes, account-action reasons), and a list would need product input on what the options should be. **Also deviates on "admin-only":** the audit report (`AuditLog.tsx`'s new "PSO Chat-Thread Views" tab) is readable by any signed-in PSO role, not admin-only — this matches the existing `account_actions`/`login_events` convention (`is_pso()`, not `is_admin()`) rather than the doc's literal wording, on the reasoning that transparency across tiers is this app's established pattern; flagging here in case that's not what was intended. |
| L17 | **Guessable Share-my-trip link.** | [N3] A random token of at least 128 bits, expiring when the ride ends. The page shows only first name, plate and live position. |
| L18 | **Seats undercounted:** book 1 seat and board 3 people, paying 1 fare and overloading the tricycle. | [PD1/UI] The driver can adjust seats at pickup ("3 passengers boarded"). `start_ride_leg` accepts `p_seats`, recomputes the fare through `compute_fare`, and checks capacity. The passenger is shown the new fare. |

### Loopholes in the existing system (audit 2026-09-24)
Sources: three read-only code audits (database access rules and functions, ride/fare/payment logic, app reliability). The findings are based on `docs/SCHEMA.MD` and the migrations. The base schema and several function bodies exist **only in the live database**, so step X0 confirms everything there before fixing.

**X7 secret rotation: DONE (2026-09-24), git history purge deferred to end of sprint.**
1. ~~Generate a new secret. Store it as a Supabase Edge Function secret and in Vault. Redeploy `notify-drivers-new-request` and `notify-expiring-documents` to read it from env, and update the two trigger/cron SQL definitions to read it from Vault.~~ **DONE.** New secret is in Vault + set as an Edge Function secret (never committed). Both functions redeployed reading `Deno.env.get('NOTIFY_SHARED_SECRET')`, fail closed (500) if unset. Trigger + cron job repointed at Vault via `supabase/migrations/20260924000001_rotate_notify_shared_secret.sql`, applied directly to the live DB (see note below on why `db push` couldn't be used). Confirmed live: the old secret now returns 401.
2. Checking Edge Function logs for unexpected calls: **not done** — this CLI version has no `functions logs` subcommand; check via the Supabase dashboard's Logs Explorer when convenient. Low urgency now that the secret is rotated.
3. **Purge the old value from git history (`git filter-repo`), then force-push — deferred to the end of the sprint by decision (2026-09-24), not before.** The live secret is already dead, so the old string sitting in history is inert; purging it is cleanup, not urgency, so it's better done once at the end than disrupting the team mid-sprint with a mandatory re-clone. Whoever does G3 (final screenshots, Person 1) should do this purge right before or after, as the last cleanup step. Any public fork still keeps the old value regardless of when the purge happens — that's expected and fine, since it's dead.
4. While there, scan history for any other committed keys — do this in the same end-of-sprint pass as item 3.

**Priority if time runs out (confirmed):**
1. The panel's items, X1–X11, and R1, R2, R4, R5.
2. Y items, as far as time allows.
3. Stretch items (C1, N1, N2) move to future work.

**X0: take a snapshot of the live database first (day 1, Person 2) — bigger than originally scoped.** A real `supabase db push` was attempted on 2026-09-24 and failed: the live database has roughly 90 migrations that were never saved into `supabase/migrations/`. Link the Supabase CLI and run `supabase db pull`, review the diff carefully (it will be large), and reconcile it with the local migrations directory before anything else in this list. This covers F2. Tick off each finding below as confirmed or already fixed live before changing anything.

**Pattern for most fixes:** Postgres row-level security (RLS) checks only the *new* row, so an "owner-only" rule still lets the owner change *every* column of their own row. Reuse the repo's existing column-lock trigger pattern (`enforce_driver_claim_columns_locked`, `enforce_notification_columns_locked`), or column-level `GRANT UPDATE (…)`, or move the write into a SECURITY DEFINER RPC.

**Gotcha confirmed live 2026-09-25, relevant to any brand-new function (e.g. `cancel_ride_request`, `accept_ride_request`, `invite_transfer` for PD1/F6/D1): a `REVOKE EXECUTE ... FROM anon, authenticated` alone is not always enough.** Postgres grants EXECUTE on a newly created function to `PUBLIC` by default, and `anon`/`authenticated` inherit that as implicit PUBLIC members — a revoke naming them individually doesn't touch the underlying PUBLIC grant they're still inheriting through. Found while building maps-proxy's `increment_maps_proxy_usage`: revoking from `anon, authenticated` left `has_function_privilege('anon', ..., 'execute')` still `true`; only revoking from `public` as well fixed it. **After any REVOKE on a function you just created, verify with `select has_function_privilege('anon', 'public.fn_name(arg_types)', 'execute');` — don't assume the REVOKE line worked just because it ran without error.**

#### Critical: exploitable with a single API call (required, week 1)
**Status (audited 2026-09-27, line-by-line against the actual migration bodies, not just filenames):** X0–X10 confirmed **DONE** — each migration was opened and its trigger/policy logic verified to actually do what its row below claims. X11 is **PARTIAL**: the migration (`20260925220000`) hardens the *existing* direct-UPDATE claim policy (adds availability/active-trip/cluster/not-declined checks) but its own header comment states the `accept_ride_request`-style RPC "doesn't exist yet and is out of scope here" — it is not the atomic RPC replacement F6 calls for, just a stopgap. X7/F1 confirmed **DONE** (secret rotated, functions read from `Deno.env`, old secret dead). Still marked *awaiting Person 2's confirmation* for live verification and the X0 reconciliation follow-up, since this audit only checked the repo, not the live database.

| ID | Loophole | Exploit | Fix |
|---|---|---|---|
| X1 | `users_update_self` locks only `role` (SCHEMA.MD:1565) | A suspended user sends `PATCH users {status:'active'}` and is unsuspended. They can also change `email` and `must_change_password`. | Lock trigger: non-admins may change only name, contact number, avatar and push token. |
| X2 | `rr_passenger_insert` checks only `passenger_id` (SCHEMA.MD:1636) | Insert rides that are already `completed` on a driver's old trip → **unlimited fake ratings**, 1★ or 5★. Insert rides as `assigned` → **permanent access to that driver's live GPS**. Fake rows in stats. **This would also forge PD1 strikes and D1 double ratings.** | BEFORE INSERT trigger forcing `status='pending'` and `trip_id`, `final_fare` and all lifecycle timestamps to NULL, with `requested_at` and `expires_at` set by the server (fixes client-set dates that never expire). `driver_locations` access also requires the trip to be `active`. |
| X3 | `discounts_submit_own` checks only `passenger_id` (SCHEMA.MD:1611) | Insert your own discount as `status:'approved'` with no expiry → 20% off forever. | Force `pending` and NULL review columns. `expires_at` is set by the database on approval. An approved discount with NULL expiry counts as expired. The fare trigger uses the same expiry test as `compute_fare`. |
| X4 | `driver_update_self` locks only `verification_status` (SCHEMA.MD:1576) | The driver sets `rating_avg=5` and `rating_count=0`, and leaves the low-rating list. | Lock trigger: drivers may change only availability, location and declared destination. |
| X5 | `tricycles_insert`/`update` (migration 20260915000002:85-100) | The driver deactivates their tricycle and inserts a **self-approved** one (any plate, cluster or seats). Or raises `seat_capacity`. | The insert is forced to `unsubmitted` with verification fields NULL. Lock `is_active`, `seat_capacity` and `plate_no`, or move vehicle changes into an RPC. |
| X6 | `driver_documents` insert/update (migration 20260915000002:57-61) | The driver marks their own documents `approved`, or sets an approved one back to `pending`, then deletes the file (evidence destroyed). | Lock trigger: drivers may change only `expiry_date`, and `storage_path` only while not approved. The insert is forced to `pending`. |
| X7 | Shared secret committed in 4 places (= F1) | Anyone with the repo can push-spam every driver or suppress document-expiry reminders. | **DONE (2026-09-24):** rotated, `Deno.env` in functions, Supabase Vault in SQL. Old secret confirmed dead (401). Git history purge deferred to end of sprint (see note above). Still open: move the hardcoded project ref out of migrations (low priority, not secret, just an env-split blocker). |
| X8 | Suspension enforced only in the app UI | A suspended user can still book, complain, rate or go online through the API. | Add `is_account_active()` to passenger/driver write rules, the ride RPCs and the go-online trigger. Emergency alerts stay open on purpose. Also ban the user in Supabase Auth when suspending. |
| X9 | `rr_passenger_cancel` checks only the new status | The cancel request can also set `trip_id`, `final_fare`, etc. | **DONE.** Replaced by PD1's `cancel_ride_request` RPC (2026-09-27); the direct UPDATE policy was already removed by X9 itself, and `cancel_ride_request_as_passenger` is now dropped in favor of the new RPC. |
| X10 | `trips` update doesn't lock `status` (migration 20260915000002:66-70) | The driver marks a trip `completed` with passengers still on it. They are then stuck: they can't cancel or rebook. | `status`, timestamps and `tricycle_id` change only through RPCs. Also check the tricycle belongs to the driver when a trip is inserted. |
| X11 | `rr_driver_update` claim: no check of availability, active trip or cluster | An offline driver claims any request by its id. | **DONE 2026-09-27.** `20260925220000` hardened the policy as a stopgap; F6's migration (`20260927000004`, applied and verified live) replaced it entirely with the atomic `accept_ride_request` RPC and dropped `rr_driver_update` outright — confirmed live: the policy no longer exists, so there is no direct driver UPDATE path left on `ride_requests` at all. |

#### High: ride integrity, payments, abuse (required)
| ID | Loophole | Fix |
|---|---|---|
| Y1 | **DONE 2026-09-27 (Person 1), applied and verified live — migration `20260927000009`, updated by `20260927000018` (Y10).** **Remote or instant rides:** `start_ride_leg` and `complete_ride_leg` have no location or time check. A driver can "complete" a ride in 2 s from anywhere and collect the full fare. | Start requires the driver within about 100 m of pickup — ✅ (same haversine_km/100m pattern as F4/PD1). Complete originally hard-blocked past ~300 m of the destination; **Y10 (2026-09-27) replaced that block** with recording the actual drop-off point and flagging (not refusing) past ~500 m — see Y10's own row, this is no longer an open limitation. Enforce a minimum ride time based on `distance_km` — ✅ (60 km/h ceiling), unchanged by Y10. Reject mocked GPS (L3) — **done separately** via R3's `enforce_driver_location_integrity` trigger (2026-09-27), which blocks a mocked fix from ever reaching `driver_profiles.current_lat/lng` in the first place — see L3's own row. |
| Y2 | **GCash never paid:** a ride completes with no payment, and the passenger can book again at once. | Block new bookings while the passenger has a completed ride without a paid transaction; show a "Settle previous ride" screen. Flag repeat cases to PSO. The app restores unpaid rides after a restart (R5). |
| Y3 | **PayMongo issues:** (a) the checkout reuses a `cash` transaction row, so the webhook fails with a 500 forever; (b) an old session can still be paid (double charge); (c) `failed → paid` is ignored; (d) the amount check passes if the amount is missing; (e) the plain signature path has no replay window; (f) the raw payload with billing PII is readable by the driver. | Require or switch `method='gcash'`. Expire the old session through the PayMongo API. Store payment ids. Allow `failed → paid`. Fail closed on a missing amount. Drop the unsigned-timestamp branch. Store only ids, with raw payloads in a service-only table. Log paid-but-unmatched payments for refund. |
| Y4 | **DONE 2026-09-27 (Person 1), applied and verified live — migration `20260927000012`.** **Complaints:** on insert a user can set `status='resolved'`, staff fields, any `against_user_id` or any ride. Only a 10 s cooldown. PSO staff can rewrite the complaint text or impersonate the department head. | New `trg_complaints_insert_fields` (BEFORE INSERT) forces `status='open'` and NULLs every staff/DH/mediation/resolution field — ✅. `against_user_id` is now derived from `ride_request_id` (passenger ⇄ trip driver); the submitter must actually be one of those two parties or the insert is rejected — ✅. Note: the app's own `submitComplaint()` never set `against_user_id` before this, so this also makes "who a complaint is about" work for the first time, not just lock it down. Max 5/day per user and 2 per ride — ✅ (soft counters, not a unique index; a rare race could let one extra through, acceptable for an abuse-rate cap). `enforce_complaint_supervisor_columns_locked` extended so `pso_staff` also can't touch `subject`/`message`/`category`/`submitted_by`/`against_user_id`/`ride_request_id`/`dh_*` — only PSO Supervisor/Admin may — ✅. New trigger functions revoked from PUBLIC/anon/authenticated per this project's grant convention; confirmed live via `has_function_privilege`. |
| Y5 | **DONE 2026-09-27 (Person 1), applied and verified live — migration `20260927000012`.** **Emergency alerts:** any `counterpart_id` (false accusation), role or status can be set. A 30 s throttle still allows about 2,880 PSO alerts a day. | New `trg_emergency_insert_fields` (BEFORE INSERT) derives `triggered_role`/`counterpart_id` from `ride_request_id` (or from the user's own account role when there's no ride) and forces `status='logged'` — ✅. `notify_pso_on_emergency` still **always accepts the alert row** (never blocks the real 911/PNP dial-out, per FR-12/NFR-4) but now also stops fanning out new PSO notifications once a user has 5 alerts logged in the past hour, on top of the existing 30 s exact-duplicate dedup — ✅. "PSO can mark false alarms, which are counted per user" — added a plain `is_false_alarm` column (no new RLS needed, `emergency_review_supervisor` already covers it); counting per user is left as an ad-hoc query for whoever reviews repeat offenders, same unautomated pattern as `account_actions` — **not built as its own reporting feature**. No client changes needed for either Y4 or Y5 — both apps already just pass through `error.message`, and the client's own `triggered_role`/`counterpart_id` insert values are now silently overridden server-side regardless of what's sent. |
| Y6 | **DONE 2026-09-27 (Person 1), applied and verified live — migration `20260927000017`.** PSO staff can read every user's `contact_no`, `email` and `push_token` directly (SCHEMA.MD:1562). | Found live before writing this: the passenger side was **already half-fixed** — `admin_passenger_directory` (a `security_invoker` view) already masks `contact_no`/`email` to null for anyone but a supervisor. There was no driver-side equivalent: `admin/drivers.ts`, `admin/tricycles.ts` and `admin/verification.ts` all read `contact_no`/`email` straight off `public.users`, unmasked, so plain `pso_staff` saw them there. New `admin_driver_directory` view mirrors the exact same masking pattern for drivers — ✅, verified live in a rolled-back transaction impersonating both a plain `pso_staff` account (masked to null) and a `pso_supervisor` account (real value) against the same driver row. All three admin call sites switched to it. Column-level `REVOKE ... FROM authenticated` was considered and **deliberately not done**: `admin_passenger_directory`'s own masking `CASE` still needs `authenticated` to hold column-level SELECT on `contact_no`/`email` (a `security_invoker` view's column references are privilege-checked against the invoker regardless of which `CASE` branch runs) — revoking it would have broken the passenger view that already works correctly. `push_token` — confirmed no admin/PSO code anywhere reads it (grepped the whole `packages/services/src/admin` tree); no view/RPC needed since nothing exposes it today. |
| Y7 | ~~`refresh_driver_rating` is not SECURITY DEFINER, so **driver ratings may never update**.~~ **DONE — fixed incidentally 2026-09-25, confirmed live 2026-09-27 (Person 1).** `20260925160000_x4_lock_driver_profile_self_update.sql:21-25` redeclares it `security definer set search_path`, as part of the X4 migration. `pg_get_functiondef` against the live project confirms `SECURITY DEFINER` is set on the deployed function — no further action needed. |
| Y8 | **DONE 2026-09-27 (Person 1), applied and verified live — migration `20260927000008`.** "One active ride" is checked with EXISTS in a trigger, so it can be raced (two devices). | Unique partial index on `ride_requests(passenger_id) where status in ('pending','assigned','ongoing')` — ✅, confirmed no existing violations before creating it, index def matches live. The trigger stays as a friendly fast-path error; `createRideRequest` now translates a 23505 from the index into the same message for the race case. |
| Y9 | **DONE 2026-09-27 (Person 1), applied and verified live — migrations `20260927000010` + `20260927000011`.** **Expired documents don't stop a driver working.** Licence, OR/CR or MTOP expiry isn't checked when going online or accepting. `expiry_date` is entered by the driver. | Block going online and accepting when any required document or the MTOP has expired — ✅. New `driver_has_expired_requirements()` helper, reused at all three points that needed it: going online (`enforce_driver_verified_before_available`, now `security definer` so it can call the helper regardless of the driver's own grants — a real gap caught and fixed live: the helper's PUBLIC-default grant was missed on the first pass, then closed in the follow-up migration once `has_function_privilege` caught it), `accept_ride_request`, and D1's `respond_transfer` (a driver with expired documents shouldn't be able to accept a transfer either). "The reviewer confirms the expiry date at approval" — **not done**, that's an admin-form change (Person 3/admin scope), not built here; today a null `expiry_date` simply never blocks. |
| Y10 | **DONE 2026-09-27 (Person 1), applied and verified live — migration `20260927000018`.** **Fare fixed at booking:** book a short trip and ride far, or get dropped early and still pay the full fare. | This also **replaces Y1's own hard block**, not just adds a new feature: Y1's `complete_ride_leg` unconditionally refused completion past 300m from the booked destination, which was strictly worse than Y10's intent — a genuine early/off-destination drop-off simply couldn't be completed from the app at all (documented as a known interim limitation in Y1's own migration, explicitly waiting on this one). New `ride_requests.dropoff_lat/dropoff_lng` record the actual completion point (previously not stored anywhere) — ✅. `fare_flagged` is set when that point is more than ~500m from the booked destination, and completion is now always allowed regardless of distance — ✅, verified live in a rolled-back transaction (walked a synthetic ride through pending→assigned→ongoing→completed as the real driver role): a >500m drop-off completes and flags, a normal <300m drop-off completes without flagging. Passenger sees "Report a fare issue" on `trip-complete.tsx` when flagged, deep-linking to the complaints tab with the ride and `fare` category preselected (reuses the existing Y4-hardened complaint pipeline, not a new one). PSO visibility: `admin/rides.ts`'s Ride Log now carries `fareFlagged` and shows a "Fare flagged" badge, same place `hasEmergencyAlert`/SOS already shows. Full fare recalculation based on the actual route remains future work, per the doc's own scope note — this only records and flags. |

#### Reliability (required: R1–R6; the rest are backlog)
| ID | Problem | Fix |
|---|---|---|
| R1 | **DONE 2026-09-27 (Person 1), applied and verified live — migration `20260927000015`.** **Ghost drivers:** a driver who kills the app stays `is_available` forever. They're counted as nearby, get pushes, and logging out with no signal leaves them online. | New `mark_ghost_drivers_offline()`, scheduled every minute via `cron.schedule` (same plain-function-on-a-schedule pattern as `cancel_stale_pending_ride_requests`/`release_expired_transfer_invites`): flips `is_available=false` where `location_updated_at` is null or older than 5 minutes — ✅, confirmed live in a rolled-back transaction against a real online driver's row (forced a stale timestamp, ran the function, confirmed `is_available` flipped to false, then rolled back so nothing in production was actually touched). "Logout waits for, or queues, the offline write" — already true: `apps/driver/app/logout.tsx` already `await`s `setAvailable(false)` before `logout()`, with a comment explaining why the order matters (the write needs the still-live session) — nothing to change there. Pushes/nearby-counting for a ghost driver were already closed by R2's freshness filter regardless of `is_available`; this item makes `is_available` itself (what the admin dashboard and the driver's own app read directly) match reality too. |
| R2 | **DONE 2026-09-27 (Person 1), deployed and verified live via `get_edge_function` (source matches exactly).** **Matching ignores location entirely.** The declared destination is never written, so the radius filter never runs, and every driver sees every request in the city, oldest first. Pushes say "nearby" but go to everyone. | `match-ride-request` (v8→v9): confirmed `declared_dest_lat/lng` is never written anywhere in either app, so the old bearing/detour "heuristicApplied" path was always dormant and every available driver fell through to the unfiltered hard-filtered list. Now always applies a hard radius filter (`system_settings.search_radius_km`, same 3 km fallback as `nearby-driver-count`) against the driver's own live `current_lat/lng`, and a driver with no location fix or one older than 2 minutes gets an empty board instead of the unfiltered one — ✅. `nearby-driver-count` (v3→v4): added the same 2-minute freshness cutoff on top of its existing radius filter — ✅. `notify-drivers-new-request` (v5→v6): previously pushed every cluster/seat-eligible driver city-wide; now also requires the candidate driver's live position within `search_radius_km` of the ride's pickup and a fresh (<2 min) `location_updated_at` — ✅. No client changes needed; all three are server-side edge functions. |
| R3 | **DONE 2026-09-27 (Person 1), applied and verified live — migrations `20260927000013` + `20260927000014`.** **GPS and time are client-controlled:** `location_updated_at` is set by the client; mock locations are accepted. | New `driver_profiles.is_mocked` column + `enforce_driver_location_integrity()` BEFORE UPDATE trigger, firing only on a genuine `current_lat`/`current_lng` change (not every unrelated `driver_profiles` write). `location_updated_at` is always server-stamped (`now()`), never the client's value — ✅. A mocked fix (`is_mocked = true`, from `expo-location`'s `LocationObject.mocked`, wired through `pushDriverLocation`/`updateDriverAvailability` in both call sites) is rejected outright — ✅, also closes L3 (see its own row). Implied speed over 80 km/h between fixes is rejected — ✅; **self-caught gap during live verification**: the first version (`20260927000013`) skipped the speed check entirely under a 1-second interval to avoid false positives from GPS jitter, which also meant two updates sent under 1 second apart bypassed the check completely — a scripted client hitting the table directly (bypassing the app's 8s throttle) could have teleported for free. Fixed in `20260927000014` by flooring the elapsed interval at 1 second instead of skipping below it; verified live in a rolled-back transaction that a genuine sub-second jitter still passes, a sub-second teleport is now rejected, and a mocked write is rejected — all three confirmed against a real online driver's row without touching production data. |
| R4 | **Core fix DONE 2026-09-27 (Person 1).** ~~Push tokens outlive logout,~~ and there's one token per account. The next user on the phone gets the previous user's pushes. | `logout()` in both `apps/passenger/src/store/useAuthStore.ts` and `apps/driver/src/store/useAuthStore.ts` now calls `registerPushToken(null)` before `authService.signOut()` (best-effort, wrapped so a failed clear never blocks sign-out). Verified: `npm run typecheck` clean, `test:passenger` 22/22 and `test:driver` 76/76 still pass. **Still open:** the `push_tokens(user_id, token unique)` multi-device table — deferred, marked "if time allows" in the original plan, not required for the core fix. |
| R5 | **DONE except the `completed`/unpaid-ride piece (2026-09-27, Person 1).** ~~stores aren't reset when the user changes. The active ride is restored only on a cold start.~~ **1. Reset on user change:** `useBookingStoreReset(sessionUserId)` in `_layout.tsx` (same pattern as `useConsentSync`) clears `useBookingStore` on every sign-out/switch. **2. Restore on every login, not just cold start:** `resolveActiveRideRoute` (the restore logic, previously only inside `splash.tsx`) was extracted to `apps/passenger/src/utils/resolveActiveRideRoute.ts` so it's one tested function instead of copy-pasted logic. `_layout.tsx`'s `useProtectedRoute` now replaces into `/splash?fast=1` instead of straight to `/(tabs)/home` on a fresh sign-in or a lifted suspension — `fast=1` skips splash's 1.4s cold-start branding wait since the app is already warm, so a same-session login gets the same active-ride check a cold launch gets, without the fake delay. **3. Restore on foreground return:** new `useForegroundActiveRideSync` hook in `_layout.tsx` listens for a real background→active cycle (same `wasBackgrounded`-gated `AppState` idiom as `useLocationPermission.ts`, so Notification Center/incoming-call 'inactive' blips don't trigger it) and re-runs the same lookup, but only when `tripStatus === 'idle'` locally — a ride already being tracked has its own live subscription (`finding-driver.tsx`/`trip.tsx`) and is left alone, so this only closes the gap where a push arrived and got missed while the realtime channel was torn down in the background. Verified: `typecheck` clean, `test:passenger` 22/22, no regressions. **Still open, correctly deferred, not attempted here:** the `'completed'`/unpaid-ride recovery — `resolveActiveRideRoute`'s own comment already says this needs Y2 (payment recovery) built first, so folding it in now would be guessing at a design that depends on unbuilt work. The offline-lookup-failure-shows-retry-state polish item is also still open — low-risk, can be picked up separately. |
| R6 | **DONE 2026-09-27 (Person 1), client-only — no migration needed.** **The driver isn't told live when a passenger cancels.** This becomes more common with PD1. | New `subscribeToTripRideRequests(tripId, onChange, onError)` in `packages/services/src/booking/index.ts` — a Realtime `postgres_changes` subscription filtered on `trip_id` (already RLS-readable by the trip's own driver via the existing `rr_driver_read` policy, and `ride_requests` is already in the `supabase_realtime` publication — confirmed live, no migration needed). Wired into `useTripStore` as `subscribeToCancellations`/`unsubscribeFromCancellations`, which just re-runs the existing `hydrate()` on any change rather than patching a single row locally — a cancellation touches several columns at once (`status`, `cancelled_at`, `cancel_reason`, `cancelled_by`), and `get_active_trip_passengers` is already the single source of truth for who's still actually on the trip. Owned session-wide in `app/_layout.tsx` (`useTripCancellationSync`, keyed on the active trip's id), same pattern as `useRequestsSync`/`useTransferInvitesSync` — not scoped to the trip/active screen's mount lifecycle. |
| R7 | **DONE 2026-09-27 (Person 1), client-only — no migration needed.** Changing the password leaves other sessions logged in. No AppState auto-refresh, so 401s after being in the background. | `packages/services/src/auth/index.ts`'s `updatePassword()` now calls `signOut({ scope: 'others' })` after a successful `updateUser({ password })`, leaving the current session untouched — ✅. Shared by both mobile apps' voluntary change flow and the recovery flow (`verifyPasswordReset` → `updatePassword`), and by the admin portal's own password-change screen (same function), so all three benefit from one fix. `useSupabaseAutoRefresh()` added to both `apps/driver/app/_layout.tsx` and `apps/passenger/app/_layout.tsx` — the standard Supabase-recommended `AppState` listener calling `auth.startAutoRefresh()`/`stopAutoRefresh()` on foreground/background — ✅. Not needed in `apps/admin` (a browser tab, not backgroundable the same way; supabase-js's own browser-visibility handling already covers it). |
| R8 | **DONE 2026-09-27 (Person 1) except the Auth-dashboard step, applied and verified live — migration `20260927000016`.** **Duplicate accounts dodge cooldowns and bans:** the phone number is unverified, can be empty, and isn't normalised (`0922 444 4955` ≠ `09224444955`). Password rules are only in the app. | Found the real gap live before writing this: `contact_no` already had a `UNIQUE` constraint (`users_contact_no_unique`), but the format check backing it (`users_contact_format`) was loose enough (`^[0-9+()\-\s]{7,20}$`) that two different punctuations of the same real number counted as two different unique values — silently defeating it. New `normalize_contact_no()` (BEFORE INSERT/UPDATE) strips everything but digits before either constraint is checked — ✅. `users_contact_format` tightened to the strict `^09\d{9}$` the client already validates against (`isValidLocalMobile`, both apps) — ✅, confirmed zero existing rows violated it before tightening. New `users_contact_required_for_pax_driver` CHECK makes it required only for `passenger`/`driver` (PSO/admin accounts don't collect it) — ✅. All three verified live in a rolled-back transaction against a real passenger row: a punctuated input normalizes correctly, nulling it out is rejected, and a malformed number is rejected. **"Set password rules in Supabase Auth settings"** — **not done**, that's a Supabase project dashboard setting (Auth → Policies), not something a migration or app code can set; flagging for whoever has dashboard access. SMS OTP remains future work (costs money), unchanged. |
| R9 | **DONE 2026-09-27 (Person 1), applied and verified live — migration `20260927000019`.** **Time zones:** earnings split days at UTC midnight; the franchise cron runs at 16:00 Manila time; admin charts use the browser's time zone. | `v_driver_earnings` now buckets `completed_at` by Manila calendar day (double `at time zone` round-trip keeps the column `timestamptz`, so no DROP+CREATE needed) — ✅, confirmed live (`2026-09-21 16:00:00+00` = Manila midnight on the 22nd). `notify-expiring-franchises` moved from `0 8 * * *` (16:00 Manila) to `0 0 * * *` (08:00 Manila, matching its sibling document-expiry job) via `cron.alter_job` — ✅, confirmed live. Admin charts (`getPeakHourHistogram`'s hour bucketing, `getRidesRevenueOverTime`'s day bucketing) were reading the **admin's own browser timezone** (`new Date(ts).getHours()`/`toLocaleDateString()` with no explicit `timeZone`) — fixed to pin `Asia/Manila` explicitly, client-only, no migration. Found and fixed the same class of bug on the driver side too, not called out in the original finding: the earnings screen's bar chart (`EarningsBarChart.tsx`) used the **driver's own phone timezone** to decide which bar is "today" and how to label each day — now also pinned to Asia/Manila, matching the view's new bucketing exactly. |
| R10 | **PARTIALLY DONE 2026-09-27 (Person 1) — see per-item detail; the rest remains backlog.** Backlog (Low): `nearby-driver-count` can be used to pinpoint a lone driver (round the count, rate-limit). `avatar_url` accepts any URL, and the avatars bucket is public. Trigger functions have no `search_path`. Expiry notices are marked sent even when sending failed. The countdown uses the phone's clock. Error banners never clear. Driver earnings today is a local counter. `admin-create-pso-user` doesn't check the admin's own status. `login_events`/flag spam. Accept rate is easy to game. Cash can be confirmed before the ride is completed. | **Done, applied and verified live — migrations `20260927000020` + `20260927000021`:** ① `nearby-driver-count` now rounds up to the nearest 3 (never reveals an exact "1") and rate-limits 20/user/hour via a new `increment_nearby_driver_count_usage` (same pattern as `increment_maps_proxy_usage`) — closes the triangulation risk without affecting the legitimate "· N nearby" chip, which only calls this a handful of times per session. ② `avatar_url` now has a CHECK constraint requiring the exact `.../storage/v1/object/public/avatars/{own id}/avatar.*` shape `uploadAvatar()` always produces — an arbitrary external URL is rejected; confirmed live, zero existing rows violated it. ③ Trigger functions with no `search_path` — audited live: every `public`-schema trigger function already has one (a byproduct of this session's own migration discipline); the only functions missing it are Supabase's own `storage`/`realtime`/`cron`-schema internals, which this project doesn't own or modify. ④ `notify-expiring-documents` no longer marks a doc's `expiry_notified_at` when its push batch's send actually failed (network error/non-2xx) — only successfully-sent batches (and token-less docs, which have nothing to send) are marked; a failed batch retries the next day. ⑤ `admin-create-pso-user` now also checks the caller's `status` (`active`/`flagged` only, matching `is_account_active()`'s own definition), not just role — a suspended/deactivated admin can no longer create PSO accounts. ⑥ Cash can be confirmed before the ride is completed — the literal fix would have blocked the app's own real UX (the cash-confirm toggle is shown *during* the ride, confirmed then completed as separate steps); scoped instead to what's unambiguously wrong: a new trigger blocks confirming cash before the passenger has even been picked up (`status in ('ongoing','completed')`), closing the "never actually drove them" case while leaving the working flow intact. **Not done** (deferred — lower value or needs real product-design decisions, not a quick fix): the countdown using the phone's clock, error banners never clearing, driver earnings-today being a local counter, `login_events`/flag spam, and accept-rate gaming. |

**How these affect the new plan:**
- PD1 strikes, D1 double ratings and C1 chat access all trust `ride_requests.trip_id` and `status`, so **X2, X9 and X11 must land before PD1, D1 and C1.**
- The PD1 cooldown is pointless while X1, X8 and R8 are open, because users can unsuspend themselves or open a new account.
- R2 changes what drivers see, so D2 and D1's driver-candidate list must use the same radius logic.

**Verification (Person 3 writes these as a test script):** for each X/Y item, call the REST API with a real passenger or driver token, e.g. `PATCH users {status:'active'}` or `POST ride_requests {status:'completed'}`. The test **passes when the call is rejected**. Run the script before and after each fix migration, and keep it for regression.

---

## Timeline: 2 weeks, 3 programmers (locked in) — every item assigned
Tiers:
- **Required:** the panel's items, F1–F6, X1–X11, and R1, R2, R4, R5.
- **Fill-in if time allows:** Y1–Y5, Y9, R6–R8.
- **Stretch (only if everything above is done):** ~~C1 chat (text + quick replies only)~~ **DONE 2026-09-29, full spec** — see the C1 section below. N1, N2 still not built.
- **Future work** (designed below, not built this sprint — written up in the manuscript): C2 voice calls, S1 (**partially started 2026-09-29** — see its own section), N3, ~~chat photos/read receipts~~ (built as part of C1), optimal stop order. ~~Y6/Y7/Y10~~ and R9 are done, R10 partially done — see their own rows, this line is stale as a "not built" list for those specifically.

**Person 1 owns Maps + Domain end-to-end** (G2 and G1 are bundled on purpose: G2's admin key needs the domain to restrict it to, P1's email needs the domain verified, and G3's final screenshots need both done — one owner avoids two people blocking each other).

### Person 1 — Maps & Domain

**✅ G2 UNBLOCKED as of 2026-09-25** — the Google Cloud billing verification passed and a project is created. Resume Person 1's revised plan below from "enable the 4 APIs" onward.

**What this does NOT affect:** all of G2's code is already written, tested (typecheck + full test suites pass), and partly deployed — `OsmMap` → `react-native-maps`, the admin's `LiveMap`/`AlertLocationMap` → `@vis.gl/react-google-maps`, and the `maps-proxy` Edge Function (deployed, its auth gate verified live). None of that needs to be redone. The only missing piece is the real API keys, which need Google Cloud billing enabled first.

**What this DOES affect:** G2 cannot be tested end-to-end on a real device, and G3 (final screenshots, which need Google Maps actually rendering) is blocked until G2 unblocks. **Tell your adviser about this risk now, not at the defense** — it may affect the timeline, and they may know a workaround (a faculty-covered card is often the simplest fix a program can offer).

**Revised Person 1 plan — reprioritized around the blocker:**

| When | Item | Notes |
|---|---|---|
| Week 1, Day 1 | G1 (start) | Buy the domain, connect it to the Vercel project. Doesn't need Google Cloud at all — proceed regardless of the billing blocker. |
| Week 1, Day 1 | *(prep for P1)* | Add Resend's DNS records for the domain (SPF/DKIM). |
| Week 1, Days 2–5 | G1 finish | Add the domain to Supabase Auth's redirect URLs. |
| Week 1–2 | P1 | Email receipts via Resend + F5 (receipt from server data). **Doesn't need Google Maps at all** — only needs the domain from G1. Bring this forward to fill the time G2 would have used. |
| Week 1–2 | L13 | Build P1's send limits alongside it: max 3 sends per ride, 20/day per user. |
| Week 1–2 | *(from Person 3)* D2 + G4 finish | Apply the D2 migration live, device-test D2 and G4, `npm install`. Steps in "Handoff: Person 3 → Person 1" under Person 3's table. Do it with the first G2 dev build. |
| — | G2 | **Paused.** Revisit the moment a card/billing path is confirmed. Once unblocked: Google Cloud setup (project, billing, 4 APIs, Map ID, quota caps, budget alert, 3–4 restricted keys — see "## G2: full Google stack" and the step-by-step in chat) → wire keys into `app.config.js` (mobile), Supabase secrets (`GOOGLE_MAPS_SERVER_API_KEY`), and `apps/admin/.env` (`VITE_GOOGLE_MAPS_WEB_API_KEY`, `VITE_GOOGLE_MAPS_MAP_ID`) → `eas build --profile development` → real-device test. |
| — | G3 | **Blocked on G2.** Final screenshots need Google Maps actually rendering on the domain and on Android. Do this last, once G2 unblocks and Person 2/3's features are stable. |
| — | *(git history purge)* | The deferred X7 cleanup, unrelated to the G2 blocker — still fine to do whenever the team is ready to re-clone. See the note in the loophole section above. |

**If G2 stays blocked past the deadline:** the manuscript can honestly describe the Google Maps migration as "designed and implemented in code, verified via automated tests and a live deployment check, pending a Google Cloud billing constraint outside the team's control" — this is a defensible, honest position for a capstone defense, not a gap to hide.

### Person 2 — Backend, ride flow, security (heaviest track)
| When | Item | Notes |
|---|---|---|
| ~~Week 1, Day 1~~ DONE | X7 (= F1) | Already done (2026-09-24) — see the note above. Skip. |
| Week 1, Day 1 | X0 (= F2) | **Bigger than originally scoped:** `supabase db pull`, and carefully reconcile ~90 migrations that are live but not in this repo, before touching anything else. Confirm every X/Y finding against the result before changing it. |
| Week 1, Days 2–4 | X1–X6, X8–X11 | Column-lock triggers/policies (the critical, one-API-call loopholes). |
| Week 1, Days 2–4 | Y8 | **DONE 2026-09-27.** Unique partial index so "one active ride" can't be raced. |
| ~~Week 1, Days 2–4~~ DONE | F6 | **Done 2026-09-27, but by Person 1, not Person 2** — see the F-items table for detail. Migration applied and verified live. |
| ~~Week 1, Days 2–4~~ DONE | F3 | **Done 2026-09-27, but by Person 1, not Person 2** — see the F items table for detail. Match on free seats, not total seats. |
| ~~Week 1, end~~ DONE | F4 | **Done 2026-09-27, but by Person 1, not Person 2** — see the F-items table for detail. Migration applied and verified live. |
| Week 1, end | L3 | Build F4's mocked-GPS rejection at the same time (shares code with R3). |
| Week 1, end | PD1 + PD2 | **DONE 2026-09-27.** Cancellation: stage gate, strikes, `cancel_ride_request` RPC. |
| Week 1, end | L1, L2, L4, L15, L18 | Build these loophole fixes as part of PD1, since they're PD1's own safeguards. |
| Week 2 | D1 | **DONE 2026-09-27.** Transfer: invites, handoff, fare/rating rules. |
| Week 2 | L5–L10 | **DONE 2026-09-27 — all six confirmed against the actual code, not assumed.** L5 (strike-on-release) and L6 (stranding guard) shipped in `20260927000006`. L7 (double cash-confirm) turned out to already be closed by the pre-existing `txn_driver_confirm_cash` RLS policy, which scopes to whichever trip currently owns the ride — a transfer already moves that access away from the old driver, no new code needed. L8 (re-check eligibility at accept) and L9 (block transfer during an active SOS) were genuinely missing on the first pass and were added and applied live in `20260927000007_d1_l8_l9_hardening.sql`. L10 (rate a driver who never served the ride) was closed by `validate_rating`'s accepted-`ride_transfers` check in `20260927000006`. |
| Week 2, if time allows | Y1 | **DONE 2026-09-27.** Location/time checks on start/complete. |
| Week 2, if time allows | Y9 | **DONE 2026-09-27.** Block expired documents from going online/accepting. |
| Week 2, if time allows | Y4, Y5 | **DONE 2026-09-27.** Complaint and SOS insert locks. |
| Week 2, if time allows | R2 | **DONE 2026-09-27.** Matching radius + staleness filter. |
| Week 2, if time allows | R3 | **DONE 2026-09-27.** GPS trigger, reject mocked location (shares code with L3/F4). |
| Week 2, if time allows | R1 | **DONE 2026-09-27.** Ghost-driver offline cron. |
| ~~Week 2, if C1 is reached~~ DONE 2026-09-29 | *(C1 backend)* | `ride_messages` table + RLS + rate-limit/masking trigger, `supabase/migrations/20260929000001_c1_ride_chat.sql`, applied and verified live. |

### Person 3 — App UX, reliability, docs & QA
| When | Item | Notes |
|---|---|---|
| Week 1, Day 1 | *(tracker)* | Own this tracker file — keep the Status column current as items land. |
| Week 1, Day 1 | G4 | Help tips: mobile `helperText`, admin `hint`. |
| Week 1, Day 1 | D2 | Nearest-next-stop sort, with the transfer-pickup and delay-fairness priority rules. |
| ~~Week 1, Days 2–5~~ DONE except unpaid-ride recovery | R5 | **Done 2026-09-27, but by Person 1, not Person 3** — see the R-items table for detail. Only the `completed`/unpaid-ride recovery (needs Y2 first) and the offline-retry-state polish remain. |
| ~~Week 1, Days 2–5~~ DONE (core fix) | R4 | **Done 2026-09-27, but by Person 1, not Person 3** — see the R-items table for detail. The optional multi-device `push_tokens` table is still open for whoever has time. |
| Week 1, in parallel | G5, P3, PD3, P2, PD4 | Scope note, fare literature, cancellation literature, both survey questions. Update `UAT_PANEL_PREP.md`. |
| Week 2, Day 1 on | Exploit test script | REST calls that try X1–X11 (and Y-items as they land); each must be *rejected*. Run against Person 2's migrations as they land. |
| Week 2, if time allows | Y2 | Block booking with an unpaid completed ride. |
| Week 2, if time allows | Y3 | PayMongo fixes. |
| Week 2, if time allows | R6 | **DONE 2026-09-27.** Driver gets a live update when the passenger cancels. |
| Week 2, if time allows | R7 | **DONE 2026-09-27.** Sign out other sessions on password change. |
| Week 2, if time allows | L12 | Driver's own trip history shows only the barangay/area, not exact coordinates. Small UI change to the driver history screen. |
| ~~Week 2, if C1 is reached~~ DONE 2026-09-29 | *(C1 UI)* | Chat screens in both apps + Realtime wiring, `app/booking/chat.tsx` (passenger) / `app/trip/chat/[rideRequestId].tsx` (driver), plus a full ride-comms UI rebuild (`docs/design_handoff_trisakay_ride_comms/`) — driver Call/Message contact row, passenger matched-ride screen, restyled chat bubbles/composer/quick-replies in `packages/ui`. L11's masking included. |
| Week 2, if C1+time allow | N1 | **Still not built.** Ride-status push notifications (assigned/arriving/arrived/transferred/completed) — natural next step after C1, reuses the same notification pattern as R4. Not started even though C1 itself landed. |
| Week 2, last 3 days | Full regression | Real Android devices, all 3 people's work together. Hand G3 screenshots to Person 1. Final tracker update — mark every item DONE/STRETCH-not-reached/FUTURE. |

### Handoff: Person 3 → Person 1 (2026-09-27) — finish D2 and G4
The code for D2 and G4 is pushed and every test suite passes. What's left needs live-database access or a real device, which Person 3 didn't have today. Person 1 already applies migrations live (e.g. `20260925000001_maps_proxy_rate_limit.sql`) and needs a dev build for G2 anyway, so these ride along. When all four steps are done, mark D2 and G4 **DONE** in the tracker above.

**1. Apply the D2 migration** `supabase/migrations/20260927000001_d2_active_trip_passenger_timing.sql`. **DONE 2026-09-27** — pushed via `supabase db push` (dry-run showed only this file, then applied for real), recorded as version `20260927000001` (confirmed via `migration list --linked`, no drift). Both verification queries pass: return type ends with `assigned_at timestamp with time zone, picked_up_at timestamp with time zone, distance_km numeric`, and `has_function_privilege('anon', ...)` is `false`.
- What it does: rebuilds `get_active_trip_passengers` with three extra return columns (`assigned_at`, `picked_up_at`, `distance_km`). The body, filter and order are unchanged (the live version was checked on 2026-09-27 and matched `20260915000010` exactly).
- **Record it under version `20260927000001`.** The live migration history uses the file names as versions since X0. A different version breaks `supabase db push` again.
  - Preferred: `supabase db push` from a linked CLI (it records the file's version by itself). Run `--dry-run` first; it should list only this one file.
  - Don't use the Supabase MCP `apply_migration` tool: it records the current time as the version.
  - SQL editor fallback: run the file, then `insert into supabase_migrations.schema_migrations (version, name) values ('20260927000001', 'd2_active_trip_passenger_timing');`
- Verify (both are read-only):
  - `select pg_get_function_result('public.get_active_trip_passengers(uuid)'::regprocedure);` should end with `assigned_at timestamp with time zone, picked_up_at timestamp with time zone, distance_km numeric`.
  - `select has_function_privilege('anon', 'public.get_active_trip_passengers(uuid)', 'execute');` must be **false** (the PUBLIC-grant gotcha above; the migration revokes it).
- The app is safe before and after: it reads the new columns as `null` when they're missing, and then the "running late" rule simply never fires.

**2. D2 device test** (driver dev build, one driver + 2–3 passenger test accounts, ideally in town with real GPS):
- Accept 2+ rides. Expected: the cards are ordered by distance to each passenger's next stop (pickup while waiting, drop-off once started). The top card says **"Next stop · x.x km"**, the others show their distance, and the map pin and Navigate button point at the top card's stop.
- Drive toward the second card's stop. It should move to the top only once it's at least 150 m closer than the current top, with no flickering between near-equal stops.
- Turn off location. The order should freeze at the last shown order, with no distances.
- The "running late" rule (needs step 1): a passenger on board longer than 1.5× the normal time for their ride distance at 20 km/h (never less than 5 min), or waiting longer than that since accept, jumps above closer stops. Easiest check: start a ride, wait more than 7.5 min, and it moves to the top.
- The transfer-pickup rule can't be tested until Person 2's D1 sets `isTransferPickup`; it's covered by unit tests.

**3. G4 on-device look** (tips are one grey line under each field, English and Filipino):
- The screens most likely to need a spacing tweak: passenger **set-pickup / set-destination** (the tip sits under the search bar only while it's empty), both apps' **register** screens (every field has a tip now, so they're longer), passenger/driver **profile edit** (name + phone), driver **documents** (expiry date).
- Admin: **Force password change** (two tips side by side above the strength checklist), **Settings → fare** (three number fields), **Discount review** and **Driver verification** forms.
- Switch the app language to Filipino once and check that no tip wraps badly.
- Fix any layout issue in the screen's styles; the wording is in `packages/shared/src/i18n/{en,fil}.ts` under `hints` (admin wording is inline in each route).

**4. `npm install` at the repo root. DONE 2026-09-27 (Person 1).** `npm install` reported "up to date" (875 packages) — the four previously-missing packages (`react-native-maps`, `@vis.gl/react-google-maps`, `expo-notifications`, `expo-network`) are already present in `node_modules`, so this note was stale. Verified clean: `npm run typecheck` passes with zero errors, `npm run test:ui` passes 19/19, `npm run test:shared` (covers D2's `nextStop` unit tests) passes 25/25.

### Ownership noted for future work (not built this sprint, but assigned so whoever revisits it knows where to start)
| Item | Proposed owner when picked up |
|---|---|
| N2 — cancellation/transfer charts for PSO | Person 2 (query/data, reuses PD1+D1's data) + Person 3 (admin chart UI) |
| N3 — Share my trip | Person 1 (it's a public map page, same stack as G2) |
| C2 — in-app voice call | Person 1 (mobile native module + EAS build, same shape as G2) for the client, Person 2 for the `call-token` edge function |
| S1 — route trail + PSO case view | Person 2 (trail table/RPC, append-only pattern) + Person 1 (the case-view map, reuses the G2 map component) |
| ~~Y6, Y7~~ DONE | Person 2 — **done 2026-09-27, but by Person 1** — see the Y-items table for detail. Y10 remains open. |
| R9, R10 | Person 3 — low-effort backlog, good "if everything else is done" filler |

**Cross-track dependencies:**
- Person 3's D2 and Person 2's D1 driver-candidate list should share the same distance/radius logic once Person 2 lands R2 — flag this if D2 ships first.
- D2's delay rule needs `assigned_at`, `picked_up_at` and `distance_km` from `get_active_trip_passengers`, which didn't return them. Person 3 wrote that migration (2026-09-27); it only adds return columns. Person 2: D1 changes the same function (handoff point as pickup) — build on the D2 version, and add the transfer flag D2's sort already accepts (`isTransferPickup`).
- Person 2's PD1 (`cancelled_by`, reason codes) must land before Person 2 starts D1.
- Person 2's X2/X9/X11 must land before PD1 and D1 are trustworthy (they close the "fake completed ride" and "forge cancellation/rating" loopholes) — this is why they're sequenced first in week 1.
- Person 1's P1 needs Person 1's own G1 (domain) done first — no cross-person wait.
- Person 3's exploit test script (week 2) depends on Person 2's X-fixes existing to test against.
- G3 (Person 1, end of week 2) needs Person 2's and Person 3's features stable enough to screenshot.
- C1, if reached: Person 2 builds the table first, then hands off to Person 3 for the UI — don't start the UI before the table lands.

**Daily sync recommended:** a 10-minute standup, since Person 2's security migrations change tables Person 1 (receipts) and Person 3 (ride state, PD1 UI) both read from.

---

## D2: nearest next stop
- **Now:** `apps/driver/app/trip/active.tsx` lists `trip.passengers` in the order they were accepted. The map targets the first assigned passenger's pickup, otherwise the first ongoing passenger's drop-off.
- **Change:**
  - Each passenger's next stop is their drop-off if they're on board (`ongoing`), or their pickup if they're still waiting (`assigned`).
  - Sort by haversine distance from the driver's position (`useDriverStore` `currentLat/currentLng`). Keep accept order if there's no GPS fix yet.
  - Mark the top card "Next stop" and point the map at the same stop.
  - Put this in a small pure helper, `sortByNextStop(passengers, driverPos, previousOrder)`, with unit tests (mixed statuses, no GPS, near-ties). Use `haversineKm` from `packages/shared/src/utils/geo.ts`.
  - **One mixed list** (confirmed): waiting and on-board passengers together, sorted by distance to their next stop.
  - Each card shows its distance, e.g. "Next stop · 0.4 km".
  - **No jumping:** the order changes only when another stop becomes closer by at least 150 m, so GPS jitter doesn't keep swapping cards.
  - The map target and the Navigate button (`active.tsx:85-96`) follow the top card.
  - Use straight-line distance, not road distance from Routes: it's free and accurate enough for short trips in town.
  - **Priority rules, checked before distance** (confirmed):
    1. A transfer pickup still waiting (the passenger is at the handoff point) goes to the top. Exception: if an on-board drop-off is 300 m or less away, that drop-off comes first.
    2. A passenger whose ride has taken more than 1.5× the normal time for their distance comes next. The normal time is the distance at an assumed tricycle speed, e.g. about 20 km/h. This stops a passenger from being pushed back forever by new passengers picked up mid-trip.
    3. Everyone else: nearest next stop, with the 150 m no-jump rule.
  - `sortByNextStop` needs extra inputs: whether a stop is a transfer handoff, `picked_up_at` and the ride distance. Its unit tests also cover both priority rules.
  - **Algorithm, for the manuscript and defense:** a greedy nearest-neighbour heuristic with safety and fairness priorities. Add it to the algorithms section of `docs/UAT_PANEL_PREP.md`.
  - **Future work (not built):** optimal stop ordering. Try every order of the 6 or fewer stops, keeping only those where each pickup comes before its drop-off, and choose the shortest total distance. Nearest-first can make the driver double back.

## PD1 + PD2: cancellation policy
**Status: DONE 2026-09-27 (Person 1), core policy — migration `20260927000005_pd1_cancellation_policy.sql`, applied and verified live.** Two sub-pieces are deliberately deferred (see bottom of this section) rather than silently missing — don't mistake either for an oversight when scanning the codebase.
- **Passenger, by stage:**
  - `pending`: free to cancel. ✅ (`cancel_ride_request` allows `p_reason_code = null` at this stage)
  - `assigned`: needs a reason and counts as a strike. ✅ (RPC raises if `p_reason_code` is null while `status='assigned'`; strike = `cancelled_by='passenger' and assigned_at is not null`)
  - `ongoing`: blocked; the passenger can only report an issue or SOS. ✅ (RPC only matches `status in ('pending','assigned')`)
- **Passenger limit:** 3 strikes in 7 days brings a 24 h booking cooldown, with a warning at strike 2. ✅ enforced server-side (`enforce_ride_request_insert_fields` trigger blocks the INSERT once the limit+recency condition is met). The numbers live in `system_settings` (`passenger_cancel_strike_limit`, `_strike_window_hours`, `_cooldown_hours`) and are DB-editable now; **admin UI to edit them from `SystemSettings.tsx` is still Person 3's job (N2/admin scope), not built here.** The "warning at strike 2" and a dedicated cooldown *screen* are also not built — today the passenger only sees the RPC's plain error text if they try to book while paused. Revisit as UI polish.
- **Driver:** cancelling after accepting counts as a strike, except:
  - "Passenger no-show", which is allowed only 5 minutes or more after `arrived_at` (F4), and only while the driver's last known position is within ~100 m of the pickup point (mirrors `mark_arrived`'s own check exactly). ✅ enforced in `cancel_ride_leg`. Or
  - a transfer (D1) — **not applicable yet; D1 isn't built.**
  - Repeat strikes flag the driver for PSO review in the admin. **Not built** — strikes are derivable today via `cancelled_by='driver'` counts on `ride_requests` (no new table needed, per this doc's own preference), but nothing surfaces that count anywhere yet. This is admin/PSO-dashboard work (Person 3), not a gap in the RPC.
- **Data:** ✅ `cancelled_by` (`passenger`/`driver`/`system`) and `cancel_reason_code` (fixed list, CHECK-constrained) added to `ride_requests`. `cancel_reason` free text kept. Strikes counted straight from `ride_requests`, no new table.
- **Server:** ✅ `cancel_ride_request` RPC (replaces X9's `cancel_ride_request_as_passenger`, dropped) enforces stage/reason/strike. ✅ Cooldown checked at ride-request INSERT time via `enforce_ride_request_insert_fields` (both the 3-strikes/24h cooldown and L2's 5-cancels/30min search-spam pause). ✅ `cancel_ride_leg` (pulled into this migration from live-only SQL, per the doc's own instruction) gets the reason code + no-show gate.
- **UI:** ✅ `ReasonPickerModal` (new shared component, `packages/ui`) — a required-reason picker sheet in both apps, wired into passenger `trip.tsx` (assigned-stage cancel) and driver `trip/active.tsx` (mid-trip cancel); the two pending-stage passenger cancel screens (`finding-driver.tsx`, `no-drivers-nearby.tsx`) stay free/reason-less, matching the stage gate. ✅ `ride-cancelled.tsx`'s three upstream screens now set `byDriver` from `cancelled_by === 'driver'` instead of guessing from `cancel_reason` text. ✅ Both apps' `legalCopy.ts` cancellation copy updated to match what's enforced. **Not built:** the strike-2 warning banner and a dedicated cooldown screen (see passenger-limit bullet above) — the server error message is the only feedback today.
- **Deferred on purpose (documented in the migration's own header, not an oversight):**
  - **L1** (passenger asks the driver to cancel so the driver eats the strike) needs a live confirm handshake between both apps (ask the passenger, wait ~60s, only then decide who's charged) — a separate, larger realtime feature. Until built, "Passenger asked to cancel" is just one of the driver's own reason codes and is always charged to the driver (safe default: can't be exploited, just doesn't yet relieve an honest driver).
  - **L18** (seats undercounted — driver adjusts seats at pickup, `start_ride_leg` recomputes fare) is a `start_ride_leg`/fare concern, not cancellation, despite being grouped under PD1 in this doc's UI bullet list. Not touched here.
  - Update the cancellation section of `legalCopy.ts` in both apps to match what is enforced.

## C1 + C2: driver–passenger communication (privacy first)
**C1 status: DONE 2026-09-29** — full spec built, not the reduced "text and quick replies only" stretch line this tracker originally carried: free text, quick-reply chips, read receipts, a typing indicator (Realtime broadcast), photo sharing (EXIF/GPS stripped client-side), phone-number masking + rate limiting (L11), and an Expo push on new messages. `supabase/migrations/20260929000001_c1_ride_chat.sql` + `20260929000002` (an advisor-flagged execute-revoke follow-up), both applied and verified live. Client: `packages/services/src/chat/index.ts`, `app/booking/chat.tsx` (passenger), `app/trip/chat/[rideRequestId].tsx` (driver), and a full UI rebuild across both apps per `docs/design_handoff_trisakay_ride_comms/` (driver Call/Message contact row, passenger matched-ride screen, restyled `ChatBubble`/`ChatComposer`/`QuickReplyRow` in `packages/ui`). Typecheck and the full test suite (347 in `packages/services` alone) are clean. **Confirmed on-device:** the driver contact row and the passenger matched-ride screen, via each app's tutorial demo state. **Not yet confirmed on-device:** the chat screens themselves, the preview banners, and — the two-device verification this doc's own Verification section calls for (live message/typing/read-receipt exchange, background push, a real photo's EXIF stripped) was never run; that needs a second physical device, which wasn't connected during this build. **The admin/PSO case-view of a thread is now partially built too — see S1 below, not "deferred with no plan" as this section originally said.** C2 (voice calling) is unaffected and still not started — see its own subsection.

**Rule:** neither side ever sees the other's phone number, email or full name.
- They see only first name, photo, and the tricycle plate (the plate only for the passenger, as a safety check).
- Contact is possible only while the ride is `assigned` or `ongoing`. After that, the thread becomes read-only and the call button disappears.
- There is no native `tel:` or `sms:` fallback.

### C1: in-app chat (Supabase Realtime)
- **Table `ride_messages`:** `id`, `ride_request_id`, `sender_id`, `kind` (text / quick_reply / image / system), `body`, `image_path`, `created_at`, `read_at`.
  - RLS: only the ride's passenger and its current assigned driver can read or insert.
  - Inserts are allowed only while the ride is assigned or ongoing.
  - Nobody can update messages except `read_at`, and only the receiver can set it.
- **Live updates:** a Realtime `postgres_changes` subscription per ride brings in new messages and read receipts. A Realtime *broadcast* channel carries "typing…" (not stored).
- **Push:** when the receiver's app is in the background, send an Expo push, reusing the existing notification pattern (`notifications` and the push-token setup). The text is "New message from your driver/passenger", without the message content.
- **Features:**
  - Free text, with a length limit and trimming.
  - Quick replies. Driver: "I'm here", "On my way", "Arriving in 2 min". Passenger: "Where are you?", "I'm at the pickup point", "Please wait".
  - Read receipts ("Seen") and a typing indicator.
  - Photo sharing:
    - The photo is re-encoded with `expo-image-manipulator`, which strips GPS/EXIF data, and uploaded to a private Storage bucket `ride-chat`.
    - Storage RLS matches the message RLS, and photos are shown through short-lived signed URLs.
- **Retention (confirmed, plus S1's legal hold):** the history is stored. Threads for rides under a complaint or SOS are kept until the case is closed. After the ride ends, both sides can read it but not send. "Typing…" is never stored. Keep message text for 30 days so PSO can use it for complaints or SOS; delete photos after 7 days (pg_cron). State this in the privacy policy (`legalCopy.ts`).
- **Admin:** ✅ **DONE 2026-09-29** — PSO can view a ride's thread only from a complaint or SOS alert that references that ride, and each view is written to the audit log. See S1 below for the actual build (this piece shipped as part of S1's case-view work, not alongside C1's own migration).
- **UI:** a chat button with an unread badge on the passenger `booking/trip.tsx` and on each passenger card in driver `trip/active.tsx`. A shared chat screen in each app, with the bubble components in `packages/ui`.
- **Transfer (D1):** the thread moves to the new driver. A system message is added ("Your ride was transferred to Juan"). The old driver loses access.

### C2: in-app voice call (VoIP, no numbers)
- **Recommended SDK: Agora** (`react-native-agora`).
  - The free tier (about 10,000 minutes a month) is enough for UAT and the pilot.
  - Audio only.
  - Needs a dev/EAS build; it won't run in Expo Go. Check that it is compatible with Expo SDK 54 before starting.
  - Alternative: ZEGOCLOUD (similar). Self-hosted WebRTC (`react-native-webrtc` with Supabase signaling) is free but needs a TURN server and is more fragile, so it isn't recommended.
- **Tokens:** a new edge function `call-token` checks that the caller is the ride's passenger or assigned driver and that the ride is active.
  - It returns a short-lived Agora RTC token for a channel named after the ride (`ride_<id>`).
  - The Agora App Certificate stays in Supabase secrets.
  - Users join with an internal numeric uid, not their phone number or name.
- **Ringing:** a new `ride_calls` table (ride, caller, callee, status ringing / answered / declined / missed / ended, started_at, ended_at).
  - Inserting a row rings the other side: Realtime if the app is open, otherwise a high-priority Expo push "Your driver is calling — tap to answer" on an Android notification channel with a ringtone.
  - The call times out as missed after 30 s.
- **Call screen:** caller's first name and photo, mute, speaker, end. Only one call per ride at a time.
- **Nothing is recorded.** The PSO audit keeps only call metadata (who, when, duration).
- **Deferred:** a full-screen incoming call on the lock screen (react-native-callkeep / ConnectionService). Revisit only if the push notification tap proves unreliable in testing.

### S1: safety and compliance trail plus the PSO case view (team addition)
**Status: PARTIAL 2026-09-29 — only the chat-thread slice is built.** `supabase/migrations/20260929030000_s1_pso_ride_chat_case_view.sql` adds `admin_view_ride_messages(ride_request_id, reason)`, a SECURITY DEFINER RPC that lets a PSO account read a ride's `ride_messages` thread only once that ride has a linked complaint or emergency alert, requires a non-blank reason, and atomically logs the read to a new `ride_message_view_log` table (closes L16 — see that row). UI: `apps/admin/src/components/RideChatThread/`, embedded in both `Complaints.tsx` and `EmergencyAlerts.tsx`'s detail modals; a new "PSO Chat-Thread Views" tab on `AuditLog.tsx` surfaces the log itself. Applied and verified live (`migration list --linked` shows it recorded), admin app typecheck clean. **Everything else below — the route trail, the reliable/foreground-service tracking, the call log, the timeline, the map, "Print case report", and the retention/legal-hold cron — is still FUTURE, not started.** This slice only answers "can PSO read a linked ride's chat," not the full case-view this section describes.

**Why:** only the driver's *current* position is stored today (`driver_locations`, overwritten about every 8 s). Once a ride ends, the PSO can't tell what route the tricycle took. S1 gives every ride a record the PSO can trust in an investigation.
- **Route trail:** a new `ride_location_trail` table (ride_request_id, trip_id, lat, lng, accuracy, recorded_at set by the server).
  - Recorded from `assigned` until completed or cancelled. Nothing is recorded while the driver is idle or offline.
  - Points are written through an RPC that checks the driver is on an active ride.
  - The app piggybacks on the existing `useDriverLocationSync` updates (30 m / 8 s).
  - The trail also backs PD1's no-show rule: it shows whether the driver waited about 5 minutes at the pickup point.
- **Reliable tracking:**
  - During an active trip only, run an Android foreground service (`expo-location` background updates + `expo-task-manager`, with a "Trip in progress" notification). Check the Expo SDK 54 docs and Google Play's background-location declaration first.
  - Save points on the phone when there's no signal and upload them later.
- **Append-only:** no update or delete rights for any role on the trail, `ride_messages`, `ride_calls` or `ride_transfers`. Only the retention job deletes. Timestamps come from the server.
- **Retention:**
  - Normally 30 days for the trail, chat and call log, and 7 days for photos.
  - **Legal hold:** if a complaint or emergency alert references the ride, keep everything until the PSO closes the case. The retention job skips rides under hold.
- **PSO case view** in the admin, opened from a complaint or SOS:
  - A map with the route, pickup, drop-off, transfer and SOS markers (drawn with the G2 map component).
  - A timeline of ride events (requested, assigned, arrived, picked up, transferred, SOS, cancelled or completed).
  - The chat thread, the call log, and the ride's passenger, driver and plate.
  - Access: a reason is required to open it, and each view is written to the audit log.
  - "Print case report" using the browser's print, for handover to police or the LGU.
- **Transparency:** update the privacy section of `legalCopy.ts` in both apps to cover what is recorded, why, retention, legal hold, and who can access it (RA 10173).
- **Verify:**
  - RLS tests: nobody can update or delete; a non-participant can't read; a PSO can read only through a linked case.
  - The retention job deletes old data but skips rides under hold.
  - Real-device test: lock the phone mid-trip, and the trail keeps recording; turn on airplane mode, and the points upload when back online.

## G4: help tips
- **Mobile:** use the existing `helperText` prop on `packages/ui/.../TextField`. Add a `helperText` prop to `Textarea`.
- **Admin:** use the existing `hint` prop on the admin `TextField`.
- **Scope:** every field the user types into (signup, profile, booking search, complaints, driver documents, admin forms). Each gets a one-line hint plus an example placeholder, e.g. "09XXXXXXXXX".
- Keep the wording in the shared i18n strings (`packages/shared`) if the app already uses them.

## D1: transfer to a chosen driver
**Status: DONE 2026-09-27 (Person 1)** — migrations `20260927000006_d1_driver_transfer.sql` and `20260927000007_d1_l8_l9_hardening.sql`, both applied and verified live (table, both constraint/trigger changes, all 6 RPCs with correct `authenticated`-only grants, the cron job, `accept_ride_request`'s L6 guard, and the L8/L9 follow-up's SOS/availability re-checks all confirmed via read-only SQL post-push, no version drift). Client-side: services layer, driver UI (Transfer/Send-to-pool buttons, reason picker, candidate picker, incoming-invite modal, Confirm-handoff button), and passenger-side driver-swap detection are all built and passing typecheck/tests. A few sub-pieces are deliberately deferred — see the bottom of this section.
- **When:** before or after pickup. After pickup, the passenger is dropped at a handoff point and the new driver continues to the original destination. ✅
- **Flow:**
  1. The driver taps Transfer and picks a reason (breakdown, full seats, route, other). ✅
  2. A list of nearby online drivers with enough free seats appears. ✅ (`list_transfer_candidates`)
  3. The driver invites **up to 3** of them at once. ✅
  4. The invites stay open for 30 s, and the first driver to accept gets the passenger. ✅
  5. If no one accepts, the first driver can invite others or send the ride back to the open pool of pending requests. After 2 failed rounds or about 2 minutes, it goes to the pool automatically. ✅ (`release_to_pool` for the manual path, `release_expired_transfer_invites` pg_cron sweep for the automatic one, both live-verified)
- **Fare:** the passenger pays the original quoted fare once, to the driver who finishes the trip. The first driver's leg is logged for the record only. ✅ (nothing about fare changes on transfer — `final_fare` is only ever set at completion, against whoever's trip the ride belongs to then)
  - **GCash paid in advance:** the payment follows the ride and is credited to the driver who finishes it. **Not independently verified against a real paymongo-webhook payload** — `transactions` rows key off `ride_request_id`, not driver, so nothing should need to change, but this needs an explicit check before relying on it for a GCash+transfer combination in UAT.
- **What moves to the new driver:** the whole ride. The request's `trip_id` switches to the new driver's trip; the destination and quoted fare stay the same. ✅
  - Before pickup, the new driver's first stop is the original pickup point. ✅ (pickup_lat/lng untouched)
  - After pickup, the first stop is the **handoff point**, stored on the `ride_transfers` row. `get_active_trip_passengers` returns it as `handoff_lat`/`handoff_lng` (only while the handoff isn't yet confirmed). ✅ — **caveat:** the driver app's map/"Next stop" routing target isn't wired to route to the handoff point specifically yet; the new driver sees a "Confirm handoff" button and notice text, but the map itself still targets the ride's normal pickup/destination. Follow-up UI polish, not a data gap.
  - The passenger's card disappears from driver 1's list, which re-sorts. ✅ (a short client-side poll after sending invites refreshes driver 1's trip once accepted — see the migration/service code comments for why a full realtime subscription wasn't used here)
  - In driver 2's list, the passenger is sorted by the D2 rules; the transfer-pickup priority applies. **Not specifically verified** — D2's `sortByNextStop` sorts by status/distance already, so a transferred-in passenger should sort like any other 'assigned'/'ongoing' leg, but no dedicated "transfer-pickup priority" was added.
- **Invites (confirmed): up to 3 drivers at once; the first to accept wins.** ✅ all sub-bullets below implemented and matching the spec:
  - Each invite row has an `expires_at` set by the server, 30 s after sending. `respond_transfer` refuses expired invites and invites already taken by someone else. When one driver accepts, the other invites switch to `superseded`.
  - **Two drivers accepting at once:** `respond_transfer` locks the ride row `FOR UPDATE` first, same F6 lock-order pattern.
  - **A driver who didn't see it** simply lets the invite expire; a late tap shows the RPC's own "This transfer request has expired" error.
  - **Delivery:** ships on the existing `notifications` row + a foreground Realtime subscription (`subscribeToTransferInvites`) instead of a dedicated push channel/full-screen banner — see deferred list below.
  - **Updates:** not built as distinct copy ("No one accepted: invite others…") — the driver just sees the candidate picker close and can tap Transfer again once a round resolves.
  - **Automatic release to the open pool:** ✅ `release_expired_transfer_invites()`, scheduled every minute via pg_cron, confirmed live.
- **Choosing the new driver:** show online drivers with enough **free** seats, sorted by distance. ✅ (`list_transfer_candidates`, distance from the FROM driver's own current position as a proxy for the handoff point) — cluster authorization is deliberately not enforced for transfer candidates (not mentioned in this doc's D1 spec, unlike F3/F6's normal matching). "Drivers with no passengers rank slightly higher" — **not built**, plain distance sort only.
- **Rating:** after a transferred ride, the passenger rates **both** drivers. **Server done, UI not built.** `ratings` is now unique on `(ride_request_id, driver_id)` and `validate_rating()` accepts either driver — both verified live. The passenger's rate-ride screen still only prompts for one rating; prompting for a second one after a transferred ride is its own UI change, deferred (see below).
- **Passenger:** notified, not asked. ✅ — `trip.tsx` detects the `trip_id` change via the existing status subscription (extended to select `trip_id`), refetches driver info, and shows a brief "You've been matched with a new driver" notice. Cancelling after a transfer never counts as a strike — true by construction (a transfer never sets `cancelled_by`/`cancel_reason_code`, those only ever come from PD1's cancel RPCs).
- **Data:** ✅ `ride_transfers` table (request, from/to driver, reason, handoff location, status, timestamps) — status list is `invited/accepted/declined/expired/superseded/pooled` (added `superseded` beyond the doc's list, needed to distinguish a losing invite from a plain expiry).
- **Admin:** a transfer log the PSO can review — **data exists and is fully queryable (`ride_transfers`, RLS lets `is_pso()` read all rows); the admin UI itself is Person 3's job, not built here.**
- **Deferred on purpose (documented in the migration's own header, not an oversight):**
  - The passenger UI for rating two drivers after a transferred ride (server-ready, no UI yet).
  - A dedicated high-priority push channel + full-screen incoming-invite banner (ships on the existing notifications/Realtime infra instead).
  - The PSO admin transfer log UI (Person 3/admin scope).
  - Verifying paymongo-webhook still credits the finishing driver correctly for a transferred, GCash-paid-in-advance ride (needs a real webhook-payload check, not done here).
  - Map/"Next stop" routing to the handoff point specifically (the new driver gets a Confirm-handoff button/notice, but no dedicated map marker for the handoff point yet).
  - "No passengers ranks higher" candidate-sort tiebreaker and the transfer-pickup D2 priority — plain distance/status sort only for now.

## G1: domain
- **Candidates** (check which are available): `trisakay.ph` (local, credible for a city project), `trisakay.app`, `trisakay.com`, `trisakaygsc.com`.
- **Steps:**
  1. Buy the domain.
  2. Add it to the Vercel project, e.g. `admin.<domain>` or the root domain.
  3. Add Resend's DNS records (SPF/DKIM) for `receipts@<domain>`.
  4. Add the domain to Supabase Auth's redirect URLs.

## P1: email receipts
- **Consent:**
  - The "Email receipts" switch in Settings (`useSettingsStore`) moves from phone-only storage to a column on the user's account, e.g. `users.email_receipts boolean default false`.
  - When it's on, a receipt is emailed automatically when the passenger's ride completes.
  - Every receipt (`trip-complete.tsx`, `history/[id].tsx`) also gets an "Email me this receipt" button.
- **Sending:** a new edge function `send-receipt` that calls Resend.
  - It is triggered after `complete_ride_leg` or called on demand.
  - It builds the receipt from server data (reference number, route, distance, fare, discount breakdown, payment method, driver and plate).
  - It never sends twice automatically: track a `receipt_emailed_at` timestamp.

## G2: full Google stack
- **Google Cloud setup:**
  - Project, billing, and a budget alert.
  - Enable Maps SDK for Android, Maps JavaScript, Places (New) and Routes.
  - Three restricted keys: Android (package + SHA-1), web (referrer = domain), server.
- **Mobile display:**
  - `react-native-maps` with `PROVIDER_GOOGLE` replaces the Leaflet WebView in `packages/ui/src/components/OsmMap`, keeping the same component API so screens and `MapOverlaySheet` don't change.
  - Check the Expo SDK 54 docs for the config plugin and key setup. This needs a new dev/EAS build.
  - **STRETCH within G2 (not a panel item — a team addition, found 2026-09-25): multi-pin support for the driver's active-trip map.** Today's `OsmMap`/`mapHtml.ts` supports only one marker + one line at a time, so with several passengers `trip/active.tsx` shows only the D2 "next stop" pin, not the full picture. **Cut this first if G2's core work (the map actually displaying via Google, search, routing) is at risk in the 2-week window** — the panel asked for nearest-drop-off-first *ordering*, not multiple pins; this rides along cheaply on the rewrite but isn't required. If there's time, since you're rewriting `OsmMap` for G2 anyway, it's cheaper to build this now than to patch the soon-to-be-replaced Leaflet map first:
    - `OsmMap`'s new `react-native-maps` version takes an array of stops (one `<Marker>` per waiting pickup, one per on-board drop-off), not just a single `marker` prop.
    - Color convention matches the app-wide standard from the Olaybal review: green = pickup, blue = drop-off.
    - The D2 "next stop" pin is visually highlighted (larger, or an outline) so the sort order stays obvious alongside the full picture.
    - Optional: tapping a pin scrolls/highlights that passenger's card in the list below.
    - `MapOverlaySheet`/`trip/active.tsx` pass the full `trip.passengers` list to the map instead of just `routingPassenger`.
- **Admin display:** `@vis.gl/react-google-maps` replaces react-leaflet in `LiveMap` and `AlertLocationMap`. ✅ **Done 2026-09-25** — see `apps/admin/src/components/LiveMap`, `AlertLocationMap`, `apps/admin/src/main.tsx` (one shared `APIProvider`). `AdvancedMarker` needs a Map ID (`VITE_GOOGLE_MAPS_MAP_ID`, Cloud Console > Maps Management, free) for the custom badge/pin content — falls back to a plain pin without one.
- **Search and routing:** ✅ **Done 2026-09-25** — `supabase/functions/maps-proxy`, deployed and its auth gate verified live (rejects missing/malformed JWTs before reaching the handler). Not yet tested end-to-end with a real Google key (waiting on Person 1's Cloud Console setup).
  - **Changed from the original plan, deliberately:** `geocode.ts` uses Places **Text Search (New)**, not Autocomplete + Details. Text Search returns full place data (including lat/lng) for every candidate in one call, matching the existing client contract exactly (`searchPlaces()` already returns full `LocationPoint[]` synchronously, same as the Nominatim call it replaces) — zero changes needed to `set-pickup.tsx`/`set-destination.tsx`'s selection UI. Trade-off: billed under the Places API (New) **Pro** tier (5,000/month free) instead of Autocomplete's **Essentials** tier (10,000/month) — mitigated by the hourly rate limit and the low daily quota cap.
  - `route.ts` moves to the Routes API (Compute Routes, Essentials tier). Its straight-line fallback stays, tests rewritten to mock `maps-proxy` instead of a raw `fetch` (the target and response shape both changed).
  - The rate-limit table (`maps_proxy_usage`) and its `increment_maps_proxy_usage` RPC are in `supabase/migrations/20260925000001_maps_proxy_rate_limit.sql`, applied live — see the PUBLIC-grant gotcha noted above under "Pattern for most fixes."
  - Server-side fare checks stay as they are.

### G2 free-tier guardrails (pricing checked 2026-09-24 on developers.google.com/maps/billing-and-pricing/pricing)
- **Free monthly allowances:**
  - Maps SDK Android/iOS: **unlimited**.
  - Dynamic Maps (JavaScript): 10,000 loads.
  - Autocomplete Requests: 10,000.
  - Autocomplete Session Usage: unlimited.
  - Place Details Essentials: 10,000; Place Details Pro: 5,000.
  - Geocoding: 10,000.
  - Compute Routes Essentials: 10,000; Compute Routes Pro: 5,000.
- **Mobile:** use the native SDK (react-native-maps), which is unlimited. Do *not* use the Google JavaScript map inside the WebView, because that would count against the 10k Dynamic Maps allowance.
- **Places:**
  - Use session tokens so the autocomplete requests in one search are billed as a single session.
  - Wait about 300 ms after typing stops before searching (already done), with a minimum of 3 characters.
  - Bias results to GenSan and restrict them to the Philippines.
  - Ask Place Details for `location` and `formattedAddress` only, which keeps it in the Essentials tier. Field masks are required, and extra fields such as `displayName` or ratings bump the call up to the Pro tier.
- **Routes:**
  - Call Compute Routes (Essentials: no traffic fields) once, on the confirm screen, not on every map move.
  - Driver ETA and the server's fare check keep using straight-line distance.
- **Keep free:**
  - Reverse geocoding on the phone (`expo-location`).
  - The admin maps, which load only on the Live Map and alert pages.
- **Hard stop:** set a daily quota cap on each API in Cloud Console, e.g. Places 300/day and Routes 300/day, plus budget alerts. Budget alerts only notify; quotas actually stop requests.
- **Proxy cache:** Google's terms allow caching coordinates for at most 30 days and place IDs indefinitely, not other content. The `maps-proxy` cache must follow that. Results from Places must be shown on a Google map, which the full switch guarantees.
- A billing account with a card is still required even if usage stays free.
- **When a quota is reached or Google fails:** fall back quietly.
  - `maps-proxy` returns a flag, and the app switches to Nominatim for search and to a straight line for routes (today's behaviour, so it's already tested).
  - The native map keeps working because it has no limit.

## Docs and survey: G5, P2, P3, PD3, PD4
- **G5:** add to Scope and Limitations: the app is built with Expo, so it runs on iOS and Android. It is released for Android only, because publishing on iOS needs a paid Apple Developer account ($99/yr).
- **P2 and PD4:** questions for the UAT survey.
  - "Would you still use TriSakay if the fare increased by ₱X?" (Likert scale)
  - "How acceptable is it for a passenger to cancel after a driver is assigned?"
  - "How acceptable is it for a driver to cancel after accepting?"
- **P3:**
  - Cite the GenSan tricycle fare ordinance, which `fare_config.ordinance_ref` is already based on, and LTFRB/LGU fare-setting practice.
  - Explain how `compute_fare` follows it: base fare for the first 4 km, then a rate per km, with a 20% discount for students, seniors and PWD under RA 9994 / RA 10754 / RA 11314.
- **PD3:**
  - Benchmark the cancellation policies of Grab PH, inDrive and Angkas as industry practice.
  - Look for academic literature on cancellation behaviour in ride-hailing.
  - Use both to justify the "3 in 7 days" limit.

## G3: final screenshots
After everything is deployed, capture the hosted admin on the real domain with Google Maps, and every mobile screen on Android. Save them in `uat_shots/` and use them in the manuscript.

---

## Verification (per item, when built)
- **D2:** unit tests for `sortByNextStop`; test manually with 2 or more passengers on a driver test account.
- **PD1:**
  - SQL tests: each stage is allowed or blocked, strikes are counted, the cooldown blocks a new request.
  - UI: cancel at each stage in both apps.
- **D1:** full walkthrough with two driver accounts: invite, accept, decline, timeout, send to pool, both before and after pickup. Confirm the passenger's screen updates.
- **P1:** turn the switch on, complete a ride, and the email arrives. The per-trip button works. No duplicate automatic sends.
- **G2:** a dev build on Android shows Google tiles, search returns GenSan places, routes draw. The admin maps load on the domain.
- **C1:**
  - SQL/RLS tests: an unrelated user can't read the thread; nobody can post after the ride completes. **Not run as an explicit test script** — the RLS/trigger logic was written and code-reviewed against the same patterns as X1–X6, but no exploit script exercised it live (same gap the doc's own "Verification (Person 3 writes these as a test script)" note flags for X/Y items).
  - Two devices: messages, "Seen", typing and photos arrive live; a push arrives when the app is in the background. **Not run** — needs a second physical device, not connected during this build.
  - A shared photo has no GPS data. **Not independently verified** — `expo-image-manipulator`'s strip step is wired in per the C1 migration's design, but no photo was actually sent and inspected.
- **C2:**
  - Two Android dev builds: call, ring, answer, decline, missed; the audio works on mobile data.
  - The token is refused for a non-participant or a finished ride.
  - No phone number appears anywhere in the call flow.
- **F6 and D1 races:** run two `accept_ride_request` or `respond_transfer` calls in parallel, e.g. two SQL sessions or a `Promise.all` script. Exactly one succeeds, the loser has no leftover empty trip, and the seat limit is never exceeded.
- **All code items:** `npm test` and type checks pass; screenshots go into `uat_shots/`.
