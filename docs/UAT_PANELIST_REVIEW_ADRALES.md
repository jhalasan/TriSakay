# UAT Panelist Review — Lorelyn F. Adrales

Source: second-panel UAT recommendation form (`UATRecommendation_maamlors.pdf`), panel date 2026-09-22, result **For UAT**.
This file tracks every recommendation from that panel, plus the team's own additions (chat/call, safety trail) and a security/reliability audit done while planning the work, so each item can be triaged and built individually.

Legend for **Status**: `TODO` / `IN PROGRESS` / `STRETCH` / `FUTURE` (designed, not built for this deadline) / `DONE`

**Deadline: 2 weeks.** The panel's items and the F/X/R fixes below are required. Team additions are stretch or future work — see the Timeline section.

---

## Tracker

| ID | Recommendation | Status | Kind |
|---|---|---|---|
| G1 | Proper domain | TODO | Setup |
| G2 | Use Google Maps | TODO | Code, large |
| G3 | Screenshots of the final hosted system with the domain and Google Maps | TODO | Last step |
| G4 | Help tips for text boxes | TODO | Code, small |
| G5 | Scope: iOS and Android, Android preferred | TODO | Docs |
| P1 | Email receipt if the passenger agrees | TODO | Code, medium |
| P2 | Ask passengers if they'd still use the app if the fare increases | TODO | Survey |
| P3 | Suggested fare with supporting literature | TODO | Docs |
| D1 | Driver can transfer a passenger to another tricycle | TODO | Code, large |
| D2 | Nearest drop-off first when carrying several passengers | TODO | Code, small |
| PD1 | Cancellation policy | TODO | Code, medium |
| PD2 | Don't allow cancelling at every stage | TODO | Part of PD1 |
| PD3 | Literature on how many cancellations to allow | TODO | Docs |
| PD4 | Ask users how they feel about cancelling | TODO | Survey |
| C1 | *(Team addition)* In-app chat between driver and passenger | STRETCH (text and quick replies only) | Code, medium |
| C2 | *(Team addition)* In-app voice call with no phone numbers shared | FUTURE | Code, large |
| S1 | *(Team addition)* Route trail, legal hold and PSO case view for safety and compliance | FUTURE | Code, large |
| N1 | *(Team addition)* Ride status push notifications (assigned, arriving, arrived, transferred, completed) | STRETCH | Code, small |
| N2 | *(Team addition)* Cancellation and transfer charts for the PSO | STRETCH | Code, small |
| N3 | *(Team addition)* Share my trip: a live link for a trusted contact | FUTURE | Code, medium |

### Fixes found during exploration (required, do first)
| ID | Fix |
|---|---|
| F1 | `supabase/functions/notify-drivers-new-request/index.ts:28` has a shared secret written in the source. Move it to a Supabase secret and rotate it. |
| F2 | `cancel_ride_leg`, `end_trip`, `get_active_trip_for_driver` and `update_fare_config` exist only in the live database. Save them into migration files before PD1 or D1 changes them. |
| F3 | `supabase/functions/match-ride-request` compares `seats_requested` with the trip's **total** `max_seats`. It should compare with the seats still free. |
| F4 | Add a "driver arrived" step: an `arrived_at` column, an `mark_arrived` RPC and a button for the driver. The passenger gets a notification. This starts the 5-minute no-show timer in PD1. |
| F6 | Accepting a ride is several separate client calls (`packages/services/src/booking/index.ts:159-240`). The guarded `status='pending'` update means only one driver can win. But a losing driver may be left with an **empty active trip**, and one driver accepting two rides at once may pass the seat check twice. Replace it with one `accept_ride_request` RPC that runs as a single transaction: lock the ride row `FOR UPDATE` → check it's still pending → lock or create the trip `FOR UPDATE` → check free seats → assign. The client keeps the message "This ride was just accepted by another driver". If the call fails with a network error or timeout, the client re-reads the ride's status before showing an error, and opens the trip if the driver actually won. Check whether `enforce_trip_seat_capacity` locks the trip row. |
| F5 | `trip-complete.tsx` builds the receipt from local store data. Use the server record instead, the same data the P1 email uses. |

### Loopholes in the new plan (each fix belongs to the item named in brackets)
| ID | Loophole | Fix |
|---|---|---|
| L1 | **Passenger dodges a strike** by asking the driver, in chat or in person, to cancel for them, so the driver takes the strike. | [PD1] Driver reason "Passenger asked to cancel" sends the passenger a confirm prompt. If they confirm, it's recorded as a passenger cancel with a strike. If they don't confirm within 60 s, it's a driver cancel, and frequent use flags the driver. |
| L2 | **Request spam without strikes.** Cancelling while still searching is free, so someone can create and cancel requests over and over, and every one pushes a notification to drivers. | [PD1] More than 5 cancels while searching in 1 hour brings a 30-minute booking pause. The numbers go in `system_settings`. |
| L3 | **Faked "I've arrived"** using a fake-GPS app. | [F4] `expo-location` reports whether a position is mocked on Android. `mark_arrived` and the no-show cancel reject mocked positions, and the event is logged. |
| L4 | **Arrive, then leave:** the driver taps "I've arrived", drives off, and claims a no-show 5 minutes later. | [PD1] The no-show cancel also requires the driver to be within about 100 m of the pickup point *at the moment of cancelling*. |
| L5 | **Transfer or release to pool used as a free cancel.** Transfers don't give the driver a strike, so a driver can dump rides they don't want. | [D1] Releasing a ride to the pool before pickup counts as a strike unless an invite was accepted. Transfers per driver are counted; more than 3 a week flags the driver for PSO review. The reason is always required and logged. |
| L6 | **Stranded passenger after a transfer after pickup:** driver 1 leaves before the new driver arrives. | [D1] Driver 1 can't accept new passengers until the handoff is done: the new driver starts the leg, the ride goes to the pool, or 5 minutes pass. The passenger has SOS and strike-free cancel throughout. |
| L7 | **Paid twice on a transfer:** driver 1 takes cash before transferring. | [D1] Cash can only be confirmed by the driver who finishes the ride. `confirmCash` is refused for a ride that is being transferred or was transferred away. |
| L8 | **Invited driver no longer eligible at accept time:** now full, suspended, offline, or documents expired. | [D1] `respond_transfer` re-checks eligibility and free seats inside the locked transaction, not only when the list was shown. |
| L9 | **Transfer during an active SOS** would move the passenger away from the emergency. | [D1] Transfers are blocked while the ride has an unresolved `emergency_alerts` row. |
| L10 | **Rating a driver who never served the ride** by abusing the "rate both drivers" change. | [D1] `validate_rating` allows a second driver only if an accepted `ride_transfers` row links them to that ride. |
| L11 | **Chat used to share phone numbers**, which defeats the privacy design, or used for harassment. | [C1] Detect PH phone number patterns (`09XXXXXXXXX`, `+639…`), mask them in the message with a warning, and log it. A "Report message" button creates a complaint. Limit to 20 messages per minute per sender (trigger). |
| L12 | **Driver keeps the passenger's home location** because pickup and drop-off stay in the driver's trip history. | [F-new] Driver-side history shows only the barangay or area after completion. Exact coordinates stay visible to the PSO only. |
| L13 | **Email spam** with the "Email me this receipt" button. | [P1] At most 3 sends per ride and 20 per day per user, enforced in `send-receipt`. Only the account's verified email is used. |
| L14 | **Abuse of the Maps proxy:** a scripted client burns through the Google quota. | [G2] `maps-proxy` requires a valid user session (no anon), has per-user limits (e.g. 60 searches and 20 routes per hour), and CORS is restricted to the domain. Google daily quotas remain the hard cap. |
| L15 | **Silent policy changes:** an admin changes strike or cooldown numbers and nobody can see who did it. | [PD1] Changes to `system_settings` and `fare_config` are written to the audit log (who, old value → new value, when). |
| L16 | **PSO case access with a junk reason**, since the reason is only free text. | [S1] The reason is chosen from a list plus notes. An admin-only report shows every PSO case access. |
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

#### Critical: exploitable with a single API call (required, week 1)
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
| X9 | `rr_passenger_cancel` checks only the new status | The cancel request can also set `trip_id`, `final_fare`, etc. | Replaced by PD1's `cancel_ride_request` RPC; remove the passenger's direct UPDATE permission. |
| X10 | `trips` update doesn't lock `status` (migration 20260915000002:66-70) | The driver marks a trip `completed` with passengers still on it. They are then stuck: they can't cancel or rebook. | `status`, timestamps and `tricycle_id` change only through RPCs. Also check the tricycle belongs to the driver when a trip is inserted. |
| X11 | `rr_driver_update` claim: no check of availability, active trip or cluster | An offline driver claims any request by its id. | Replaced by F6's `accept_ride_request` RPC (checks availability, active account, not declined, cluster, seats). Remove the driver's direct UPDATE on `ride_requests`. |

#### High: ride integrity, payments, abuse (required)
| ID | Loophole | Fix |
|---|---|---|
| Y1 | **Remote or instant rides:** `start_ride_leg` and `complete_ride_leg` have no location or time check. A driver can "complete" a ride in 2 s from anywhere and collect the full fare. | Start requires the driver within about 100 m of pickup. Complete requires them within about 300 m of the destination (or an early drop-off, Y10). Enforce a minimum ride time based on `distance_km`. Reject mocked GPS (L3). |
| Y2 | **GCash never paid:** a ride completes with no payment, and the passenger can book again at once. | Block new bookings while the passenger has a completed ride without a paid transaction; show a "Settle previous ride" screen. Flag repeat cases to PSO. The app restores unpaid rides after a restart (R5). |
| Y3 | **PayMongo issues:** (a) the checkout reuses a `cash` transaction row, so the webhook fails with a 500 forever; (b) an old session can still be paid (double charge); (c) `failed → paid` is ignored; (d) the amount check passes if the amount is missing; (e) the plain signature path has no replay window; (f) the raw payload with billing PII is readable by the driver. | Require or switch `method='gcash'`. Expire the old session through the PayMongo API. Store payment ids. Allow `failed → paid`. Fail closed on a missing amount. Drop the unsigned-timestamp branch. Store only ids, with raw payloads in a service-only table. Log paid-but-unmatched payments for refund. |
| Y4 | **Complaints:** on insert a user can set `status='resolved'`, staff fields, any `against_user_id` or any ride. Only a 10 s cooldown. PSO staff can rewrite the complaint text or impersonate the department head. | BEFORE INSERT forces `status='open'` and NULL staff fields. The submitter must be a party to the ride, and `against_user_id` is derived from the ride. Max 5 per day per user and 2 per ride. Extend the lock trigger for `pso_staff` to cover content and `dh_*`. |
| Y5 | **Emergency alerts:** any `counterpart_id` (false accusation), role or status can be set. A 30 s throttle still allows about 2,880 PSO alerts a day. | Derive role and counterpart from the ride. Force `status='logged'`. **Always accept the alert row**, but limit PSO notifications to about 5 an hour per user. PSO can mark false alarms, which are counted per user. |
| Y6 | PSO staff can read every user's `contact_no`, `email` and `push_token` directly (SCHEMA.MD:1562). | Revoke column SELECT from `authenticated`. Expose these through a supervisor-gated RPC or view. |
| Y7 | `refresh_driver_rating` is not SECURITY DEFINER, so **driver ratings may never update**. | Confirm live. Make it SECURITY DEFINER with `set search_path`. |
| Y8 | "One active ride" is checked with EXISTS in a trigger, so it can be raced (two devices). | Unique partial index on `ride_requests(passenger_id) where status in ('pending','assigned','ongoing')`. |
| Y9 | **Expired documents don't stop a driver working.** Licence, OR/CR or MTOP expiry isn't checked when going online or accepting. `expiry_date` is entered by the driver. | Block going online and accepting when any required document or the MTOP has expired. The reviewer confirms the expiry date at approval. |
| Y10 | **Fare fixed at booking:** book a short trip and ride far, or get dropped early and still pay the full fare. | `complete_ride_leg` records the drop-off point. If it's more than about 500 m from the booked destination, the ride is flagged for PSO and the passenger sees "Report a fare issue". Full recalculation is future work. |

#### Reliability (required: R1–R6; the rest are backlog)
| ID | Problem | Fix |
|---|---|---|
| R1 | **Ghost drivers:** a driver who kills the app stays `is_available` forever. They're counted as nearby, get pushes, and logging out with no signal leaves them online. | pg_cron job: `is_available=false` where `location_updated_at < now() - 5 min`. Logout waits for, or queues, the offline write. |
| R2 | **Matching ignores location entirely.** The declared destination is never written, so the radius filter never runs, and every driver sees every request in the city, oldest first. Pushes say "nearby" but go to everyone. | Always filter by radius from the driver's current position, and exclude drivers whose location is more than 2 min old. Apply the same in `nearby-driver-count` and `notify-drivers-new-request`. This also reduces how much passenger pickup data drivers see. |
| R3 | **GPS and time are client-controlled:** `location_updated_at` is set by the client; mock locations are accepted. | A trigger sets `location_updated_at := now()`. Reject impossible jumps (over about 80 km/h between fixes). Reject or flag `coords.mocked` (merges with L3). |
| R4 | **Push tokens outlive logout,** and there's one token per account. The next user on the phone gets the previous user's pushes. | Clear the token before `signOut()` in both apps. Add a `push_tokens(user_id, token unique)` table for multiple devices. |
| R5 | **Passenger app state:** stores aren't reset when the user changes. The active ride is restored only on a cold start. `finding-driver` ignores `ongoing`/`completed`. An unpaid completed ride is lost after a restart. | Reset stores on user change. Look up the active ride on every login and every return to the foreground. Handle `ongoing` and `completed` on the waiting screen. Restore unpaid or unrated rides. Show a retry state when offline instead of Home. |
| R6 | **The driver isn't told live when a passenger cancels.** This becomes more common with PD1. | Subscribe to the active trip's `ride_requests` rows by `trip_id`. |
| R7 | Changing the password leaves other sessions logged in. No AppState auto-refresh, so 401s after being in the background. | `signOut({scope:'others'})` after a password change. Add the standard AppState listener that starts and stops auto-refresh. |
| R8 | **Duplicate accounts dodge cooldowns and bans:** the phone number is unverified, can be empty, and isn't normalised (`0922 444 4955` ≠ `09224444955`). Password rules are only in the app. | Normalise the phone with a trigger, a strict `^09\d{9}$` check, and make it required for passengers and drivers. Set password rules in Supabase Auth settings. SMS OTP is future work (costs money). |
| R9 | **Time zones:** earnings split days at UTC midnight; the franchise cron runs at 16:00 Manila time; admin charts use the browser's time zone. | Use `at time zone 'Asia/Manila'` in `v_driver_earnings` and the admin reports. Fix the cron times. |
| R10 | Backlog (Low): `nearby-driver-count` can be used to pinpoint a lone driver (round the count, rate-limit). `avatar_url` accepts any URL, and the avatars bucket is public. Trigger functions have no `search_path`. Expiry notices are marked sent even when sending failed. The countdown uses the phone's clock. Error banners never clear. Driver earnings today is a local counter. `admin-create-pso-user` doesn't check the admin's own status. `login_events`/flag spam. Accept rate is easy to game. Cash can be confirmed before the ride is completed. | Fix as time allows. |

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
- **Stretch (only if everything above is done):** C1 chat (text + quick replies only), N1, N2.
- **Future work** (designed below, not built this sprint — written up in the manuscript): C2 voice calls, S1, N3, chat photos/read receipts, optimal stop order, Y6/Y7/Y10, R9/R10.

**Person 1 owns Maps + Domain end-to-end** (G2 and G1 are bundled on purpose: G2's admin key needs the domain to restrict it to, P1's email needs the domain verified, and G3's final screenshots need both done — one owner avoids two people blocking each other).

### Person 1 — Maps & Domain
| When | Item | Notes |
|---|---|---|
| Week 1, Day 1 | G1 (start) | Buy the domain, connect it to the Vercel project. |
| Week 1, Day 1 | G2 (start) | Create the Google Cloud project, enable billing, turn on Maps SDK / Maps JS / Places / Routes, set daily quota caps and budget alerts (see "G2 free-tier guardrails"). |
| Week 1, Day 1 | *(prep for P1)* | Add Resend's DNS records for the domain (SPF/DKIM), so it's verified by the time Week 2's P1 needs it. |
| Week 1, Days 2–5 | G2 display | Swap `OsmMap` to `react-native-maps` (`PROVIDER_GOOGLE`) in both mobile apps; swap `LiveMap`/`AlertLocationMap` in the admin to `@vis.gl/react-google-maps`. Needs a new dev/EAS build — check the Expo SDK 54 config-plugin docs first. |
| Week 2 | G2 finish | `maps-proxy` edge function (session-token Places search, Routes) with the quiet fallback to today's free services. |
| Week 2 | L14 | Build the proxy's abuse limits at the same time: session required (no anon), per-user rate limits, CORS restricted to the domain. |
| Week 2 | G1 finish | Add the domain to Supabase Auth's redirect URLs. |
| Week 2 | P1 | Email receipts via Resend (needs the domain verified above). |
| Week 2 | L13 | Build P1's send limits at the same time: max 3 sends per ride, 20/day per user. |
| Week 2 | F5 | Receipt built from server data, not the local store — do this alongside P1 since it's the same data. |
| Week 2, last 2 days | G3 | Final screenshots: the hosted admin on the domain with Google Maps, every mobile screen on Android. Needs Person 2 and 3's features stable first. |
| Week 2, very last step | *(git history purge)* | The deferred X7 cleanup: `git filter-repo` to scrub the old leaked secret string from all commit history, then force-push. Announce to the whole team first — everyone must re-clone or hard-reset right after. Do this last, once nobody has unmerged local branches that would be lost. |

### Person 2 — Backend, ride flow, security (heaviest track)
| When | Item | Notes |
|---|---|---|
| ~~Week 1, Day 1~~ DONE | X7 (= F1) | Already done (2026-09-24) — see the note above. Skip. |
| Week 1, Day 1 | X0 (= F2) | **Bigger than originally scoped:** `supabase db pull`, and carefully reconcile ~90 migrations that are live but not in this repo, before touching anything else. Confirm every X/Y finding against the result before changing it. |
| Week 1, Days 2–4 | X1–X6, X8–X11 | Column-lock triggers/policies (the critical, one-API-call loopholes). |
| Week 1, Days 2–4 | Y8 | Unique partial index so "one active ride" can't be raced. |
| Week 1, Days 2–4 | F6 | Atomic `accept_ride_request` RPC (fixes the leftover-empty-trip and double-seat-check bugs). |
| Week 1, Days 2–4 | F3 | Match on free seats, not total seats. |
| Week 1, end | F4 | "I've arrived" step (`arrived_at`, `mark_arrived` RPC). |
| Week 1, end | L3 | Build F4's mocked-GPS rejection at the same time (shares code with R3). |
| Week 1, end | PD1 + PD2 | Cancellation: stage gate, strikes, `cancel_ride_request` RPC. |
| Week 1, end | L1, L2, L4, L15, L18 | Build these loophole fixes as part of PD1, since they're PD1's own safeguards. |
| Week 2 | D1 | Transfer: invites, handoff, fare/rating rules. Needs PD1 (`cancelled_by`, reason codes) done first. |
| Week 2 | L5–L10 | Build these as part of D1, since they're D1's own safeguards. |
| Week 2, if time allows | Y1 | Location/time checks on start/complete. |
| Week 2, if time allows | Y9 | Block expired documents from going online/accepting. |
| Week 2, if time allows | Y4, Y5 | Complaint and SOS insert locks. |
| Week 2, if time allows | R2 | Matching radius + staleness filter. |
| Week 2, if time allows | R3 | GPS trigger, reject mocked location (shares code with L3/F4). |
| Week 2, if time allows | R1 | Ghost-driver offline cron. |
| Week 2, if C1 is reached | *(C1 backend)* | Quick add: the `ride_messages` table + RLS, same column-lock pattern as X1–X6. About an hour of work once the pattern exists — hand off to Person 3 for the UI. |

### Person 3 — App UX, reliability, docs & QA
| When | Item | Notes |
|---|---|---|
| Week 1, Day 1 | *(tracker)* | Own this tracker file — keep the Status column current as items land. |
| Week 1, Day 1 | G4 | Help tips: mobile `helperText`, admin `hint`. |
| Week 1, Day 1 | D2 | Nearest-next-stop sort, with the transfer-pickup and delay-fairness priority rules. |
| Week 1, Days 2–5 | R5 | Passenger active-ride restore on login/foreground; handle `ongoing`/`completed`; reset stores on user change. |
| Week 1, Days 2–5 | R4 | Clear push tokens on logout; a `push_tokens` table if time allows. |
| Week 1, in parallel | G5, P3, PD3, P2, PD4 | Scope note, fare literature, cancellation literature, both survey questions. Update `UAT_PANEL_PREP.md`. |
| Week 2, Day 1 on | Exploit test script | REST calls that try X1–X11 (and Y-items as they land); each must be *rejected*. Run against Person 2's migrations as they land. |
| Week 2, if time allows | Y2 | Block booking with an unpaid completed ride. |
| Week 2, if time allows | Y3 | PayMongo fixes. |
| Week 2, if time allows | R6 | Driver gets a live update when the passenger cancels. |
| Week 2, if time allows | R7 | Sign out other sessions on password change. |
| Week 2, if time allows | L12 | Driver's own trip history shows only the barangay/area, not exact coordinates. Small UI change to the driver history screen. |
| Week 2, if C1 is reached | *(C1 UI)* | Chat screens in both apps + Realtime wiring, once Person 2's `ride_messages` table lands. Include L11's phone-number masking in the same pass. |
| Week 2, if C1+time allow | N1 | Ride-status push notifications (assigned/arriving/arrived/transferred/completed) — natural next step after C1, reuses the same notification pattern as R4. |
| Week 2, last 3 days | Full regression | Real Android devices, all 3 people's work together. Hand G3 screenshots to Person 1. Final tracker update — mark every item DONE/STRETCH-not-reached/FUTURE. |

### Ownership noted for future work (not built this sprint, but assigned so whoever revisits it knows where to start)
| Item | Proposed owner when picked up |
|---|---|
| N2 — cancellation/transfer charts for PSO | Person 2 (query/data, reuses PD1+D1's data) + Person 3 (admin chart UI) |
| N3 — Share my trip | Person 1 (it's a public map page, same stack as G2) |
| C2 — in-app voice call | Person 1 (mobile native module + EAS build, same shape as G2) for the client, Person 2 for the `call-token` edge function |
| S1 — route trail + PSO case view | Person 2 (trail table/RPC, append-only pattern) + Person 1 (the case-view map, reuses the G2 map component) |
| Y6, Y7, Y10 | Person 2 — Y7 especially, confirm live first, it may be a one-line fix |
| R9, R10 | Person 3 — low-effort backlog, good "if everything else is done" filler |

**Cross-track dependencies:**
- Person 3's D2 and Person 2's D1 driver-candidate list should share the same distance/radius logic once Person 2 lands R2 — flag this if D2 ships first.
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
- **Passenger, by stage:**
  - `pending`: free to cancel.
  - `assigned`: needs a reason and counts as a strike.
  - `ongoing`: blocked; the passenger can only report an issue or SOS.
- **Passenger limit:** 3 strikes in 7 days brings a 24 h booking cooldown, with a warning at strike 2. The numbers go in `system_settings` and are editable in the admin's `SystemSettings.tsx`.
- **Driver:** cancelling after accepting counts as a strike, except:
  - "Passenger no-show", which is allowed only 5 minutes or more after `arrived_at` (F4). `mark_arrived` only accepts the tap if the driver's last known position is within about 100 m of the pickup point, so a driver can't claim to have arrived from far away. This doesn't depend on the S1 route trail, which is future work. Or
  - a transfer (D1).
  - Repeat strikes flag the driver for PSO review in the admin. There is no automatic suspension.
- **Data:**
  - Add `cancelled_by` (passenger / driver / system) and a `cancel_reason_code` from a fixed list. Keep the free-text `cancel_reason`.
  - Count strikes from `ride_requests`. Add a table only if that turns out to be too awkward.
- **Server:**
  - A new `cancel_ride_request` RPC enforces the stage, the reason and the cooldown. It replaces the direct table update in `packages/services/src/booking/index.ts` `cancelRideRequest`.
  - Check the cooldown when a ride request is created.
  - `cancel_ride_leg` gets the reason code and strike logic. Its SQL exists only in the live database, so pull it into a migration first.
- **UI:**
  - A reason picker sheet in both apps.
  - Strike warning and cooldown screens.
  - `ride-cancelled.tsx` reads `cancelled_by` instead of checking the reason text for the word "driver".
  - Update the cancellation section of `legalCopy.ts` in both apps to match what is enforced.

## C1 + C2: driver–passenger communication (privacy first)
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
- **Admin:** PSO can view a ride's thread only from a complaint or SOS alert that references that ride, and each view is written to the audit log.
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
- **When:** before or after pickup. After pickup, the passenger is dropped at a handoff point and the new driver continues to the original destination.
- **Flow:**
  1. The driver taps Transfer and picks a reason (breakdown, full seats, route, other).
  2. A list of nearby online drivers with enough free seats appears.
  3. The driver invites **up to 3** of them at once.
  4. The invites stay open for 30 s, and the first driver to accept gets the passenger.
  5. If no one accepts, the first driver can invite others or send the ride back to the open pool of pending requests. After 2 failed rounds or about 2 minutes, it goes to the pool automatically.
- **Fare:** the passenger pays the original quoted fare once, to the driver who finishes the trip. The first driver's leg is logged for the record only.
  - **GCash paid in advance:** the payment follows the ride and is credited to the driver who finishes it. Check how `paymongo-webhook` credits drivers today before building.
- **What moves to the new driver:** the whole ride. The request's `trip_id` switches to the new driver's trip; the destination and quoted fare stay the same.
  - Before pickup, the new driver's first stop is the original pickup point.
  - After pickup, the first stop is the **handoff point**, stored on the `ride_transfers` row. `get_active_trip_passengers` returns it as that passenger's pickup until they are picked up again. The original pickup stays on the ride for the receipt, the fare and the PSO.
  - The passenger's card disappears from driver 1's list, which re-sorts.
  - In driver 2's list, the passenger is sorted by the D2 rules; the transfer-pickup priority applies.
- **Invites (confirmed): up to 3 drivers at once; the first to accept wins.**
  - Each invite row has an `expires_at` set by the server, 30 s after sending. `respond_transfer` refuses expired invites and invites already taken by someone else (the same first-accept-wins update as `acceptRideRequest`). When one driver accepts, the other invites switch to `superseded` ("Taken by another driver").
  - **Two drivers accepting at once:** `respond_transfer` locks the ride row `FOR UPDATE` first, so all responses, the automatic release to the pool and a passenger cancel are handled one at a time. A unique partial index allows only one `accepted` invite per transfer. The losing driver sees "Taken by another driver".
  - **A driver who didn't see it** simply lets the invite expire. It never blocks the ride, and a late tap shows "This transfer request has expired".
  - **Delivery:** a high-priority Expo push on a separate Android channel "transfer-invite" with its own sound and vibration. If the app is open, a full-screen banner with one large Accept button, so a driver on a ride can accept with a single tap.
  - **Updates:** after each failed round, driver 1 gets "No one accepted: invite others or release to all drivers" and the passenger sees "Still finding your next driver…".
  - **Automatic release to the open pool:** after 2 failed rounds or about 2 minutes without a successful handoff, whichever comes first, the ride returns to `pending` and every eligible driver sees it as a normal request. A pg_cron job or a check when `respond_transfer` runs does this, so the passenger never depends on driver 1 acting after a breakdown.
- **Choosing the new driver:** show online drivers with enough **free** seats (uses F3), sorted by distance to the handoff point. Each row shows the distance, free seats and how many passengers they already have.
  - The invited driver sees the handoff point, the destination, the fare and how far away they are before accepting.
  - Drivers with no passengers right now rank slightly higher in the list, since they're more likely to see the invite quickly.
- **Rating:** after a transferred ride, the passenger rates **both** drivers.
  - This changes the one-rating-per-ride rule in `ratings`: make it unique on (ride, driver) instead, and update the `validate_rating` trigger to accept any driver that served the ride.
- **Passenger:** notified, not asked. They immediately see the new driver's photo, name, plate and ETA. Cancelling after a transfer never counts as a strike.
- **Data:**
  - A `ride_transfers` table: request, from-driver, to-driver, reason, handoff location, status (invited / accepted / declined / expired / pooled), timestamps.
  - RPCs: `invite_transfer`, `respond_transfer`, `release_to_pool`.
  - The accept step reuses the seat-capacity trigger and the active-trip logic in `acceptRideRequest`.
  - The invite is delivered by push notification (same pattern as `notify-drivers-new-request`) plus realtime.
- **Admin:** a transfer log the PSO can review.

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
- **Admin display:** `@vis.gl/react-google-maps` replaces react-leaflet in `LiveMap` and `AlertLocationMap`.
- **Search and routing:**
  - A new `maps-proxy` edge function holds the server key, with per-user rate limiting and a short cache.
  - `apps/passenger/src/utils/geocode.ts` moves to Places Autocomplete and Details.
  - `route.ts` moves to the Routes API. Keep its current straight-line fallback and its tests.
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
  - SQL/RLS tests: an unrelated user can't read the thread; nobody can post after the ride completes.
  - Two devices: messages, "Seen", typing and photos arrive live; a push arrives when the app is in the background.
  - A shared photo has no GPS data.
- **C2:**
  - Two Android dev builds: call, ring, answer, decline, missed; the audio works on mobile data.
  - The token is refused for a non-participant or a finished ride.
  - No phone number appears anywhere in the call flow.
- **F6 and D1 races:** run two `accept_ride_request` or `respond_transfer` calls in parallel, e.g. two SQL sessions or a `Promise.all` script. Exactly one succeeds, the loser has no leftover empty trip, and the seat limit is never exceeded.
- **All code items:** `npm test` and type checks pass; screenshots go into `uat_shots/`.
