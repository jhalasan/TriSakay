# Spec 1: trip records (1a · 1b · 1c)

Read README §2 first; the shared visual system isn't repeated here. Sizes are px at 390 width, and type is written as `size/lineHeight weight`.

---

## 1a. Ride details (passenger) & Trip details (driver)

**Files:** `apps/passenger/app/history/[id].tsx`, `apps/driver/app/history/[id].tsx` (+ their styles).
**PNGs:** `1a-1`, `1a-2`, `1a-3`, `1a-4`.
**Problem:** five stacked labelled cards that read like a form.
**Goal:** one story. The band says what happened and what it cost, the journey card says where, and the person and the receipt follow.
**Data:** nothing new. Drop-off time is derived (README D3).

### Layout, top to bottom

**1. Navy band** (`NavyBandHeader`, bottom padding 58)
- **Row:** back tile · title (17/24 bold white: "Ride details" / "Trip details", flex 1) · status pill.
  - Passenger pills: Completed (green), Cancelled (red).
  - Driver pills: Done (green), Cancelled (red).
- **Hero** (padding 0×4, gap 2):
  - *Passenger, completed:*
    - date line "Thu, Aug 28, 2026 · 4:12 PM" (13/18, white 78%)
    - fare **44/52 extrabold** white, letter-spacing −1.4
    - meta row (wraps): wallet/cash icon 15 + "Paid with GCash" / "Paid in cash" (12.5/18 semibold white) · 3 px dot white 50% · "20% discount applied" (12.5/18 semibold `#B9E3A6`). Show the discount only when the ride had one.
  - *Driver, done:*
    - eyebrow "YOU EARNED" (11/15 bold uppercase, letter-spacing 0.8, white 66%)
    - amount 44/52 extrabold
    - meta: cash icon + "Cash · collected" / "GCash · received" · dot · "Fri, Sep 12 · 5:40 PM" (400, white 78%)
  - *Cancelled (both):*
    - date line
    - "Ride cancelled" / "Trip cancelled" at **32/40 extrabold**, letter-spacing −1
    - sub-line 12.5/18 semibold white 86%: passenger "You weren't charged", driver "No earnings for this trip"

**2. Overlap card** (`marginTop -42`, radius 22, hero shadow)
- *Completed/done:* the **journey card**.
  - **Driver only:** a passenger row first (padding 14×16, bottom separator):
    - avatar 42 green pair with initials
    - "PASSENGER" label (11/15 semibold uppercase `#666F75`) over the name (15/21 bold)
    - on the right, a seat chip: `#F6F7F9` pill, person icon 13 + "1 seat" (12/16 semibold)
  - **Route:** `RouteRail` with labels and times (padding 16/16/14, gap 16 between stops).
    - Labels: passenger "PICKUP" / "DROP-OFF"; driver "PICKED UP" / "DROPPED OFF" (11/15 semibold uppercase, letter-spacing 0.5, `#666F75`).
    - Place name 15/21 semibold ink.
    - Time 13/21 semibold `#5A646B`, right-aligned, top-padded 15 so it lines up with the place name.
  - **StatCells:** passenger has 3 (Distance, Duration, Seat[s]); driver has 2 (Distance, Duration). Value 16/22 bold, caption 11.5/16 `#5A646B`, cell padding 11, top border.
- *Cancelled:* a **reason card** replaces it.
  - red icon tile 38 with `information-circle`
  - "WHY IT WAS CANCELLED" (11/15 bold uppercase `#931E17`)
  - reason 15/21 semibold ink (the cancel reason label from the ride row)
  - If there's no reason, show "No reason given".

**3. Below the overlap card** (gap 12, horizontal padding 16; bottom padding 110 with an action bar, 100 without)

*Passenger, completed:*
- **Driver card** (radius 20):
  - avatar 46 navy
  - name 15/20 bold + star 13 green + rating 12.5 bold
  - row: green `shield-checkmark` 14 + body-number tag + plate tag
- **Receipt card** (padding 16, gap 10):
  - "RECEIPT" label
  - "Base fare" / amount (14/20)
  - "Discount · 20%" / "−₱9.00" (green, semibold). Only when discounted.
  - hairline
  - "Total paid" 15/21 bold / total 18/24 extrabold
  - payment row: `#F6F7F9` inner card radius 14, padding 10×12, navy icon tile 30 + method name 13.5 semibold + status pill "Paid" (green)
  - footer: "Trip reference **#T5518**" (mono bold for the ref) + a "Copy" link (copy icon 14, 13/18 semibold navy). Copy writes to the clipboard and shows the existing toast.

*Passenger, cancelled:*
- journey card **without times**, with StatCells "Planned distance" + "Seats"
- a compact driver card: avatar 40, name 14.5 bold, "Assigned driver · Body 042" (12/17). Hide it if no driver was assigned.
- the trip-reference row on the canvas (not in a card), padding 4×6

*Driver, done:*
- **Payment + reference card** (padding 4×16), two rows:
  - green cash tile 34 + "Cash" / "Payment method" + "Paid" pill
  - neutral tile with "#" glyph + ref in mono 14/20 bold / "Trip reference" + Copy
- **Report row card:** red flag tile 34 + "Report a problem with this trip" (14/20 semibold) / "Opens complaints with this trip filled in" (12/17) + chevron. It goes to driver complaints step 1 with this trip preselected.

*Driver, cancelled:*
- reason card
- the passenger + route card is not an overlap card (normal shadow), with no times and no stat cells
- ref row on the canvas
- report row card

**4. Bottom bar (passenger only)**
- Left: outline "Get help" (flex none, padding 0×16, 1.5 px `#DCE2E6`, flag icon 16 `#5A646B`, 15/20 semibold). It opens passenger complaints with this ride prefilled.
- Right: primary (flex 1, min-height 52), `refresh` icon 17 + "Book this route again" (completed) / "Try this ride again" (cancelled). See README D5.
- **The driver app has no bottom bar.**

### States & edge cases
- Loading: skeleton band + two card skeletons (reuse the existing skeleton if one exists).
- Missing duration: hide the drop-off time and the Duration cell (a passenger 3-cell grid becomes 2 cells).
- Long place names: wrap to 2 lines max, then ellipsis.
- Seat count: "1 Seat" / "2 Seats" (caption pluralised; the value is the number).

---

## 1b. Driver: My documents

**File:** `apps/driver/app/profile/documents.tsx` (+ styles).
**PNGs:** `1b-1`, `1b-2`.
**Keep:** the same store and the same `setExpiry(doc.id, date | null)`. The 30-day "expiring" threshold is unchanged.

### Status derivation (per document)
`expired` if date < today · `expiring` if 0 ≤ days ≤ 30 · `valid` if > 30 · `unset` if null.

### Layout
**1. Navy band** (bottom padding 20, with shadow)
- back tile + "My documents" (17/24 bold)
- Headline block (padding 0×4, gap 10):
  - headline 24/30 extrabold, letter-spacing −0.6: "{n} need attention" where n = expired + expiring. When n = 0: "All documents up to date".
  - sub 13/19, white 74%: "Keep expiry dates current so the PSO can keep you verified."
  - **Health bar:** `ProgressSegments`, one segment per document, 6 px high, gap 4, ordered expired → expiring → valid → unset. Colours:
    - expired `#E0675E`
    - expiring `#7FB2E5`
    - valid `#8BC873`
    - unset white 22%
  - **Legend** (gap 14, 11.5/16 semibold white 86%): 7 px dot + "1 expired", "1 expiring", "1 valid", "1 not set". Omit zero counts.

**2. Content** (padding 16/16/24, gap 18)
- **"NEEDS ATTENTION"** group (only if n > 0), listing expired documents first, then expiring:
  - *Expired card:* white, radius 20, **1.5 px `#F2C4BF` border**, overflow hidden (put the shadow on a wrapper).
    - Top row (padding 14×16): red tile 40 with the doc icon · name 15/21 bold · status line 12.5/18 semibold `#931E17`, e.g. "Expired 28 days ago · Sep 2, 2026".
    - Footer strip: bg `#FDF4F3`, top border `#F7DAD6`, padding 10×16.
      - "Renewed it? Enter the new date." (12/17 `#5A646B`, flex 1)
      - small primary: navy fill radius 11, padding 8×12, calendar icon 14 + "Update date" (13/18 bold white)
  - *Expiring card:* plain white card, row layout.
    - navy tile 40 · name · "Expires in 14 days · Oct 14, 2026" (12.5 semibold `#002E60`)
    - "Soon" pill (navy)
- **"UP TO DATE"** group, one card with rows separated by hairlines:
  - *Valid row:* green tile · name · "Valid until Mar 3, 2027" (12.5/18 `#5A646B`) · green `shield-checkmark` 18.
  - *Unset row:* neutral tile · name · "No expiry date set" · "+ Add" link (13/18 semibold navy).
- **Footnote:** info icon 16 + "Dates are entered by you. Use the date printed on each document." (12.5/18 `#5A646B`)
- Doc icons:
  - franchise permit / OR-CR: `document-text-outline`
  - license: `card-outline`
  - tricycle photo: the trike/`bicycle-outline` icon already used in the app

**Tapping** any row, the Update date button or Add opens the sheet.

### Date sheet (`1b-2`)
- Scrim `colors.overlay`. The sheet is white with top radius 28, padding 10/20/26, gap 16, shadow `0 -10 30 rgba(0,0,0,.18)`.
- Handle: 40×5 `#DCE2E6`.
- Header row: status-tinted tile 40 · doc name 17/23 bold / "Set the new expiry date" 12.5/18 · close tile 34 (`#F6F7F9`, radius 11, close icon 14).
- **Picker:** native wheel (iOS spinner). The prototype shows a `#F6F7F9` well, radius 18, height 190, with a white 38 px selection band. On Android, use a date field row that opens the native dialog and keep the preview below it.
  - Initial value = the current date, or today if unset.
  - Min = today − 1 year (so a driver can record a date that has already passed); no max.
- **Live preview chip** (radius 14, padding 11×14), recomputed as the date changes:
  - valid → green pair + shield: "Valid · about 11 months from today"
  - expiring → navy pair: "Expires in {n} days"
  - expired → red pair: "Already expired"
- Primary: "Save {Mon D, YYYY}" (e.g. "Save Aug 31, 2027") → `setExpiry(id, date)`, closes, shows the existing success toast.
- Text button: "Clear date" (only if a date is set) → `setExpiry(id, null)`.
- Error from the store: inline red text above the primary; the sheet stays open.

---

## 1c. Driver: Complaints

**Files:**
- `apps/driver/app/complaints.tsx` (home + filing)
- new `apps/driver/app/complaints/[id].tsx` (case page, D6)

The filing steps can be a stack route (`complaints/new.tsx`) or in-screen steps. Match whatever passenger 2a shipped.

**PNGs:** `1c-1` … `1c-4`.
**Reference:** `design_handoff_trisakay_complaints` 2a (passenger). This is the same design with driver content. Reuse its components.
**No tab bar.** It's reached from Profile, trip details (1a), and ratings (3a).

### Driver categories (in this order; map them to the existing driver enum)
| Label | Tile tone | Icon |
|---|---|---|
| Fare dispute | green | cash |
| Passenger conduct | navy | person |
| Safety | red | shield |
| Unfair rating (`low_rating`) | navy | star-outline |
| Vehicle damage | navy | construct/wrench |
| Other | neutral | ellipsis-horizontal |

### Home (`1c-1`)
- **Navy band** (padding 6/16/20, gap 12):
  - back tile + "Complaints" **28/34 extrabold**, letter-spacing −0.7
  - sub "Report a passenger or trip problem to the PSO." (13/19, white 72%)
  - stats row with top border white 14%, padding-top 12: two columns split by a 1 px divider (white 14%), each a number 22/26 extrabold over a caption 12/16 white 72% ("Open or in review", "Closed")
- **Primary card** (radius 22, shadow `0 4 14 rgba(0,46,96,.1)`, padding 16): navy fill tile 48 radius 15 with a white + · "Report a problem" 16/22 bold / "Two short steps" 12.5/18 · arrow 18 navy. Starts step 1.
- **"COMMON ISSUES":** 3-column grid, gap 8. Each is a small card (radius 16, padding 12×10) with tile 34 over a label 12.5/16 semibold. Shows the first 3 categories, and tapping one opens step 1 with it preselected.
- **"YOUR CASES":** cards (radius 18, padding 14×16, gap 10), newest first.
  - Row: "{Category} · {Mon D}" (11/16 semibold, letter-spacing 0.5, `#666F75`) + status pill.
  - Subject 15/21 semibold.
  - **3-segment bar** (5 px): Open → Under review → Closed.
    - Done segments green `#477434`.
    - The current segment is navy `#002E60`; when Closed, all three are green.
    - Future segments `#DCE2E6`.
  - Footer (only when a trip is linked): "{Passenger} · {Pickup} → {Drop-off}" (12/17) + chevron.
  - Tap → case page.
- **Empty state:** no cases → hide "YOUR CASES" and show the existing EmptyState under Common issues: "No complaints yet".

### Step 1 (`1c-2`)
- Plain header: **close** tile (X) · "New complaint" · "1 of 2" (13/18 semibold `#5A646B`).
- Progress: 2 segments, 5 px, gap 6, padding 0/16/12.
- Question headings 17/23 bold, letter-spacing −0.2, gap 20 between blocks.
- **"Which trip was it?"**
  - Selected trip card (focused style):
    - top: passenger avatar 36 green pair · name 14/20 semibold / "Sep 12, 5:40 PM · #T5612" (12/17) · "Change" link, which opens a picker of recent trips (existing list)
    - bottom, above a hairline: compact rail (8 px dots) with pickup / drop-off 13/18 and the fare 15/20 bold, right-aligned at the bottom
  - Alternative row: radio 18 (2 px `#DCE2E6`) + "Not about a specific trip" / "e.g. an app or account problem". Selecting it deselects the trip.
  - Default: the most recent trip, or the trip passed in from 1a/3a.
- **"What's it about?":** 2-column grid of `SelectTile` (navy accent), single-select.
- Bottom: primary "Continue →", disabled until a category is picked.

### Step 2 (`1c-3`)
- Header: **back** tile · "New complaint" · "2 of 2". Both progress segments are navy.
- **Summary chip:** `#EDF1F4` radius 14, padding 10×12: category tile 30 + "Fare dispute · Maria Reyes, Sep 12" (13/18 semibold, one line with ellipsis) + pencil 15. Tapping it returns to step 1.
- **"SUBJECT":** focused input showing the value. Below it, suggestion chips per category (radius 999, padding 6×12, 12/16 semibold):
  - selected: navy fill with white text
  - unselected: white with `#DCE2E6` border and `#5A646B` text
  - Tapping a chip fills the subject.
  - Fare dispute suggestions: "Passenger paid less than the fare", "Refused to pay", "Discount ID not shown". Write 2–3 for each other category and list them in the Phase 0 report.
- **"WHAT HAPPENED":** textarea, min-height 112. Hint below (12/17 `#666F75`) per category; for fare it's "Include the fare shown, what you received and where."
- **"PHOTOS (OPTIONAL)"** + a "0/3" counter pill: dashed slot (1 px `#9FB9D4`, radius 14, height 76) with camera 22 + "**Add photo** — damage to the tricycle, or a screenshot". Maximum 3 thumbnails; reuse the passenger photo picker.
- Bottom: primary "Submit complaint". While sending it shows a spinner and is disabled. On success → case page (`router.replace`) + the existing toast. On error → inline error block above the button.
- Validation: subject required (≥ 3 chars), message required (use the existing min length).

### Case page (`1c-4`, new route)
- **Navy band** (padding 6/16/22, back tile top-aligned):
  - eyebrow category (11/16 bold uppercase white 72%)
  - subject 24/30 extrabold (wraps)
  - row: status pill + "Filed Sep 12" (12/17 white 72%)
- **"Now" card** (1.5 px navy border, padding 16): navy tile 38 with time icon · "NOW" (11/15 bold navy) · headline 15/21 bold · body 12.5/18. Copy per status:
  - Open: "Your report was sent" / "The PSO will pick it up soon."
  - Under review: "The PSO is reviewing your report" / "Nothing needed from you. You'll get a notification when it's closed."
  - Closed: "This case is closed" / the resolution note, if the row has one; otherwise "Thanks for reporting."
- **"PROGRESS":** vertical 3-step timeline.
  - Done: 22 green disc with check + a green 2 px connector.
  - Current: 22 white disc with a 2 px navy border, an 8 px navy dot and a 4 px `#E3EDF7` halo; grey connector.
  - Future: 22 white disc, 2 px `#DCE2E6`, label in `#666F75`.
  - Dates are right-aligned (12/22 `#666F75`) wherever a timestamp exists.
- **"YOUR REPORT":** the message (13.5/20), plus photo thumbnails if any.
- **Linked trip row** (only if linked): avatar 32 · "Maria Reyes · Sep 12" / "Poblacion Plaza → Public Market · ₱45.00" (one line, ellipsis) · chevron → driver trip details (1a).
