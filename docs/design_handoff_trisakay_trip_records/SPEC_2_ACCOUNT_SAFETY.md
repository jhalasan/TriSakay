# Spec 2: trip complete, safety, account (2a · 2b · 2c)

Read README §2 first. Sizes are px at 390 width.

---

## 2a. Passenger: Trip complete

**File:** `apps/passenger/app/booking/trip-complete.tsx` (+ styles).
**PNGs:** `2a-1`, `2a-2`.
**Problem:** a check icon, label/value rows and a plain Continue.
**Goal:** the fare is the hero, it uses the same journey card as 1a, and rating starts on this page.

### Layout
**1. Navy band** (no back button; padding 14/20/60; centred, gap 6)
- green disc 56 (`#E9F7E3`) with a check 26 `#3B602B` and an 8 px `rgba(233,247,227,.16)` halo
- "You've arrived" 15/21 bold white, 8 above
- fare **46/54 extrabold**, letter-spacing −1.4
- payment line (12.5/18 semibold white 90%): wallet icon + "Paid with GCash · settled", or cash icon + "Paid in cash". Use the existing receipt status wording for GCash pending/failed.

**2. Content** (`marginTop -40`, padding 0/16/120, gap 12)
- **Normal (`2a-1`):**
  - *Journey card* (overlap, hero shadow): `RouteRail` with names only (no labels, no times), gap 14. Then 2 StatCells: "2.4 km / Distance" and "#T5518 / Trip ref." (the ref value in mono 15/22 bold).
  - *Driver + rate card* (radius 22, padding 18×16, centred, gap 12):
    - left-aligned row: avatar 46 + name 15/20 bold + plate tag
    - hairline
    - "How was your ride?" 16/22 bold
    - `StarPicker` size **36**, empty colour `colors.line`
    - hint "Tap a star to rate {firstName}" (12/17 `#5A646B`)
- **Fare flagged (`2a-2`, when `receipt.fareFlagged`):** the amber card **replaces the journey card's overlap slot**. The journey card moves below it (normal shadow). The driver/rate card is not shown above the fold in the prototype; keep it below the journey card on scroll.
  - Amber card: bg `#FFF6E0`, 1.5 px `#E9C46A`, radius 22, padding 16, gap 12, hero shadow.
    - Row: amber tile 38 (`#F7E2A8`, alert icon `#7A5A00`) · title "Drop-off didn't match your booking" 15/21 bold · body "This trip ended somewhere different from your booked destination." (12.5/18 `#4A3B0F`)
    - Compare box: white radius 14, padding 10×12. Rows "Booked" / {destination} and "Ended near" / {end address} (label `#5A646B`, value ink semibold). Omit "Ended near" if the data isn't there (README D4).
    - Button: **ink** fill `#14191D`, radius 12, min-height 46, flag icon + "Report a fare issue" (15/20 bold white) → `/complaints/new?category=fare&rideRequestId=…`

**3. Bottom bar** (gap 4)
- primary "Rate {firstName}"
- text button "Skip for now" (14/20 semibold `#5A646B`), which goes to the same destination as the old Continue

### Behaviour
- Tapping star *n* navigates to `rate-driver` with `initialScore=n`. The rate page opens with n selected (3a).
- "Rate {firstName}" → `rate-driver` with no score.
- The fare-flagged card sits above the fold and ahead of the rating on purpose. Don't reorder it.
- Already rated (if the store knows): hide the stars and show "Thanks — you rated {n}★", and the primary becomes "Done".

---

## 2b. Privacy & Safety Center (both apps)

**Files:**
- `apps/passenger/app/profile/privacy-safety.tsx`
- `apps/driver/app/profile/privacy-safety.tsx` (use the real paths)

**PNGs:** `2b-1`, `2b-2`.
**Problem:** "Send SOS to PSO" and "Call 911 / PNP" are two equal red buttons under a red banner, and a confirm Alert is the only thing stopping an accidental SOS.
**Change:** a single press-and-hold SOS, a separate quiet 911 row, and the reading material collapsed.

### Layout
- Plain header: back tile + "Privacy & Safety".
- Content: padding 6/16/24, gap 14.

**1. SOS card** (white, radius 24, padding 22/18/18, shadow `0 4 14 rgba(0,46,96,.1)`, centred, gap 12)
- **Hold button** (`HoldToConfirmButton`, `variant="disc"`):
  - Outer disc 148, `#FBEAE8`.
  - Ring track: 5 px `#F2C4BF` inset border. **While held, a progress ring fills clockwise over this track over 2000 ms** (danger colour). Use `react-native-svg` if it's already in the repo; otherwise use the component's existing progress mechanism.
  - Inner disc 116: gradient `#C62E24 → #931E17`, shadow `0 10 24 rgba(179,38,30,.35)`, "SOS" 26/30 extrabold (letter-spacing 0.5) over "Hold 2s" 11/15 semibold white 90%.
  - Press-in: scale 0.97 + haptic (light). Completion: haptic (success) → send. Releasing early resets the ring (animate back over 200 ms) and doesn't send.
  - Accessibility: role button, label "Send SOS to PSO", hint "Press and hold for 2 seconds". With a screen reader running, fall back to a double-tap **plus the old confirm Alert**, since holding is hard with VoiceOver/TalkBack.
- Title "Send SOS to PSO" 17/23 bold.
- Body (max-width 290): "Press and hold. Shares your live location with PSO right now, even without an active ride."
- **911 row** (top hairline, padding-top 12): red tile 38 with a call icon · "Call 911 / PNP" 14.5/20 bold / "For immediate danger" 12/17 · chevron. Tapping it runs the existing `Linking.openURL('tel:911')` flow. It's not a hold action.

**2. SOS states** (they replace the SOS card contents in place; the rest of the page stays)
- *Sending:* the inner disc shows a spinner in place of "SOS"; the ring stays full; "Sending…" replaces the title.
- *Sent (`2b-2`):* card border 1.5 px `#477434`.
  - green disc 96 with a 42 check and a 10 px `rgba(233,247,227,.5)` halo
  - "PSO has been notified" 21/27 extrabold
  - body "Your location was shared at {time}. Stay where it's safe; call 911 if you need help right now."
  - location chip: `#F6F7F9` radius 12, pin icon + the reverse-geocoded area (one line, ellipsis), or omit it if there's none
  - **full-width red "Call 911 / PNP" button** (danger gradient, min-height 52)
  - After sent, the SOS can be sent again only after the service's existing cooldown. Show nothing extra.
- *Failed:* a red strip replaces the card body. `#FBEAE8` radius 16, padding 12×14: alert icon 17 `#931E17` · "Could not reach PSO. Try again, or call 911 directly." (12.5/18 ink) · "Retry" (13/18 bold `#931E17`), which re-sends **without another hold**. The 911 row stays visible under it. (The prototype shows the failed strip under the sent card only for reference.)

**3. "ACCOUNT SECURITY"** card: navy key tile 38 · "Change password" 14.5/20 semibold / "Update the password for this account" (12/17) · chevron → change-password.

**4. "LEARN MORE"** card, three `CollapsibleRow`s. Several can be open at once.
- "How in-app SOS works" (navy hand tile): the existing SOS explainer copy.
- "Safety tips" (green shield tile) + a count pill (`#EDF1F4`, 11/16 semibold) showing the number of tips. The passenger and driver tip lists come from the existing copy.
- "Your data" (neutral eye tile): the existing data notice copy.
- The chevron rotates 180° when open. Body text 12.5/19 `#5A646B`, indented to the title.

**5. Footer link** (centred): flag 14 + "Report a non-emergency issue" (13/18 semibold navy) → complaints (passenger complaints tab / driver complaints 1c).

**Driver app:** identical layout, driver tips, and driver complaints as the destination.

---

## 2b. Change password (both apps)

**PNG:** `2b-3`. **Keep the feature's current "not available" status.** This is a restyle that makes the form ready for later.

- Plain header: back + "Change password".
- Content: padding 6/16/110, gap 14.
- **Status card:** `#E3EDF7` radius 18, padding 14. White tile 36 radius 11 with a lock icon `#002043` · "Not available yet" 14/20 bold / body 12.5/18 ink 85%: "Changing your password from the app isn't ready in this prototype. Contact PSO if you need help accessing your account." Reuse the existing i18n string if the copy matches.
- **Fields** (label = section-label style, gap 7):
  1. "CURRENT PASSWORD": resting input, masked, eye toggle 18.
  2. "NEW PASSWORD": focused input.
     - **Strength bar:** 3 segments, 5 px, gap 4. Filled green `#477434` = number of rules met; the rest `#DCE2E6`.
     - **Checklist card** (white radius 16, padding 12×14, gap 8, card shadow). One row per rule in `hints.newPassword`:
       - met: 18 green disc with a white 9 px check, text 13/18 semibold ink
       - unmet: 18 empty circle (2 px `#DCE2E6`), text 13/18 `#5A646B`
       - rules: at least 10 characters · upper and lower case letters · a number or symbol
  3. "CONFIRM NEW PASSWORD": placeholder "Type the same password again". On mismatch, show an inline error "Passwords don't match" (red 12/17) once the user has typed as many characters as the new password.
- **Bottom:** "Update password" with a lock icon.
  - **Disabled** (`#DCE2E6` / `#666F75`) while the feature is unavailable.
  - When it ships, it enables once all rules pass and the confirmation matches.
- The checklist is live even while the button is disabled.

---

## 2c. Deactivate account (passenger)

**File:** new route `apps/passenger/app/deactivate-account.tsx`, replacing the confirm Alert (D8). Settings pushes this route as a modal.
**PNG:** `2c-1`.

- Header: **close** tile (X) only.
- **Intro** (padding 8/20/0, gap 10):
  - red tile 56 radius 18 with a 26 alert icon
  - title "Deactivate your account?" 26/32 extrabold, letter-spacing −0.6
  - sub "Here's what happens, so there are no surprises." 14/21 `#5A646B`
- **Facts card** (radius 20, padding 6×16). Three rows, padding 12, hairlines between. Each is a 34 tile + title 14/20 semibold + sub 12.5/18. The text comes from `deactivateAccount.message`, split into three items:
  1. red X: "You can't book rides" / "Starting as soon as you confirm"
  2. green check: "Your ride history is kept" / "Deactivating doesn't delete anything"
  3. navy pin: "Reactivate at the PSO office" / the PSO office address constant
- **Understanding checkbox row:** white radius 16, padding 13×14. 22 box radius 7, "I understand and want to deactivate" 13.5/19 semibold.
  - Unchecked: 1 px `#DCE2E6` border; empty box with a 2 px `#DCE2E6` border.
  - Checked: 1.5 px navy border; navy box with a white 12 check.
  - The whole row is the touch target.
- **Bottom** (no white bar background, gap 6):
  - **danger** primary "Deactivate account", **disabled until checked** (disabled style from README §2)
  - text button "Keep my account" (15/20 semibold **navy**), which closes the page
- On confirm: spinner in the button → the existing deactivate service → the existing sign-out/redirect. On error: an inline error block above the button.

---

## 2c. Account suspended (passenger)

**File:** `apps/passenger/app/account-suspended.tsx`. Mirrors the driver gate.
**PNG:** `2c-2`.

- Background `#F6F7F9` + a large motif at top −40 / right −50, 240 px, danger colour at 5%.
- **Centred block** (padding-top 60 after the safe area, horizontal 22, gap 10):
  - red disc 72 with a 32 lock `#B3261E` and a 10 px `rgba(251,234,232,.5)` halo
  - title "Your account has been suspended" 25/31 extrabold, 14 above
  - body 14/21 `#5A646B`: "A PSO staff member has suspended your account. Visit the PSO office for details and next steps before you can request rides again."
- **PSO office card** (padding 22/16/0, radius 20, padding 16, gap 12, shadow `0 4 14 rgba(0,46,96,.1)`):
  - "PSO OFFICE" label
  - navy pin tile 36 + address 14/20 semibold
  - navy time tile 36 + "Monday to Friday · 8:00 AM – 5:00 PM"
  - Both values come from the existing constants used by the driver gate.
- **Bottom** (gap 6):
  - caption "Already visited? Refresh to check your status." (12/17 `#666F75`, centred)
  - primary with a refresh icon, "Refresh status". It re-checks the status with the existing call, shows a spinner, and routes home if the account is active.
  - text button "Log out"

---

## 2c. Terms & Privacy (passenger; driver too if the route exists)

**File:** `apps/passenger/app/profile/legal.tsx`. The copy comes **verbatim** from `apps/passenger/src/content/legalCopy.ts`.
**PNG:** `2c-3`.

- **Navy band** (padding 6/16/18, gap 14, shadow):
  - back tile + "Terms & Privacy" 22/28 extrabold
  - **Segmented control:** track white 12%, radius 14, padding 4. Active segment: white radius 11, 13.5/34 bold navy. Inactive: 13.5/34 semibold white 80%. Tabs: "Terms of Service" / "Privacy Policy".
  - Version line: "Terms {CURRENT_TOS_VERSION} · Privacy {CURRENT_PRIVACY_VERSION}" (12/17 white 70%)
- **Content** (padding 16/16/24, gap 16):
  - **"WHAT WE COLLECT & SHARE"** (on the Privacy tab; on the Terms tab, show the equivalent disclosures if `legalCopy` has them, otherwise skip this block): one card with the four `DISCLOSURES` as icon rows (tile 32, title 13.5/19 semibold, body 12/17 `#5A646B`, padding 11, hairlines). Icon per item:
    - name & contact: navy person
    - live location: green pin
    - ride & payment history: navy time
    - payment details: navy wallet
  - **"FULL POLICY · {n} SECTIONS"** (15 for Terms, 11 for Privacy; count them from the data): an accordion card (`AccordionGroup`, **one open at a time**). Each row, padding 13:
    - number: 12/18 bold, width 18; navy when open, `#666F75` when closed
    - title 14/20 semibold
    - chevron 14: navy and rotated when open
    - Open body: 12.5/19 `#5A646B`, indented 28 px.
    - Default: section 1 open.
- Switching tabs resets the accordion to section 1 and scrolls to the top.
