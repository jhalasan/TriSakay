# Spec 3: ratings (3a)

Read README §2 first. Sizes are px at 390 width.

---

## 3a-P. Passenger: Rate driver

**File:** `apps/passenger/app/booking/rate-driver.tsx` (+ styles).
**PNGs:** `3a-1` (empty), `3a-2` (5★), `3a-3` (2★).

**Problems fixed:**
1. "Skip for now" only appeared after a submit error.
2. All 8 tags showed at every score.
3. The stars had no meaning label, and the vertically centred layout pushed Submit under the keyboard.
4. A 1–2★ ride had no route to the PSO.

**Params:** `rideRequestId` (existing), plus optional `initialScore` (from 2a).

### Header: navy band, two sizes
- **Before a score (`3a-1`, `3a-2`), large** (padding 6/16/22, gap 16):
  - row: "TRIP COMPLETED" (11/16 bold uppercase, letter-spacing 0.8, white 72%) · "**Skip for now**" (14/20 semibold white, padding 8×4, hit slop)
  - driver row: avatar 60 (`#E3EDF7`, 3 px white-25% border, initials 19 bold) · name **22/28 extrabold** · "₱36.00 paid via GCash · 2.4 km" (12.5/18 white 78%)
- **Low score (`3a-3`), compact**, which leaves room for the extra content (padding 6/16/18, row, gap 12): avatar 44 · name 17/23 bold / fare line 12/17 · "Skip" (14/20 semibold). No motif.
- Rule: use compact when score ≤ 3 **or** the keyboard is open; otherwise large. Animate the height change with `LayoutAnimation`.
- **Skip is always visible.** It goes to the same place as a successful submit, without submitting.

### Body
- **Empty (`3a-1`):** padding 34/20/0, centred, gap 14.
  - "How was your ride?" 24/30 extrabold
  - `StarPicker` 44 px, gap 10, all `#DCE2E6`
  - hint "Tap a star — your rating is anonymous to {firstName}" (13/19 `#5A646B`)
  - Submit is disabled.
- **After a score** (padding 22/16/110, gap 18; the heading is hidden):
  - Stars 44 with a **word under them** (17/23 bold):

    | Score | Word | Star colour | Word colour |
    |---|---|---|---|
    | 1 | Terrible | `#B3261E` | `#931E17` |
    | 2 | Poor | `#B3261E` | `#931E17` |
    | 3 | Okay | `#002E60` | `#002E60` |
    | 4 | Good | `#477434` | `#3B602B` |
    | 5 | Excellent | `#477434` | `#3B602B` |

    Unfilled stars stay `#DCE2E6`. Tapping another star changes the score and **clears tags that no longer apply**.
  - **Tags** (2-column `SelectTile` grid, gap 8, multi-select):
    - 4–5★: label "WHAT STOOD OUT? (OPTIONAL)"; **green** accent; the four positive `RATING_TAGS`:
      - Friendly: person
      - Safe driving: shield
      - Clean vehicle: trike
      - On time: time
    - 1–3★: label "WHAT WENT WRONG?"; **red** accent; the four negative tags:
      - Unsafe driving: alert
      - Late: time
      - Rude: person
      - Poor vehicle condition: wrench
    - Map labels to the existing enum values. **Don't add values.** If the enum has a different split, report it in Phase 0.
    - Selected positive tiles also get a shadow `0 4 14 rgba(71,116,52,.14)`. Selected negative tiles have no shadow.
  - **Comment:**
    - 4–5★: collapsed row. White, 1 px **dashed** `#9FB9D4`, radius 16, padding 13×14: pencil 16 navy · "Add a comment" 13.5/19 semibold navy · "Optional" (12/17 `#666F75`). Tapping it expands to the textarea and focuses it.
    - 1–3★: **open** by default. Label "COMMENT (OPTIONAL)" + a focused-style textarea, min-height 80. Keep the existing max length and show the counter once within 20 of it.
  - **Report card, ≤ 2★ only** (the threshold is a constant, `REPORT_PROMPT_MAX_SCORE = 2`):
    - `#FBEAE8` radius 16, padding 12×14: flag 18 `#931E17` · "Something serious?" 13.5/19 bold / "A rating isn't a report. Tell the PSO." (12/17 ink 80%) · "Report" (13/18 bold `#931E17`)
    - Tapping it → `/complaints/new?rideRequestId=…` (D7). The rating draft is kept; after returning, the page is still there.
- **Bottom bar:** primary "Submit rating", disabled until a score is chosen. It submits score + tags + comment through the existing service. While sending it shows a spinner. On error, it shows an inline error above the button **and** the button stays (Skip is already in the header).
- **Keyboard:** the content scrolls (`KeyboardAvoidingView` / `keyboardShouldPersistTaps="handled"`), and the bottom bar rides above the keyboard. Never centre the content vertically.
- With `initialScore`, open straight into the after-score state.

---

## 3a-D. Driver: My ratings

**File:** `apps/driver/app/ratings.tsx` (+ styles).
**PNG:** `3a-4`.
**Data:** `useRatingsStore` must also select `tags` (D1). Everything else is already loaded.

### Navy band (padding 6/16/18, gap 14, shadow)
- back tile + "My ratings" 22/28 extrabold
- **Summary row** (gap 18):
  - Left column:
    - average **44/48 extrabold** (letter-spacing −1.4, one decimal)
    - 5 stars 13 in `#8BC873`, filled to the rounded average
    - "{n} ratings" (11.5/16 white 72%)
  - Right column (flex 1, gap 4): 5 rows from 5 down to 1. Each row (11/14 semibold white) is:
    - the digit (width 8, 80%)
    - a track (flex 1, 6 px, radius 3, white 16%) with a fill at width = share
    - the **percentage** right-aligned (width 28, 80%)
    - Fill `#8BC873` for 2–5; **`#E0675E` for the 1★ row**.
    - Percentages come from the existing distribution and should sum to about 100.
- **Filter chips** (gap 6): "All", "With comments", "Low" (Low = ≤ 2★). Active: white bg, 12.5/16 bold navy, padding 7×13. Inactive: 1 px white-30% border, semibold white, padding 6×12. The filters are client-side over the loaded list.

### Content (padding 14/16/24, gap 12)
- **"WHAT PASSENGERS MENTION":** wrapping chips (gap 6, radius 999, padding 5×11, 12/16 semibold), each showing the label + a count (800 weight; use `fontFamily` extrabold, not `fontWeight`).
  - Positive tags use the green pair; negative tags use the red pair.
  - Sorted positive-first by count desc, then negative by count desc.
  - Counted over the loaded ratings. Hide the section if there are no tags.
- **Rating cards** (radius 18, padding 14×16, gap 8):
  - top row: 5 stars 14 (4–5 filled green `#477434`, 3 filled navy, 1–2 filled red `#B3261E`; empty `#DCE2E6`) · date (12/17 `#666F75`)
  - comment 13.5/20 ink, if present
  - tag chips (11/15 semibold, padding 3×9): neutral pair (`#EDF1F4` / `#5A646B`) on 4–5★, red pair on 1–3★
  - **≤ 2★ only:** footer above a hairline (padding-top 8): flag 14 + "Report unfair rating" (13/18 semibold navy) → driver complaints step 1 with category **Unfair rating** (`low_rating`) and the linked trip preselected
- Empty: the existing EmptyState ("No ratings yet").
- Filter with no matches: the small inline text "No ratings match this filter".
- Passenger identity is **never shown** on driver rating cards (ratings are anonymous). Don't add names.
