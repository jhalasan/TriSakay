# Handoff: TriSakay Driver App — full redesign (LOCKED)

## Overview

Complete visual redesign of the TriSakay **driver** app — the operator side of the tricycle booking system for General Santos City (PSO-supervised pilot). 23 phone frames covering auth & registration, the gates between login and going online, requests and the active trip, earnings/history/ratings, and profile & account.

Target repo: `jhalasan/TriSakay` (branch `main`), an Expo Router / React Native monorepo. Driver app lives at `apps/driver`, shared tokens at `packages/ui/src/theme`.

**Status: locked.** No further design changes are planned. The dashboard (`app/(tabs)/dashboard.tsx`) was locked earlier and lives in `TriSakay Home Final.dc.html` — see `MIGRATION.md`. Splash and dashboard are therefore *not* in the driver prototype; everything else is.

## About the design files

The files here are **design references created in HTML** — prototypes showing intended look, structure, and copy. They are not production code to port.

Recreate them in the existing React Native codebase using its established patterns: `StyleSheet.create` in `apps/driver/src/styles/**`, tokens from `@trisakay/ui` (`colors`, `spacing`, `radius`, `typography`, `elevation`), shared components from `packages/ui/src/components`, driver-local components from `apps/driver/src/components`, Ionicons via `@expo/vector-icons`, Expo Router file routes. Do not introduce a new styling approach or component library.

Two things translate rather than copy:

- **Gradients** — HTML `linear-gradient(...)` → `expo-linear-gradient`, already wrapped by `packages/ui/src/components/GradientSurface`. Use it.
- **Chevron texture** — HTML `repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 2px, transparent 2px 14px)` → the existing texture overlay inside `GradientSurface`. Reuse, don't rebuild.

## Fidelity

**High fidelity.** Final colors, typography, spacing, radii, shadows, and copy. Recreate pixel-for-pixel at 390×844 (iPhone 14 reference).

Every hex in the mocks is an existing token in `packages/ui/src/theme/colors.ts`. If a value in the HTML is not in that file, it is a bug in the mock — report it, do not add a token. Exceptions, both intentional placeholders: the grey/green map art on Active trip and Location permission (`#E7EBE4`, `#E6EBEC`, `#DFE6E3`, `#DEE9D8`) stands in for real map tiles, and `#8D959B` on a disabled button label should become `colors.inkFaint`.

Type is Poppins in four families (400/600/700/800). **Weight lives in the family name, never `fontWeight`** — see the comment block in `packages/ui/src/theme/typography.ts`. `font:700 17px/21px Poppins` maps to `fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 21`.

## The system (identical to the passenger app)

Both apps run on the same four surfaces. Anything the driver app shares with the passenger app is *the same component, restyled with driver content* — not a variant.

1. **Navy header band** — `linear-gradient(135deg, #002E60 → #001A38)`, chevron texture at 5% white, chevron motif watermark at 12% offset top-right, bottom corners radius 30, shadow `0 12px 30px rgba(0,46,96,.22)`. Used on: login and Profile. Status bar sits inside it; content is white.
2. **White panel** — radius 16–18, `0 2px 8px rgba(0,46,96,.07)`, grouped rows divided by `#EBEFF2` hairlines, 34px (info) or 38px (navigation) icon tiles at radius 11–12.
3. **Bottom sheet** — radius 26 top-only, `0 -14px 36px rgba(0,46,96,.16)`, docked over the map. Used by Active trip and Location permission.
4. **Empty / gate state** — 46–64px icon tile, title, one line of plain-language cause, single primary action. Owns the whole screen on the gates (verification pending, suspended); dashed `#DCE2E6` radius-20 panel when it sits inside a populated screen.

Colour discipline: navy = primary action and identity; green = confirmed, positive, earnings, and franchise standing; red = errors, destructive confirms, badges, suspension, and Emergency only. Never more than one green element per screen.

### Shared screens — build these off the passenger implementation

These four are the passenger screens with driver content substituted. Implement by copying the passenger screen's styles and swapping data, **not** by designing again:

| Driver route | Passenger source | What differs |
| --- | --- | --- |
| `app/(tabs)/profile.tsx` | `apps/passenger/app/(tabs)/profile.tsx` | Third info row is **Tricycle** (`GSC-1187 · Body no. 042`); the green card is **Franchise verified** (PSO-cleared, expiry) instead of the discount card; account list is My ratings / Complaints / Settings |
| `app/profile/settings.tsx` | `apps/passenger/app/(tabs)/settings.tsx` | Push-notification sub-label is "New ride requests and trip updates"; version line reads `TriSakay Driver v1.0 · Barangay Poblacion PSO` |
| `app/notifications.tsx` | `apps/passenger/app/notifications.tsx` | Driver items: verification approved, cash confirmed, franchise expiring, complaint closed. Filters are All / Unread / **Trips** |
| `app/logout.tsx` | `apps/passenger/app/logout.tsx` | Identical modal; only the body copy differs (driver string from `packages/shared/src/i18n/en.ts`) |
| `app/complaints.tsx` | `apps/passenger/app/(tabs)/complaints.tsx` | Identical compose form; driver content — related trip names the **passenger**, categories are driver-side (unpaid fare, passenger behaviour, app issue), placeholder asks for the fare due and where the trip ended. Reached from Profile, so it gets a back tile and **no tab bar** (it is not a driver tab) |

Profile anatomy, since it carries the most: full-bleed navy band (eyebrow `ACCOUNT` + `Profile` at 26/32 w800, translucent **Edit** pill), 72px avatar in a `#F6F7F9` pad + `#E9F7E3` 1.5px ring, pulled up `-42` so it breaks the seam, 32px `#477434` camera badge with a 2.5px `#F6F7F9` border. Name 22/28 w700, then one shield-prefixed line: `Verified driver · 4.8 (96 ratings)`. Then the info panel (11px row padding), the green franchise card (radius 18, `0 8px 20px rgba(71,116,52,.26)`), the `ACCOUNT` eyebrow, and the navigation panel. Tab bar visible, Profile active.

## Screens

One HTML section per group; every phone frame carries a `data-screen-label`.

### Group 1 — Auth & registration (6 frames)

| Frame | Route | Notes |
| --- | --- | --- |
| Login | `app/(auth)/login.tsx` | Passenger login exactly — 186px navy band, 88px mark tile straddling the edge, 16px fields, OR divider, outline Create account — plus a **Driver** chip on the band, the one difference that earns its place |
| Register step 1 — account | `app/(auth)/register.tsx` | Step 1 of 2 + progress bar; name, mobile (+63), email, then **password and confirm password full-width and stacked**, each with a reveal icon |
| Register step 2 — documents | `app/(auth)/register.tsx` | Document upload rows (`src/components/DocumentUploadRow`): licence, OR/CR, franchise, barangay clearance — status per row |
| Register step 2 — terms (scrolled) | `app/(auth)/register.tsx` | Scroll area stops at the docked footer's real height (**190px**); the fade clips the disclosure card cleanly; footer is opaque with a `border-top` |
| Forgot password | `app/(auth)/forgot-password.tsx` | Single field + explanation + primary send |
| Reset password | `app/reset-password.tsx` | New + confirm password, both with reveal icons |

Driver legal copy is taken **verbatim** from `apps/driver/src/content/legalCopy.ts` (four driver `DISCLOSURES`, three `POLICY_BODY` paragraphs). It is deliberately *not* the passenger set. Never inline it.

### Group 2 — Gates & account states (5 frames)

| Frame | Route | Notes |
| --- | --- | --- |
| Consent gate | `app/consent.tsx` | Blocking re-acceptance, no back navigation. All three `POLICY_BODY` paragraphs + all four `DISCLOSURES`, scroll clipping + bottom fade, docked footer with the unchecked box, the **store-failure error slot**, and a disabled `Accept & Continue` (`colors.fill` / `inkFaint`). Restyle only — keep the store call and the `replace()`-on-confirmed-write |
| Location permission | `app/location-permission.tsx` | Blurred map ground behind a docked sheet; why-we-need-it copy, Allow / Not now. Driver copy states tracking runs only while online or on a trip |
| Verification pending | `app/verification-pending.tsx` | Owns the screen: motif watermark at 5%, tile, title, expected review window, secondary "Contact PSO" |
| Finish registration (documents unsubmitted) | `app/verification-pending.tsx` | Same route, unsubmitted branch — the only gate with a checklist: which documents are still missing, primary continues the upload |
| Account suspended | `app/account-suspended.tsx` | 64px `dangerSoft` tile, reason, what to do next, PSO contact. The only red gate |

### Group 3 — Requests & active trip (4 frames)

| Frame | Route | Notes |
| --- | --- | --- |
| Ride requests | `app/(tabs)/requests.tsx` | The request card keeps its **dashboard form exactly**: `#E9F7E3` header (payment · seats, fare right), pickup/drop-off on one connector rail, outline Decline + navy-gradient Accept ride. Countdown chip in the section header |
| Ride requests — offline | `app/(tabs)/requests.tsx` | Offline branch: neutral panel, "You're offline", go-online action. Not an error state — no red |
| Active trip | `app/trip/active.tsx` | Map is the page; the docked sheet is the navy textured surface. Passenger row + call/message tiles, stage-advancing primary, SOS entry |
| Emergency | `app/trip/emergency.tsx` | The only red screen: `dangerSoft` ground, motif at 9%, hold-to-call SOS, PSO hotline row |

### Group 4 — Earnings, history & ratings (3 frames)

| Frame | Route | Notes |
| --- | --- | --- |
| Earnings | `app/(tabs)/earnings.tsx` | Tracked total on the navy surface at the dashboard's `amount` scale (40/46 w800) so one number reads first; seven-day bars (`src/components/EarningsBarChart`); settlement log below |
| Trip history | `app/(tabs)/history.tsx` | Rows anchored by fare on the right, status as a quiet `chip` pill — never a full-row colour wash |
| My ratings | `app/ratings.tsx` | Average + distribution bars, then comment rows with date and tags |

### Group 5 — Profile & account (5 frames)

Profile, Settings, Notifications, Complaints, Log out confirm — see **Shared screens** above. Routes: `app/(tabs)/profile.tsx`, `app/profile/settings.tsx`, `app/notifications.tsx`, `app/complaints.tsx`, `app/logout.tsx`.

## Tab bar

`app/(tabs)/_layout.tsx`. Same spec as the passenger bar — height 60 + safe-area inset, `panel` background, `1px lineSoft` top hairline, 24px icons, 11px `labelSm` labels, inactive `colors.inkFaint` `#666F75`, active `colors.accentBlue` `#002E60` with the bold family and a **22×3 radius-2 marker** centred on the item's top edge (needs a custom `tabBarButton`/`tabBarIcon` wrapper). Pressed = `colors.fill` wash.

Five tabs in repo order: **Dashboard** (`speedometer`), **Requests** (`list`), **History** (`time`), **Earnings** (`wallet`), **Profile** (`person`). Hidden on every gate, on `app/trip/*`, and on Emergency.

## Interactions & behavior

- **Register** — two steps in one route; step 2 gates "Create account" on the acceptance checkbox; document upload requires every required row before submit.
- **Consent gate** — disabled until checked; `loading` on press; navigate only on a confirmed write; on failure show the error above the button and re-enable. No back navigation.
- **Verification** — the pending screen polls (or refreshes on focus) and routes to the dashboard once approved; the unsubmitted branch routes back into upload.
- **Requests** — each request runs a countdown (18s in the mock, needs a real timer); Accept transitions to `trip/active`; Decline removes the card and returns to listening. Going offline empties the list.
- **Active trip** — one primary that advances the stage (arrived → start → complete), then cash confirmation, then rate passenger.
- **Log out** — modal over the current screen on `colors.overlay`; confirm clears the session and returns to login.
- **Animation** — the listening pulse and the SOS hold ring are the only continuous animations (1.4s, `Animated.loop`). Everything else uses the repo's `motion` tokens.

## State

- `driverStatus: 'offline' | 'online' | 'on_trip'` — drives requests, dashboard, and the tab set.
- `verificationState: 'unsubmitted' | 'pending' | 'approved' | 'suspended'` — picks the gate.
- `documents` — per-document capture URI + status; submit validity.
- `activeRequest` + countdown deadline.
- `activeTrip` stage.
- `earningsRange` (day/week) for the bar chart.
- `unreadNotifications` for the badge.

## Assets

- `assets/trike-white.png` / `trike-navy.png` — tricycle mark.
- `assets/brand/*` — lockup and mark; the mark fills the 88px login tile.

All other glyphs are Ionicons. The HTML inlines hand-built SVG sprites (`#ic-speed`, `#ic-list`, `#ic-wallet`, …) purely so the prototype runs standalone — **use Ionicons in the app**, matching the names in `_layout.tsx`. Map art in the mocks is grey placeholder blocks; replace with the real map component.

> Note on the screenshots: they are DOM captures, and the prototype's inline SVG sprite does not resolve in them — icon tiles appear as empty rounded squares. Layout, type, colour, and copy are accurate. For icons, open the HTML.

## Out of scope / open items

- **Splash and dashboard** are not here — dashboard is locked in `TriSakay Home Final.dc.html`.
- Not designed: driver chat, complaint detail thread, notification-permission prompt.
- Complaints has no prior-complaints list in the mock (the passenger screen has one); reuse the passenger list treatment with driver copy.
- The request countdown needs a real timer (18s in the mock).
- `POLICY_BODY` / `DISCLOSURES` are placeholder legal copy in the repo; final text replaces them verbatim in `legalCopy.ts`.
- Confirm the franchise expiry date on Profile comes from real data or drop the line.

## Files

- `TriSakay Driver Screens.dc.html` — all 23 frames, five sections, 390×844 each, every frame labelled. **Source of truth.**
- `TriSakay Home Final.dc.html` — the locked dashboard (and passenger home), both states each.
- `screenshots/` — one wide PNG per group: `01-auth-registration`, `02-gates-account-states`, `03-requests-active-trip`, `04-earnings-history-ratings`, `05-profile-account`.
- `MIGRATION.md` — the locked homes' component-by-component anatomy and original token notes.
- `support.js` — runtime for the HTML prototypes; not part of the app.
- `assets/` — brand and tricycle art.
