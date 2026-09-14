# TriSakay — in-app tutorials (passenger + driver)

Locked 2026-09-14. Source of truth: `TriSakay Passenger Tutorial.dc.html` (copy included with `support.js` so it opens offline). That one file holds **both** tours — driver section first, passenger section second.

Target: `apps/passenger` and `apps/driver` (Expo / React Native), repo `jhalasan/TriSakay`, branch `main`.

One overlay, two step tables. Dim, spotlight, pulse ring, tooltip, welcome sheet and finished toast are **identical** in both apps — build them once in `packages/ui` and feed them a step table.

## Passenger tour — 10 steps, 6 screens

| # | Screen | Target | Screenshot |
| --- | --- | --- | --- |
| — | Home | Welcome sheet ("Hi Maria!") | `screens/passenger/00-welcome.png` |
| 1 | Home | Greeting header (avatar, stats strip) | `screens/passenger/01-header.png` |
| 2 | Home | Request a Tricycle card | `screens/passenger/02-request-a-tricycle.png` |
| 3 | Home | Saved places list | `screens/passenger/03-saved-places.png` |
| 4 | Home | Tab bar | `screens/passenger/04-tab-bar.png` |
| 5 | Booking | Pickup + destination card | `screens/passenger/05-pickup-destination.png` |
| 6 | Fare confirm | Fare sheet (price, payment, Confirm) | `screens/passenger/06-fare-payment.png` |
| 7 | Live trip | Driver card + Emergency SOS | `screens/passenger/07-driver-safety.png` |
| 8 | Complaints | Related trip + Category | `screens/passenger/08-report-a-problem.png` |
| 9 | Complaints | Evidence + Submit | `screens/passenger/09-evidence-submit.png` |
| 10 | Case status | Progress tracker | `screens/passenger/10-follow-your-case.png` |

Trigger: once, first launch after login. Replay from Settings → Help → Replay app tour.

## Driver tour — 8 steps, 4 screens

| # | Screen | Target | Screenshot |
| --- | --- | --- | --- |
| — | Dashboard | Welcome sheet ("Hi Jomar!") | `screens/driver/00-welcome.png` |
| 1 | Dashboard | Duty console (online toggle) | `screens/driver/01-go-online.png` |
| 2 | Dashboard | Earnings-today figure + meta | `screens/driver/02-earnings-today.png` |
| 3 | Dashboard | Incoming request card | `screens/driver/03-accept-or-decline.png` |
| 4 | Dashboard | Tab bar | `screens/driver/04-tab-bar.png` |
| 5 | Requests | Filter pills (Along route / Nearby / All) | `screens/driver/05-filter-queue.png` |
| 6 | Active trip | Passenger card + Confirm cash + Complete | `screens/driver/06-run-the-trip.png` |
| 7 | Active trip | Emergency SOS block | `screens/driver/07-emergency-sos.png` |
| 8 | Earnings | Tracked total (eyebrow + ₱ + meta) | `screens/driver/08-earnings-record.png` |

Trigger: once, first launch **after documents are approved** — the first moment the duty switch works. Replay from Settings → Help.

## Shared anatomy

- **Dim**: `rgba(2,16,32,.66)` (tweakable 0.30–0.85 in the design; ship 0.66).
- **Spotlight rect**: transparent, `2px solid rgba(255,255,255,.9)`, per-step radius, `transition: all .28s cubic-bezier(.4,0,.2,1)`.
- **Pulse ring**: rect inset −6px, radius +6, `2px solid rgba(255,255,255,.55)`, `scale .96 → 1.04` / `opacity .7 → 0` over 1.8s, looping, non-interactive.
- **Tooltip**: white, radius 20, padding 18, `0 14px 34px rgba(0,26,56,.34)`; `left/right: 16`; `top = rect.bottom + 16` (`tip: below`) or `bottom = 844 − rect.top + 16` (`tip: above`); 16×16 white square rotated 45° as arrow, left clamped `20…300`.
- **Tooltip content**: step chip `#E3EDF7` / `#002E60` (800 11/16) + title (700 17/22 `#14191D`); body (400 14/21 `#5A646B`); 4px `#EBEFF2` track with `#002E60` fill at `step/total`; `Skip tour` · `Back` (hidden on step 1, space kept) · `Next` navy `#002E60` radius 13, 44px (`Done` on the last step).
- **Welcome sheet**: bottom sheet on `rgba(2,16,32,.62)`, navy gradient `135deg #002E60 → #001A38` + chevron texture + motif 14%, 60px logo tile, name greeting 26/31 w800, body white 82%, `Skip` outline + white `Take the tour`.
- **Finished toast**: `#14191D` pill, `left/right 16`, `bottom 74`, `#9BD47F` check, one line + `Restart`.
- Poppins throughout; design frame 390×844; the dim swallows taps (only tooltip controls are interactive); no tap-anywhere-to-advance.

## Step geometry (390×844 design frame, px)

Measured against the live screens; in-app, measure the real targets and use these as the fallback/expectation.

**Passenger**

| # | screen | top | left | w | h | r | tip |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | home | 44 | 10 | 370 | 164 | 26 | below |
| 2 | home | 226 | 10 | 370 | 102 | 24 | below |
| 3 | home | 332 | 8 | 374 | 268 | 20 | below |
| 4 | home | 778 | 6 | 378 | 66 | 22 | above |
| 5 | book | 52 | 10 | 370 | 142 | 24 | below |
| 6 | confirm | 599 | 10 | 370 | 238 | 28 | above |
| 7 | trip | 694 | 10 | 370 | 140 | 28 | above |
| 8 | complaint | 127 | 10 | 370 | 188 | 22 | below |
| 9 | complaint | 528 | 10 | 370 | 188 | 22 | above |
| 10 | status | 200 | 10 | 370 | 231 | 24 | below |

**Driver**

| # | screen | top | left | w | h | r | tip |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | dash | 118 | 12 | 366 | 203 | 24 | below |
| 2 | dash | 184 | 24 | 210 | 80 | 14 | below |
| 3 | dash | 359 | 12 | 366 | 242 | 24 | below |
| 4 | dash | 778 | 6 | 378 | 66 | 22 | above |
| 5 | req | 118 | 12 | 366 | 48 | 26 | below |
| 6 | trip | 460 | 16 | 358 | 210 | 22 | above |
| 7 | trip | 672 | 20 | 350 | 86 | 18 | above |
| 8 | earn | 117 | 12 | 366 | 94 | 18 | below |

## Copy (verbatim — do not paraphrase)

**Passenger welcome — Hi Maria!** Welcome to TriSakay. Let us walk you through one full booking — seven taps and you will know how the whole app works.

1. **Your header** — Your name, trips so far and your fare discount. The bell shows ride updates and driver messages.
2. **Book a ride** — Tap Request a Tricycle. This is the only way in — it shows the starting fare and how many drivers are nearby.
3. **Saved places** — Home, Work and Campus book in one tap. Add or rename them any time from Manage.
4. **Move around the app** — History for past rides and receipts, Complaints to report a trip, Profile and Settings for your account.
5. **Set pickup and destination** — Pickup fills in from your location — tap the second row to choose where you are going, or pick a suggestion below.
6. **Check the fare first** — You see the exact fare, your discount and the payment method before anything is booked. Tap Confirm ride when it looks right.
7. **Your driver, and safety** — Follow the tricycle on the map and check the plate before you board. Hold Emergency SOS to alert the operator and your emergency contact.
8. **Report a problem** — Open Complaints, pick the trip it happened on and choose a category — fare dispute, driver conduct, safety or vehicle condition.
9. **Add proof, then submit** — Attach up to three photos of the receipt or the tricycle. Submit sends it straight to the operator with your trip details already attached.
10. **Follow your case** — Every complaint gets a reference number and a status you can track — received, under review, resolved. You are notified at each step.

Finished toast: *That is the whole app. Enjoy the ride!*

**Driver welcome — Hi Jomar!** Your account is verified. Eight taps and you will know the whole app — going online, taking a request, running the trip, and reading your earnings.

1. **Go online** — This switch is the whole job. Flip it on and requests start reaching you; offline, nothing comes through and your day is paused.
2. **Earnings today** — What you have collected so far today, with trips, rating and acceptance rate under the line. The app never holds the money — fares are paid to you directly.
3. **Accept or decline** — Every request shows the fare, the payment method, how far the pickup is and where it ends before you decide. Accept locks the ride to you; the countdown passes it on if you wait.
4. **Move around the app** — Requests for the full queue, History for finished trips, Earnings for your records, Profile for your documents and account.
5. **Filter the queue** — Along route keeps requests pointed the way you are already driving. Nearby widens it to anything close, All shows the whole barangay.
6. **Run the trip** — Tick Confirm cash received when the passenger pays, then Complete. More than one passenger can ride the same trip — each has their own row.
7. **Emergency SOS** — Press and hold if you are in immediate danger. It alerts the operator with your location and opens the call to 911 / PNP.
8. **Your earnings record** — Weekly total, a bar per day and a settlement log you can show the operator. This is record-keeping, not a wallet.

Finished toast: *You're set. Drive safe out there!*

## Out of scope

Driver complaints is deliberately not in the driver tour (kept to core duty features). If added later it becomes driver step 9, on the existing Complaints screen, before the earnings step.

Implementation prompt: `CLAUDE_CODE_PROMPT.md`.
