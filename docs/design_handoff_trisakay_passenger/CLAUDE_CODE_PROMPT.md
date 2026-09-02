# Claude Code prompt — TriSakay passenger redesign

Copy the block below into Claude Code from the repo root, with this handoff folder available (e.g. `design_handoff_trisakay_passenger/` inside the repo, or pass its path).

Each phase is one session. Do not start a phase until the previous one is committed and runs on device.

---

## The prompt

> You are implementing a completed high-fidelity redesign of the TriSakay **passenger** app in this Expo Router / React Native monorepo.
>
> **Read first, before writing any code:**
>
> - `design_handoff_trisakay_passenger/README.md` — the full spec: token map, per-screen anatomy, interactions, state.
> - `design_handoff_trisakay_passenger/screenshots/` — one wide PNG per screen group.
> - `design_handoff_trisakay_passenger/TriSakay Passenger Screens.dc.html` — the source prototype, 390×844 per frame, each frame labelled with `data-screen-label`. Open it in a browser when a measurement in the README is ambiguous.
> - `packages/ui/src/theme/*` — every colour, type style, space, radius, and shadow you may use.
> - `apps/passenger/src/styles/tabs/home.styles.ts` — the reference for how a redesigned screen's styles are written in this repo, including the two Android shadow caveats in its comments.
>
> **Hard rules for every phase:**
>
> 1. The HTML is a **reference, not code to port**. Recreate each screen in React Native using this repo's existing patterns: `StyleSheet.create` in `apps/passenger/src/styles/**`, tokens from `@trisakay/ui`, components from `packages/ui/src/components`, Ionicons from `@expo/vector-icons`, Expo Router file routes.
> 2. **No new design tokens.** Every hex in the mock already exists in `packages/ui/src/theme/colors.ts`. If you find one that doesn't, stop and report it — do not add it.
> 3. **Never set `fontWeight`.** Weight lives in the family name (`fontFamily.regular/semibold/bold/extrabold`). See the comment block in `typography.ts`.
> 4. Gradients use `expo-linear-gradient` via the existing `GradientSurface`. Never put an elevation shadow on the same view as `overflow:'hidden'` + `borderRadius` — shadow goes on an outer wrapper.
> 5. **Restyle, don't rewrite logic.** Where a screen already has working state, navigation, or store calls (e.g. `app/consent.tsx`), keep them and change only presentation.
> 6. Do not touch the driver app, and do not touch `app/landing.tsx` or `app/walkthrough.tsx` — those are handled separately.
>
> **Work phase by phase. One phase per session.** At the end of each phase: run typecheck and lint, verify on a 390×844 simulator against the matching screenshot, list what you changed and anything that didn't match the spec, then stop and wait for me. Do not begin the next phase on your own.
>
> ### Phase 0 — Foundation (no screens)
> Confirm the theme exports every token the README's colour and type tables reference, and note any gap. Read `GradientSurface` and the home styles and write down, in a scratch file, the exact recipes you will reuse in every later phase: the navy header band (gradient + texture + motif + radius-30 bottom + shadow wrapper split), the white panel, the bottom sheet, the empty/error state column. Change no screens.
>
> ### Phase 1 — Tab bar
> `apps/passenger/app/(tabs)/_layout.tsx`. 60px + safe area, five tabs in the existing order, 24px icons, 11px `labelSm` labels, inactive `colors.inkFaint`, active `colors.accentBlue` with the bold family **and a 22×3 radius-2 marker centred on the item's top edge** (needs a custom `tabBarButton`/`tabBarIcon` wrapper — `screenOptions` alone can't draw it). Pressed = `colors.fill` wash. Badge = `colors.danger` circle, 2px white border, bold 9px numeral, caps at `9+`. Hide the bar on every `app/booking/*` route and on emergency. Screenshot: `06`, first frame.
>
> ### Phase 2 — Auth
> `app/(auth)/login.tsx`, `register.tsx`, `forgot-password.tsx`. Login gets the 186px navy band, the 88px mark tile straddling its edge (must paint above the band), the **Mobile number / Email segmented control**, the `+63`-prefixed number field, focused/error field treatments, OR divider, outline Create account. Register keeps its two steps and progress bar. Include the login error state from screenshot `06` (banner + red field + attempt copy). Screenshots: `01` frames 1–3, `06` frame 2.
>
> ### Phase 3 — Legal & permission gates
> `app/consent.tsx`, `app/location-permission.tsx`, `app/logout.tsx`. Consent gate is a **restyle only** — keep the store call, the disabled-until-checked button, the error slot, the `replace('/(tabs)/home')`-on-confirmed-write, and the absence of back navigation. Copy must come from `src/content/legalCopy.ts` (all three `POLICY_BODY` paragraphs, all four `DISCLOSURES`) — never inline it. Log out is the centred radius-24 modal over `colors.overlay`. Screenshot: `01` frames 4, 6, 8.
>
> ### Phase 4 — Booking flow
> `app/booking/{set-pickup,set-destination,confirm,finding-driver,trip,rate-driver}.tsx`. One sheet language: radius 26 top-only, docked, `0 -14px 36px rgba(0,46,96,.16)`. Map stays the page. Beacon pulse via `Animated.loop`, 1.4s. Tab bar hidden throughout. Screenshot: `03`.
>
> ### Phase 5 — Booking states
> No-drivers-nearby, ride-cancelled, and the emergency screen (`app/booking/emergency.tsx`). The two failure sheets use the neutral `colors.fill` tile, not red — red is only for emergency, destructive confirms, errors, and badges. Wire the search timeout into finding-driver and the driver-cancel path from phase 4. Screenshots: `06` frames 5–6, `01` frame 7.
>
> ### Phase 6 — History
> `app/(tabs)/history.tsx`, `app/history/[id].tsx`, plus the list's **loading skeleton** (four placeholder cards, `#E4E8EC` blocks, 1.4s opacity pulse, rows fading down the list) and **empty state** (dashed panel, motif at 5%, green Request a tricycle). No centred spinners on list screens. Screenshots: `04`, `06` frames 3 and 7.
>
> ### Phase 7 — Payments & complaints
> `app/booking/payment.tsx`, `app/(tabs)/complaints.tsx`, `app/notifications.tsx`. Amount on a navy panel in `typography.amount`; complaints list uses quiet `chip` status pills; notifications group by day with an unread dot. Screenshot: `02` frames 1–3.
>
> ### Phase 8 — Account sub-pages
> `app/profile/{apply-discount,fare-matrix,payment-methods,payment-history}.tsx`, `app/saved-places/manage.tsx`. Fare discount's ID upload is **two stacked landscape slots**, full width, height 130, laid out horizontally — captured slot gets the `accentBlueSoft` fill, `1.5px accentBlue` border and trailing green check; empty slot is white with a `1px dashed` border and a trailing camera glyph. Screenshot: `02` frames 4–8.
>
> ### Phase 9 — Profile & settings
> `app/(tabs)/profile.tsx`, `app/(tabs)/settings.tsx`. Profile keeps the navy band with the avatar breaking below it; settings uses grouped rows with 42px icon tiles and no cards, ending in the `danger`-tinted log out row. Screenshot: `05`.
>
> ### Phase 10 — Offline & polish
> The global connectivity flag and the `#14191D` offline strip (the only element allowed above a header band; persists across tabs, tab bar at 50% opacity), plus the offline empty state. Then a final pass: diff every screen against its screenshot, confirm no stray hex values outside the theme, no `fontWeight`, no shadow-on-clipped-view, and that the whole app still typechecks.
>
> Start with Phase 0 and stop when it's done.

---

## Notes for you (not part of the prompt)

- Phases 1–3 are the riskiest: the tab bar marker needs a custom tab button, and the consent gate must not lose its store logic.
- If a session starts running long, phases 4, 7, and 8 each split cleanly in half by screen.
- Open items the README flags and Claude Code cannot resolve alone: final legal copy, the 3-failure login lock backend rule, and whether the home stats strip has real data.
