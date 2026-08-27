# Handoff: TriSakay passenger first-run flow

## Overview

Redesign of the passenger app's pre-login flow: **splash → walkthrough 01–03 → landing**. It replaces the current navy-gradient screens (icon-in-a-glass-circle illustrations, centred copy, white logo plate) with a map-ground illustration system and a white copy sheet.

Target: `apps/passenger` in the `jhalasan/TriSakay` monorepo (Expo Router + React Native, `packages/ui` design tokens).

Files this replaces:

| Screen | Existing files |
|---|---|
| Splash | `apps/passenger/app/splash.tsx`, `src/styles/splash.styles.ts` |
| Walkthrough | `apps/passenger/app/walkthrough.tsx`, `src/styles/walkthrough.styles.ts`, `src/constants/walkthrough.ts` |
| Landing | `apps/passenger/app/landing.tsx`, `src/styles/landing.styles.ts` |

## About the design files

The files in this bundle are **design references authored in HTML** — prototypes showing intended look and motion. They are not production code to copy. The task is to **recreate them in the existing React Native / Expo codebase**, using its established patterns: `packages/ui` theme tokens, the `Button` component, `moderateScale` from `packages/ui/src/theme/scale.ts`, Expo Router navigation, and Ionicons via `@expo/vector-icons`.

Everything in the HTML is expressed at the **375 × 812 baseline canvas** — the same baseline `moderateScale` is calibrated against, so every px value below can be passed through `moderateScale()` unchanged.

## Fidelity

**High-fidelity.** Final colors, typography, spacing and motion timings. Recreate pixel-for-pixel using existing tokens. Two things cannot port literally and are called out in "Porting notes" at the end.

---

## Design tokens

All already exist in `packages/ui/src/theme` — no new tokens except one noted below.

**Colors**

| Token | Hex | Use in this flow |
|---|---|---|
| `navy` | `#002E60` | primary CTA gradient start, pickup pin, headings on dark, wordmark |
| `navyDeep` | `#002043` | primary CTA gradient end |
| `accentGreen` | `#477434` | route line, drop-off pin, headline accent span, PSO dot |
| `accentGreenDark` | `#3B602B` | text on green-tint chips |
| `greenTint` | `#E9F7E3` | chip backgrounds |
| `bg` | `#F6F7F9` | landing surface |
| `surface` | `#FFFFFF` | copy sheet, cards, chips |
| `textPrimary` | `#14191D` | display + card text |
| `textSecondary` | `#5A646B` | body copy, step counter |
| `textTertiary` | `#666F75` | "Where to?" placeholder |
| `line` | `#DCE2E6` | map grid lines, inactive dots |
| `lineSoft` | `#EBEFF2` | card divider rows |
| `lineStrong` | `#838B91` | secondary button border |

**New values used by the map illustration** (add to the theme as a small `map` group):

| Name | Hex | Use |
|---|---|---|
| `map.ground` | `#EDF1F4` | illustration background |
| `map.grid` | `#DCE2E6` | 38px grid lines (same as `line`) |
| `map.road` | `#E3EDF7` | road bands, avatar circle fill |

`#5EA746` (raw logo green) appears once, on the chevron inside the step-03 navy badge. It is the logo's own green, not `accentGreen`.

**Typography** — Poppins throughout (already loaded).

| Role | Size / line-height | Weight | Tracking |
|---|---|---|---|
| Display (walkthrough headline) | 34 / 40 | 800 | −0.8 |
| Display (landing headline) | 36 / 42 | 800 | −1.1 |
| Fare figure | 40 / 46 | 800 | −1.2 |
| Body | 16 / 24 | 400 | 0 |
| Button label | 16 / 20 | 700 | 0 |
| Card title | 16 / 24 | 600 | 0 |
| Step counter / card eyebrow | 12 / 16 | 700 | +0.6, uppercase |
| Chip label | 11–12 / 16 | 600 | 0 |
| Card row text | 13 / 18 | 400 | 0 |

**Radius** `12` buttons · `16` inner cards · `20` splash card · `28` sheet top corners · `999` pills
**Shadows** CTA `0 4 10 rgba(0,46,96,.22)` · card `0 14 40 rgba(0,46,96,.16)` · floating card `0 16 40 rgba(0,46,96,.18)` · chip `0 4 12 rgba(0,46,96,.14)` · sheet `0 −10 30 rgba(0,46,96,.08)` · pin `0 4 10 rgba(0,46,96,.24)`
**Min touch target** 44 (Skip) · **min button height** 52

---

## The map illustration system

Every illustration in the flow is built from the same five primitives — no stock icons, no `BrandMotif` watermark. Build this once as `src/components/MapGround.tsx` and compose per screen.

1. **Ground** — fill `#EDF1F4`.
2. **Grid** — 38 × 38 lines, 1px, `#DCE2E6`. In RN: a repeating `ImageBackground`/SVG `<Pattern>`, or two loops of absolutely-positioned 1px `View`s.
3. **Road bands** — `#E3EDF7` rectangles: one vertical (20 wide), one or two horizontal (26 and 14 tall). They are the alignment armature: **the route's legs must run down the centreline of their band** (within ~2px). This was the single most common defect while designing — check it after any repositioning.
4. **Route** — `#477434` stroke, width 6, round caps, right-angle path.
5. **Pins** — 30 × 30 `View`, `borderRadius: '50% 50% 50% 0'` equivalent (in RN: `borderTopLeftRadius/TopRight/BottomLeft = 15`, `borderBottomRightRadius: 0`) rotated `-45deg`, with a centred 10px white dot. Navy = pickup/origin, green = drop-off/destination.

Optional **label chips**: white pill, `padding: 5px 11px`, 11/16 weight 600, centred on its pin's x-centre.

---

## Screens

### 1 · Splash

**Purpose** — brand moment while the app boots and decides where to route.

**Layout** — full-bleed map ground, content centred both axes.

- Vertical road band: `left: 96`, width 16. Horizontal bands: `top: 236` (h 22) and `bottom: 198` (h 14).
- Route path `M 104 700 L 104 246 L 300 246`.
- Navy pin at `(90, 686)`; green pin at `(286, 231)` — sits on the route's end point.
- **Lockup card** — white, radius 20, padding `28 32`, shadow `0 14 40 rgba(0,46,96,.16)`. Contains `trisakay-lockup.png` at 196 × 110 (`object-fit: contain`) and, 12px below, "Book a tricycle, hassle-free" in body/`textSecondary`.
- **Loading bar** — `bottom: 64`, 120 × 3, radius 999, track `#DCE2E6`, indicator `#477434`.

**Copy** — "Book a tricycle, hassle-free" (unchanged from current build).

### 2 · Walkthrough (three steps)

Shared structure — this is the core change:

```
┌──────────────────────────────┐
│ map band · height 516        │  full-bleed, overflow hidden
│  ├ 44 status spacer          │
│  ├ counter row (Step nn / Skip)  padding 8 24 0, z 2
│  └ illustration area (flex 1)│
├──────────────────────────────┤
│ white sheet · flex 1         │  marginTop −28, radius top 28,
│  padding 26 24 0             │  shadow 0 −10 30 rgba(0,46,96,.08)
│  ├ headline 34/40 w800       │
│  ├ body 16/24                │
│  ├ CTA row (marginTop auto,  │
│  │   paddingBottom 14)       │
│  └ dot row (paddingBottom 22)│
├──────────────────────────────┤
│ 34 home-indicator spacer     │
└──────────────────────────────┘
```

- Sheet box computes to **290px** (812 − 516 − 34 + 28). The tallest slide's content is 284px — keep the band at 516 or the `marginTop: auto` on the CTA row collapses and the dots drift.
- **Counter** — "Step 01 &nbsp;of&nbsp; 03", 12/16 weight 700, +0.6 tracking, uppercase, `textSecondary`. Sits on the map, not the sheet.
- **Skip** — 14/18 weight 600, `navy`, min-height 44. Hidden on step 03 (rendered transparent to preserve layout).
- **Dots** — inside the sheet, centred, gap 8. Active `22 × 8` navy pill; inactive `8 × 8` `#DCE2E6`.
- **CTA** — `flex: 1` in its row, min-height 52, radius 12, navy gradient `135deg #002E60 → #002043`. "Next" on 01–02, "Get Started" on 03. Use the existing `Button` primary variant.

**Step 01 — "Book a ride / in seconds"**
Body: "Set your pickup and drop-off. A nearby verified driver is on the way."
Illustration: vertical band `left: 104` w20; horizontal bands `top: 206` (h26) and `bottom: 100` (h14). Route `M 114 303 L 114 122 L 292 122`. Navy pin `(100, 289)` with **Pickup** chip at `(84, 334)`; green pin `(278, 108)` with **Drop-off** chip at `(258, 72)`. A white **"Where to?"** search bar pinned `top: 0, left/right: 24`, radius 12, padding `13 14`, shadow `0 8 22 rgba(0,46,96,.14)`, `search` Ionicon 19px + 15/22 placeholder.

**Step 02 — "Know the fare / before you go"**
Body: "Pricing follows the approved fare matrix, broken down in full before you confirm. No haggling."
Illustration: bands `top: 120` (h26), `bottom: 80` (h14). Centred white card, width 232, radius 16, padding 22, shadow `0 10 28 rgba(0,46,96,.16)`: eyebrow "ESTIMATED FARE" → **₱ 25.00** at 40/46 w800 navy → two skeleton rows (8px-tall `#EBEFF2` pills, `space-between`) → green chip "Approved fare matrix" with `checkmark-circle` 16px.
*Use the real fare-matrix base + per-km values from the fare service rather than hardcoding 25.00 if they're available at this point in the app.*

**Step 03 — "Every driver, / verified"**
Body: "Checked by the PSO before they can accept a ride. Track your trip in real time, pickup to drop-off."
Illustration: three concentric rings, centred — outer 286 dashed `1px rgba(0,46,96,.18)` at `(45, 31)`; middle 212 fill `rgba(0,46,96,.05)` inset 37; inner 186 fill `rgba(0,46,96,.06)` inset 13. Inside: 128px navy circle, shadow `0 12 30 rgba(0,46,96,.28)`, holding the 76px brand mark (white arc + `#5EA746` chevron). Below the stack, a white **PSO verified** chip (8px green dot + 12/16 label) — keep ≥28px of clearance above the sheet.

### 3 · Landing

**Purpose** — choose sign-up or sign-in.

**Layout** — `bg` surface, no map ground.

- Faint brand motif, 480px, at `top: −100, right: −160` — arc `#002E60` @ 6%, chevron `#477434` @ 16%.
- 44 status spacer, then a header block `padding: 36 32 0`:
  - `trisakay-lockup.png` at 150 × 84, flush left at the 32px gutter (**no negative margin** — it must align with the headline below it).
  - Headline 36/42 w800, −1.1: "Smarter ride," / "smarter Gensan." with the second line in `accentGreen`.
  - Body: "Tricycle booking for General Santos City — fixed fares, verified drivers, no haggling."
- **Trike band** — `flex: 1`, overflow hidden. `trike-asset.webp` 300px wide, centred, `bottom: 14`. At 300px it is ~240px tall in a ~276px band; going larger clips the front wheel into the CTA.
- **Actions** — `padding: 0 32 24`, gap 12. Primary = navy gradient "Get Started". Secondary = "I already have an account", radius 12, `1.5px #838B91` border, `textPrimary` label.
- 34 home-indicator spacer.

---

## Interactions & behavior

**Navigation** — `splash` → (first launch) `walkthrough` → `landing` → `(auth)/login | signup`. If the walkthrough has been seen, splash goes straight to `landing`. Persist the seen flag (`AsyncStorage`, e.g. `trisakay.walkthroughSeen`); Skip and finishing both set it.

**Walkthrough paging** — horizontal `FlatList`/`PagerView`, `pagingEnabled`, dots reflect `currentIndex`. "Next" advances; on the last slide it reads "Get Started" and routes to `landing`. Swipe and button must stay in sync.

**Motion** — entrance animations per screen. Timings from the prototype (`Animated`/Reanimated `withTiming`, or `FadeInDown`/`FadeIn` entering transitions):

| Element | Duration | Delay | From |
|---|---|---|---|
| Route line draw | 950–1150ms | 150–350 | `strokeDashoffset` full → 0 |
| Pin drop | 500ms | pickup 100–300, drop-off 1150–1200 | opacity 0, offset (−24, −24), slight overshoot |
| Label chips | 400ms | 950 / 1400 | opacity 0 |
| Search bar | 550ms | 100 | opacity 0, y −22 |
| Splash lockup card | 700ms | 350 | opacity 0, scale 0.88 → 1.03 → 1 |
| Fare / driver card | 700ms | 300 | same pop |
| Card chip | 500ms | 950 | opacity 0, y 18 |
| Copy sheet | 650ms | 50 | y +64 |
| Headline / body | 600ms | 300 / 420 | opacity 0, y 18 |
| CTA | 550ms | 560 | opacity 0, y 18 |
| Dots | 500ms | 680 | opacity 0, y 18 |
| Ring pulse (step 03) | 3600ms | 600 | loop, scale 1 → 1.05, opacity 1 → 0.7 |
| Splash loading bar | 1700ms | 900 | loop, indeterminate sweep |
| Landing trike | 850ms | 500 | opacity 0, offset (−30, 10) |

Easing: `cubic-bezier(.2,.8,.25,1)` for rises/sheet, `cubic-bezier(.2,.7,.3,1)` for pops, `cubic-bezier(.4,0,.2,1)` for the route draw. Pins overshoot (`cubic-bezier(.34,1.4,.64,1)`) — a spring with low bounce is fine.

**Reduced motion** — honour `AccessibilityInfo.isReduceMotionEnabled()`: skip entrances and render every element at its resting state (opacity 1, no offset, route fully drawn). The HTML has the same guard; getting this wrong renders the screen blank.

**States** — splash shows the looping bar while bootstrapping; if the first-launch check fails, fall through to `landing` rather than blocking. No error or form states in this flow.

## State management

- `splash`: `isReady`, `hasSeenWalkthrough` (from storage) → redirect.
- `walkthrough`: `currentIndex` (0–2), derived `isLast`.
- `landing`: stateless.
- Slide content stays data-driven in `src/constants/walkthrough.ts`, but the per-slide `icon` field is replaced by an illustration key (`'route' | 'fare' | 'verified'`) that maps to an illustration component.

## Assets

| File | Source | Use |
|---|---|---|
| `assets/brand/trisakay-lockup.png` | repo | splash card, landing header |
| `assets/brand/trisakay-mark.png` | repo | typographic lockup badge (used in explorations) |
| `assets/trike-asset.webp` | repo | landing hero |

The step-03 brand mark is drawn as SVG (arc + chevron), matching `packages/ui/src/components/BrandMotif`.

## Porting notes — things that do not translate literally

1. **No `white-space: nowrap` in RN.** During design, one headline only fit because of it. Every headline here fits at its authored size in a 311px column; if you change the copy or the font size, re-check the wrap rather than reaching for a no-wrap equivalent.
2. **CSS `@keyframes` → `Animated`.** Use the timing table above. The route draw needs `react-native-svg` with an animated `strokeDashoffset`.
3. **`borderRadius: '50% 50% 50% 0'`** (the teardrop pin) has no RN equivalent as a percentage — use the four explicit corner radii given in the primitives section.
4. **Gradients** need `expo-linear-gradient`; the existing `Button` primary already wraps it — reuse rather than re-implementing.
5. **The map grid** is a CSS repeating background. Prefer an SVG `<Pattern>` (one node) over ~30 `View`s per screen.

## Files in this bundle

- `screens/` — 2× PNG reference shots of the five frames at their resting state (`01-splash`, `02-walkthrough-01`, `03-walkthrough-02`, `04-walkthrough-03`, `05-landing`). Use them for visual comparison; take measurements from the README or the HTML, not from the images.
- `TriSakay First-Run Flow.dc.html` — **the locked design.** Five frames, `data-screen-label` on each: Splash, Walkthrough 01, Walkthrough 02, Walkthrough 03, Landing. Includes all animations and a Replay control. Open this one first.
- `TriSakay Onboarding.dc.html` — the exploration canvas: turn 1 recreates what currently ships (useful as a before/after), turn 2 holds the three directions considered (Daylight / Nightfall / Route), turns 3–4 the chosen direction and the light landing.
- `support.js` — runtime for the HTML files; no bearing on the app.
- `assets/` — the three brand assets referenced above.

Open either HTML file directly in a browser. Design-system rules extracted from the locked file are also summarised in the project's `CLAUDE.md`.
