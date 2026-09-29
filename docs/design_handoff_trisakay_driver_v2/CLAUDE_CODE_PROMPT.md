# Claude Code prompt — TriSakay driver redesign v2

Put this folder in the repo as `docs/design_handoff_trisakay_driver_v2/` (or pass its path), then paste the block below into Claude Code from the repo root. Run one phase per session.

---

> You are implementing an approved high-fidelity redesign of four TriSakay **driver** screens in this Expo Router / React Native monorepo: **Dashboard, Trip history, Earnings, and the accepted-ride screen (`app/trip/active.tsx`)**. It supersedes the earlier locked dashboard and the earlier Earnings/History/Active-trip designs; the owner has approved replacing them.
>
> **Read before writing any code:**
> - `docs/design_handoff_trisakay_driver_v2/README.md` is the full spec: token map, shared recipes, per-screen anatomy with px values, the active-trip stage table, i18n keys, and the data dependencies.
> - `docs/design_handoff_trisakay_driver_v2/screens/01…13.png` are 2× captures, one per state. Icons render empty in the PNGs; open the HTML to see them.
> - `docs/design_handoff_trisakay_driver_v2/TriSakay Driver Redesign.dc.html` is the prototype. Open it in a browser whenever a measurement is ambiguous. Frame 4a is clickable end to end.
> - `packages/ui/src/theme/{colors,typography,spacing}.ts`, `packages/ui/src/components/*` (Button, Card, Avatar, GradientSurface, BrandMotif, HoldToConfirmButton, RequestCard, ConfirmModal, ReasonPickerModal, MapOverlaySheet, OsmMap, EmptyState).
> - The current `apps/driver/app/(tabs)/{dashboard,history,earnings}.tsx`, `apps/driver/app/trip/active.tsx` and their styles in `apps/driver/src/styles/**`.
>
> **Hard rules:**
> 1. The HTML is a reference, not code to port. Rebuild with `StyleSheet.create` in `apps/driver/src/styles/**`, `@trisakay/ui` tokens and components, Ionicons, and Expo Router.
> 2. **No new colour tokens.** Every hex maps to a token in README §1. If you find one that doesn't, stop and report it. Map ground and canvas grey are the only exceptions.
> 3. **Never set `fontWeight`.** Use `fontFamily.*`. Where no typography token matches exactly, make a local style with `moderateScale`; don't add tokens.
> 4. Never put a shadow on a view that also has `overflow:'hidden'` + `borderRadius`. Split it onto a wrapper. Android uses `elevation`.
> 5. **Restyle, don't rewrite logic.** Keep every store call, service, modal, guard, tutorial target, and the `sortByNextStop` ordering in `active.tsx`. Presentation and control placement change; behaviour does not, except where README §6 says so explicitly (End trip only rendered when there are no passengers; SOS moves to a map FAB; cash Toggle becomes a Received button; Transfer/Release/Cancel move into an options sheet).
> 6. All copy goes through `packages/shared/src/i18n/en.ts` (keys in README §7). Reuse existing keys where the string already exists. No inline strings.
> 7. **Do not reintroduce "Notify PSO for settlement" or the settlement log.** Earnings uses the existing peak-hours analytics, restyled per README §5.
> 8. **Do not show the passenger's rating** on request cards.
> 9. Don't touch the passenger app, admin, or any driver screen outside these four, apart from the two small `packages/ui` additions below.
>
> **At the end of every phase:** run typecheck and lint, compare against the matching PNG at 390×844, and list what changed, any mismatch with the spec, and any data you couldn't find. Then **stop and wait for me**.
>
> ### Phase 0 — Plan and data check (no UI changes)
> - Map every README §1 hex to its token and confirm there are no gaps.
> - Go through README §8 row by row. For each piece of data, tell me whether it exists today (file and field) or needs a delta, and which fallback you'll use.
> - List the i18n keys you'll add and the existing keys you'll reuse.
> - Propose the two `packages/ui` additions:
>   - (a) `HoldToConfirmButton` `variant="fab"`: a 58px circle with a progress ring and the same hold duration.
>   - (b) `RequestCard` `compact` variant, or a new `RequestBanner`, for the mid-trip request. Also confirm the full `RequestCard` can drop its map and passenger rating.
> - Then stop.
>
> ### Phase 1 — Dashboard (`app/(tabs)/dashboard.tsx`) — PNGs 01–03
> Build README §3:
> - Header with the time-of-day greeting.
> - Navy hero with the **Go offline** button in place of the Toggle, the goal bar (hidden unless a goal is set) and a 3-tile stats grid.
> - The request card **without a map or passenger rating**, with the 4px countdown bar and chip on one real timer, and 54px Decline/Accept.
> - A horizontal listening card and Recent trips (2 rows, See all → History).
> - The offline state: white status card, 58px green **Go online**, verification footer, This-week grid and Last trip.
> - The two pulse animations only.
>
> ### Phase 2 — Trip history (`app/(tabs)/history.tsx`) — PNG 04
> Build README §4:
> - Navy band with the All/Done/Cancelled pills and counts, filtering client-side.
> - Day-grouped list with nowrap group headers ("Today Sep 28" / "3 trips · ₱70").
> - Completed cards with time/payment/seats, fare, route rail, avatar + name, and the Done chip + chevron.
> - Cancelled cards with a dashed border, muted route and the localised reason.
> - Empty and loading states.
>
> ### Phase 3 — Earnings (`app/(tabs)/earnings.tsx`) — PNG 05
> Build README §5:
> - Today/Week/Month segmented control (default Week) on the navy band, with the range label, total at `amount`, delta pill (hidden when ≤0 or unknown) and trip count.
> - Chart card with tap-to-select bars: the selection resets to the last bucket when the period changes, and the header shows the selected bucket's label, value and trips.
> - Goal line; 3 stat tiles.
> - The **Peak hours** card restyled from the existing analytics source.
>
> Update or replace `src/components/EarningsBarChart` as needed.
>
> ### Phase 4 — Accepted ride (`app/trip/active.tsx`) — PNGs 06–13
> Build README §6 exactly:
> - Full-screen map, status pill (text per stage), and the SOS FAB (`variant="fab"`, same hold → `/trip/emergency`, keep `sosTarget`). Remove the map Navigate button.
> - The floating sheet: next-stop block with a labelled Navigate (calls `handleNavigate`), the passenger strip with ⋯, and **one primary action per the stage table in §6.4**, driven by the existing `status`, `arrivedAt`, `paymentMethod`, `cashConfirmed` and `handoffLat` fields, plus the hint line under it.
> - Cash row, pending and done. Received calls `handleConfirmCash`.
> - Complete opens the existing ConfirmModal with the new copy.
> - The "Then" list for the other `sortedStops`.
> - The compact mid-trip request banner.
> - The options bottom sheet (Transfer / Release / Cancel wired to the existing flows and disable rules).
> - The all-dropped-off panel, where End trip opens the existing end-trip ConfirmModal.
>
> Keep `passengerCardTarget` on the top block. Verify with 1 passenger (walk every stage), 2 passengers, a GCash passenger (no cash row), a handoff passenger, and the tutorial demo.
>
> ### Phase 5 — Polish
> - Diff all 13 PNGs at 390×844 and also check 360 and 430 widths for wrapping (group headers, the status pill and the zone line must not wrap).
> - Grep for stray hex values, `fontWeight`, and shadow-on-clipped views.
> - Confirm the tab bar is hidden on `trip/*`, typecheck and lint are clean, and no settlement UI remains.
>
> Start with Phase 0 and stop when it's done.

---

## Notes for you (not part of the prompt)

- The riskiest phase is Phase 4, because `active.tsx` carries transfer, release, handoff and tutorial logic that must survive the move into the options sheet.
- Open decisions Claude Code can't make alone:
  - where the daily goal is set (the design assumes a Settings field; it isn't designed yet)
  - the Release wording
  - whether ETA minutes are real or estimated
  - zone name source
