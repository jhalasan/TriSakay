# Claude Code prompt — In-app tutorials, passenger + driver (TriSakay)

Paste the whole thing. It assumes repo `jhalasan/TriSakay`, branch `main`, Expo + React Native, `apps/passenger` + `apps/driver`, and that the design bundle `design_handoff_trisakay_tutorials/` (README + `screens/passenger/*.png` + `screens/driver/*.png`) is available. Do not restyle any existing screen — both tours are overlays on screens that already exist.

---

Implement the **in-app tutorials for both apps**: a 10-step coach-mark walkthrough in the passenger app and an 8-step one in the driver app. One shared overlay implementation, two step tables. Both must match `design_handoff_trisakay_tutorials/README.md` and the screenshots in that folder exactly.

Order of work: build the shared overlay → wire the passenger tour → wire the driver tour. If either app already contains a tutorial overlay, lift it into the shared package rather than duplicating it.

## 1. Shared overlay component

Create (or move the passenger one to) `packages/ui/src/tutorial/` with:

- `TutorialProvider.tsx` — context holding `{ active, step, total, start(), next(), back(), skip(), goTo(n), finish() }`. Step 0 = welcome sheet, 1…N = coach marks, N+1 = finished toast.
- `TutorialOverlay.tsx` — renders the dim + spotlight + pulse ring + tooltip for the current step.
- `useTutorialTarget(id)` — returns a ref + `onLayout` handler that registers the measured rect (`measureInWindow`) of a target element under `id` in the provider. Screens register their targets; the overlay reads the rect for the current step's `targetId`. Fall back to the design-frame rect from the step table (scaled by `screenWidth / 390`) if a target has not reported yet.
- `steps.passenger.ts` and `steps.driver.ts` — the step tables (below).

Overlay visuals (exact):

- Dim `rgba(2,16,32,0.66)`. React Native has no `box-shadow: 0 0 0 9999px`, so draw the dim as **four absolutely-positioned `View`s** (top / bottom / left / right of the spotlight rect) plus the rect's own border — never a single full-screen view over the target.
- Spotlight rect: `borderWidth: 2`, `borderColor: 'rgba(255,255,255,0.9)'`, per-step `borderRadius`. Animate `top/left/width/height` with `Animated.timing`, `duration: 280`, `easing: Easing.bezier(0.4, 0, 0.2, 1)`.
- Pulse ring: rect inset by −6 on all sides, `borderRadius + 6`, `2px rgba(255,255,255,0.55)`, looping `scale 0.96 → 1.04` with `opacity 0.7 → 0` over 1800ms, `pointerEvents: 'none'`.
- Tooltip card: white, `borderRadius: 20`, `padding: 18`, shadow ≈ `0 14px 34px rgba(0,26,56,0.34)`, pinned `left: 16, right: 16`, and `top = rect.bottom + 16` when the step's `tip` is `below`, else `bottom = screenH - rect.top + 16`. Arrow: 16×16 white square, `transform: rotate(45deg)`, `borderRadius: 3`, at `-7` on the tooltip's near edge, `left` clamped to `20…300` (design-frame px, scaled).
- Tooltip content, in order: row with step chip (`#E3EDF7` bg, `#002E60`, Poppins 800 11/16, `borderRadius: 8`, padding `4×9`, text `"{n} of 8"`) and title (Poppins 700 17/22, `#14191D`); body (Poppins 400 14/21, `#5A646B`); 4px progress track `#EBEFF2` with `#002E60` fill at `step/total`, 280ms width animation; controls row — `Skip tour` (600 13/18, `#666F75`), `Back` (same, `visibility: hidden` on step 1 — keep the space), spacer, `Next` (navy `#002E60`, `borderRadius: 13`, height 44, padding `0 20`, label 700 15/20 white; label is `Done` on the last step).
- The dim swallows taps: only the tooltip controls are interactive. No tap-anywhere-to-advance.
- Respect `prefers-reduced-motion` / `AccessibilityInfo.isReduceMotionEnabled()` — drop the pulse ring and the 280ms transitions to instant.

Welcome sheet (step 0): bottom sheet on `rgba(2,16,32,0.62)`, `margin: 18`, `borderRadius: 26`, navy `LinearGradient` `135deg #002E60 → #001A38`, chevron texture overlay at 5% and the chevron motif watermark at 14% top-right (reuse the existing driver dashboard texture/motif components), 60px rounded tile (`rgba(255,255,255,0.16)`, 1px `rgba(255,255,255,0.28)`) with the tricycle mark, title "Hi Jomar!" (use the real first name) Poppins 800 26/31 white, body Poppins 400 14/21 white at 82% opacity, then `Skip` (48px, outline `rgba(255,255,255,0.34)`) + `Take the tour` (flex 1, white bg, `#002E60` label 700 16/21, forward arrow).

Finished toast (step N+1): `#14191D` pill at `left/right: 16, bottom: 74`, `borderRadius: 16`, padding `13×16`, `#9BD47F` check icon, "You're set. Drive safe out there!" (600 13/18 white), `Restart` action (700 13/18, `#9BD47F`).

## 2. Passenger step table

`steps.passenger.ts` — ten entries, in this order. Screens: `home`, `book` (booking sheet), `confirm` (fare confirmation), `trip` (live trip), `complaint` (file a complaint), `status` (case status).

```ts
export const PASSENGER_STEPS = [
  { screen: 'home', targetId: 'greeting-header', tip: 'below', frame: { top: 44, left: 10, width: 370, height: 164, radius: 26 },
    title: 'Your header',
    body: 'Your name, trips so far and your fare discount. The bell shows ride updates and driver messages.' },
  { screen: 'home', targetId: 'request-cta', tip: 'below', frame: { top: 226, left: 10, width: 370, height: 102, radius: 24 },
    title: 'Book a ride',
    body: 'Tap Request a Tricycle. This is the only way in — it shows the starting fare and how many drivers are nearby.' },
  { screen: 'home', targetId: 'saved-places', tip: 'below', frame: { top: 332, left: 8, width: 374, height: 268, radius: 20 },
    title: 'Saved places',
    body: 'Home, Work and Campus book in one tap. Add or rename them any time from Manage.' },
  { screen: 'home', targetId: 'tab-bar', tip: 'above', frame: { top: 778, left: 6, width: 378, height: 66, radius: 22 },
    title: 'Move around the app',
    body: 'History for past rides and receipts, Complaints to report a trip, Profile and Settings for your account.' },
  { screen: 'book', targetId: 'route-card', tip: 'below', frame: { top: 52, left: 10, width: 370, height: 142, radius: 24 },
    title: 'Set pickup and destination',
    body: 'Pickup fills in from your location — tap the second row to choose where you are going, or pick a suggestion below.' },
  { screen: 'confirm', targetId: 'fare-sheet', tip: 'above', frame: { top: 599, left: 10, width: 370, height: 238, radius: 28 },
    title: 'Check the fare first',
    body: 'You see the exact fare, your discount and the payment method before anything is booked. Tap Confirm ride when it looks right.' },
  { screen: 'trip', targetId: 'driver-card', tip: 'above', frame: { top: 694, left: 10, width: 370, height: 140, radius: 28 },
    title: 'Your driver, and safety',
    body: 'Follow the tricycle on the map and check the plate before you board. Hold Emergency SOS to alert the operator and your emergency contact.' },
  { screen: 'complaint', targetId: 'trip-and-category', tip: 'below', frame: { top: 127, left: 10, width: 370, height: 188, radius: 22 },
    title: 'Report a problem',
    body: 'Open Complaints, pick the trip it happened on and choose a category — fare dispute, driver conduct, safety or vehicle condition.' },
  { screen: 'complaint', targetId: 'evidence-and-submit', tip: 'above', frame: { top: 528, left: 10, width: 370, height: 188, radius: 22 },
    title: 'Add proof, then submit',
    body: 'Attach up to three photos of the receipt or the tricycle. Submit sends it straight to the operator with your trip details already attached.' },
  { screen: 'status', targetId: 'progress-card', tip: 'below', frame: { top: 200, left: 10, width: 370, height: 231, radius: 24 },
    title: 'Follow your case',
    body: 'Every complaint gets a reference number and a status you can track — received, under review, resolved. You are notified at each step.' },
] as const;
```

Passenger welcome sheet: "Hi Maria!" (real first name) + "Welcome to TriSakay. Let us walk you through one full booking — seven taps and you will know how the whole app works." Finished toast: "That is the whole app. Enjoy the ride!"

Passenger routes: `home` → `apps/passenger/app/(tabs)/home.tsx`; `book`/`confirm` → the booking + fare-confirmation routes; `trip` → the live-trip route; `complaint` → `apps/passenger/app/(tabs)/complaints.tsx` (new-complaint form); `status` → the complaint-detail route. Demo state while the tour runs: destination "Public Market, Stall 14", fare ₱45 with Student −20%, Cash selected, driver Juan Dela Cruz 4.9 / plate TRK 2841, complaint #1042 "Charged above the fare matrix" under review with 1/3 evidence attached. Submit, Confirm ride and SOS handlers are disabled for the duration.

Passenger trigger: once, on the first launch after login — `passengerTutorialSeenAt` in local storage; same skip/finish write rules and the same Settings → Help → Replay app tour entry as the driver app.

## 3. Driver step table

`steps.driver.ts` — eight entries, in this order. `targetId` is what the screens register; `frame` is the measured design-frame fallback (390×844).

```ts
export const DRIVER_STEPS = [
  { screen: 'dashboard', targetId: 'duty-console',   tip: 'below', frame: { top: 118, left: 12, width: 366, height: 203, radius: 24 },
    title: 'Go online',
    body: 'This switch is the whole job. Flip it on and requests start reaching you; offline, nothing comes through and your day is paused.' },
  { screen: 'dashboard', targetId: 'earnings-today', tip: 'below', frame: { top: 184, left: 24, width: 210, height: 80, radius: 14 },
    title: 'Earnings today',
    body: 'What you have collected so far today, with trips, rating and acceptance rate under the line. The app never holds the money — fares are paid to you directly.' },
  { screen: 'dashboard', targetId: 'incoming-request', tip: 'below', frame: { top: 359, left: 12, width: 366, height: 242, radius: 24 },
    title: 'Accept or decline',
    body: 'Every request shows the fare, the payment method, how far the pickup is and where it ends before you decide. Accept locks the ride to you; the countdown passes it on if you wait.' },
  { screen: 'dashboard', targetId: 'tab-bar', tip: 'above', frame: { top: 778, left: 6, width: 378, height: 66, radius: 22 },
    title: 'Move around the app',
    body: 'Requests for the full queue, History for finished trips, Earnings for your records, Profile for your documents and account.' },
  { screen: 'requests', targetId: 'scope-filters', tip: 'below', frame: { top: 118, left: 12, width: 366, height: 48, radius: 26 },
    title: 'Filter the queue',
    body: 'Along route keeps requests pointed the way you are already driving. Nearby widens it to anything close, All shows the whole barangay.' },
  { screen: 'activeTrip', targetId: 'passenger-card', tip: 'above', frame: { top: 460, left: 16, width: 358, height: 210, radius: 22 },
    title: 'Run the trip',
    body: 'Tick Confirm cash received when the passenger pays, then Complete. More than one passenger can ride the same trip — each has their own row.' },
  { screen: 'activeTrip', targetId: 'sos', tip: 'above', frame: { top: 672, left: 20, width: 350, height: 86, radius: 18 },
    title: 'Emergency SOS',
    body: 'Press and hold if you are in immediate danger. It alerts the operator with your location and opens the call to 911 / PNP.' },
  { screen: 'earnings', targetId: 'tracked-total', tip: 'below', frame: { top: 117, left: 12, width: 366, height: 94, radius: 18 },
    title: 'Your earnings record',
    body: 'Weekly total, a bar per day and a settlement log you can show the operator. This is record-keeping, not a wallet.' },
] as const;
```

Copy is final — do not paraphrase, re-punctuate, or "improve" it.

## 4. Screen advancement (driver)

The tour drives navigation: when the current step's `screen` differs from the previous step's, the provider navigates there before painting the coach mark.

- `dashboard` → `apps/driver/app/(tabs)/dashboard.tsx`
- `requests` → `apps/driver/app/(tabs)/requests.tsx`
- `activeTrip` → the active-trip route
- `earnings` → `apps/driver/app/(tabs)/earnings.tsx`

While the tutorial is active, run these screens in a **demo state** so the coach marks always have something to point at, and never fire real side effects:

- dashboard: online, `₱845.00` today, 12 trips · 4.8 · 92% accepted, one incoming request (Cash · 2 seats, ₱45, Poblacion Plaza waiting shed → Public Market Stall 14, 18s countdown frozen)
- requests: two requests (₱45 cash / ₱25 GCash), `Along route` selected
- activeTrip: one aboard passenger (Maria Reyes, 2 seats, ₱45.00, Ongoing), `Confirm cash received` off, Complete enabled, SOS present, End trip disabled
- earnings: tracked total `₱4,320.00`, 58 trips, Sep 8 – Sep 14, seven-day bars with the sixth highlighted, two settlement rows

Gate this behind a `tutorialDemo` flag in the screens' data hooks; it must not touch live queries, accept a real ride, or send an SOS. Disable the Accept / Decline / Complete / SOS handlers for the duration.

## 5. Trigger + persistence

- Store `driverTutorialSeenAt` (ISO string) in the existing local-storage layer (AsyncStorage / MMKV / SecureStore — follow what the app already uses; do not add a dependency).
- Start the tour when: driver is authenticated, `verificationStatus === 'approved'`, and `driverTutorialSeenAt` is null. Write the timestamp on `finish()` **and** on `skip()`.
- Add `Replay app tour` to Settings → Help; it clears nothing, just calls `start()` from step 0.
- Never auto-start while a trip is active or a request is on screen.

## 6. Acceptance

Compare against `design_handoff_trisakay_tutorials/screens/passenger/*.png` and `.../driver/*.png` on a 390×844 device:

1. Every state renders: passenger welcome + 10 coach marks + toast; driver welcome + 8 coach marks + toast.
2. Each spotlight frames exactly its target with ~4–8px of breathing room and no bleed onto neighbouring UI (check step 3 against the request card and step 7 against the SOS block).
3. Tooltip never overlaps its own spotlight and never runs off-screen; the arrow points at the rect.
4. Step chip reads `n of 10` (passenger) / `n of 8` (driver); the progress bar fills in tenths / eighths; `Back` is hidden on step 1; `Next` reads `Done` on the last step.
5. Skipping from any step, or finishing, sets the app's `*TutorialSeenAt` key and does not show that tour again on relaunch; Settings → Help replays it in both apps.
6. Text is Poppins at the specified sizes; no font below 12px; contrast on the navy surfaces is full-opacity white.
7. No live mutation is triggered by any tour step.

Deliver as two PRs off the shared overlay: `feat(ui): tutorial coach-mark overlay` + `feat(passenger,driver): in-app tutorial walkthroughs`. Include a short `docs/tutorials.md` noting where the step tables live and how to add a step (driver complaints is the intended driver step 9 later).
