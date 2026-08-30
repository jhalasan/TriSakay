# Handoff: TriSakay Home — Passenger & Driver

## Overview
Redesigned home screens for the TriSakay tricycle-hailing apps: the passenger **Home** tab and the driver **Dashboard** tab. Both keep the existing card-based information architecture and add a stronger brand surface (navy woven texture + chevron motif), a clearer primary action, and a request slot on the driver side that is never empty.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy. The task is to **recreate them in the TriSakay codebase** (`jhalasan/TriSakay`, Expo / React Native monorepo: `apps/passenger`, `apps/driver`, shared `packages/ui`) using its existing theme tokens and components. Do not port the HTML/CSS; translate it into React Native styles via `packages/ui/src/theme`.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii and shadows below are final. Recreate pixel-faithfully with the codebase's existing primitives (`Avatar`, `GradientSurface`, `BrandMotif`, `Card`, `Badge`, `Toggle`, `Button`, `EmptyState`, `StatTile`, `RequestCard`).

Canvas per screen: 390 × 844 (iPhone logical), 52px status-bar inset, 60px tab bar pinned to the bottom.

---

## Screen 1 — Passenger Home
**File:** `apps/passenger/app/(tabs)/home.tsx` (styles: `apps/passenger/src/styles/tabs/home.styles.ts`)
**Purpose:** greet the passenger, get them into a booking in one tap, offer saved destinations.

### Layout
Vertical stack, no scroll needed for the default content:
1. Full-bleed greeting surface (extends under the status bar; bottom corners radius 30).
2. Content column: `padding: 18px 16px 76px`, `gap: 16`.
   - Request a Tricycle card
   - Saved places section
3. Tab bar (Home · History · Complaints · Profile · Settings), 60px, white, 1px `#EBEFF2` top border.

### Components
**Greeting surface**
- Background: linear-gradient 135° `#002E60` → `#001A38`; shadow `0 12px 30px rgba(0,46,96,.22)`.
- Texture overlay: `repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 2px, transparent 2px 14px)` (in RN: pre-rendered PNG or a Skia/SVG pattern).
- Chevron brand motif, 230px, 12% opacity, top `-46` right `-52`.
- Row: `padding: 8px 18px 22px`, `gap: 14`.
  - Avatar: 56px circle, `#E3EDF7` fill, initials Poppins 700/20 `#002043`; double ring — 3px `rgba(255,255,255,.22)` pad, then 2px pad with 1.5px `#E9F7E3` border. Empty state swaps initials for a person icon (26px, `#002043`).
  - Eyebrow: weather icon 14px + "GOOD MORNING" — Poppins 700 11/16, letter-spacing .7, uppercase, `#fff` at 80% opacity. Evening variant uses the moon icon + "GOOD EVENING".
  - Name: Poppins 800 28/32, letter-spacing −.7, `#fff` ("Maria" / "Welcome" when unknown).
  - Subline: Poppins 400 13/18, `#fff` 72% — "Your ride is just a tap away."
  - Bell: 40px circle, `rgba(255,255,255,.16)` fill, 1px `rgba(255,255,255,.3)` border, 20px icon; unread dot 10px `#B3261E` with 2px `#001A38` border, top/right 6.
- Stats strip inside the same surface, 1px `rgba(255,255,255,.14)` top border, two equal cells split by a 1px divider, `padding: 12px 18px 16px`:
  - Label Poppins 700 10/14, letter-spacing .7, uppercase, `#fff` 60%.
  - Value Poppins 700 15/20 — "48" (`#fff`) and "Student 20%" (`#E9F7E3`). Empty state: "0" and "Not set" (`#fff` 70%).

**Request a Tricycle**
- Solid `#477434`, radius 22, `margin-top: -4`, shadow `0 8px 20px rgba(71,116,52,.28)`, same texture overlay at .06 alpha, chevron motif 150px at 14% top `-34` right `-30`.
- Row `padding: 18`, `gap: 14`: 52px circle (`rgba(255,255,255,.2)` fill, `rgba(255,255,255,.28)` border) holding the tricycle mark at 30px wide; title Poppins 700 20/25 letter-spacing −.3 `#fff`; chip "Fares from ₱25" Poppins 600 12/16 on `rgba(255,255,255,.18)` pill (`padding: 2px 8px`) + "· 4 nearby" at 80%; trailing forward arrow 22px.
- Empty-state variant drops the chip for the subline "Book a ride in a few taps" (Poppins 400 13/18, 85%).

**Saved places**
- Header row: "SAVED PLACES" Poppins 700 12/16, letter-spacing .7, uppercase, `#5A646B`; "Manage" Poppins 600 12/16 `#002E60` right-aligned.
- Rows: white, radius 16, `min-height: 70`, `padding: 13px 16px`, `gap: 14`, shadow `0 2px 8px rgba(0,46,96,.07)`, stacked with `gap: 10`.
  - Icon tile 42px radius 12 — Home `#002E60` (white icon), Work `#477434` (white icon), Campus `#E3EDF7` (`#002043` icon), all 20px Ionicons.
  - Title Poppins 600 16/22 `#14191D`; address Poppins 400 13/18 `#5A646B`, single line with ellipsis; chevron 18px `#666F75`.
  - Content: Home / "12 Rizal St, Barangay Poblacion"; Work / "Public Market, Stall 14"; Campus / "National High School, Gate 2".
- **Empty state:** white panel, 1px dashed `#DCE2E6`, radius 18, `padding: 34px 26px`, centered; chevron watermark 160px at 5%; 46px `#E3EDF7` tile radius 14 with a 22px bookmark icon; "No saved places yet" Poppins 600 17/23 `#14191D`; "Places you save will appear here for one-tap booking." Poppins 400 14/20 `#5A646B`.

### Explicitly removed
No destination search field, no Recent/rebook row, no docked bottom CTA — the green card is the only primary action.

---

## Screen 2 — Driver Dashboard
**File:** `apps/driver/app/(tabs)/dashboard.tsx` (styles: `apps/driver/src/styles/tabs/dashboard.styles.ts`)
**Purpose:** show duty state and today's money at a glance, and surface the live request without scrolling.

### Layout
`padding: 12px 16px 76px`, `gap: 16`, above the 60px tab bar (Dashboard · Requests · History · Earnings · Profile):
1. Identity row
2. Duty console (hero)
3. Request slot — incoming request **or** listening panel

### Components
**Identity row** (`gap: 12`)
- 44px `#E3EDF7` circle, initials Poppins 700/16 `#002043` (icon variant when unnamed).
- Name Poppins 600 16/21 `#14191D`; below: 13px shield icon `#477434` + "PSO verified · Body no. 042" Poppins 400 12/16 `#5A646B`.
- Bell tile 44px radius 14 white, shadow `0 2px 8px rgba(0,46,96,.09)`, 21px icon, 9px `#B3261E` dot with 2px white border.

**Duty console — online**
- Radius 22, gradient 150° `#002E60` → `#001A38`, shadow `0 12px 28px rgba(0,46,96,.3)`, texture overlay .05, chevron motif 210px at 12% bottom `-60` right `-46`.
- `padding: 18px 18px 20px`.
- Status row: pulsing dot 10px `#E9F7E3` (scale .9 → 1.9, opacity .55 → 0, 2s ease-out infinite) + "YOU'RE ONLINE" Poppins 700 12/16, letter-spacing .9, uppercase, `#fff`; toggle 56×32 radius 16 `#E9F7E3` with a 26px `#002E60` knob at right.
- "EARNINGS TODAY" Poppins 700 11/15, letter-spacing .9, `#fff` 60%; amount **₱845.00** Poppins 800 40/46, letter-spacing −1.2, `#fff`.
- Meta line above a 1px `rgba(255,255,255,.16)` divider (`margin-top: 14`, `padding-top: 14`, `gap: 14`): 15px icon + Poppins 600 13/18 `#fff` — "12 trips", "4.8" (star `#E9F7E3`), "92% accepted".

**Duty console — offline**
- White card, 1px `#EBEFF2`, radius 22, no texture. Grey 10px dot + "YOU'RE OFFLINE" `#5A646B`; toggle `#DCE2E6` with white knob left. Amount **₱0.00** in `#14191D`; meta "0 trips", "No ratings" in `#5A646B`.
- Primary button inside the card (`margin: 0 18px 18px`): `min-height: 52`, radius 14, gradient 135° `#002E60` → `#002043`, shadow `0 6px 14px rgba(0,46,96,.24)`, power icon 19px + "Go online" Poppins 700 16/20 `#fff`.
- Below the card: info strip `#EDF1F4`, radius 16, `padding: 16`, 20px radio icon `#002E60` + "You won't receive ride requests while offline. Go online to start listening." Poppins 400 13/19 `#5A646B`.

**Incoming request card**
- Section header: "INCOMING REQUEST" Poppins 700 12/16 uppercase `#5A646B` + countdown chip "18s" Poppins 700 11/16 `#B3261E` on `#FBEAE8` pill.
- Card white, radius 20, shadow `0 6px 20px rgba(0,46,96,.14)`.
  - Header band `#E9F7E3`, `padding: 14px 16px`: 18px cash icon + "CASH · 2 SEATS" Poppins 700 12/16 uppercase `#3B602B`; fare "₱45" Poppins 800 22/26 letter-spacing −.6 `#3B602B`.
  - Body `padding: 16`, `gap: 14`: timeline rail (9px `#002E60` ring dot, 2px `#DCE2E6` connector, 9px `#477434` square) beside two stops — label Poppins 400 11/15 uppercase `#666F75` ("Pickup · 400 m away" / "Drop-off"), value Poppins 600 15/21 `#14191D` ("Poblacion Plaza, waiting shed" / "Public Market, Stall 14").
  - Actions row `gap: 12`: Decline — 96px wide, `min-height: 48`, radius 14, 1.5px `#838B91` border, Poppins 600 14/18 `#14191D`; Accept ride — flex 1, radius 14, gradient 135° `#002E60` → `#002043`, shadow `0 6px 14px rgba(0,46,96,.28)`, 20px check icon + Poppins 700 16/20 `#fff`.

**Listening panel** (same slot when no request is live)
- Eyebrow "LISTENING" Poppins 700 12/16 uppercase `#5A646B`.
- White panel radius 24, `padding: 44px 24px`, centered, shadow `0 8px 24px rgba(0,46,96,.1)`; chevron watermark 230px at 4.5%.
- 74px `#E3EDF7` circle with a 32px radio icon `#002E60`, plus a duplicate circle behind it running the same 2.4s pulse.
- "Listening for requests" Poppins 700 19/25 `#14191D`; "You're online near Poblacion. The next ride will appear right here." Poppins 400 14/20 `#5A646B`, max-width 250.

---

## Interactions & Behavior
- **Duty toggle** (driver): switches the hero between the navy online treatment and the white offline card; going offline replaces the request slot with the info strip; going online shows the listening panel until a request arrives. Animate the surface cross-fade ~200ms ease-out; the status dot pulse runs only while online.
- **Request lifecycle**: request arrives → card replaces the listening panel; countdown chip ticks down from 18s (1s interval) and the request expires back to listening at 0. Accept → navigate to the active-trip screen; Decline → back to listening.
- **Passenger CTA**: tap the green card → booking flow. Saved place row → prefilled booking. "Manage" → saved-places management.
- **Pulses**: keyframes `scale(.9) opacity .55` → `scale(1.9) opacity 0` (70% → end holds), ease-out, infinite; 2s on the driver status dot, 2.4s on the listening circle. Respect reduce-motion.
- **Hit targets**: nothing below 44px; the driver Accept/Decline row is 48px.
- **Loading**: earnings/stats render as the empty-state values (₱0.00, "—") until data resolves; do not show spinners inside the hero.

## State Management
Passenger: `user {name, initials, avatar}`, `greeting` (time-of-day), `stats {trips, discountLabel}`, `savedPlaces[]` (empty → dashed empty state), `unreadNotifications`.
Driver: `isOnline`, `earningsToday`, `tripsToday`, `rating`, `acceptanceRate`, `incomingRequest | null` (`{fare, paymentMethod, seats, pickup, pickupDistance, dropoff, expiresAt}`), `countdownSeconds` derived from `expiresAt`, `unreadNotifications`.

## Design Tokens
Colors — navy `#002E60`, navy deep `#002043`, navy ink `#001A38`, green `#477434`, green dark `#3B602B`, mint `#E9F7E3`, sky `#E3EDF7`, app bg `#F6F7F9`, panel bg `#EDF1F4`, hairline `#EBEFF2`, dashed border `#DCE2E6`, text `#14191D`, text muted `#5A646B`, text subtle `#666F75`, outline `#838B91`, danger `#B3261E`, danger bg `#FBEAE8`.
Spacing — 2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 22 · 26 · 34 · 44.
Radius — 11 · 12 · 14 · 16 · 18 · 20 · 22 · 24 · 30 · 999 (pill).
Type (Poppins) — 800 40/46 (amount), 800 28/32 (name), 700 20/25 (CTA), 700 19/25, 600 16/22, 600 15/21, 400 14/20, 400 13/18-19, 700 12/16 uppercase +.7, 700 11/15-16 uppercase +.9, 400 11/15, 700 10/14 uppercase.
Shadows — `0 2px 8px rgba(0,46,96,.07)`, `0 6px 14px rgba(0,46,96,.24-.28)`, `0 6px 20px rgba(0,46,96,.14)`, `0 8px 20px rgba(71,116,52,.28)`, `0 8px 24px rgba(0,46,96,.1)`, `0 12px 28-30px rgba(0,46,96,.22-.3)`.
Texture — `repeating-linear-gradient(135deg, rgba(255,255,255,.05-.07) 0 2px, transparent 2px 14px)`.

## Assets
- `assets/trike-white.png` — tricycle mark, white on transparent, 1674×1162, derived from the client-supplied artwork. Used at 30px wide inside the 52px CTA circle; also at 24–26px in the compact CTAs.
- `assets/trike-navy.png` — same mark in `#002E60` for light surfaces.
- All other icons are **Ionicons** (already a dependency). Chevron brand motif is drawn from the TriSakay logo mark in `packages/ui/src/components/BrandMotif`.
- Type is **Poppins** 400/600/700/800, unchanged from `packages/ui/src/theme`.

## Files
- `TriSakay Home Final.dc.html` — the locked designs: passenger (returning + first run) and driver (incoming request + listening).
- `TriSakay Current Homes.dc.html` — pixel recreation of the current screens, for before/after comparison.
- `TriSakay Home Redesign.dc.html` — full exploration (1a–1f, 2a–2b) if rationale is needed.
- `MIGRATION.md` — condensed spec plus open items.
- `assets/trike-white.png`, `assets/trike-navy.png`.
- `screenshots/` — 2× PNG captures of all four states: `01-passenger-home`, `02-passenger-home-empty`, `03-driver-incoming-request`, `04-driver-listening`.

## Open items
1. Confirm the passenger stats strip is backed by real data (trips count, discount tier) or drop the strip.
2. Request countdown needs a real expiry from the dispatch payload.
3. Decide whether "Manage" on saved places routes to a screen or opens a sheet.
