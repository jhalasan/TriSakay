# TriSakay handoff: trip records, account & safety, ratings

Approved high-fidelity redesign of the passenger and driver screens that weren't covered by the earlier handoffs. It covers 10 screens across both apps, with 21 frames showing their states.

- **Source of truth:** `prototypes/TriSakay Trip Details & Driver Records Redesign.dc.html`. Open it in a browser; it's a pan/zoom canvas with sections 1a–3a.
- **Screens:** `screens/*.png`, 2× captures of each 390×844 frame. Icons drawn with `<use href>` may render **blank** in the PNGs, and a few lines wrap differently than in the browser. **Where they differ, the HTML is correct.** The icon names are listed in each spec.
- **Specs:**
  - `SPEC_1_TRIP_RECORDS.md`: 1a trip details (both apps), 1b driver My documents, 1c driver Complaints
  - `SPEC_2_ACCOUNT_SAFETY.md`: 2a passenger Trip complete, 2b Privacy & Safety + Change password (both apps), 2c Deactivate account, passenger Account suspended, Terms & Privacy
  - `SPEC_3_RATINGS.md`: 3a passenger Rate driver, driver My ratings
- **Prompt:** `CLAUDE_CODE_PROMPT.md`

Repo: `jhalasan/TriSakay` on `main` (Expo Router / React Native monorepo, `@trisakay/ui`, `@trisakay/shared`).

---

## 0. Relationship to earlier handoffs

| Earlier handoff | Status |
|---|---|
| `design_handoff_trisakay_passenger` (Passenger Screens: ride details, rate driver, trip complete, account sub-pages) | **Superseded** for the screens listed in §5. Everything else there still applies. |
| `driver handoff` (Driver Screens: ratings, complaints, profile sub-pages) | **Superseded** for `ratings.tsx`, `complaints.tsx`, `profile/documents.tsx`, `history/[id].tsx`, privacy-safety, change-password. |
| `design_handoff_trisakay_complaints` (passenger complaints 2a) | **Still current.** Driver complaints (1c) reuses its patterns and components. Build shared pieces once. |
| `design_handoff_trisakay_driver_v2` | Still current. Its token table (§ colours) is the base for §3 below. |
| `design_handoff_trisakay_ride_comms` | Still current. The trip SOS FAB there uses the same `HoldToConfirmButton` as the Privacy & Safety SOS (2b). |

---

## 1. Ground rules

1. The HTML is a **reference, not code**. Rebuild in React Native with `StyleSheet.create` in each app's `src/styles/**`, using `@trisakay/ui` tokens and components, Ionicons and Expo Router.
2. **No new colour tokens.** Every hex must map to §3. Unmapped hexes are listed in §3.2; resolve them in Phase 0. Never introduce them silently.
3. **Never set `fontWeight`.** Use `fontFamily.*` (Poppins 400 → `regular`, 600 → `semibold`, 700 → `bold`, 800 → `extrabold`/`black`, whichever exists). If no typography token matches, write a local style with `moderateScale`.
4. Never put a shadow on a view that also has `overflow:'hidden'` + `borderRadius`. Move the shadow to a wrapper. Android uses `elevation`.
5. **Restyle, don't rewrite logic.** Keep every store, service call, guard, redirect and analytics event. The data changes are limited to the ones listed in §4.
6. All copy goes through i18n. Add every new key to **both `en.ts` and `fil.ts`**, and reuse existing keys where the string already exists.
7. Legal copy (Terms & Privacy, deactivate facts) stays **word-for-word** from `legalCopy.ts` / existing i18n. The redesign changes structure only.
8. Touch targets are ≥ 44×44. Every interactive row/tile gets `accessibilityRole` and a label. Star pickers expose `accessibilityValue`.
9. Test at 390×844, 360×640 and 430×932. Nothing clips, and long names/addresses truncate with an ellipsis on one line where the spec says so.

---

## 2. Shared visual system (applies to every screen)

**Canvas.** Screen background `#F6F7F9`. Frame 390 wide. The status-bar spacer in the prototype is 52 px; use the safe-area inset.

**Navy band header** (used on 1a, 1b, 1c home/case, 2a, 2c Terms, 3a):
- `LinearGradient` 135° `#002E60 → #001A38`; bottom corners radius **30**.
- Stripe texture: diagonal 2 px lines, 14 px pitch, white 5%. Reuse the existing `BrandMotif`/`GradientSurface` texture if it has one. Otherwise use a tiled image or skip it (it's decoration).
- Motif mark: 170 px, top −30 / right −34, white at 12% opacity (`BrandMotif`).
- Shadow when the band sits over a list: `0 12 30 rgba(0,46,96,.22)`.
- Back tile on navy: 40×40, radius 13, `rgba(255,255,255,.14)`, back chevron 18 white.

**Plain header** (2b, 2c deactivate, 1c filing): 40×40 white tile radius 13, shadow `0 2 8 rgba(0,46,96,.09)`, icon 18 ink; title 18/24 bold ink, letter-spacing −0.3.

**Overlap card.** On 1a and 2a the first card pulls up into the band: band bottom padding 58–60, card `marginTop: -40…-42`, radius 22, shadow `0 8 24 rgba(0,46,96,.12)`.

**Cards.** White, radius 20 (list cards) / 22 (hero cards) / 18 (small rating/case cards), padding 14–16, shadow `0 2 8 rgba(0,46,96,.07)`. Row separators `1px #EBEFF2`.

**Section label.** 11/15 bold, uppercase, letter-spacing 0.7, `#5A646B`, 8 px above its card.

**Icon tile.** Rounded square with an icon centred: 32–40 px, radius ≈ size/3.2. Tint pairs:
- navy: bg `#E3EDF7`, icon `#002043`
- green: bg `#E9F7E3`, icon `#3B602B`
- red: bg `#FBEAE8`, icon `#931E17`
- neutral: bg `#EDF1F4`, icon `#5A646B`

**Status pill.** 11/16 bold, radius 999, padding 3–4 × 10–11:
- Completed / Done / Paid / Closed: green pair
- Cancelled: red pair
- Under review / Soon: navy pair

**Route rail.** 14 wide. Pickup dot 12 `#477434` with 4 px `#E9F7E3` ring; dashed 2 px line `#9FB0BD` (4 on / 4 off); drop-off 12 square radius 3 `#002E60` with 4 px `#E3EDF7` ring.

**Plate / body tag.** Monospace 11.5/16 bold, letter-spacing 0.6, ink text, 1.5 px ink border, radius 6, padding 1×7.

**Bottom action bar.** Absolute bottom, white, top border `#EBEFF2`, padding 12 / 16 / 26 (+ safe area).
- Primary button: min-height 54 (52 in two-button bars), radius 14, gradient `#002E60 → #002043`, 17/21 bold white, shadow `0 8 18 rgba(0,46,96,.26)`.
- Disabled: `#DCE2E6` fill, `#666F75` text, no shadow.
- Danger: gradient `#C62E24 → #931E17`, shadow `rgba(179,38,30,.26)`.
- Text button: min-height 40–48, 14–15 semibold `#5A646B` (or `#002E60` for "Keep my account").

**Selectable tile** (rating tags, complaint categories):
- Default: white, 1 px `#DCE2E6`, radius 16, padding 12, 32–34 icon tile + 13/17 semibold label.
- Selected: 1.5 px accent border, shadow `0 4 14 (accent @ .10–.14)`, 20 px check badge (accent fill, 2 px `#F6F7F9` ring, 10 px white check) at top −6 / right −6, icon tile switches to the accent pair.
- Accent is **green** for positive rating tags, **red** for negative tags, **navy** for complaint categories.

**Focused input.** 1.5 px `#002E60` border + shadow `0 4 14 rgba(0,46,96,.1)`. Resting: 1 px `#DCE2E6`. Radius 16, padding 13×14.

---

## 3. Colour map

### 3.1 Known tokens (from driver v2 / ride-comms)

| Hex | Token | Used for here |
|---|---|---|
| `#002E60` | `colors.accentBlue` | primary, selected borders, link text, drop-off square, progress fill |
| `#002043` | `colors.accentBluePressed` | gradient end, navy icon glyphs, initials |
| `#001A38` | `colors.accentBlueDeep` | navy band gradient end |
| `#E3EDF7` | `colors.accentBlueSoft` | navy icon tiles, avatars, "Not available yet" card |
| `#477434` | `colors.accentGreen` | stars (4–5), pickup dot, valid shield, done progress |
| `#3B602B` | `colors.accentGreenPressed` | green text/icons, "Excellent" |
| `#E9F7E3` | `colors.accentGreenSoft` | green tiles/pills, valid-date preview |
| `#B3261E` | `colors.danger` | low-score stars, negative tag border, suspended lock |
| `#FBEAE8` | `colors.dangerSoft` | red tiles/pills, report card, SOS outer disc |
| `#14191D` | `colors.ink` | primary text |
| `#5A646B` | `colors.inkSoft` | secondary text, icons, labels |
| `#666F75` | `colors.inkFaint` | captions, dates, disabled text |
| `#DCE2E6` | `colors.line` | resting borders, empty stars (rate page), disabled fill |
| `#EBEFF2` | `colors.lineSoft` | separators |
| `#EDF1F4` | `colors.fill` | neutral tiles, tag chips |
| `#F6F7F9` | `colors.bg` | screen bg, inner receipt row |
| `#FFFFFF` | `colors.white` | cards, sheets |
| `rgba(10,14,17,.58)` | `colors.overlay` | sheet scrim (prototype shows `.5`; use the token) |

### 3.2 Hexes to resolve in Phase 0

Check `packages/ui/src/theme/colors.ts` for each one. If there's no token, **stop and propose** a mapping to the nearest token, or a named local constant in the screen's styles file. Don't add theme tokens without approval.

| Hex | Where | Suggested nearest |
|---|---|---|
| `#931E17` | red text/glyphs, danger gradient end | `colors.dangerPressed` if it exists |
| `#C62E24` | danger gradient start (SOS, Deactivate) | `colors.danger` |
| `#F2C4BF` | SOS ring track, expired-card border | `dangerSoft` darker; maybe `dangerLine` |
| `#FDF4F3`, `#F7DAD6` | expired-card footer strip bg / top border | `dangerSoft` / `lineSoft` |
| `#8BC873` | on-navy green (rating bars, header stars, valid segment) | on-dark green token if one exists |
| `#E0675E` | on-navy red (1★ bar, expired segment) | on-dark red |
| `#7FB2E5` | on-navy blue (expiring segment) | on-dark blue |
| `#B9E3A6` | on-navy "20% discount applied" | on-dark green light |
| `#FFF6E0`, `#E9C46A`, `#F7E2A8`, `#7A5A00`, `#4A3B0F` | amber fare-flagged card (bg, border, icon tile, icon, body text) | `warning*` family if it exists; else propose |
| `#9FB0BD` | dashed route line | `lineStrong` `#838B91` acceptable |
| `#9FB9D4` | dashed "Add a comment" / photo border | `accentBlue` @ 40% or `lineStrong` |
| `#C9D2D9` | empty stars on Trip complete | `colors.line` (use the same as the rate page) |
| `#9AA3A9` | input placeholder | `colors.inkFaint` |

---

## 4. Data & behaviour changes (the complete list)

Everything else must come from data that already exists. If you find a value doesn't exist, report it. Don't fetch new data unasked.

| # | Change | Screen | Notes |
|---|---|---|---|
| D1 | `useRatingsStore` (driver) selects the existing `tags` column | 3a driver | Read-only, and the column already exists. Tag counts are computed client-side over the loaded page (≤ 50). |
| D2 | Pass the tags submitted on rate-driver via the existing `RATING_TAGS` enum | 3a passenger | Same enum, filtered by score. **No new tag values.** |
| D3 | Drop-off time = `date + durationMinutes` | 1a | Derived, not stored. Hide it if `durationMinutes` is null. |
| D4 | "Ended near" location for the fare-flagged card | 2a | Needs the ride's end location/address. **Check in Phase 0.** If it isn't stored, show "Booked" only and keep the body copy. |
| D5 | Book this route again → booking flow with pickup + destination prefilled | 1a passenger | Check whether `set-pickup` / `confirm` accepts params. If not, propose the smallest change. |
| D6 | Driver complaint case page, new route `apps/driver/app/complaints/[id].tsx` | 1c | Reads the same complaints store row. No schema change. |
| D7 | Low-score report CTAs link with prefill: `/complaints/new?rideRequestId=…` (passenger), driver equivalent with `category=low_rating` | 3a | Check the current complaints route/param names. Passenger complaints 2a may already accept them. |
| D8 | Deactivate becomes a route (`deactivate-account.tsx`) instead of an Alert | 2c | Same service call. |
| D9 | SOS: hold-to-send replaces the confirm Alert | 2b | Same SOS service. Uses `HoldToConfirmButton` (2 s). See `SPEC_2 §2b`. |
| D10 | Date picker for document expiry | 1b | Use the native picker (`@react-native-community/datetimepicker` if installed; iOS `display="spinner"` in a bottom sheet, Android the dialog). **Don't add a dependency without asking.** |

---

## 5. Screen index

| ID | Screen | App · file | PNGs |
|---|---|---|---|
| 1a | Ride details | passenger · `app/history/[id].tsx` | `1a-1` completed + discount, `1a-2` cancelled |
| 1a | Trip details | driver · `app/history/[id].tsx` | `1a-3` done, `1a-4` cancelled |
| 1b | My documents | driver · `app/profile/documents.tsx` | `1b-1` overview, `1b-2` date sheet |
| 1c | Complaints | driver · `app/complaints.tsx` (+ new `complaints/[id].tsx`) | `1c-1` home, `1c-2` step 1, `1c-3` step 2, `1c-4` case |
| 2a | Trip complete | passenger · `app/booking/trip-complete.tsx` | `2a-1` normal, `2a-2` fare flagged |
| 2b | Privacy & Safety | both · `app/profile/privacy-safety.tsx` | `2b-1` idle, `2b-2` sent (+ failed variant) |
| 2b | Change password | both · `app/profile/change-password.tsx` | `2b-3` |
| 2c | Deactivate account | passenger · `app/deactivate-account.tsx` | `2c-1` |
| 2c | Account suspended | passenger · `app/account-suspended.tsx` | `2c-2` |
| 2c | Terms & Privacy | passenger · `app/profile/legal.tsx` (driver equivalent if present) | `2c-3` |
| 3a | Rate driver | passenger · `app/booking/rate-driver.tsx` | `3a-1` empty, `3a-2` 5★, `3a-3` 2★ |
| 3a | My ratings | driver · `app/ratings.tsx` | `3a-4` |

File paths are from the last repo read. Confirm them in Phase 0; if a file has moved, use the real path and tell me.

---

## 6. Proposed shared components

Build these once in `packages/ui` (or the app's `src/components` if only one app uses it) and export them:

- `NavyBandHeader`: gradient + texture + motif + back tile + title + optional right slot + children, with a `overlapBottom` prop that adds the 58 px bottom padding.
- `RouteRail`: pickup/drop-off rows with optional label, time and the dashed rail. Also has a compact variant for complaint step 1: 8 px dots and a solid `#DCE2E6` line.
- `StatCells`: 2- or 3-column grid of value + caption with hairline dividers.
- `IconTile`: `size`, `tone: 'navy'|'green'|'red'|'neutral'`, `icon`.
- `StatusPill`: `tone`, `label`.
- `SelectTile`: icon + label, `selected`, `accent: 'green'|'red'|'navy'`, check badge.
- `StarPicker`: 5 × `size` (44 on the rate page, 36 on trip complete), colour by score, a word label under it, and `accessibilityValue`.
- `CollapsibleRow`: row with a chevron that rotates 180° and reveals children. Supports single-open groups (`AccordionGroup`).
- `ProgressSegments`: n equal 5–6 px bars with a gap of 4, each coloured.
- `HoldToConfirmButton`: **already exists** (changed in the ride-comms merge). Reuse it and add a `variant="disc"` for 2b if needed.

If the passenger complaints (2a) work already built equivalents (category tile, 3-step case bar, subject chips, photo slot), **reuse them**. Don't duplicate them.

---

## 7. i18n

Every visible string in the specs is English source copy. Add keys under the existing namespaces (`history.*`, `tripComplete.*`, `rating.*`, `driver.ratings.*`, `driver.documents.*`, `driver.complaints.*`, `privacySafety.*`, `changePassword.*`, `deactivateAccount.*`, `accountSuspended.*`, `legal.*`), and write a Filipino translation for each in `fil.ts`. Use plural-aware helpers for counts ("1 seat / 2 seats", "Expires in 1 day / 14 days", "2 need attention").

Relative-date copy for documents (1b), with the threshold kept at **30 days**:
- `expired` → "Expired {n} days ago · {date}" ("Expired today" when n = 0)
- `expiring` (≤ 30 days) → "Expires in {n} days · {date}"
- `valid` → "Valid until {date}"
- `unset` → "No expiry date set"
