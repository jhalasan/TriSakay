# Claude Code prompt — TriSakay driver redesign

Copy the block below into Claude Code from the repo root, with this handoff folder available (e.g. `driver handoff/` inside the repo, or pass its path).

Each phase is one session. Do not start a phase until the previous one is committed and runs on device.

Run this **after** the passenger redesign — phases 1, 6 and 7 reuse passenger screens directly.

---

## The prompt

> You are implementing a completed, locked high-fidelity redesign of the TriSakay **driver** app in this Expo Router / React Native monorepo.
>
> **Read first, before writing any code:**
>
> - `driver handoff/README.md` — the full spec: system, token rules, per-screen anatomy, interactions, state.
> - `driver handoff/screenshots/` — one wide PNG per screen group. Icon tiles render empty in these captures; open the HTML when you need an icon.
> - `driver handoff/TriSakay Driver Screens.dc.html` — the source prototype, 390×844 per frame, each labelled with `data-screen-label`. Open it in a browser whenever a measurement is ambiguous.
> - `driver handoff/MIGRATION.md` — the already-locked driver dashboard's anatomy. Every screen here sits beside it.
> - `packages/ui/src/theme/*` — every colour, type style, space, radius, and shadow you may use.
> - `apps/driver/src/styles/tabs/dashboard.styles.ts` — the reference for how a redesigned driver screen's styles are written here, including the Android shadow caveats in its comments.
> - The passenger implementations of profile, settings, notifications, and logout — the driver versions are those screens with driver content, not new designs.
>
> **Hard rules for every phase:**
>
> 1. The HTML is a **reference, not code to port**. Recreate each screen in React Native with this repo's patterns: `StyleSheet.create` in `apps/driver/src/styles/**`, tokens from `@trisakay/ui`, components from `packages/ui/src/components` and `apps/driver/src/components`, Ionicons from `@expo/vector-icons`, Expo Router file routes.
> 2. **No new design tokens.** Every hex in the mock already exists in `packages/ui/src/theme/colors.ts`. If one doesn't, stop and report it. The only allowed exceptions are the placeholder map greys and `#8D959B` (use `colors.inkFaint`).
> 3. **Never set `fontWeight`.** Weight lives in the family name (`fontFamily.regular/semibold/bold/extrabold`).
> 4. Gradients use `expo-linear-gradient` via the existing `GradientSurface`. Never put an elevation shadow on the same view as `overflow:'hidden'` + `borderRadius` — shadow goes on an outer wrapper.
> 5. **Restyle, don't rewrite logic.** Where a screen already has working state, navigation, or store calls (`app/consent.tsx`, `app/verification-pending.tsx`, the request accept/decline path), keep them and change only presentation.
> 6. Legal copy comes from `apps/driver/src/content/legalCopy.ts` verbatim — the **driver** set, never the passenger set, never inlined.
> 7. Do not touch the passenger app, and do not touch `apps/driver/app/(tabs)/dashboard.tsx` or the splash — both are already locked and shipped.
>
> **Work phase by phase. One phase per session.** At the end of each phase: run typecheck and lint, verify on a 390×844 simulator against the matching screenshot, list what you changed and anything that didn't match the spec, then stop and wait for me. Do not begin the next phase on your own.
>
> ### Phase 0 — Foundation (no screens)
> Confirm the theme exports every token the README references, and note any gap. Read `GradientSurface`, the dashboard styles, and the passenger profile/settings implementations, then write down in a scratch file the exact recipes you will reuse: navy header band (gradient + texture + motif + radius-30 bottom + shadow wrapper split), white panel with 34/38px tiles, docked sheet, gate/empty state column. Change no screens.
>
> ### Phase 1 — Tab bar
> `apps/driver/app/(tabs)/_layout.tsx`. Five tabs in existing order — Dashboard, Requests, History, Earnings, Profile — 60px + safe area, 24px icons, 11px `labelSm`, inactive `colors.inkFaint`, active `colors.accentBlue` with the bold family **and the 22×3 radius-2 marker on the item's top edge** (custom `tabBarButton`/`tabBarIcon`; `screenOptions` alone can't draw it). Pressed = `colors.fill`. Hidden on gates, `app/trip/*`, and emergency. Mirror the passenger implementation if it already exists.
>
> ### Phase 2 — Auth & registration
> `app/(auth)/{login,register,forgot-password}.tsx`, `app/reset-password.tsx`, and `src/components/DocumentUploadRow`. Login is the passenger login plus the **Driver chip** on the band. Register step 1 puts **password and confirm password full-width and stacked**, each with a reveal icon. Step 2 has the document rows and the terms view whose scroll area stops at the docked footer's real height (**190px**) with the fade clipping the disclosure card — the footer is opaque with a `border-top`. Screenshot: `01`.
>
> ### Phase 3 — Gates & account states
> `app/consent.tsx`, `app/location-permission.tsx`, `app/verification-pending.tsx` (both branches — pending and documents-unsubmitted), `app/account-suspended.tsx`. Consent is a **restyle only**: keep the store call, disabled-until-checked, the store-failure error slot above the button, the navigate-on-confirmed-write, and the absence of back navigation. Suspension is the only red gate. Screenshot: `02`.
>
> ### Phase 4 — Requests
> `app/(tabs)/requests.tsx`, online and offline branches. The request card keeps the dashboard's form exactly (green payment header, connector rail, outline Decline + navy Accept) — extract it to a shared component if the dashboard hasn't already. Wire the per-request countdown to a real timer and the offline branch to `driverStatus`. Offline is neutral, not red. Screenshot: `03` frames 1–2.
>
> ### Phase 5 — Active trip & emergency
> `app/trip/active.tsx`, `app/trip/emergency.tsx`. Map is the page; the sheet is the navy textured surface, radius 26 top-only. One primary advances the stage (arrived → start → complete → cash confirmed). Emergency is the only red screen; the hold-to-call ring is one of the two allowed continuous animations. Tab bar hidden on both. Screenshot: `03` frames 3–4.
>
> ### Phase 6 — Earnings, history & ratings
> `app/(tabs)/earnings.tsx`, `app/(tabs)/history.tsx`, `app/ratings.tsx`, plus `src/components/EarningsBarChart`. Earnings leads with the tracked total on the navy surface at `typography.amount`; history rows are fare-anchored with quiet `chip` status pills; ratings shows the average, distribution bars, and comment rows. Screenshot: `04`.
>
> ### Phase 7 — Profile & account (shared screens)
> `app/(tabs)/profile.tsx`, `app/profile/settings.tsx`, `app/notifications.tsx`, `app/complaints.tsx`, `app/logout.tsx`. **Build these from the passenger implementations** — same band, avatar-breaking-the-seam, panels, toggles, notification cards and modal — swapping only content: Tricycle row, green **Franchise verified** card in place of the discount card, driver notification items, All/Unread/Trips filters, driver logout copy, driver version line, and driver complaint categories (complaints keeps the passenger compose form but is pushed from Profile, so it has a back tile and no tab bar). Any structural difference you find between the two is a bug; report it rather than diverging. Screenshot: `05`.
>
> ### Phase 8 — Polish
> Diff every screen against its screenshot at 390×844. Confirm: no stray hex outside the theme, no `fontWeight`, no shadow-on-clipped-view, gates unreachable once approved, tab bar hidden exactly where specified, and the app typechecks and lints clean.
>
> Start with Phase 0 and stop when it's done.

---

## Notes for you (not part of the prompt)

- Phase 3 is the riskiest: `consent.tsx` and `verification-pending.tsx` both carry real logic that must survive the restyle.
- Phase 7 should be fast if the passenger app is already done; if it isn't, run phase 7 last.
- Open items Claude Code cannot resolve alone: final legal copy, the real countdown duration, whether the franchise expiry on Profile has real data, and the driver complaint category list.
