# Claude Code prompt — TriSakay ride communication (driver Call/Message · passenger matched ride · ride chat)

Copy this folder into the repo as `docs/design_handoff_trisakay_ride_comms/`, then paste the block below into Claude Code from the repo root (`jhalasan/TriSakay`, branch `main`). Run **one phase per session**.

---

> You are implementing an approved high-fidelity design package for TriSakay ride communication in this Expo Router / React Native monorepo. It has three connected parts:
> - **A**: driver accepted ride (`apps/driver/app/trip/active.tsx`): Call + Message on the passenger strip, unread states, in-app message preview.
> - **B**: passenger matched ride (`apps/passenger/app/booking/trip.tsx`): full redesign of the trip sheet.
> - **C**: ride chat for both apps (`apps/passenger/app/booking/chat.tsx`, `apps/driver/app/trip/chat/[rideRequestId].tsx`, `packages/ui` `ChatBubble` / `ChatComposer` / `QuickReplyRow` / `TypingDots`): a restyle of the C1 chat that was just merged.
>
> **Read before writing any code:**
> - `docs/design_handoff_trisakay_ride_comms/README.md`: overview, **§0 supersedes list**, ground rules, token map, the Part A spec, data table, screen index.
> - `docs/design_handoff_trisakay_ride_comms/PART_B_PASSENGER_MATCHED_RIDE.md`
> - `docs/design_handoff_trisakay_ride_comms/PART_C_RIDE_CHAT.md`
> - `docs/design_handoff_trisakay_ride_comms/screens/*.png` (2×, 390×844). Icons may render empty and some text wraps only in the PNGs; the HTML wins.
> - `docs/design_handoff_trisakay_ride_comms/prototypes/*.dc.html`: open in a browser for any ambiguous measurement. Ignore the driver frame 4d and the Message sheet in passenger 5a; both are superseded.
> - `docs/design_handoff_trisakay_driver_v2/README.md` §6: still the spec for the rest of `trip/active.tsx`.
> - The shipped chat: `supabase/migrations/20260929000001_c1_ride_chat.sql`, `packages/services/src/chat/index.ts`, both `useChatStore.ts`, both `useChatNotifications.ts`, both chat screens and styles, and the four `packages/ui` chat components.
> - `packages/ui/src/theme/*`, `packages/ui/src/components/index.ts`, `packages/shared/src/i18n/{en,fil}.ts`.
>
> **Hard rules:**
> 1. The HTML is a reference, not code to port. Use `StyleSheet.create`, `@trisakay/ui` tokens and components, Ionicons, Expo Router.
> 2. **No new colour tokens.** Every hex maps to README §3. If one doesn't, stop and report it.
> 3. **Never set `fontWeight`**; use `fontFamily.*`. No new typography tokens (local styles with `moderateScale` are fine).
> 4. No shadow on a view with `overflow:'hidden'` + `borderRadius`; use a wrapper. Android uses `elevation`.
> 5. **Do not change chat data or security:** no edits to the `ride_messages` schema, RLS, triggers, the `ride-chat` bucket policies, the `notify-new-message` function, or the push payload (title only, no content). `packages/services/src/chat` stays as is. `useChatStore` may only gain read-only derived selectors.
> 6. **Restyle, don't rewrite logic** in `trip.tsx` and `active.tsx`: keep every store, subscription, guard, tutorial target/demo guard, redirect, transfer/release/cancel flow and the `sortByNextStop` ordering.
> 7. **Message always opens the chat screen.** Do not build the quick-reply bottom sheets or the "Message sent" toast from the older handoffs.
> 8. Quick replies are sent as **codes** only. Keep the existing code sets.
> 9. **Call** is behind `features.rideCall` (default off). With the flag off or no number, Call is not rendered and Message takes the full width. Never show a raw phone number in UI text.
> 10. All copy goes through i18n, and every new key is added to **both `en.ts` and `fil.ts`**. Reuse the existing `chat.*` / `driver.chat.*` / `trip.*` keys.
> 11. Don't touch other screens, admin, or unrelated `packages/ui` components.
>
> **At the end of every phase:** run typecheck, lint and the existing tests (`packages/services/tests/chat.test.ts` included). Compare against the listed PNGs at 390×844 and at 360 width. Report what changed, any spec mismatch, and any missing data. Then **stop and wait for me**.
>
> ### Phase 0 — Plan and data check (no UI changes)
> - Map every README §3 hex to a token; confirm there are no gaps.
> - Walk README §6 row by row and answer each: exists (file + field) / needs delta / fallback. Specifically:
>   - the real `ride_requests.status` values and the arrived flag → the stage mapping in Part B §B2;
>   - where the plate and ETA come from on the passenger side;
>   - ride event timestamps available for the system pills (Part C §C5);
>   - whether the cancel API takes a reason code and whether a reasons list exists;
>   - whether any masked/proxy phone number exists (expected: no → Call stays flagged off).
> - Decide and tell me: build the in-app message preview banner (README §4.4) now, or skip it.
> - Check `HoldToConfirmButton` (changed in the last merge): does `variant="fab"` exist? If not, propose it.
> - Propose the new/changed `packages/ui` APIs:
>   - `ChatHeader` (new)
>   - `ChatBubble` changes: no inner meta, a `groupPosition: 'single'|'first'|'middle'|'last'` prop, quick-reply styles, masked-token rendering, `lifted` state
>   - `QuickReplyRow` `size`
>   - `ChatComposer` focus/counter/sending
>   - `ChatSystemPill`, `ChatErrorBar`, `ChatReadOnlyBar`, `ChatReportSheet` (new)
> - Propose the pure helper `buildChatRows` (in `packages/shared`) with its test cases, and the `useUnreadByRide` hook.
> - List the i18n keys to add (en + fil) and the ones you'll reuse.
> - Then stop.
>
> ### Phase 1 — Shared chat components (`packages/ui`) — no screen changes yet
> Build Part C §C2, §C4 (bubble), §C5, §C6, §C7, §C8, §C9 (sheet component), §C10 (bar component) as components, plus `buildChatRows` with unit tests (grouping window 3 min, tail corners, single Seen, day separators, masked-token split, system-pill insertion). Export them from `components/index.ts`. Keep the existing prop names working so the current screens still compile.
>
> ### Phase 2 — Passenger chat screen — PNGs C1, C2, C3, C4
> Rewire `booking/chat.tsx` to use the new components: ChatHeader with plate + status, privacy tip (persisted dismissal), grouped list with system pills and the typing bubble, error bar with Retry (and rate-limit handling), restyled chips (`md`), composer (personalised placeholder, focus, counter, sending), report sheet instead of the Alerts + toast, read-only bar with Report → `/complaints/new` prefilled, empty state, skeleton loading. Test a live thread against a second device or account.
>
> ### Phase 3 — Driver chat screen — PNG C6
> Same for `trip/chat/[rideRequestId].tsx`: driver header status line, **passenger switcher** (≥2 active passengers, `router.replace`, unread counts through `useUnreadByRide`), `lg` chips, driver copy for the empty and read-only states, Report → driver complaints prefilled.
>
> ### Phase 4 — Driver accepted ride entry points — PNGs A1, A2, C7
> README §4: two-button contact row (Call flagged, Message → chat), the filled Message state with a count, the "Then" row chat tile with badge, refetch unread on focus. Add the preview banner if Phase 0 approved it. Everything else in `active.tsx` follows driver v2 §6; if that isn't implemented yet, restyle only the strip and tell me.
>
> ### Phase 5 — Passenger matched ride — PNGs B1–B6, C5
> Part B in full: map layer, status pill, SOS FAB (remove the old bar), floating sheet with the stage table, progress, driver strip + plate tag + Call (flagged) / Message (filled when unread, replaces `messageDriverDot`), route, fare, Cancel → reason sheet, transfer banner + New tag, preview banner if approved. Walk all three stages, a GCash ride, a transfer, and the tutorial demo.
>
> ### Phase 6 — Polish and docs
> - Diff all 15 PNGs at 390×844; check 360×640 and 430×932 for wrapping and clipping.
> - Grep the touched files for hex literals, `fontWeight`, and shadow-on-clipped views.
> - Check every item in Part B §B9 and Part C §C15.
> - Update `apps/passenger/PRODUCT.md` (and the driver equivalent if there is one): replace "No in-app call or chat" with a short description of ride chat (and Call, if enabled).
> - Typecheck, lint and tests clean.
>
> Start with Phase 0 and stop when it's done.

---

## Notes for you (not part of the prompt)

- **Riskiest phases:** Phase 1 (`ChatBubble` API change, since both screens depend on it; the prompt keeps the old props compiling) and Phase 5 (the biggest visual change to `trip.tsx`).
- **Decisions only you can make:**
  - Call: masked/proxy number, raw number, or none (the default is none).
  - The in-app preview banner, which shows message text inside the app. Lock-screen pushes stay content-free.
  - The real cancel reasons.
  - Real ETA vs estimate.
- **Not in scope:** admin/PSO chat logs and 30-day retention (deferred in the C1 migration), and the driver v2 dashboard/history/earnings (their own handoff).
