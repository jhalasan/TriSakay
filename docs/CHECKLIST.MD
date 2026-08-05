# TriSakay — Full Project Checklist (Ranked, All 3 Apps + Backend)

Generated 2026-08-05 from a full-repo review: typecheck clean, 74/74 tests pass (9 passenger, 17 driver, 48 services), working tree clean. Verified against live code, not just prior docs — cross-reference `docs/PASSENGER_TODO.MD`, `docs/DRIVER_TODO.MD`, and `docs/CONTEXT.MD` for the underlying FR/UC numbers. Admin app is included here (the two TODO docs above scope it out).

**Updated 2026-08-05 (later same day)** after `docs/SCHEMA.MD`/`docs/CONTEXT.MD` picked up MTOP franchise tracking (FR-1.4a/1.7/7.5), Department Head complaint review (FR-4.3a), the complaint SLA view (FR-4.8/5.5), and the GCash→PayMongo rename (FR-9). The DB/types side of all of these is already live (`tricycles.mtop_no`/`mtop_expiry_date`, `complaints.dh_reviewed_*`, `v_overdue_complaints`, `v_expiring_franchises`, `notify_expiring_franchises()`, `transactions.paymongo_session_id`/`paymongo_payload`) — nothing in app code consumes any of it yet, confirmed via repo scan. See items marked **(new)** below.

---

## P0 — Blocking / structural (nothing above this works right until these land)

- [x] **Build `match-ride-request` Edge Function** — deployed 2026-08-05 (`supabase/functions/match-ride-request/index.ts`, ACTIVE on the live project). Implements the FR-2.5 two-stage check: cluster-authorization hard filter (mirrors `is_cluster_authorized()`) + seat capacity, then a bearing-tolerance/detour-ratio soft filter once the driver has a known position. `subscribeToPendingRideRequests()` (`packages/services/src/booking/index.ts`) now calls it instead of the old naive full-table select; `useRequestsStore.subscribe()` and the Dashboard toggle were updated to pass `driverId` through. All 66 existing unit tests (49 services + 17 driver) and both composite typechecks (`apps/driver`, `apps/passenger`) still pass.
  - **Not yet exercised live**: no end-to-end smoke test was run against the deployed function (would need a seeded verified driver + tricycle + pending request; out of scope for this pass) — verify during the next real QA session.
  - **Soft filter won't activate yet**: it depends on `driver_profiles.current_lat/current_lng`, which nothing writes today — see the P0 item below ("Driver availability toggle...") and the still-stub `packages/services/src/location/index.ts`. Until then the function correctly falls back to the hard-filtered list only (cluster + capacity), which is still a real improvement over the old unfiltered board.
- [ ] **Build `paymongo-webhook` Edge Function** *(renamed from `gcash-webhook`)* — server-side payment confirmation via a signature-verified PayMongo webhook (FR-9.2), writing `transactions.status`/`paymongo_session_id`/`paymongo_payload` (renamed from `gcash_reference`/`gcash_payload` — DB and generated types already use the new names; only the Edge Function itself is unbuilt). Blocks the entire GCash path; nothing should trust a client-side "paid" state.
- [ ] **Driver availability toggle → real `driver_profiles.is_available` write.** Dashboard shows "Online" but never touches the DB — the driver is invisible server-side no matter what the UI says. Small fix, high correctness impact; land before more matching work sits on top of it.
- [ ] **Admin Web App — frontend built 2026-08-06, backend wiring still pending.** All 11 wireframe screens now exist and are navigable (`apps/admin/src`: routing, RBAC role-gating, design tokens, shared components), but the pass was deliberately frontend-only — every screen reads/writes typed mock fixtures through a service layer, nothing touches Supabase yet (no client, no auth, no queries). Full feature-by-feature backend backlog (FR-1.4a MTOP fields, FR-4.3–4.8 two-step complaint flow incl. `dh_directive`, FR-5 monitoring/reporting incl. `v_overdue_complaints`/`v_expiring_franchises`, FR-6, FR-8, FR-10.3–10.4, FR-3.10 discount review, plus cross-app blockers) is now tracked in `docs/ADMIN_TODO.MD`, mirroring `docs/DRIVER_TODO.MD`/`docs/PASSENGER_TODO.MD`.

## P1 — Core ride flow (make the primary user journey real, both apps)

- [ ] Driver: document upload → real Storage + `driver_documents`/`tricycles` write (new `driver-docs` bucket).
- [ ] Driver: verification-status read (`driver_profiles.verification_status`) — no screen currently shows pending/rejected state.
- [ ] Driver: accept/start/complete/cancel trip → real `trips`/`ride_requests` writes (`app/trip/active.tsx` has the right shape, bodies are still local).
- [ ] Driver: mid-trip pickup screen (FR-2.5c) — doesn't exist yet, new UI, not just wiring.
- [ ] Driver: passenger-info view post-match — real name/photo via join, not the hardcoded `null`.
- [ ] Passenger: trip tracking after match — replace `wait()` timers in `finding-driver.tsx` / `driver-found.tsx` / `trip-in-progress.tsx` with real subscriptions to `trips`/`driver_profiles`.
- [ ] Passenger + Driver: cash payment confirmation → real `transactions.status='paid'` write with `cash_confirmed_by` (FR-9.9). Passenger's `payment.tsx` and Driver's cash-confirm toggle are both still `wait()` stubs.
- [ ] Passenger: rate-driver → real `ratings` insert (UI already correct, submit is `wait(500)`).

## P2 — Secondary features (real but not day-one-critical)

- [ ] Passenger + Driver: complaint submission → real `complaints` insert. Passenger form is free-text only — needs the real `complaint_category` enum added to the form, not just wiring.
- [ ] Driver: complaint management/triage view.
- [ ] Passenger: trip history → real query (`useHistoryStore` seeded empty).
- [ ] Driver: trip history → real query.
- [ ] Driver: earnings → real read from `v_driver_earnings` (keep "tracked/simulated" copy, never "payout").
- [ ] Driver: own ratings → real read of `driver_profiles.rating_avg`/`rating_count`.
- [ ] Passenger + Driver: notifications → real `notifications` table read + Realtime subscription (both currently 100% local-store; no `expo-notifications` dependency installed in either app yet — push tokens are a later layer on top of this). `packages/services/src/notifications/index.ts` is currently a one-line stub (`export const notificationsServiceStatus = ...`) with no real send/read logic — build this shared service once, since FR-7.1–7.5 (ride status, verification, complaint, payment, and franchise-expiry notifications) all depend on it.
- [ ] **(new)** FR-1.6a: on a driver verification decision (approved/rejected), notify the driver via **in-app notification** (depends on the notifications service above) **and email** — no email-sending infrastructure exists anywhere in the repo yet (no Resend/SendGrid/SMTP integration found), so this needs a new Edge Function + provider, not just wiring an existing one.
- [ ] **(new)** Enable `pg_cron` (Supabase Dashboard → Database → Extensions) and schedule `notify_expiring_franchises()` per the comment in `docs/SCHEMA.MD` §4.8 (`select cron.schedule('notify-expiring-franchises', '0 8 * * *', 'select public.notify_expiring_franchises();')`). Low value until the admin verification-review screen above can actually populate `mtop_no`/`mtop_expiry_date` — otherwise `v_expiring_franchises` stays empty and the job has nothing to notify on.
- [ ] Passenger: new Payment History screen — doesn't exist at all (`payment-methods.tsx` is static info, not history).
- [ ] Passenger: Settings persistence (`useSettingsStore` toggles are in-memory) + actual Filipino i18n behind the language cycler (currently just flips a label).

## P3 — Account/auth completeness

- [ ] Passenger + Driver: password reset — "Forgot password?" is a stub `Alert.alert` on both login screens.
- [ ] Passenger: phone number update on profile (avatar + name already real).
- [ ] Driver: phone number update on profile, if in scope.

## P4 — Compliance / pre-demo polish

- [ ] Replace placeholder ToS/Privacy legal copy in `consent.tsx` (both apps) — currently literal "Placeholder —" paragraphs; FR-11 requires real disclosure text.
- [ ] Resolve map library divergence: spec says MapLibre, code uses Leaflet-in-WebView on OSMF's free tile service, which the component's own comments flag as not production-safe past dev/low-volume use. Either swap or amend `CONTEXT.MD` to match reality — don't leave it silently diverged.
- [ ] Decide on committing Supabase migrations locally (`supabase/` dir referenced in the spec doesn't exist; schema only lives via MCP `apply_migration`) — affects whether `git log` can ever show schema history.

## P5 — Deployment readiness

- [ ] `eas.json` for Passenger + Driver (Android internal distribution + iOS TestFlight) — doesn't exist for either app yet; can likely be done once and shared.
- [ ] Admin app deployment to Vercel — moot until the admin app (P0) exists.

## P6 — Housekeeping (low risk, no user-facing impact, fix opportunistically)

- [ ] `apps/passenger/package.json`, `packages/ui/package.json`, `packages/utils/package.json` missing `"type": "module"` — Node's test runner currently reparses each `.ts` test file as ESM at runtime with a warning; harmless today but worth silencing.
- [ ] Confirm/document the "driver test accounts need manual email confirmation" friction (Supabase dashboard "Confirm email" + low built-in rate limit) before QA/demo sessions — not a code fix, an ops note.

---

**Why this order:** P0 unblocks everything downstream (an Edge Function and an entire missing app can't be deferred behind screen-level polish). P1 finishes one ride end-to-end for both mobile apps — the thing a defense demo actually needs to show. P2–P3 round out the feature set the FR/UC docs already lock. P4–P6 are compliance, deployment, and cleanup that don't block a working prototype but do block calling it "done."
