# TriSakay Driver — Redesign v2 handoff

**Scope:** Dashboard (3 states), Trip history, Earnings, Accepted ride / active trip (`app/trip/active.tsx`, 6 stages + multi-passenger + options sheet).
**Source prototype:** `TriSakay Driver Redesign.dc.html` in this folder. Open it in a browser. Every phone is 390×844 and labelled with `data-screen-label`. Frame 4a is clickable end to end.
**Supersedes:** the driver dashboard in `TriSakay Home Final.dc.html`, and the Earnings, History and Active trip frames in `driver handoff/`. The product owner approved replacing them.
**Screenshots:** `screens/01…13.png` at 2×. Icons drawn with `<use href>` render **empty** in these PNGs. Open the HTML to see an icon.

---

## 0. Ground rules

1. The HTML is a **reference, not code**. Rebuild it in React Native with `StyleSheet.create` in `apps/driver/src/styles/**`, tokens from `@trisakay/ui`, Ionicons and Expo Router.
2. **Every colour below is an existing token.** The prototype uses no hex outside `packages/ui/src/theme/colors.ts`. The only exceptions are the placeholder map ground (`#E7EBE4`, which the real `OsmMap` replaces) and the canvas grey `#e9eaec` (not part of the app).
3. **Never set `fontWeight`.** Weight lives in `fontFamily.*`.
4. A shadow must never share a view with `overflow:'hidden'` + `borderRadius`. Split the shadow onto an outer wrapper.
5. **Restyle, don't rewrite logic.** Keep every store call, service, modal and guard. This matters most in `trip/active.tsx` (transfer, release, handoff, cancel reasons, 150 m no-jump ordering, tutorial targets).
6. All new copy goes into `packages/shared/src/i18n/en.ts` (keys suggested in §7). Nothing is inlined.

## 1. Token map (prototype hex → token)

| Hex | Token | Used for |
|---|---|---|
| `#002E60` | `colors.accentBlue` | primary buttons, active tab, selected bar, navy surfaces |
| `#002043` | `colors.accentBluePressed` | gradient end of primary buttons, initials text |
| `#001A38` | `colors.accentBlueDeep` | gradient end of navy bands/hero |
| `#E3EDF7` | `colors.accentBlueSoft` | avatar bg, icon tiles, unselected chart bars, request banner |
| `#477434` | `colors.accentGreen` | Go online, Received, peak bars, drop-off square |
| `#3B602B` | `colors.accentGreenPressed` | green chip text, check icons |
| `#E9F7E3` | `colors.accentGreenSoft` | Done/On board chips, online dot, goal fill, delta icon on navy |
| `#B3261E` | `colors.danger` | SOS, countdown, Cancelled chip, Cancel ride |
| `#FBEAE8` | `colors.dangerSoft` | Cancelled chip bg, countdown chip bg |
| `#14191D` | `colors.ink` | primary text |
| `#5A646B` | `colors.inkSoft` | secondary text, eyebrows |
| `#666F75` | `colors.inkFaint` | inactive tabs, disabled button label |
| `#838B91` | `colors.lineStrong` | outline button borders, dashed cash border, chevrons |
| `#DCE2E6` | `colors.line` | connector rails, sheet handle |
| `#EBEFF2` | `colors.lineSoft` | dividers, tab bar top border |
| `#EDF1F4` | `colors.fill` | disabled primary bg, Release icon tile |
| `#F6F7F9` | `colors.bg` | page bg, passenger strip, info notes |
| `rgba(10,14,17,.58)` | `colors.overlay` | modal/sheet scrim |
| `rgba(255,255,255,.72)` | white @ 0.72 | secondary text on navy (≈7:1, passes) |
| `rgba(255,255,255,.09/.12/.16/.26)` | white @ alpha | tiles, pills, borders and tracks on navy |

**Type** (px at 390 width → token):
- `40/46 extrabold -1.2` → `amount`
- `28/32 extrabold -0.7` → `h1b`
- `20–21/26–27 extrabold` → `h2`, with the family changed to extrabold via a local style (see note)
- `18/24 bold` → next-stop address (local style, `fontFamily.bold`)
- `17/22` → `h3`
- `16.5/22 bold` → primary button (use `button`, 16/20)
- `15/20 semibold` → names and list titles (`bodyLg`, 15/21)
- `14.5/20 semibold` → trip route lines (`bodyLg`)
- `13/18` → `caption`
- `12/16 bold uppercase .7` → `eyebrow`
- `11.5/15–16` → sub-labels (local style, `fontFamily.regular`/`semibold`)
- `11/15` → `labelSm` (tabs)
- `10.5–11 bold uppercase .5` → status chips (`labelXs`, bumped to 11)

Note: where no token matches exactly, build a local style from `fontFamily.*` plus a `scaleFont`-equivalent (`moderateScale`). Do not add a new typography token.

**Radii:**
- 38: phone frame only (ignore)
- 30: navy band bottom corners
- 26: floating trip sheet
- 28: options bottom sheet (top corners)
- 24: hero cards and confirm modal
- 22: white cards and request card
- 20: list panels
- 18: history trip cards and stat cards
- 16: buttons (56h) and passenger strip
- 14–15: icon tiles, Navigate
- 12–13: small buttons and ⋯
- 999: pills and chips

**Shadows:**
- Hero: `0 12 28 rgba(0,46,96,.30)`
- Request card: `0 8 24 .14`
- White panels: `0 2 8 .07`
- Primary buttons: `0 8 18 .28`
- Trip sheet: `0 -8 34 rgba(0,20,45,.18)`
- SOS: `0 8 20 rgba(179,38,30,.40)`

Map these to the existing elevation helpers. Android gets `elevation` 2, 4, 6 or 8 at the closest weight.

## 2. Shared recipes

- **Navy band (History, Earnings):** full-bleed. `GradientSurface` 135° from accentBlue to accentBlueDeep. The texture is a 135° repeating stripe (white .05, 2px on / 12px off); reuse the existing `BrandMotif`/texture from the locked screens. The motif sits at top −40 / right −46, 200px, opacity .12. The band has a 52px safe-area spacer, padding `6 18 20–22`, bottom radius 30 and the shadow `0 12 30 rgba(0,46,96,.22)` on an outer wrapper.
- **Navy hero card (Dashboard online):** the same gradient at 150°, radius 24, padding 16, gap 14. The motif is at top −50 / right −50, 200px, opacity .10.
- **Pill filter on navy:**
  - Active: white bg, accentBlue text (semibold 13).
  - Inactive: white .12 bg, 1px white .26 border, white text.
  - Both are min-height 38 with horizontal padding 14, and carry a count badge (bold 11, radius 999, padding 1×7). The badge is accentBlueSoft on active and white .16 on inactive.
- **Segmented control on navy (Earnings):**
  - Container: white .10 bg, 1px white .20 border, radius 14, padding 4.
  - Segments: flex 1, min-height 38, radius 10.
  - Active segment: white bg, accentBlue bold 13.5. Inactive segment: white semibold 13.5.
- **Status chip:** bold 11 uppercase, letter-spacing .5, padding 3×9, radius 999, with an optional 11px check icon.
  - Done / On board / Logged: accentGreenSoft bg, accentGreenPressed text.
  - Cancelled: dangerSoft bg, danger text.
- **Primary button:** min-height 56 (54 on the request card), radius 16, gradient from accentBlue to accentBluePressed, white `button` label, shadow. The **disabled** state has a fill bg, inkFaint label and no shadow.
- **Outline button:** min-height 52–54, radius 14–16, 1.5px lineStrong border, ink semibold 15.
- **Route rail:** pickup is a 10px ring with a 2.5px accentBlue border. The rail is 2px `line`, min-height 12–22, with 3px margins. Drop-off is a 10px square with radius 2, accentGreen.
- **Tab bar:** unchanged from the locked spec: Dashboard, Requests, History, Earnings, Profile. Height 64 in the mock (60 plus bottom padding). The active tab is accentBlue bold with a 22×3 radius-2 top marker. Hidden on `trip/*`.

## 3. Dashboard (`app/(tabs)/dashboard.tsx`) — screens 01, 02, 03

Page bg is `bg`, with padding `6 16 20` below the 52 safe area and a column gap of 16.

**Header row (all states):**
- 44px avatar circle: accentBlueSoft bg, initials bold 15 accentBluePressed.
- Greeting line (caption 12, inkSoft). The greeting follows the device clock:
  - "Magandang umaga," before 12:00
  - "Magandang hapon," from 12:00 to 18:00
  - "Magandang gabi," after 18:00
- First name in bold 17.
- Bell tile: 44×44, radius 14, white, shadow. It shows a 9px danger dot with a 2px white ring at top 9 / right 9 when there are unread notifications.

### 3a. Online + incoming request (01)

**Hero (navy card):**
- **Row 1**
  - Left: a 10px dot in accentGreenSoft with the pulse animation. This is one of the two allowed continuous animations: scale .9→1.9 and opacity .55→0 over 2s. Next to it, "You're online" (bold 13, white) with the sub-line "{zone} zone · {online duration}" (11.5, white .72, nowrap).
  - Right: the **Go offline** button. Min-height 40, padding 0×14, radius 12, white .12 bg, 1px white .26 border, a 15px power icon and semibold 13 white text. It calls the existing availability toggle action. The old small Toggle is removed.
- **Earnings:** the eyebrow "EARNED TODAY" (semibold 11, .8 tracking, white .72) over `amount` in white showing today's earnings.
- **Goal:** only when `showGoal`, i.e. a goal is set. An 8px track (white .16, radius 4) with an accentGreenSoft fill at `min(100, today/goal)%`. Below it, a row with space-between: "₱{goal−today} to go" (or "Goal reached — nice work!") and "Goal ₱{goal}". Both are medium 12, accentBlueSoft.
- **Stats grid:** 3 columns, gap 8. Each tile is white .09, radius 14, padding 10×12, with a bold 18 white value over an 11.5 white .72 label. Tiles:
  - "Trips" (today's count)
  - "Rating" with a 13px star
  - "Accepted" (acceptance %)

**Request block** (replaces the listening panel while a request is pending):
- **Header row:** the eyebrow "NEW RIDE REQUEST", and on the right a countdown chip (dangerSoft bg, danger bold 12 text, 12px clock icon) reading "{n}s left".
- **Card:** white, radius 22, shadow. **There is no map in this card.**
  - A 4px countdown bar across the top: fill track, danger fill at remaining/total. It animates linearly and is driven by the same timer as the chip.
  - Body: padding 16, gap 14.
  - **Fare row:** the fare in extrabold 30/34 (−.8) ink, over "{Cash|GCash} · {seats} seats · {distance} km" (medium 13, inkSoft). **The passenger's rating is intentionally not shown.**
  - **Route:** the rail on the left. Labels are 11.5 inkFaint: "Pickup · {m} m away", then "Drop-off". Values are semibold 15 ink and wrap (no ellipsis).
  - **Actions:** Decline is an outline button, width 104, min-height 54, radius 16. Accept ride is a primary button, flex 1, min-height 54, with a 20px check icon and bold 16 label. Keep the existing accept/decline handlers (`useAcceptRideRequest`, `decline`).

### 3b. Online, listening (02)

- The hero is the same as 3a.
- **Listening card:** white, radius 22, padding 18, row, gap 16, shadow `0 6 20 .10`.
  - A 60px circle in accentBlueSoft with a 28px radio icon in accentBlue. Behind it, the same pulse ring at 2.4s. This is the second allowed animation.
  - Text: "Looking for passengers" (bold 16), over "New requests pop up here. Keep the app open." (13/19, inkSoft).
- **Recent trips:**
  - Header: eyebrow "RECENT TRIPS" and a "See all ›" link (semibold 13, accentBlue, min-height 32), which navigates to the History tab.
  - A white panel, radius 20, padding 4×16, with the **2 most recent completed trips**. Each row:
    - 40px tile, radius 12, accentGreenSoft, with a check icon
    - "{pickup} → {drop-off}" (semibold 14.5, single line with ellipsis)
    - "{time} · {passenger name}" (12, inkSoft)
    - Fare on the right (bold 15)
  - Rows are divided by `lineSoft`. Hide the section if there are no trips today.

### 3c. Offline (03)

- **Status card:** white, radius 24, padding `20 18 18`, gap 16, shadow `0 6 20 .10`. The motif sits at top −40 / right −44, 190px, opacity .05, in accentBlue.
  - "You're offline" (bold 13, inkSoft) next to a 10px lineStrong dot.
  - The title "Ready to drive?" (extrabold 26/32, −.6) over "Go online to start getting ride requests around {zone}." (14/21, inkSoft).
  - **Go online:** min-height 58, radius 18, accentGreen bg, 20px power icon, bold 17 white, shadow `0 8 18 rgba(71,116,52,.30)`. It calls the same availability toggle action.
  - Footer row, above a `lineSoft` top border: a 15px shield icon in accentGreen and "PSO verified · Body no. {n} · Franchise valid to {Mon YYYY}" (12.5, inkSoft). Omit the franchise part if there's no expiry data.
- **This week so far:** the eyebrow, then a 2-column grid, gap 10. Each card is white, radius 18, padding 14×16.
  - "Earned": the value in extrabold 22, with a delta line below: up-arrow icon and "{n}% vs last week" in semibold 11.5 accentGreenPressed. Hide the delta when it is ≤ 0 or unknown.
  - "Trips": the count, with "{n} days online" below.
- **Last trip:**
  - Header: the eyebrow and a "History ›" link.
  - One row in the same style as Recent trips, with "Yesterday, 7:48 PM · {name}" style meta.

## 4. Trip history (`app/(tabs)/history.tsx`) — screen 04

**Navy band:**
- Eyebrow "YOUR TRIPS" (white .72), title "Trip history" in `h1b` white.
- 16px below, the pill filters "All {n}", "Done {n}" and "Cancelled {n}". Tapping one filters the list client-side. The counts are for the loaded range.

**List:**
- Padding `6 16 20`. Trips are grouped by local calendar day, newest first.
- **Group header** (padding-top 16, row with space-between, nowrap):
  - Left: "{Today|Yesterday|Weekday}" in bold 13 ink, then the date "Sep 28" in regular inkSoft.
  - Right: "{doneCount} trips · ₱{sum}" (semibold 12.5, inkSoft).
  - The sum counts completed trips only.
- Cards are spaced with gap 10. Hide any group left empty by the filter.

**Completed card:**
- White, radius 18, padding 14×16, shadow, column, gap 12, pressable. It opens the existing trip detail route if one exists; otherwise it is a no-op (report it).
- **Row 1:** "{time} · {Cash|GCash} · {n} seat(s)" (semibold 12.5, inkSoft), and on the right the fare (extrabold 17, −.3).
- **Route:** the rail with the from and to lines (semibold 14.5, single line with ellipsis).
- **Footer:** above a `lineSoft` top border with padding-top 11.
  - 28px initials avatar (accentBlueSoft, bold 11) and the name (medium 13).
  - "✓ DONE" chip, then a 14px chevron in lineStrong.

**Cancelled card:**
- White with a 1px **dashed** `line` border, no shadow, radius 18, padding 14×16, gap 10.
- Row: the time, and on the right a "CANCELLED" chip.
- "{from} → {to}" (semibold 14.5, **inkSoft**, ellipsis).
- The reason line: a 14px info icon and the localised cancel reason (12.5, inkSoft). Use the existing `DRIVER_CANCEL_REASON_CODES` labels, plus the passenger-cancel label.

**States:**
- Empty: the existing `EmptyState` below the band.
- Loading: skeleton cards at the same size.

## 5. Earnings (`app/(tabs)/earnings.tsx`) — screen 05

**Navy band** (padding `6 18 22`, gap 16):
1. The segmented control: **Today / Week / Month**. Default is Week.
2. Eyebrow with the range label:
   - Today: "Today · Mon, Sep 28"
   - Week: "Sep 22 – 28"
   - Month: "September 2026"
3. The period total in `amount` white.
4. A row (gap 8, wrap) with the delta pill and the trip count:
   - The delta pill: accentGreenSoft text on white .16-ish green tint, i.e. `rgba(233,247,227,.16)`, with radius 999, padding 3×10, a 12px up icon and semibold 12.5 text:
     - Today: "{n} trips so far"
     - Week: "{n}% vs last week"
     - Month: "{n}% vs {prev month}"
   - Hide the pill when the delta is negative or unknown. Never show red here.
   - The trip count: "{n} trips" (medium 12.5, accentBlueSoft).

**Chart card:** white, radius 22, padding 16, gap 14, shadow `0 2 10 .08`.
- **Header row:** "{selected bucket full label}" (medium 12.5, inkSoft) over its value (extrabold 22), with a chip on the right: "{n} trips" (semibold 12, accentBlue on accentBlueSoft).
- **Bars:** height 140, gap 8, bar radius `9 9 4 4`.
  - Height is value/max × 100%, with a minimum of 8%.
  - Colours: the selected bar is accentBlue, the others accentBlueSoft.
  - **Tap a bar to select it.** The default selection is the last bucket (today, this week or week 4). Switching period resets the selection to the last bucket.
- **Buckets:**
  - Today: 5 three-hour slots, labelled 6a, 9a, 12n, 3p, 6p. Full labels: "6–9 AM" … "6–9 PM".
  - Week: 7 days labelled Tue … "Today". Full label e.g. "Sat, Sep 26".
  - Month: Wk 1–4. Full label e.g. "Sep 22 – 28".
- **Labels row:** 11.5 medium inkSoft, centred under each bar, with −6 margin-top.
- **Goal line** (only if a goal is set): above a `lineSoft` border, a 14px dashed accentGreen dash, then:
  - Week: "Hit your ₱{goal} daily goal on {n} of 7 days"
  - Otherwise: "Daily goal: ₱{goal}"

**Stat tiles:** 3 columns, gap 10. Each is white, radius 16, padding 12×14, with a 12 inkSoft label over a bold 17 value.
- "Avg fare" (total/trips, rounded)
- "Best" (the bucket with the highest value, as a short label)
- "Cash" (the cash share of fares, %)

**Peak hours** (this replaces the settlement block; do **not** reintroduce Notify PSO or the settlement log):
- **Header:** the eyebrow "PEAK HOURS", with the scope on the right (12, inkSoft): "Last 7 days" when Today is selected, otherwise the range label.
- **Card:** white, radius 22, padding 16, gap 14.
  1. **Best-time row:**
     - A 48px tile (radius 16, accentGreenSoft) with a 22px clock icon in accentGreenPressed.
     - "Best time to be online" (medium 12.5, inkSoft) over "5 – 7 PM" (extrabold 20/26, −.4).
     - On the right, a chip "₱{n} / hr" (semibold 12, accentGreenPressed on accentGreenSoft, nowrap).
  2. **Hour strip:**
     - 16 bars for 6 AM–9 PM, one per hour. Height 72, gap 3, bar radius `4 4 2 2`.
     - Height is value/max. Bars in a peak window are accentGreen; the rest are accentBlueSoft.
     - Axis labels (11 medium, inkSoft, space-between): 6 AM, 9 AM, 12 NN, 3 PM, 6 PM, 9 PM.
  3. **Three rows** (dividers `lineSoft`, padding 11 vertical). Each has a 10px radius-3 swatch, the label (medium 13) and "₱{n} / hr" (semibold 13) on the right:
     - "Morning rush · {window}" with a green swatch
     - "Evening rush · {window}" with a green swatch
     - "Quietest · {window}" with an accentBlueSoft swatch; its text is inkSoft
  4. **Info note:** bg fill, radius 12, padding 10×12, a 16px info icon and "Based on your completed trips. Earnings per hour online." (12.5/18, inkSoft).
- **Data:** the current build already replaced settlement with peak-hours analytics. **Reuse that existing data source/service and only restyle it.** If it doesn't provide ₱/hr or window boundaries, show trip counts instead and report the gap. Don't invent a backend.

## 6. Accepted ride — `app/trip/active.tsx` — screens 06–13

### 6.1 What changes vs. today

| Today | Redesign |
|---|---|
| Each passenger card shows up to 6 controls at once | Only the **next stop** is expanded, with **one** primary action that follows its status |
| Complete is grey with no reason | A hint line under the primary explains any disabled state |
| The Navigate icon sits unlabelled on the map | A labelled Navigate button beside the next-stop address |
| Transfer, Release and Cancel are always visible | Behind a **⋯** button, in a bottom sheet |
| SOS takes a full-width slot in the sheet | A floating circular hold button on the map, top-right |
| End trip is always shown, disabled while passengers are aboard | End trip is **only rendered when there are no passengers** |
| The mid-trip request is a full RequestCard | A compact banner at the top of the sheet |

### 6.2 Layout

- The map fills the screen (the existing `OsmMap`, unchanged props). The tab bar is hidden.
- **Status pill:** top 60 (safe area + 8), left 16.
  - White, radius 999, padding 9×14, shadow `0 4 14 rgba(0,20,45,.18)`.
  - A 9px accentBlue dot and bold 13 ink text, nowrap.
- **SOS:** top 54, right 16.
  - A 58px circle in danger with a 3px white border and shadow. Inside, stacked: an 18px warning icon and "SOS" (extrabold 11, .6 tracking, white).
  - Below it, 5px gap: a white chip "Hold 2s" (semibold 10.5, danger).
  - This is the existing `HoldToConfirmButton` behaviour (same hold duration, same `router.push('/trip/emergency')`) in a new **circular variant**: add `variant="fab"` to the component. Its progress ring draws around the circle. Keep the `sosTarget` tutorial target on it.
  - Remove the Navigate map button (it moves into the sheet).
- **Sheet:** absolute, left, right and bottom 10.
  - White, radius 26 on all corners, padding `10 16 18`, column, gap 14, shadow `0 -8 34 rgba(0,20,45,.18)`.
  - A 40×4 `line` handle, centred.
  - `maxHeight` keeps today's formula. The content scrolls internally.
  - SOS no longer lives in the sheet.

### 6.3 Next-stop block (top passenger = `sortedStops[0]`)

- A row with gap 12:
  - 44px tile, radius 14. For a pickup: accentBlueSoft with the 14px pickup ring. For a drop-off: accentGreenSoft with the 13px green square.
  - Text column:
    - Eyebrow (semibold 11.5, .6 tracking, uppercase, inkSoft):
      - One stop: "NEXT STOP · PICKUP" or "NEXT STOP · DROP-OFF"
      - More than one: "STOP 1 OF {n} · PICKUP|DROP-OFF"
    - The address in bold 18/24 ink, wrapping.
    - The meta line (13, inkSoft):
      - "{km} km · about {min} min"
      - After arriving: "You arrived {n} min ago"
  - **Navigate:** a 48px tile (radius 15, primary gradient, shadow) with a 20px navigate icon, over a "Navigate" label (semibold 11, accentBlue). It calls the existing `handleNavigate`.
- **Passenger strip:** bg `bg`, radius 16, padding `10 10 10 12`, gap 12.
  - 40px avatar (use the existing `Avatar` size md).
  - Name (semibold 15) with an optional status chip:
    - "ARRIVED" after arriving
    - "ON BOARD" when ongoing
  - Sub-line (12.5, inkSoft): "{seats} seats · ₱{fare} · {Cash | Cash received | GCash paid}".
  - **⋯ button:** 44×44, radius 13, white, 1px `line` border, 20px ellipsis icon. It opens the options sheet (§6.6).

### 6.4 Primary action by status (one passenger, 4a)

| Stage | Condition (existing fields) | Status pill | Extra row | Primary | Hint |
|---|---|---|---|---|---|
| 1 (06) | `status==='assigned' && !arrivedAt` | "Heading to pickup" | — | **I've arrived** → `handleMarkArrived` | "Lets {first name} know you're at the pickup point." |
| 2 (07) | `status==='assigned' && arrivedAt` | "Waiting at pickup" | chip ARRIVED | **Start ride** → `handleStart` | "Tap once {first name} is on board." |
| 3 (08) | `status==='ongoing' && isCash && !cashConfirmed` | "On the way to drop-off" | **Cash row, pending** | **Complete drop-off**, *disabled* | "Confirm the cash first, then complete." |
| 4 (09) | `status==='ongoing' && (!isCash \|\| cashConfirmed)` | "On the way to drop-off" | **Cash row, done** (cash only) | **Complete drop-off** → opens the existing complete `ConfirmModal` | "Tap when {first name} has been dropped off." |
| 5 (10) | ConfirmModal open | — | — | Modal: title "Drop off {first name}?", message "This ends her/his ride and records ₱{fare} in your earnings." (use neutral "their" if gender is unknown), buttons "Not yet" (outline) and "Complete" (primary) | — |
| 6 (11) | `!hasPassengers` | "Trip open · no passengers" | — | See §6.7 | — |

In stages 1–5 the map target follows the current behaviour: the pickup marker while assigned, the destination once ongoing.

A handoff passenger (`handoffLat !== null`) has the primary **Complete handoff** → `handleCompleteHandoff`, with the existing `handoffNotice` as the hint.

**Cash row, pending:**
- A 1.5px **dashed** lineStrong border, radius 16, padding `10 10 10 14`.
- A 22px cash icon (inkSoft), then "Collect ₱{fare} cash" (semibold 14) over "Confirm before completing" (12, inkSoft).
- A **Received** button: min-height 44, padding 0×16, radius 12, accentGreen, a 15px check icon and bold 14 white text. It calls `handleConfirmCash` and replaces today's Toggle.

**Cash row, done:** accentGreenSoft bg, radius 16, padding 12×14, a check icon and "Cash received · ₱{fare}" (semibold 14, accentGreenPressed).

Loading: the primary shows the existing `Button` loading spinner while the store call is in flight (the `arrivingIds`, `startingIds` and `completingIds` sets are unchanged).

### 6.5 Multiple passengers (12)

- The next-stop block and primary follow §6.3–6.4 for `sortedStops[0]`.
- **"Then" list:** below a `lineSoft` border with padding-top 12. The eyebrow "THEN", then one row per remaining stop:
  - A 26px circle in fill with the stop number (bold 12).
  - "Pick up {name}" or "Drop off {name}" (semibold 14.5).
  - "{address} · {km} km · {seats} seat(s) · {payment}" (12.5, inkSoft, ellipsis).
  - A ⋯ button.
  - These rows have no primary. They become the top block when `sortedStops` reorders; keep the 150 m no-jump rule.
- **Mid-trip compatible request** (`incoming`): rendered as the **first child** of the sheet.
  - A banner in accentBlueSoft, radius 16, padding `10 10 10 14`.
  - Text: "NEW REQUEST ON YOUR ROUTE · {n}s" (semibold 11, uppercase, accentBluePressed) over "₱{fare} · {pickup} → {drop-off}" (semibold 14, ellipsis).
  - A 44px white decline (×) tile, and **Accept** (min-height 44, accentBlue, bold 14 white).
  - It uses the existing `acceptRideRequest` and `decline`. Add a `compact` variant to `RequestCard`, or a new `RequestBanner`, in `packages/ui`.

### 6.6 Passenger options sheet (13)

- The scrim is `colors.overlay`. The bottom sheet is white with radius 28 on the top corners and padding `10 18 26`.
- A handle, then a header: 44px avatar, name (bold 17), and "{seats} seats · ₱{fare} · {payment}".
- Rows (min-height 64, `lineSoft` dividers): a 42px tile (radius 13), title (semibold 15), description (12.5, inkSoft) and a chevron.

| Row | Tile | Title colour | Description | Action (existing) |
|---|---|---|---|---|
| Transfer to another driver | accentBlueSoft / swap icon in accentBlue | ink | "Invite nearby drivers with free seats to take this ride" | `handleOpenTransfer` → reason picker → candidates modal |
| Release passenger | fill / exit icon in ink | ink | "Hand this ride back so another driver can pick it up" (**confirm this wording matches `releasePassenger` semantics**) | `setReleasingPassenger` → reason picker |
| Cancel ride | dangerSoft / close icon in danger | danger | "Passenger didn't show up or asked to cancel" | `setCancellingId` → cancel reason picker |

- The **Close** outline button closes the sheet (min-height 52, margin-top 12).
- Keep the existing disable rules: all three rows are disabled while that passenger is completing or starting.

### 6.7 All dropped off (11)

- **Sheet content:**
  - Centred: a 60px accentGreenSoft circle with a 28px check, the title "All passengers dropped off" (extrabold 21/27), and "₱{trip total} added to today · {n} passenger(s)" (14, inkSoft).
  - An info note: "You're still online. New requests near you will show up here until you end the trip."
  - Primary **End trip** → the existing end-trip `ConfirmModal` (Stay online / End trip) → `/(tabs)/dashboard`.
- If the trip was opened with no passengers at all, use the same panel with the existing `onlineNoPassengers` / `noPassengersNote` copy instead of the ✓ title.
- Hide the map route when there is no target.

## 7. New i18n keys (suggested, `en.ts`)

```
driver.dashboard.greetingMorning  "Magandang umaga,"
driver.dashboard.greetingAfternoon "Magandang hapon,"
driver.dashboard.greetingEvening  "Magandang gabi,"
driver.dashboard.youreOnline      "You're online"
driver.dashboard.zoneLine         "{zone} zone · {duration}"
driver.dashboard.goOffline        "Go offline"
driver.dashboard.goOnline         "Go online"
driver.dashboard.youreOffline     "You're offline"
driver.dashboard.readyTitle       "Ready to drive?"
driver.dashboard.readyBody        "Go online to start getting ride requests around {zone}."
driver.dashboard.earnedToday      "Earned today"
driver.dashboard.goalToGo         "₱{amount} to go"
driver.dashboard.goalReached      "Goal reached — nice work!"
driver.dashboard.goalLabel        "Goal ₱{amount}"
driver.dashboard.statTrips / statRating / statAccepted  "Trips" / "Rating" / "Accepted"
driver.dashboard.newRideRequest   "New ride request"
driver.dashboard.secondsLeft      "{n}s left"
driver.dashboard.lookingTitle     "Looking for passengers"
driver.dashboard.lookingBody      "New requests pop up here. Keep the app open."
driver.dashboard.recentTrips / seeAll / thisWeek / lastTrip / daysOnline / vsLastWeek
driver.history.summary            "{n} trips · ₱{sum}"
driver.history.filterAll / filterDone / filterCancelled
driver.earnings.today / week / month / tripsSoFar / vsLastWeek / vsPrevMonth / avgFare / best / cash
driver.earnings.goalHitDays       "Hit your ₱{goal} daily goal on {n} of 7 days"
driver.earnings.peakHours / bestTime / perHour / morningRush / eveningRush / quietest / peakNote
driver.tripActive.headingToPickup "Heading to pickup"
driver.tripActive.waitingAtPickup "Waiting at pickup"
driver.tripActive.toDropoff       "On the way to drop-off"
driver.tripActive.tripOpenEmpty   "Trip open · no passengers"
driver.tripActive.nextStopPickup / nextStopDropoff / stopOfPickup / stopOfDropoff
driver.tripActive.arrivedAgo      "You arrived {n} min ago"
driver.tripActive.etaLine         "{km} km · about {min} min"
driver.tripActive.navigateLabel   "Navigate"
driver.tripActive.iveArrived      "I've arrived"
driver.tripActive.startRide       "Start ride"
driver.tripActive.completeDropoff "Complete drop-off"
driver.tripActive.hintArrive / hintStart / hintCashFirst / hintComplete
driver.tripActive.collectCash     "Collect ₱{fare} cash"
driver.tripActive.collectCashSub  "Confirm before completing"
driver.tripActive.received        "Received"
driver.tripActive.cashReceived    "Cash received · ₱{fare}"
driver.tripActive.then / pickUpName / dropOffName
driver.tripActive.requestOnRoute  "New request on your route · {n}s"
driver.tripActive.optionsTransferDesc / optionsReleaseDesc / optionsCancelDesc / close
driver.tripActive.dropoffConfirmTitle "Drop off {name}?"
driver.tripActive.dropoffConfirmBody  "This ends their ride and records ₱{fare} in your earnings."
driver.tripActive.allDroppedTitle "All passengers dropped off"
driver.tripActive.allDroppedBody  "₱{amount} added to today · {n} passengers"
driver.tripActive.stillOnlineNote "You're still online. New requests near you will show up here until you end the trip."
trip.sosHold                      "Hold 2s"
```

Reuse existing keys wherever the string already exists (`accept`, `decline`, `endTrip`, `stayOnline`, cancel reasons and so on).

## 8. Data the design needs — confirm before coding

| Need | Where | Likely source | If missing |
|---|---|---|---|
| Zone name ("Poblacion") | Dashboard hero, offline body | driver profile / barangay | drop "{zone} zone ·" and use a generic body line |
| Online duration | Dashboard hero | `onlineSince` on driver status | drop the duration |
| Daily goal | Dashboard, Earnings | **new** local setting (AsyncStorage, default off) | hide the goal UI (`showGoal=false`) |
| Acceptance % | Dashboard stats | already on the locked dashboard | — |
| Week delta, days online | Offline "This week" | earnings service | hide the delta and the days line |
| Period buckets (3h / day / week) + trips per bucket | Earnings chart | earnings service | aggregate client-side from trip history |
| Cash share | Earnings tile | trips' `paymentMethod` | compute client-side |
| Peak hours | Earnings | **existing** peak-hours analytics | show counts instead of ₱/hr |
| ETA minutes | Active trip meta | none today (`distanceKm` only) | show km only, or km ÷ 15 km/h rounded (label it "about") |
| Arrived-ago minutes | Active trip stage 2 | `arrivedAt` | — |
| Franchise expiry | Offline footer | driver docs | omit that clause |

## 9. Motion

- There are only two continuous animations: the online pulse dot and the listening pulse ring. Both use `Animated.loop` on native driver.
- The request countdown bar is linear and tied to the request timer.
- The Earnings period switch and bar selection change instantly (no chart tween needed). If you add one, keep it ≤200 ms ease-out.
- The options sheet uses the standard bottom-sheet slide, 220 ms.
- The confirm modal uses the existing `ConfirmModal`.

## 10. Screen index

| PNG | Frame |
|---|---|
| 01-dashboard-request | 1a Dashboard online + request |
| 02-dashboard-listening | 1b Dashboard listening + recent trips |
| 03-dashboard-offline | 1c Dashboard offline |
| 04-trip-history | 2a History, All filter |
| 05-earnings-week | 3a Earnings, Week, today selected |
| 06-active-heading-to-pickup | 4a stage 1 |
| 07-active-arrived | 4a stage 2 |
| 08-active-collect-cash | 4a stage 3 |
| 09-active-ready-to-complete | 4a stage 4 |
| 10-active-confirm-dropoff | 4a stage 5 (modal) |
| 11-active-all-dropped-off | 4a stage 6 |
| 12-active-two-passengers | 4b |
| 13-active-options-sheet | 4c |
