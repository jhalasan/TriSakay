# TriSakay — Passenger Complaints & Case Tracker (redesign handoff)

Source of truth: `TriSakay Complaints Redesign.dc.html`, section **2a · Redesign** (section **1a · Current** shows the app as it is today, for reference only). Open the file in a browser. The screenshots in `screens/` are the same frames.

Repo: `jhalasan/TriSakay`, branch `main`, Expo Router + React Native, `apps/passenger`, shared UI from `@trisakay/ui` (`packages/ui`).

| # | Frame | Screenshot | Route |
| --- | --- | --- | --- |
| 1 | Complaints tab (home) | `screens/01-complaints-home.png` | `app/(tabs)/complaints.tsx` (rewritten) |
| 2 | New complaint — step 1 of 2 | `screens/02-new-complaint-step1.png` | `app/complaints/new.tsx` (new), `step = 1` |
| 3 | New complaint — step 2 of 2 | `screens/03-new-complaint-step2.png` | same route, `step = 2` |
| 4 | Complaint sent | `screens/04-complaint-sent.png` | same route, `step = 'sent'` |
| 5 | Tracker — in progress | `screens/05-tracker-in-progress.png` | `app/complaints/[id].tsx` (rewritten) |
| 6 | Tracker — resolved | `screens/06-tracker-resolved.png` | same route, terminal status |

All measurements are **design-frame px at 390pt width**. Where a token is named, use it; otherwise pass the px value through `moderateScale(px, deviceWidth)` exactly as the theme files do. Never set `fontWeight` — weight lives in `fontFamily` (see `typography.ts`).

---

## 0. What changes, and why

| Today | Redesign |
| --- | --- |
| The tab *is* the form. "Your complaints" sits below Submit and only appears once one exists. | The tab is a **case list** under a navy header. Filing is a separate two-step flow. |
| Trip and category are both collapsed dropdowns. | Trip is a **selected card** showing route and fare. Category is a **2×3 tile grid**: every option is visible and you pick one with a tap. |
| Success is a generic `EmptyState`. | A **receipt screen**: reference number, Copy, what happens next, "Track this complaint". |
| Tracker: one timestamp, small dots, no "what now". | A **Now card** for the current stage, 22px stage markers with dates, trip + evidence on the same page, and a **decision card** when it's closed. |

No token, font, or colour is new. Every value below already exists in `packages/ui/src/theme`.

---

## 1. Shared building blocks

Build these once in `apps/passenger/src/components/complaints/` (or `packages/ui` if you prefer — they are passenger-only today).

### 1.1 `NavyBand` (reuse if Home/History/Profile already have one)
- `LinearGradient` `gradients.hero` (`#002E60 → #001A38`), 135°. Full-bleed and extends under the status bar (`SafeAreaView edges={[]}` on the band, add top inset as padding).
- Bottom corners `radius.heroBottom` (30). Shadow: `0 12 30 rgba(0,46,96,.22)` → iOS `shadowColor accentBlue, offset {0,12}, opacity .22, radius 30`; Android `elevation 8`.
- Texture overlay: `repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 2px, transparent 2px 14px)` — reuse the existing texture component from Home.
- Chevron motif watermark: 170×170, white, opacity .12, `top: -30, right: -34`.
- Content padding: `6 16 22` below the status-bar spacer (52 in the frame = safe-area top).

### 1.2 `StatusChip`
Pill, `radius.pill`, padding `3 × 10`, Poppins **700 11/16**.

| DB status | Label (existing i18n key) | bg | fg |
| --- | --- | --- | --- |
| `open` | `statusOpen` | `accentBlueSoft #E3EDF7` | `accentBluePressed #002043` |
| `under_review` | `statusUnderReview` | `#E3EDF7` | `#002043` |
| `mediation_scheduled` | `statusMediationScheduled` | `#E3EDF7` | `#002043` |
| `escalated` | `statusEscalated` | `dangerSoft #FBEAE8` | `dangerPressed #931E17` |
| `resolved` | `statusResolved` | `accentGreenSoft #E9F7E3` | `accentGreenPressed #3B602B` |
| `dismissed` | `statusDismissed` | `fill #EDF1F4` | `inkSoft #5A646B` |

Note: the current tracker renders "Under review" on **green**. The redesign fixes that: in-progress is blue, and green is reserved for done (matches the `colors.ts` rule "accentGreen — positive/complete status only").

### 1.3 `StageBar` (3 segments, used on case cards)
Row, `gap 4`, each segment `flex 1`, height 5, radius 3.
Derive from the existing `getComplaintStageStates(status)` — do not duplicate the logic:
- Segment 1 (Received): always `accentGreen #477434`.
- Segment 2 (Review): `done` → `#477434`, `current` → `accentBlue #002E60`, `pending` → `line #DCE2E6`.
- Segment 3 (Decision): `done` → `#477434` (for `dismissed`, use `lineStrong #838B91`), `pending` → `#DCE2E6`.

### 1.4 `StageTimeline` (tracker)
Three rows. Each row: marker column 22 wide, text column `flex 1`, `gap 12`.
- **Done marker**: 22×22 circle, `#477434`, white check icon 11px (Ionicons `checkmark`, stroke look).
- **Current marker**: 22×22 circle, white fill, 2px `#002E60` border, inner 8×8 `#002E60` dot, plus a 4px halo ring `#E3EDF7` (draw as a 30×30 `#E3EDF7` circle behind, or `shadow` spread is not available in RN; use the wrapper view).
- **Pending marker**: 22×22, white, 2px `#DCE2E6` border.
- Connector: width 2, `flex 1`, `minHeight 20` (14 on the resolved screen), `marginVertical 3`. Colour `#477434` if the stage *above* it is done, else `#DCE2E6`.
- Text column: `paddingBottom 14` except last. Row layout `justifyContent: space-between`.
  - Title Poppins **700 14/22**, `ink`; pending title `inkFaint #666F75`.
  - Body Poppins **400 12/17**, `inkSoft`.
  - Date on the right, Poppins **400 12/22**, `inkFaint`, `flexShrink 0`.

### 1.5 `WhiteCard`
`panel #FFF`, radius 18 (`radius.md3`) for list cards / 20 (`radius.lg`) for tracker cards, shadow `0 2 8 rgba(0,46,96,.07)` → `elevation.card` is close enough (use it). Raised/selected variant: `1.5px #002E60` border + `0 4 14 rgba(0,46,96,.1)`.

### 1.6 `IconTile`
Square with rounded corners, centred Ionicon. Sizes used: 48/r15 (primary action), 38/r12 (Now/decision), 34/r11 (category), 32/r10 (details row), 30/r10 (summary chip).
Category tones: keep the existing `CATEGORY_TONE` / `CATEGORY_ICON` maps from `(tabs)/complaints.tsx`. Move them to `src/utils/complaintCategories.ts` so all three screens share them. `vehicle_condition` uses `build-outline`, `low_rating` `star-outline`, `other` `ellipsis-horizontal`.

### 1.7 Primary button & sticky footer
- Button: `minHeight 54`, radius 14, `gradients.button` 135°, label `typography.button`-ish at **700 17/21** white, `elevation.button`. Use the existing `Button` if it supports this size; otherwise extend it with a `size="lg"` rather than hand-rolling.
- Sticky footer (steps 1–2): absolute bottom, white, `borderTopWidth 1 lineSoft #EBEFF2`, padding `12 16` + bottom safe-area inset (26 in frame). Scroll content gets `paddingBottom 100` so the last field clears it. Wrap in `KeyboardAvoidingView` as today.

### 1.8 Back / close tile
40×40, radius 13, white, `0 2 8 rgba(0,46,96,.09)`, icon 18 `ink`. On the navy band: bg `rgba(255,255,255,.14)`, no shadow, icon white.

---

## 2. Frame 1 — Complaints tab (`app/(tabs)/complaints.tsx`)

Background `bg #F6F7F9`. Tab bar unchanged (Complaints active).

**Navy band** (1.1). Content, top → bottom:
1. Title "Complaints": Poppins **800 28/34**, −0.7 tracking, white (`typography.h1b` with lineHeight 34).
2. Subline "Report a problem and follow it to a decision.": **400 13/19**, white @ 72% opacity. `marginTop 4`.
3. Stats strip, `marginTop 14, paddingTop 14`, top border `1px rgba(255,255,255,.14)`. Two equal columns split by a 1px `rgba(255,255,255,.14)` divider with `marginHorizontal 16`:
   - Value **800 22/26** white; label **400 12/16** white @ 72%.
   - "In progress" = count where status ∉ {resolved, dismissed}; "Resolved" = count of `resolved` (dismissed is excluded from both).
   - Hide the strip entirely when the user has 0 complaints.

**Body**, padding `16 16 76`, `gap 18`:

1. **Report a problem** card: white, radius 22 (`radius.lg2`), padding 16, shadow `0 4 14 rgba(0,46,96,.1)`. Row `gap 14`: IconTile 48/r15 `#002E60` with white `add` icon 22 · text (title **700 16/22** ink "Report a problem", sub **400 12.5/18** inkSoft "Takes about two minutes") · `arrow-forward` 18 `#002E60`. Press → `router.push('/complaints/new')`.

2. **Common issues**: eyebrow (**700 11/15**, 0.7 tracking, uppercase, inkSoft) + `marginTop 8` grid of 3 equal columns `gap 8`. Each tile: white card radius 16, padding `12 10`, `gap 8`, column: IconTile 34/r11 in category tone + label **600 12.5/16** ink. Tiles: `fare` "Fare dispute", `conduct` "Driver conduct", `safety` "Safety". Press → `router.push({ pathname: '/complaints/new', params: { category } })`.

3. **Your cases**: header row, eyebrow "Your cases" left, "See all" (**600 13/18** `#002E60`) right. Show "See all" only when there are > 3 cases. It expands the list in place (no new route). Then a column of case cards, `gap 8`, newest first, **max 3** visible:
   - Card: white, radius 18, padding `14 16`, `gap 10`, `elevation.card`.
   - Row 1: `#{ref} · {category label}` (**600 11/16**, 0.5 tracking, inkFaint), StatusChip right.
   - Row 2: subject **600 15/21** ink, `numberOfLines 2`.
   - Row 3: StageBar (1.3).
   - Row 4: meta **400 12/17** inkSoft + `chevron-forward` 14 inkSoft. Meta = `Updated {date}` for in-progress, `Closed {resolvedAt}` for resolved/dismissed. If there is no updated timestamp, use `Filed {createdAt}`.
   - Press → `router.push('/complaints/' + id)`.
   - `ref` = `getReferenceCode(id)` (existing util).
   - **Empty state** (0 cases): replace the list with a dashed `#DCE2E6` panel, radius 16, padding 18, copy "No complaints yet. If something goes wrong on a ride, report it here." (**400 13/19** inkSoft). The same pattern as the empty Saved places panel on Home.

Keep: `OfflineState` when offline, `useFocusEffect` reload of `listMyComplaints()`.

---

## 3. Frames 2–4 — New complaint (`app/complaints/new.tsx`, new stack route)

One route, local `step: 1 | 2 | 'sent'` state, so form state survives Back. Move all form logic from today's `(tabs)/complaints.tsx` here: picker, `generalComplaint`, evidence picking with `readFileBytes`, `submitComplaint`, the `attachmentError` warning, and the `rideRequestId`/`category` search params. Nothing in the submit contract changes.

No tab bar. The header sits under the safe area:
- Row padding `6 16 10`, `gap 12`: close/back tile (1.8) — step 1 shows `close` (dismiss the route), step 2 shows `chevron-back` (→ step 1) · title "New complaint" **700 18/24**, −0.3, ink, `flex 1` · "1 of 2" / "2 of 2" **600 13/18** inkSoft.
- Progress: row padding `0 16 12`, `gap 6`, two segments height 5 radius 3. Filled `#002E60`, empty `#DCE2E6`.

### 3.1 Step 1 — trip & category (frame 2)
Content padding `8 16 100`, `gap 20`. Two groups, each `gap 8`, with a question heading **700 17/23**, −0.2, ink (`typography.h3` family bold).

**"Which trip was it?"**
- **Selected trip card** (raised variant 1.5, radius 16, padding 14, `gap 12`):
  - Top row `gap 10`: Avatar 36 (existing `Avatar size="sm"`, `#E3EDF7` / `#002043` initials) · name **600 14/20** ink + `{Mon D, h:mm A} · #{getReferenceCode(ride.id)}` **400 12/17** inkSoft · "Change" **600 13/18** `#002E60`.
  - Route block, `paddingTop 12`, top border 1 `lineSoft`: 10-wide marker column (8×8 green circle `#477434`, 2px `#DCE2E6` line, 8×8 navy square radius 2) · pickup/drop-off lines **400 13/18** ink, `gap 8` · fare **700 15/20** ink aligned to bottom. Hide the fare if the ride row has none.
  - "Change" and a tap on the card open the **existing ride list** (`Card` + `ListRow`s, max-height 280 scroll) as a bottom sheet or inline expansion below the card. Keep the "Cancelled" badge on cancelled rides.
- **Unselected state** (no ride yet): same card at `1px #DCE2E6`, no shadow, placeholder "Select a past ride" inkFaint + `chevron-down`.
- **"Not about a specific ride" option**: white, `1px #DCE2E6`, radius 16, padding `12 14`, row `gap 10`: 18×18 radio (2px `#DCE2E6` ring; selected = 2px `#002E60` ring + 8px `#002E60` dot) · title **600 14/20** ink + sub **400 12/17** inkSoft "e.g. your driver never arrived". Selecting it sets `generalComplaint = true` and dims the trip card to 50% opacity. The two options are mutually exclusive.
- Pre-fill: if `params.rideRequestId` is set (from trip-complete), open straight onto the selected card.

**"What's it about?"** — 2-column grid, `gap 8`, 6 tiles in `CATEGORY_OPTIONS` order: fare, conduct, safety, vehicle_condition, low_rating, other. Visual order in the frame: Fare, Conduct / Safety, Vehicle / Low rating, Other.
- Tile: white, radius 16, padding 12, row `gap 10`: IconTile 34/r11 (category tone) + label **600 13/17** ink.
- Unselected: `1px #DCE2E6`. Selected: `1.5px #002E60` + `0 4 14 rgba(0,46,96,.1)` + a 20×20 `#002E60` check badge at `top −6, right −6` with a 2px `#F6F7F9` border and a 10px white check.
- Default selection: `params.category` if present, else **none** (today it silently defaults to `other`. Remove that, so the rider has to choose).
- `accessibilityRole="radio"`, `accessibilityState={{ checked }}`.

**Footer**: "Continue" + `arrow-forward` 18, `gap 8`. Disabled (opacity .45, no shadow) until `(relatedTripId || generalComplaint) && category`.

### 3.2 Step 2 — details & photos (frame 3)
Content padding `8 16 100`, `gap 16`.

1. **Summary chip**: `fill #EDF1F4`, radius 14, padding `10 12`, row `gap 10`: IconTile 30/r10 (category tone, icon 15) · "{Category} · {Driver}, {Mon D}" or "{Category} · Not about a ride" **600 13/18** ink, 1 line ellipsis · `pencil` 15 inkSoft. Press → step 1.

2. **Subject**: label eyebrow "Subject" · TextField (existing), radius 16, padding `13 14`, **600 14/20**. Focused: `1.5px #002E60` + `0 4 14 rgba(0,46,96,.1)`. Below it, a wrap row of **suggestion chips**, `gap 6`: pill, padding `6 12`, **600 12/16**. Unselected is white with a `1px #DCE2E6` border and inkSoft text. Selected (matches the current subject exactly) is `#002E60` with white text. Tap → `setSubject(chip)`. Chips are **client-side constants** per category, for example:
   - `fare`: "Charged above the fare matrix", "No change given", "Discount not applied"
   - `conduct`: "Rude or unsafe behaviour", "Refused my drop-off point", "Asked for extra passengers"
   - `safety`: "Reckless driving", "Overloaded tricycle", "Felt unsafe during the ride"
   - `vehicle_condition`: "Tricycle in poor condition", "No body number visible"
   - `low_rating`: "Explaining my rating"
   - `other`: none (hide the row)
   Put them in `src/i18n` with the other complaint strings so they translate.

3. **What happened**: eyebrow "What happened" · existing Textarea, radius 16, padding `13 14`, `minHeight 112`, **400 14/20** ink · helper **400 12/17** inkFaint "Include the fare quoted, what you paid and where you were dropped off." (the existing `t.hints.complaintMessage`).

4. **Photos (optional)**: header row, eyebrow left + counter pill right (`fill`, radius pill, padding `2 8`, **600 11/16** inkSoft, "1/3"). Row `gap 10`:
   - Thumbs 76×76 radius 14 (image `cover`), remove badge 22×22 `ink` circle at `top −6, right −6` with a white 10px close.
   - Add tile: **`flex 1`**, height 76, radius 14, `1px dashed #9FB9D4`, white, padding `0 14`, row `gap 10`: `camera-outline` 22 `#002E60` + "**Add photo** — a receipt or the tricycle's body number" (**400 12/17** inkSoft, "Add photo" **600** `#002E60`). When 2 photos exist, the add tile shrinks to 76×76 icon-only (the text no longer fits). At 3 photos it is hidden.
   - `MAX_EVIDENCE_PHOTOS` stays 3.

5. Inline submit error (`submitError`) above the footer: **400 13/18** `danger`, as today.

**Footer**: "Submit complaint". Disabled until `isNonEmpty(subject) && isNonEmpty(message)`. Loading spinner while `submitting`.

### 3.3 Sent (frame 4)
Replaces today's `submitted` EmptyState. No header row, no progress bar.
- Status-bar spacer, then a centred column, padding `40 20 0`, `gap 10`:
  - 76×76 circle `#E9F7E3` with a 10px halo `rgba(233,247,227,.5)` (wrapper circle 96×96), `checkmark` 34 `#3B602B`.
  - "Complaint sent" **800 26/32**, −0.6, ink, `marginTop 12`.
  - "The PSO has your report. We also texted the reference number to your phone." **400 14/21** inkSoft, `maxWidth 300`, centred. Only say "texted" if SMS is actually sent on submit. Otherwise drop the second sentence.
  - If `submittedWarning` (attachment upload failed): show it below in **400 13/18** `danger`, centred.
- Block, padding `22 16 0`, `gap 14`:
  - **Reference card**: navy `gradients.hero` + texture, radius 20, padding `16 18`, row space-between. Left: eyebrow "Reference" (**700 11/15**, 0.8, white @ 60%) + `#{ref}` **800 30/36**, −0.8, white. Right: "Copy" button, **600 13/18** white, `1px rgba(255,255,255,.34)` border, radius 12, padding `8 14` → `Clipboard.setStringAsync('#' + ref)` then label "Copied" for 1.5s.
  - **What happens next** card (white, radius 18, padding 16, `gap 14`): eyebrow + 3 rows, row `gap 12`, 26×26 radius 8 tile + title **600 14/19** ink + body **400 12.5/18** inkSoft:
    1. Tile `#E9F7E3` with `checkmark` 12 `#3B602B` — "Received" / "Just now"
    2. Tile `#E3EDF7` with "2" (**800 12** `#002E60`) — "Operator reviews it" / "The driver is asked for their side"
    3. Tile `#E3EDF7` with "3" — "You get a decision" / "We'll notify you — it also shows in the tracker"
- Bottom, absolute, padding `12 16` + inset, `gap 6`: primary "Track this complaint" → `router.replace('/complaints/' + newId)` (requires `submitComplaint` to return the new id; see §6) · text button "Back to complaints" **600 15/20** `#002E60`, `minHeight 48` → `router.back()` (lands on the tab, which refreshes on focus).

---

## 4. Frames 5–6 — Tracker (`app/complaints/[id].tsx`)

No tab bar (this is a stack route; the current tutorial mock showing one was wrong). Remove `ScreenHeader`. The navy band carries the back button.

**Navy band** (1.1), content row padding `6 16 22`, **`flexDirection: row`, `alignItems: flex-start`, `gap 12`**:
- Left: back tile on navy (1.8), `flexShrink 0` → `router.back()`.
- Right column `flex 1, minWidth 0, gap 6`:
  - Eyebrow `Complaint #{ref}` **700 11/16**, 0.7, uppercase, white @ 72%.
  - Subject **800 24/30**, −0.6, white, no line limit.
  - Row `gap 8`: StatusChip + `Filed {Mon D} · {Category}` **400 12/17** white @ 72%.

**Body**, padding `16 16 24`, `gap 12`, in a ScrollView.

### 4.1 Now card (in-progress statuses, frame 5)
White, radius 20, padding 16, **`1.5px #002E60` border**, shadow `0 4 14 rgba(0,46,96,.1)`, row `gap 12`: IconTile 38/r12 `#E3EDF7` + `time` icon 18 `#002043` · column: eyebrow "Now" (**700 11/15**, 0.7, `#002E60`), title **700 15/21** ink `marginTop 2`, body **400 12.5/18** inkSoft.

| Status | Title | Body |
| --- | --- | --- |
| `open` | "Waiting for review" | "The operator will pick this up soon. Nothing needed from you." |
| `under_review` | "Being reviewed" | "The operator is checking your report. Nothing needed from you." |
| `mediation_scheduled` | "Mediation scheduled" | `mediation_meeting_at` + `mediation_location` if exposed (§6), else "The operator will contact you with a time and place." |
| `escalated` | "Escalated" | "Your case has been passed to a PSO supervisor." Tile uses `#FBEAE8` / `#931E17` and the border becomes `#B3261E`. |

The frame 5 copy ("Waiting for the driver's side … respond by Sep 15") is the **aspirational** version. Use it only if a driver-response deadline is added to the schema. Otherwise ship the table above.

### 4.2 Decision card (terminal statuses, frame 6)
Replaces the Now card. Radius 20, padding 16, no shadow, row `gap 12`:
- `resolved`: bg `#E9F7E3`; tile 38/r12 `#477434` with a white `checkmark` 18; eyebrow `Decision · {resolvedAt Mon D}` (**700 11/15**, 0.7, `#3B602B`); title "Resolved" **700 15/21** ink. The frame says "Resolved in your favour", but only use that wording if the resolution records the outcome direction. Body = `resolutionNotes` **400 12.5/18** ink. Hide the body if it is null.
- `dismissed`: bg `#EDF1F4`; tile `#838B91` with a white `close`; eyebrow colour inkSoft; title "Closed without action"; body `resolutionNotes`.

### 4.3 Progress card
White, radius 20, padding 16, `gap 14`, `elevation.card`: eyebrow "Progress" + StageTimeline (1.4).

| Stage | Title | Body (in progress only) | Date |
| --- | --- | --- | --- |
| 1 | "Received" | "Reference sent by SMS" | `createdAt` → `Mon D, h:mm A` |
| 2 | "Under review" | "Operator is checking the report" (`mediation_scheduled`: "Mediation scheduled") | status-change date if available, else none |
| 3 | "Decision" | "The outcome will appear here" | `resolvedAt` → `Mon D` |

On terminal statuses (frame 6) hide the bodies and show only titles and dates. The rows tighten to `paddingBottom 12` and the connector gets `minHeight 14`.

### 4.4 Details card
White, radius 20, padding `4 16`, rows separated by 1px `lineSoft`:
- **Trip row** (only if `rideRequestId`): Avatar 32 · `{Driver} · {Mon D}` **600 14/20** ink + `{pickup} → {dropoff} · ₱{fare}` **400 12/17** inkSoft, 1 line ellipsis · `chevron-forward` 14. Press → the ride's detail route from History.
- **Evidence row** (in-progress only): IconTile 32/r10 `#E3EDF7` with `image-outline` · "{n} photo(s) attached" / "No photos yet" **600 14/20** ink · "Add more" **600 13/18** `#002E60` (hidden when n = 3). This needs an "add attachment to existing complaint" call (§6). If you don't build that call, hide "Add more" and the row stays informational.

### 4.5 Follow-up line (terminal only, frame 6)
Padding `4`, row `gap 12`: `information-circle-outline` 16 inkSoft + "Still not right? **File a follow-up** and quote #{ref}." **400 12.5/18** inkSoft, link **600** `#002E60` → `router.push({ pathname: '/complaints/new', params: { rideRequestId, category } })`.

Keep: the loading `Spinner` and the not-found `EmptyState`. Both now render under the navy band, with the eyebrow and title replaced by skeleton bars (`#E4E8EC`, radius 7).

---

## 5. Tutorial & deep links (must be updated in the same PR)

- `booking/trip-complete.tsx:124` → push `/complaints/new` with the same params.
- `booking/ride-cancelled.tsx:36` and `profile/privacy-safety.tsx:174` → keep `/(tabs)/complaints` (the tab is now the list, which is right for those entry points).
- `usePassengerTutorialNavigation.ts`: `complaint` → `/complaints/new`. `status` is unchanged.
- `useComplaintFormTutorialDemo` must now also seed a selected ride card (`relatedTripLabel`, a pickup/drop-off pair and a fare) and `category: 'fare'`.
- Tutorial targets:
  - `trip-and-category` → wrap **both** step-1 groups (trip card + category grid).
  - `evidence-and-submit` → on step 2, wrap the Photos block **and** the footer button. Because the footer is absolute, register two targets and union their rects, or target the Photos block only and update the tooltip copy.
  - `progress-card` → the Progress card (4.3), unchanged id.
  - Re-measure the design-frame fallback rects in `steps.passenger.ts` against the new layout.
  - The tutorial demo for step 2 needs step = 2 forced while the step is active.

---

## 6. Backend deltas (small — confirm before building)

1. `submitComplaint` should return the new complaint `id`, so "Track this complaint" can deep-link. If it doesn't today, `select('id').single()` after the insert.
2. `listMyComplaints` should return `category`, `created_at` and `resolved_at` in addition to `id, subject, status`, for the case card meta and the stats strip.
3. `getMyComplaint` already returns `resolvedAt` and `resolutionNotes`. Optionally add `ride_request_id`, the ride's driver/pickup/drop-off/fare, the attachment count, and `mediation_meeting_at` / `mediation_location` for 4.1 and 4.4.
4. **Not required for launch** (the design degrades gracefully without them): per-stage timestamps, driver-response deadline, add-evidence-to-existing-case.

---

## 7. Copy (verbatim, add to `src/i18n` under `complaints`)

Tab: "Complaints" · "Report a problem and follow it to a decision." · "In progress" · "Resolved" · "Report a problem" · "Takes about two minutes" · "Common issues" · "Your cases" · "See all" · "Updated {date}" · "Closed {date}" · "No complaints yet. If something goes wrong on a ride, report it here."

Flow: "New complaint" · "{n} of 2" · "Which trip was it?" · "Change" · "Select a past ride" · "Not about a specific ride" · "e.g. your driver never arrived" · "What's it about?" · "Continue" · "Subject" · "What happened" · "Include the fare quoted, what you paid and where you were dropped off." · "Photos (optional)" · "Add photo" · "— a receipt or the tricycle's body number" · "Submit complaint"

Sent: "Complaint sent" · "The PSO has your report. We also texted the reference number to your phone." · "Reference" · "Copy" · "Copied" · "What happens next" · "Received" · "Just now" · "Operator reviews it" · "The driver is asked for their side" · "You get a decision" · "We'll notify you — it also shows in the tracker" · "Track this complaint" · "Back to complaints"

Tracker: "Complaint #{ref}" · "Filed {date} · {category}" · "Now" · Now-card table (4.1) · "Decision · {date}" · "Resolved" · "Closed without action" · "Progress" · "Received" · "Reference sent by SMS" · "Under review" · "Operator is checking the report" · "Decision" · "The outcome will appear here" · "{n} photo attached" / "{n} photos attached" · "No photos yet" · "Add more" · "Still not right?" · "File a follow-up" · "and quote #{ref}."

Categories (existing keys): Fare dispute · Driver conduct · Safety · Vehicle condition · Low rating · Other.

---

## 8. Acceptance checklist

- [ ] Frames 1–6 match the screenshots side by side on a 390pt device (iPhone 14/15) and on a 360dp Android.
- [ ] The tab shows the list only. The form lives at `/complaints/new`. Back from step 2 keeps every field.
- [ ] Nothing is preselected in the category grid unless it came from a param.
- [ ] Continue and Submit are disabled until they are valid. Disabled = 45% opacity, no shadow.
- [ ] The status chip and stage bar are correct for all 6 DB statuses (unit-test the mapping next to `complaintStages.test.ts`).
- [ ] "Under review" is blue, never green.
- [ ] The tracker has no tab bar. The back button sits left of the title block, top-aligned.
- [ ] Offline, loading, not-found, empty-list and attachment-failed states are all rendered.
- [ ] Every tile, chip and row is at least 44pt tall/wide for touch (the chip visual can be smaller if the hit area is `hitSlop`-padded).
- [ ] The tutorial runs end to end with the new routes and targets.
- [ ] No new colours, fonts or radii beyond `packages/ui/src/theme`.
