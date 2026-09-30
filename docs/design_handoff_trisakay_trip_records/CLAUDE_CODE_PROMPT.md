# Claude Code prompt: TriSakay trip records, account & safety, ratings

Copy this folder into the repo as `docs/design_handoff_trisakay_trip_records/`. Then paste the block below into Claude Code from the repo root (`jhalasan/TriSakay`, branch `main`). Run **one phase per session**.

---

> You are implementing an approved high-fidelity design package for ten TriSakay screens across the passenger and driver apps (Expo Router / React Native monorepo). The goal is to match the design **exactly**: layout, sizes, colours, copy, states and behaviour.
>
> **Screens:**
> - **1a** Ride details (passenger `app/history/[id].tsx`) and Trip details (driver `app/history/[id].tsx`)
> - **1b** Driver My documents (`app/profile/documents.tsx`)
> - **1c** Driver Complaints (`app/complaints.tsx` + new `app/complaints/[id].tsx`)
> - **2a** Passenger Trip complete (`app/booking/trip-complete.tsx`)
> - **2b** Privacy & Safety + Change password (both apps, `app/profile/privacy-safety.tsx`, `app/profile/change-password.tsx`)
> - **2c** Passenger Deactivate account (new route `app/deactivate-account.tsx`), passenger Account suspended (`app/account-suspended.tsx`), Terms & Privacy (`app/profile/legal.tsx`)
> - **3a** Passenger Rate driver (`app/booking/rate-driver.tsx`) and driver My ratings (`app/ratings.tsx`)
>
> **Read before writing any code:**
> - `docs/design_handoff_trisakay_trip_records/README.md`: supersedes list (§0), ground rules (§1), **shared visual system (§2)**, colour map + unresolved hexes (§3), **the complete list of data/behaviour changes (§4)**, screen index (§5), proposed shared components (§6), i18n (§7).
> - `SPEC_1_TRIP_RECORDS.md`, `SPEC_2_ACCOUNT_SAFETY.md`, `SPEC_3_RATINGS.md`: per-screen specs with every measurement, the copy, the states and the edge cases.
> - `screens/*.png` (2× of 390×844). Icons may render **blank** and a few lines wrap differently in the PNGs; the HTML and the specs win.
> - `prototypes/TriSakay Trip Details & Driver Records Redesign.dc.html`: open it in a browser for any ambiguous measurement. Every value in it is an inline style.
> - `docs/design_handoff_trisakay_complaints/`: driver complaints (1c) reuses the passenger complaints components. Reuse, don't duplicate.
> - The current source of every file in the screen list, its styles file, the stores and services it uses, `packages/ui/src/theme/*`, `packages/ui/src/components/index.ts` (including `HoldToConfirmButton`), `packages/shared/src/i18n/{en,fil}.ts`, both apps' `src/content/legalCopy.ts`, and the `RATING_TAGS` definition.
>
> **Hard rules:**
> 1. The HTML is a reference, not code to port. Use `StyleSheet.create` in each app's `src/styles/**`, `@trisakay/ui` tokens and components, Ionicons, Expo Router.
> 2. **No new colour tokens.** Every hex maps to README §3.1. The hexes in §3.2 must be resolved in Phase 0 and approved by me. Never hard-code a hex that isn't in the approved map.
> 3. **Never set `fontWeight`**; use `fontFamily.*`. No new typography tokens (local styles with `moderateScale` are fine).
> 4. No shadow on a view with `overflow:'hidden'` + `borderRadius`; use a wrapper. Android uses `elevation`.
> 5. **Restyle, don't rewrite logic.** Keep every store, service call, guard, redirect and analytics event. The only data/behaviour changes allowed are README §4 D1–D10. Anything else you think is needed: stop and ask.
> 6. **No new dependencies** without asking (the date picker and the SVG progress ring especially).
> 7. `RATING_TAGS` keeps its values; the UI only filters them by score. The ≤ 2★ report threshold is a named constant.
> 8. Legal copy stays word-for-word from `legalCopy.ts`; only the structure changes.
> 9. All copy goes through i18n. Add every new key to **both `en.ts` and `fil.ts`** (real Filipino, not English placeholders), and use plural-aware strings for counts.
> 10. Touch targets ≥ 44×44. Accessibility roles/labels on every interactive element. The hold-to-send SOS has a screen-reader fallback (SPEC_2 §2b).
> 11. Don't touch screens outside the list, the admin app, or unrelated `packages/ui` components.
>
> **At the end of every phase:** run typecheck, lint and the existing tests. Compare against the listed PNGs at 390×844, and check 360×640 and 430×932 for wrapping and clipping. Report what changed, every spec mismatch you chose to accept (and why), and any missing data. Then **stop and wait for me**.
>
> ### Phase 0: Plan and data check (no UI changes)
> - Confirm the real path of every file in the screen list.
> - Map every README §3.1 hex to a token. For each §3.2 hex, propose a token or a named local constant.
> - Walk README §4 D1–D10 and answer each: exists (file + field) / needs a change (smallest diff) / fallback. Specifically:
>   - Does the ride row have `durationMinutes`, a cancel reason, and a discount amount?
>   - Is the ride end location/address stored (D4)?
>   - Do the booking screens accept a prefilled pickup + destination (D5)?
>   - What are the complaints route + param names for prefilling the ride and category (D7)?
>   - Is `@react-native-community/datetimepicker` installed (D10)?
>   - Is `react-native-svg` installed (SOS ring)?
>   - What does `RATING_TAGS` contain, and how does it split positive/negative?
>   - What does the driver complaint category enum contain (it must include `low_rating`)?
>   - What `HoldToConfirmButton` props/variants exist today?
> - Propose the shared components in README §6 (name, props, file). List the ones you'll reuse from passenger complaints 2a.
> - List the i18n keys to add (en + fil) and the ones you'll reuse. Write the extra subject suggestions for each driver complaint category (SPEC_1 §1c step 2).
> - Then stop.
>
> ### Phase 1: Shared components
> Build README §6 (`NavyBandHeader`, `RouteRail`, `StatCells`, `IconTile`, `StatusPill`, `SelectTile`, `StarPicker`, `CollapsibleRow`/`AccordionGroup`, `ProgressSegments`, and the `HoldToConfirmButton` `disc` variant if approved). Export them from `components/index.ts`. Add unit tests for any pure helpers (document status + relative-date copy, tag filtering by score, tag counts, rating percentages). Existing screens must still compile.
>
> ### Phase 2: Trip details, both apps (1a): PNGs 1a-1…1a-4
> SPEC_1 §1a in full: completed/done and cancelled for both apps, discount line, derived drop-off time, receipt with Copy, driver report row, passenger bottom bar (Get help + Book/Try again per D5).
>
> ### Phase 3: Trip complete (2a) + Rate driver (3a-P): PNGs 2a-1, 2a-2, 3a-1…3a-3
> SPEC_2 §2a and SPEC_3 §3a-P: fare hero, inline stars → `rate-driver?initialScore=n`, fare-flagged amber card (D4 fallback), always-visible Skip, the two header sizes, score words and colours, tags filtered by score, comment collapsed/open, ≤ 2★ report card, keyboard-safe layout. Walk the flow end to end: GCash ride, cash ride, flagged fare, 5★, 2★ with report and return.
>
> ### Phase 4: Driver My ratings (3a-D): PNG 3a-4
> D1 (select `tags`), labelled distribution with the 1★ red bar, filter chips, "What passengers mention" counts, tags on cards, "Report unfair rating" → driver complaints with `low_rating`.
>
> ### Phase 5: Driver documents (1b): PNGs 1b-1, 1b-2
> Health bar + legend, urgency grouping, relative status copy (30-day threshold unchanged), expired card with the footer strip, date sheet with the native picker (D10), live preview chip, Save/Clear through the existing `setExpiry`.
>
> ### Phase 6: Driver complaints (1c): PNGs 1c-1…1c-4
> Home with stats, Report card, Common issues, case list with the 3-segment bar; two-step filing (trip picker + "not about a trip", category tiles, subject chips, message, up to 3 photos); new case route `complaints/[id].tsx` with the Now card, timeline, report, and linked trip. Wire the entry points from 1a and 3a-D.
>
> ### Phase 7: Privacy & Safety + Change password (2b), both apps: PNGs 2b-1…2b-3
> Hold-to-send SOS (2 s ring, haptics, early-release reset, screen-reader fallback), sending/sent/failed in place, a separate 911 row, the security row, three collapsible Learn more rows, the footer link. Change password: status card, live checklist + strength bar, confirm mismatch, disabled button while the feature is unavailable. **Test the SOS on a real device** (hold, early release, VoiceOver/TalkBack).
>
> ### Phase 8: Account states & legal (2c): PNGs 2c-1…2c-3
> Deactivate as a modal route with an understanding checkbox and a disabled danger button until checked; passenger Suspended gate with the PSO card and Refresh status; Terms & Privacy with the segmented tabs, disclosure icon rows and a one-open-at-a-time accordion (copy verbatim).
>
> ### Phase 9: Polish and docs
> - Diff all 21 PNGs at 390×844; check 360×640 and 430×932.
> - Grep the touched files for hex literals, `fontWeight`, and shadow-on-clipped views.
> - Walk each spec's "States & edge cases" and behaviour notes line by line.
> - Check that every new i18n key exists in both `en.ts` and `fil.ts`.
> - Update `apps/passenger/PRODUCT.md` / the driver equivalent where the behaviour changed (hold-to-send SOS, deactivate page, rating tags, report routes).
> - Typecheck, lint and tests clean.
>
> Start with Phase 0 and stop when it's done.

---

## Notes for you (not part of the prompt)

- **Riskiest phases:** Phase 7 (SOS: a new interaction on a safety-critical action; test it on devices) and Phase 3 (the rating flow feeds driver scores; check that the tags are saved correctly).
- **Decisions only you can make:**
  - How to map the unresolved hexes (README §3.2), especially the amber warning family and the on-navy tints.
  - Whether storing the ride end location (D4) is in scope. If it isn't, the fare-flagged card shows "Booked" only.
  - Whether the booking flow may accept prefilled routes (D5).
  - Adding the date picker / SVG dependency, if missing.
  - The ≤ 2★ report threshold.
- **Not in scope:** admin/PSO views of these records, a working password change (the UI stays "not available"), and account deletion (deactivation only).
