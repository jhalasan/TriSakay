# Handoff: TriSakay Passenger App — full redesign

## Overview

Complete visual redesign of the TriSakay passenger app — a tricycle booking app for General Santos City (Barangay Dadiangas West pilot, PSO-supervised). 36 screens across onboarding/auth, the booking flow, history, payments, account, plus the tab bar spec and six system states.

Target repo: `jhalasan/TriSakay` (branch `main`), an Expo Router / React Native monorepo. Passenger app lives at `apps/passenger`, shared design tokens at `packages/ui/src/theme`.

## About the design files

The files in this bundle are **design references created in HTML** — prototypes showing intended look, structure, and copy. They are not production code to copy.

The task is to **recreate these designs in the existing React Native codebase**, using its established patterns: `StyleSheet.create` in `apps/passenger/src/styles/**`, tokens imported from `@trisakay/ui` (`colors`, `spacing`, `radius`, `typography`, `elevation`), shared components from `packages/ui/src/components`, Ionicons via `@expo/vector-icons`, and Expo Router file routes. Do not introduce a new styling approach or component library.

Two things translate rather than copy:

- **Gradients** — the HTML uses `linear-gradient(...)`; RN needs `expo-linear-gradient`. The repo already wraps this in `packages/ui/src/components/GradientSurface`. Use it.
- **Chevron texture** — the HTML uses `repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 2px, transparent 2px 14px)`. In RN this is the existing texture overlay used by `GradientSurface` on the home hero; reuse that implementation, don't rebuild it.

Read `MIGRATION.md` in this bundle for the already-locked home screens' anatomy — the passenger home is signed off and shipped, and every screen here is built to sit beside it.

## Fidelity

**High fidelity.** Final colors, typography, spacing, radii, shadows, and copy. Recreate pixel-for-pixel at 390×844 (iPhone 14 reference). Every color in the mocks is an existing token from `packages/ui/src/theme/colors.ts` — if a value in the HTML isn't in that file, it's a bug in the mock, not a new token. Report it instead of adding a token.

Type is Poppins, loaded as four separate families (400/600/700/800). **Weight lives in the family name, never in `fontWeight`** — see the comment block in `packages/ui/src/theme/typography.ts`. The HTML shorthand `font:700 17px/21px Poppins` maps to `fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 21`.

## Design tokens

All from `packages/ui/src/theme`. The HTML hardcodes hex values; map them back to tokens.

### Colors

| Hex | Token | Use in these designs |
| --- | --- | --- |
| `#F6F7F9` | `colors.bg` | Every screen background |
| `#FFFFFF` | `colors.panel` / `white` | Cards, sheets, tab bar, input fills |
| `#14191D` | `colors.ink` | Primary text |
| `#0A0E11` | `colors.inkPressed` | — |
| `#5A646B` | `colors.inkSoft` | Secondary text, eyebrow labels |
| `#666F75` | `colors.inkFaint` | Inactive tab icon + label, fine print, placeholders |
| `#DCE2E6` | `colors.line` | Dividers, dashed empty-state borders, input borders |
| `#838B91` | `colors.lineStrong` | Outline-button borders, unchecked checkbox |
| `#EBEFF2` | `colors.lineSoft` | Row dividers inside white cards, tab bar hairline |
| `#EDF1F4` | `colors.fill` | Segmented-control track, disabled button |
| `#002E60` | `colors.accentBlue` | Primary actions, active tab, header bands, links |
| `#002043` | `colors.accentBluePressed` | Second stop of the navy button gradient |
| `#E3EDF7` | `colors.accentBlueSoft` | 42–46px navy icon tiles, empty-state tiles |
| `#001A38` | `colors.accentBlueDeep` | Deepest stop of hero/header gradients |
| `#477434` | `colors.accentGreen` | Request a Tricycle CTA, discount card, confirmed status |
| `#3B602B` | `colors.accentGreenPressed` | — |
| `#E9F7E3` | `colors.accentGreenSoft` | Avatar ring, positive chips |
| `#B3261E` | `colors.danger` | Emergency, destructive button, error borders/text, badges |
| `#931E17` | `colors.dangerPressed` | Alert glyph inside `dangerSoft` tiles |
| `#FBEAE8` | `colors.dangerSoft` | Error banners, destructive icon tiles |
| `rgba(10,14,17,.58)` | `colors.overlay` | Modal scrim (log out) |

Map-illustration greys (`#E6EBEC`, `#DFE6E3`, `#E0E7E9`, `#DEE9D8`) are **placeholder map art only** — they stand in for the real map tiles and must not become tokens. `#8D959B` on the disabled Accept label and `#7E1913` on error-banner body text are the only two off-token values; substitute `inkFaint` and `dangerPressed` respectively.

### Typography (from `typography.ts`, sizes pass through `moderateScale`)

| Token | Size / line | Family | Used for |
| --- | --- | --- | --- |
| `amount` | 40/46, ls −1.2 | extrabold | Fare due on payment screen |
| `display` | 34/40, ls −0.8 | extrabold | — |
| `h1b` | 28/32, ls −0.7 | extrabold | "History", "Before you ride", greeting name |
| `h1` | 27/33, ls −0.4 | bold | "Welcome back" |
| `h2b` | 22/25, ls −0.3 | bold | System-state titles ("No drivers nearby") |
| `h2` | 20/26, ls −0.2 | bold | "Log out?", section titles |
| `h3b` | 19/25 | bold | — |
| `h3` | 17/23 | semibold | — |
| `body` | 16/24 | regular | — |
| `bodyStrong` | 16/24 | semibold | Row labels |
| `bodyLg` | 15/21 | semibold | Input values, address lines |
| `bodySm` | 14/20 | semibold | Card titles inside white panels |
| `caption` | 13/18 | regular | Body copy, helper text |
| `labelSm` | 11/15 | regular | Tab labels, fine print |
| `labelXs` | 10/14, ls 0.7, upper | bold | Stats-strip labels |
| `eyebrow` | 12/16, ls 0.7, upper | bold | Section eyebrows |
| `label` | 12/16, ls 0.6, upper | bold | Field labels (mock renders these at 11px — use `label`) |
| `button` | 16/20 | bold | Buttons (mock renders the primary at 17px — use `button`) |
| `chip` | 12/16 | semibold | Chips, status pills, inline links |

### Spacing, radius, elevation

Spacing in the mocks resolves to the repo scale: 4 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 22 / 24 / 34 / 44. Screen gutter is 16 (20 on legal screens). Vertical rhythm between blocks is 16.

Radius: inputs and white panels **16**; segmented-control track **14**, its thumb **11**; buttons **14**; cards **16–18**; large cards / hero CTA **20–22**; modal **24**; bottom sheets **26 top-only**; header bands **30 bottom-only**; icon tiles **13 (40px) / 14–15 (46px) / 16 (48px)**; pills fully round.

Shadows (all `shadowColor: colors.accentBlue` unless noted):
- Row/card: `0 2px 8px rgba(0,46,96,.07)`
- Raised card: `0 2px 10px rgba(0,46,96,.08)`
- Header band: `0 12px 30px rgba(0,46,96,.22)`
- Primary button: `0 8px 18px rgba(0,46,96,.26)`
- Bottom sheet: `0 -14px 36px rgba(0,46,96,.16)`
- Modal: `0 24px 60px rgba(0,26,56,.4)`
- Destructive button: `0 6px 16px rgba(179,38,30,.28)`
- Green CTA: `0 8px 20px rgba(71,116,52,.26)`

**Android caveat, already documented in `home.styles.ts`:** never put an elevation shadow on the same view as `overflow:'hidden'` + `borderRadius`. Shadow goes on an outer wrapper (`heroShadowWrap`, `ctaCardShadowWrap` patterns). Every header band and gradient CTA in these designs needs that split.

## The system

Four surfaces carry the whole app:

1. **Navy header band** — `linear-gradient(135deg, #002E60 → #001A38)` (home hero uses 150deg), chevron texture at 5% white, chevron motif watermark at 12% opacity offset top-right, bottom corners radius 30. Used on: home, history, profile, rate driver, trip in progress, login. Status bar sits inside it; content is white.
2. **White panel** — radius 16, `0 2px 8px rgba(0,46,96,.07)`, holds grouped rows divided by `#EBEFF2` hairlines with 38–42px icon tiles.
3. **Bottom sheet** — radius 26 top-only, `0 -14px 36px rgba(0,46,96,.16)`, docked to the bottom over the map. Every booking step and every booking-time system state uses this.
4. **Empty / error state** — 46px icon tile (radius 15), title, one line of plain-language cause, single primary action. Dashed `#DCE2E6` radius-20 panel when it sits inside a populated screen; bare centered column when it owns the screen.

Colour discipline: navy = primary action and identity; green = confirmed, positive, and the Request CTA; red = errors, destructive confirm, badges, and Emergency only. Never more than one green element per screen. The emergency gradient (`#B3261E → #7E1913`) is reserved for the SOS screen and appears nowhere else.

## Screens

Screens are grouped as they appear in `TriSakay Passenger Screens.dc.html`, one HTML section per group, each phone frame carrying a `data-screen-label`.

### Group 1 — Onboarding, auth & safety (8)

| Screen | Route | Notes |
| --- | --- | --- |
| Login | `app/(auth)/login.tsx` | See detail below |
| Register step 1 | `app/(auth)/register.tsx` | Back tile + title, "Step 1 of 2" + progress bar (two 5px segments), fields: full name, mobile (+63 prefix), email, password, confirm; primary "Next" with forward chevron |
| Register step 2 — terms | `app/(auth)/register.tsx` | "Step 2 of 2", version stamp `Terms v1.0 · Privacy v1.0`, all four `DISCLOSURES` in one white panel, pre-checked acceptance row, "Create account" |
| Consent gate | `app/consent.tsx` | Blocking re-acceptance. No back navigation (deliberate — see the comment in `consent.tsx`). All three `POLICY_BODY` paragraphs + all four `DISCLOSURES` in a scroll area with a bottom fade; docked footer holds the unchecked checkbox, the store-failure error slot, and a **disabled** `Accept & Continue` (`colors.fill` bg, `inkFaint` label) |
| Reset password | `app/(auth)/forgot-password.tsx` | Single field + explanation + primary send |
| Location permission | `app/location-permission.tsx` | Map ground behind a docked sheet; "why we need it" copy, allow / not now |
| Emergency | `app/booking/emergency.tsx` | The only red screen: `#B3261E → #7E1913` band, hold-to-call SOS, PSO hotline row, share-trip row |
| Log out | `app/logout.tsx` | `colors.overlay` scrim + radius-24 modal, centered 48px `dangerSoft` tile / title / body, then two equal buttons: outline Cancel + `danger` Log out |

**Login, in full.** Navy band 186px (gradient + texture + motif at top −40 / right −46, 210px, 12%). An 88px white tile, radius 26, `0 10px 26px rgba(0,46,96,.2)`, holds the 54px brand mark and straddles the band's bottom edge with `marginTop: -44` — it must paint **above** the band (RN: render it after the band; web: `position:relative; z-index:2`). Then 20/22 padding, gap 16:
1. Centered `h1` "Welcome back" + `caption` "Log in to book your next ride."
2. Segmented control — `fill` track, radius 14, 4px padding; two flex-1 options min-height 36, radius 11; active is white with `0 2px 6px rgba(0,46,96,.12)` and `chip`-weight navy label; inactive `inkFaint`. Options: **Mobile number** / **Email**. Switching swaps the first field's label, keyboard type, and validation only.
3. Fields, gap 12. `label` above each, 7px gap. Input: white, `1px solid #DCE2E6`, radius 16, padding 14/16. Mobile variant shows a `+63` prefix in `inkSoft` with a 1px right divider and 10px padding. Focused input: `1.5px solid accentBlue` + `0 4px 14px rgba(0,46,96,.1)`. Password shows a 6-dot mask (letter-spacing 3) and an eye toggle in `inkFaint`.
4. Right-aligned `chip`-weight navy "Forgot password?"
5. Primary button, min-height 54, radius 14, navy gradient, `button` label.
6. OR divider — two 1px `line` rules with an uppercase `inkFaint` "OR" between them.
7. Outline "Create account", min-height 52, `1.5px lineStrong`.

### Group 2 — Payment, complaints & account pages (8)

`app/booking/payment.tsx` (amount on a navy panel, `amount` type, method rows, pay button), `app/(tabs)/complaints.tsx` (compose form + prior complaints list with status chips), `app/notifications.tsx` (grouped by day, unread dot), `app/profile/apply-discount.tsx`, `app/profile/fare-matrix.tsx`, `app/profile/payment-methods.tsx`, `app/profile/payment-history.tsx`, `app/saved-places/manage.tsx`.

**Fare discount (`apply-discount`)** deserves a note: green discount card, explanation, three-option category segmented control (Senior / PWD / Student), then **two stacked landscape ID slots** — each full-width, height 130, radius 16, laid out as a horizontal row (34px card glyph, two-line label, trailing status). Front slot when captured: `accentBlueSoft` fill, `1.5px accentBlue` border, 24px green check at the trailing edge. Back slot when empty: white, `1px dashed line`, camera glyph trailing. Copy tells the rider to hold the ID sideways — the slots are landscape because IDs are.

### Group 3 — Booking flow (6)

`app/booking/{set-pickup,set-destination,confirm,finding-driver,trip,rate-driver}.tsx`. Map is the page; everything else is a docked radius-26 sheet. Set pickup/destination: search field + saved-place rows + confirm. Confirm ride: fare on a navy panel with the discount chip, seat count, payment method, primary "Request tricycle". Finding driver: pulsing beacon (`tsPulse` keyframes in the mock — 1.4s scale 0.9→1.9 with opacity fade; RN uses `Animated.loop`), cancel. Trip in progress: the sheet itself becomes the navy textured surface, driver row + call/message tiles, SOS entry. Rate driver: navy band, 5 stars, tags, tip row, submit. **The tab bar is hidden on all six.**

### Group 4 — History (2)

`app/(tabs)/history.tsx` — navy band header, rows anchored by fare on the right, status as a quiet `chip` pill (never a full-row colour wash). `app/history/[id].tsx` — stacked labelled blocks: route timeline, fare breakdown, driver, receipt actions.

### Group 5 — Profile & settings (2)

`app/(tabs)/profile.tsx` — navy band with the avatar breaking below it, then form rows. `app/(tabs)/settings.tsx` — grouped rows with 42px icon tiles, no cards; language, notifications, privacy, help, then a `danger`-tinted log out row.

### Group 6 — Tab bar & system states (7)

**Tab bar** (`app/(tabs)/_layout.tsx`). Height 60 + safe-area bottom inset, `panel` background, `1px lineSoft` top hairline, 4px vertical padding. Five tabs in repo order: Home (`home`), History (`time`), Complaints (`chatbox-ellipses`), Profile (`person`), Settings (`settings-sharp`). Icons 24px. Labels `labelSm` 11px.

- Inactive: icon **and** label `inkFaint` `#666F75` (`tabBarInactiveTintColor: colors.inkFaint` — already correct in the repo).
- Active: `accentBlue` `#002E60`, label switches to the **bold** family, plus a **22×3 marker, radius 2, `accentBlue`**, centered on the item's top edge. The marker is new — implement it as a custom `tabBarIcon` wrapper or `tabBarButton`, since `screenOptions` alone can't draw it.
- Pressed: `#EDF1F4` (`colors.fill`) wash on the item, no colour change.
- Badge: `danger` circle, min-width 16, 2px white border, bold 9px white numeral, top −2 / right −4 of the icon; caps at `9+`.
- Hidden on every booking step and on Emergency.

**System states:**

| State | Where | Anatomy |
| --- | --- | --- |
| Field errors | Login | `dangerSoft` banner (alert glyph + attempt-count copy), errored input gets `1.5px danger` border, 12px `danger` message 6px below the field. Copy names the cause and the consequence: "That password doesn't match this number. 2 tries left before a 5-minute lock." |
| Loading skeleton | History | Header band renders immediately; four card placeholders with `#E4E8EC` blocks, radius 7, pulsing opacity .55→1 over 1.4s, rows fading 100/100/72/45% down the list. Never a centered spinner on a list screen. |
| Offline | Any tab | `#14191D` strip above the header: 8px `#F2B8B5` dot + "No connection — showing your last update". Body is the standard empty-state column (46px `accentBlueSoft` tile, title, cause, Try again) plus a secondary text link to the cached last receipt. Tab bar at 50% opacity. |
| No drivers nearby | Booking | Sheet: neutral `fill` tile (not red — this isn't an error), title, cause with a real reason ("common around 6–7 PM near KCC"), a "notify me when one is free" toggle row, primary "Search again", secondary "Change pickup point". |
| Ride cancelled | Booking | Sheet: close glyph in a `fill` tile, "Ride cancelled", who cancelled and when, a `bg` panel showing ₱0.00 held and the discount preserved (green check), primary "Find another driver", secondary "Report this cancellation". |
| Empty history | History | Dashed `line` radius-20 panel, motif watermark at 5%, `accentBlueSoft` tile, "No rides yet", then a green "Request a tricycle" button — the only green in the state set, because it's the same CTA as home. |

## Interactions & behavior

- **Login** — segmented control switches field label/keyboard/validation; submit disabled until both fields non-empty; failed attempt renders the banner and increments the counter; 3 failures → 5-minute lock (copy already states it, backend rule to confirm).
- **Consent gate** — `Accept & Continue` disabled until checked; on press, `loading` on the button; navigate `replace('/(tabs)/home')` **only** on a confirmed write; on failure show the error above the button and re-enable. No back navigation. Logic already exists in `consent.tsx` — this is a restyle, not a rewrite.
- **Register** — two steps in one route; step 2's checkbox gates "Create account".
- **ID upload** — tapping a slot opens the camera; captured slot switches to the filled treatment with a green check and "Tap to retake"; submit requires both sides.
- **Booking** — each step advances the sheet; "Finding driver" runs the beacon loop and a search timeout that lands on **No drivers nearby**; a driver cancelling lands on **Ride cancelled**.
- **Offline** — the strip is driven by a global connectivity listener and is the only element allowed above the header band; it persists across tabs.
- **Loading** — skeletons on first load only; pull-to-refresh keeps existing rows and shows the platform spinner.
- **Log out** — modal over the current screen, scrim `colors.overlay`; confirm clears the session and returns to login.
- **Animation** — the beacon pulse (1.4s) and the skeleton pulse (1.4s) are the only continuous animations. Everything else uses the repo's `motion` tokens.

## State

Existing stores cover most of this: `useConsentStore` (accept, error), plus the booking/session stores already in `apps/passenger/src/store`. New state this redesign implies:

- `loginMethod: 'mobile' | 'email'` — segmented control.
- `loginAttempts` + lock timestamp — attempt-count copy.
- `isOffline` — global connectivity flag driving the strip and the offline state.
- `idFront` / `idBack` capture URIs + submit validity — discount application.
- Per-list `isLoading` / `isEmpty` — skeleton vs. empty vs. populated.
- `unreadComplaints` — tab badge count.

## Assets

In `assets/`, copied from the repo's `assets/brand`:

- `brand/trisakay-lockup.png` — full lockup (was used on the landing screen)
- `brand/trisakay-mark.png` — mark only; used in the 88px login tile
- `trike-white.png` — white tricycle glyph on green/navy surfaces (Request a Tricycle, walkthrough)
- `trike-navy.png` — navy variant for light surfaces

All other glyphs are Ionicons; the HTML inlines hand-built SVG equivalents (`#ic-home`, `#ic-time`, `#ic-chat`, `#ic-person`, `#ic-settings`, `#ic-card`, `#ic-alert`, …) purely so the prototype runs standalone. **Use Ionicons in the app**, matching the names already in `_layout.tsx`. Map illustrations in the mocks are grey placeholder blocks — replace with the real map component.

## Out of scope / open items

- **Landing and walkthrough** are not in this bundle; they were redesigned separately. Confirm their final versions match this language before shipping.
- Not designed: driver chat/call, complaint detail thread, notification-permission prompt.
- Confirm the home stats strip (trips · discount) comes from real data or drop it — carried over from `MIGRATION.md`.
- `POLICY_BODY` and `DISCLOSURES` are placeholder legal copy in the repo; final text replaces them verbatim and both screens must pick it up from `legalCopy.ts`, never inline.
- The 3-failure login lock needs a backend rule.

## Files

- `screenshots/` — one wide PNG per group, screens left-to-right in the order documented above:
  - `01-onboarding-auth-safety.png` — login, register 1–2, consent gate, reset password, location permission, emergency, log out
  - `02-payments-account-pages.png` — payment, complaints, notifications, fare discount, fare matrix, payment methods, payment history, manage saved places
  - `03-booking-flow.png` — set pickup → set destination → confirm → finding driver → trip → rate driver
  - `04-history.png` — ride history, ride details
  - `05-profile-settings.png` — profile, settings
  - `06-tabbar-system-states.png` — tab bar spec, field errors, loading skeleton, offline, no drivers nearby, ride cancelled, empty history
- `TriSakay Passenger Screens.dc.html` — all 36 screens, six sections. Open in a browser; each phone frame is 390×844 and labelled.
- `TriSakay Home Final.dc.html` — the signed-off home screens (passenger + driver), both states each. Reference for the shared header/CTA/empty-state language.
- `MIGRATION.md` — the locked homes' component-by-component anatomy and the original token notes.
- `support.js` — runtime for the HTML prototypes; not part of the app.
- `assets/` — brand and tricycle art.
