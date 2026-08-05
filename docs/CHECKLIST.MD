# TriSakay — Full Project Checklist (Ranked, All 3 Apps + Backend)

Generated 2026-08-05 from a full-repo review: typecheck clean, 74/74 tests pass (9 passenger, 17 driver, 48 services), working tree clean. Verified against live code, not just prior docs — cross-reference `docs/PASSENGER_TODO.MD`, `docs/DRIVER_TODO.MD`, and `docs/CONTEXT.MD` for the underlying FR/UC numbers. Admin app is included here (the two TODO docs above scope it out).

---

## P0 — Blocking / structural (nothing above this works right until these land)

- [ ] **Build `match-ride-request` Edge Function** — bearing/detour heuristic + cluster-authorization hard filter (FR-2.5). Every "matching" flow today is a naive full-table query. Blocks real driver discovery, real "driver found" on the passenger side, and mid-trip pickup.
- [ ] **Build `gcash-webhook` Edge Function** — server-side payment confirmation (FR-9.2). Blocks the entire GCash path; nothing should trust a client-side "paid" state.
- [ ] **Driver availability toggle → real `driver_profiles.is_available` write.** Dashboard shows "Online" but never touches the DB — the driver is invisible server-side no matter what the UI says. Small fix, high correctness impact; land before more matching work sits on top of it.
- [ ] **Admin Web App — doesn't exist.** `apps/admin/src` is the untouched Vite scaffold (one `<h1>`, no routing, no auth, no screens). Every PSO/Supervisor/Admin-facing feature (FR-1.5, FR-4.3–4.6, FR-5, FR-6, FR-8, FR-10.3–10.4, FR-3.10 review) currently has zero frontend. This is the single largest remaining scope block in the project.

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
- [ ] Passenger + Driver: notifications → real `notifications` table read + Realtime subscription (both currently 100% local-store; no `expo-notifications` dependency installed in either app yet — push tokens are a later layer on top of this).
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
