# Part B — Passenger matched ride (`apps/passenger/app/booking/trip.tsx`)

Screens: `B1`–`B6`, `C5`. Prototype: `prototypes/TriSakay Passenger Matched Ride Redesign.dc.html`. Frame 5a is interactive (use the stage switcher under it and tap Cancel); frame 5b is the transfer state. **Ignore the prototype's Message quick-reply sheet in 5a. It's superseded: Message opens chat (Part C).**
Replaces the navy textured trip sheet. Mirrors the driver accepted-ride screen (driver v2 §6), so share components where the two overlap.

## B1. Layout (390×844)

```
[● Status pill]                  (SOS)        pill: top safe+16 left 16 · SOS: top safe+10 right 16
                                 Hold 3s
        full-screen OsmMap (route, pins, trike)
 [preview banner — only when a new message arrives, see B7]
┌ floating sheet (left/right/bottom 10, r26) ┐
│ handle                                      │
│ [transfer banner] (5b only)                 │
│ EYEBROW / Headline / sub      [✓ tile]      │
│ ▬▬▬ ▭▭▭ ▭▭▭  Driver coming · Pickup · Drop-off│
│ ┌ driver strip ───────────────────────────┐ │
│ │ (JS) Jomar Santos            ┌PLATE──┐ │ │
│ │ ★ 4.8 · 🛡 PSO verified      │TRK 4821│ │ │
│ │ [  Call  ] [ Message (2) ]             │ │
│ └─────────────────────────────────────────┘ │
│ ○ Pickup   Poblacion Plaza, waiting shed    │
│ ■ Drop-off Public Market, Stall 14          │
│ ─────────────────────────────────────────── │
│ 💵 2 seats · Pay cash to driver      ₱45.00 │
│ [            Cancel ride            ]       │  stages 1–2 only
└─────────────────────────────────────────────┘
```
No tab bar. Status bar dark-on-light over the map.

## B2. Stages

Map the real enum from `ride_requests.status` plus the arrived flag. Use the repo's actual names and report them in Phase 0.

| Stage | Condition | Pill dot / text | Eyebrow | Headline | Sub | Step |
|---|---|---|---|---|---|---|
| 1 | `assigned`, not arrived | accentBlue · Driver on the way | ARRIVING IN | `{eta} min` | `{first} is {km} km away · Wait at {pickupShort}` | 0 |
| 2 | `assigned`, arrived | accentGreen · Driver is here | AT YOUR PICKUP | Your driver is here | `Look for plate {plate} at {pickupShort}` | 1 |
| 3 | `ongoing` | accentBlue · On the way to drop-off | ARRIVING AT DROP-OFF IN | `{eta} min` | `{dropoffName} · {km} km` | 2 |
| — | `completed` | existing redirect → trip-complete / rate-driver (unchanged) |
| — | cancelled by driver/system | existing handling (unchanged) |

- ETA < 1 → headline `Less than a minute`. ETA unknown → stage 1 headline `On the way`, and the sub drops the distance part.
- `{pickupShort}` = the pickup name before the first comma.
- Stage 2 only: a 48px tile on the right of the status block (radius 16, accentGreenSoft) holding a check icon 22 accentGreenPressed.

## B3. Map layer
- `OsmMap` full screen; bottom padding = measured sheet height (`onLayout`).
- Route: accentBlue 7px, round caps. Stages 1–2: driver → pickup, **dotted** (`2 12`). Stage 3: pickup → drop-off, **solid**.
- Pickup pin (1–2): 28px, white fill, 6px accentGreen border, chip `You · Pickup` (white pill, semibold 12, padding 4/10).
- Drop-off pin (3): 26px rounded square r7, accentBlue fill, 4px white border, chip `Drop-off`.
- Trike marker: 38px r12 accentGreen, 3px white border, trike glyph 20px; driven by the live driver location.
- **Status pill:** white, padding 9/14, gap 8, 9px dot + bold 13, `numberOfLines={1}`, elevation 4.
- **SOS FAB:** `HoldToConfirmButton variant="fab"` from `packages/ui`. It was modified in the latest merge, so check whether `fab` already exists; if not, add it once for both apps. 58px circle, danger, 3px white border, alert icon 18 + "SOS" extrabold 11. "Hold 3s" white pill under it (labelXs danger). A 3 s hold with a white progress ring → the existing `booking/emergency` route. Early release does nothing. Haptic on start and complete. **Remove the old full-width SOS bar.**

## B4. Floating sheet
Container: absolute left/right 10, bottom `10 + insets.bottom`, white, radius 26, padding `10 16 16`, gap 14, max-height 560 with a `ScrollView` inside. Handle 40×4 `line`. The sheet does not drag in v1.

**B4.1 Progress:** bars in a row, gap 4, each flex 1 × 5px, radius 3; filled `accentBlue` when `i <= step`, else `accentBlueSoft`. Labels under them: `Driver coming · Pickup · Drop-off`. The current label is bold 11 accentBlue; the others medium 11 inkFaint.

**B4.2 Driver strip:** bg `bg`, radius 16, padding 12, gap 10.
- Row 1 (gap 12): `Avatar` 48 (photo, else initials bold 16 accentBluePressed on accentBlueSoft) · name semibold 15.5 (1 line, ellipsis) with an optional **New** tag (B6) · meta line: star 12 accentGreen + rating · shield 12 accentGreen + `PSO verified`. Hide the rating when there are fewer than 5 ratings; hide PSO when the driver isn't verified.
- **Plate tag** (flex none): white, 1.5px ink border, radius 9, padding 4/10. `PLATE` (semibold 9.5 uppercase +0.8 inkSoft) over the plate (extrabold 15 +0.6 ink, 1 line). It's the loudest element in the strip on purpose.
- Row 2: **Call** + **Message**, gap 8, flex 1 each, minHeight 44, radius 12.
  - **Call:** same rules as README §4.3 (flag `features.rideCall`; hidden when off or when there's no number, and Message then takes the full width).
  - **Message:** `router.push('/booking/chat')` (existing route). Source for unread: the existing `unreadMessageCount` in `trip.tsx`; also refetch on focus.
    - Unread 0: soft style (accentBlueSoft bg, chat icon 17 + semibold 14 accentBlue, "Message").
    - Unread > 0 (C5): **filled**. accentBlue bg, white icon + bold 14.5 "Message {first}", count pill (22px min, radius 11, white, extrabold 12 accentBlue, `99+` cap), shadow on a wrapper. **This replaces today's small `messageDriverDot`.**
  - Keep the tutorial-demo guard: `tutorialDemo.active ? undefined : router.push(...)`.

**B4.3 Route:** a rail column (10px ring with a 2.5px accentGreen border → 2px `line` connector (min 16) → 10px square r2 accentBlue) beside a text column, gap 8: `Pickup` / `Drop-off` label (medium 11.5 inkFaint) over the address (semibold 14.5 ink, max 2 lines).

**B4.4 Fare row:** 1px `lineSoft` top border, padding-top 12, gap 12. Payment icon 20 inkSoft · pay line (flex 1, medium 13 inkSoft) · fare extrabold 18 ink (existing currency formatter; discounted fare if a discount applies, and keep the existing discount chip before the fare).
- Cash, stages 1–2: `{n} seats · Pay cash to driver` (singular `1 seat`)
- Cash, stage 3: `Pay cash when you arrive`
- GCash: `{n} seats · Paid with GCash`

**B4.5 Cancel ride (stages 1–2 only):** outline button, minHeight 50, radius 14, 1.5px `line` border, semibold 15 danger. Opens B5. **Not rendered in stage 3.**

## B5. Cancel with reason (B4, B5)
Scrim `overlay` (tap closes) + bottom sheet (white, top radius 28, padding `10 18 26+inset`, gap 14). Extend `ReasonPickerModal` if it can do this; otherwise build it in `apps/passenger/src/components`.
- Title `Cancel this ride?` (extrabold 21/27 −0.4). Body 14/21 inkSoft:
  - stage 1: `{first} is already on the way. Tell us why so we can improve matching.`
  - stage 2: `{first} is already at your pickup. Tell us why so we can improve matching.`
- Reasons, single select, gap 8. Each row minHeight 52, radius 14, padding 0/14, gap 12, label 14.5 `flex:1` (**one line**).
  - Unselected: 1.5px `line` border, 20px ring 2px lineStrong, label medium.
  - Selected: 1.5px accentBlue border, accentBlueSoft bg, 20px radio with a 6px accentBlue border and white centre, label semibold.
  - Reasons: use the existing cancel-reason list if there is one; otherwise these placeholders: `Driver is taking too long` · `I found another ride` · `I changed my plans` · `Booked by mistake`.
- Buttons row gap 10, flex 1 each, minHeight 54, radius 16:
  - **Keep my ride:** accentBlue → accentBluePressed gradient 135°, bold 15.5 white. Closes the sheet.
  - **Cancel ride:** disabled (fill bg, inkFaint) until a reason is picked. Enabled: 1.5px danger border, bold 15.5 danger → the **existing** cancel service with the reason code. A spinner shows while in flight and both buttons are disabled. Then the existing post-cancel navigation.
- Selection resets on each open. Auto-close if the ride moves to `ongoing`.

## B6. Driver changed (B6)
When the booking's driver id changes while `assigned` (a transfer via `respond_transfer`):
- **Banner** at the top of the sheet, above the status block: accentBlueSoft, radius 16, padding `12 10 12 14`, row gap 12, flex-start. Swap icon 20 accentBlue · `You have a new driver` (bold 14 ink) over `Your ride moved to {newName}. Same pickup, same fare.` (12.5 inkSoft) · dismiss button 32 radius 10 white, close icon 14 (hitSlop to 44).
- **New tag** after the name: accentBlueSoft pill, bold 10.5 uppercase +0.5 accentBluePressed, padding 2/8.
- Both clear on dismiss or when stage 2 starts. Progress and ETA reset to the new driver.
- Chat follows automatically, because the RLS joins through `trip_id`. The chat header must re-read the driver (Part C §C2).

## B7. In-app message preview (C5)
Same component and rules as README §4.4. Place it at `top = safe + 76`, left/right 12. The title line is `{driverFirst}`; the Reply button → `/booking/chat`. Show it only while `trip.tsx` is focused.

## B8. i18n (add to `en.ts` + `fil.ts`; reuse `trip.messageDriver`)
```
trip.pill.onTheWay / here / riding
trip.eyebrow.arrivingIn / atPickup / arrivingDropoff
trip.headline.minutes "{{n}} min" / lessThanMin / here "Your driver is here" / onTheWay
trip.sub.onTheWay "{{name}} is {{km}} km away · Wait at {{pickup}}"
trip.sub.here "Look for plate {{plate}} at {{pickup}}"
trip.sub.riding "{{dropoff}} · {{km}} km"
trip.steps.coming / pickup / dropoff
trip.driver.psoVerified / plate / new / call
trip.messageDriverNamed "Message {{name}}"
trip.pay.cashSeats / cashSeat / cashOnArrival / gcashSeats
trip.sos.hold "Hold 3s"
trip.cancel.title / bodyOnTheWay / bodyHere / keep / button / reasons.{tooLong,otherRide,changedPlans,mistake}
trip.transfer.title "You have a new driver" / body "Your ride moved to {{name}}. Same pickup, same fare."
```

## B9. Acceptance
- [ ] B1/B2/B3 match at 390×844; pill/headline/sub/pay line per the tables.
- [ ] Cancel only in stages 1–2; disabled until a reason is picked; the reason code reaches the cancel service.
- [ ] Message → `/booking/chat`; filled state + count when unread; the count clears after visiting chat.
- [ ] Call hidden with the flag off; `tel:` with the flag on and a number present.
- [ ] SOS 3 s hold → emergency; old bar removed.
- [ ] Transfer banner + New tag; the chat header shows the new driver.
- [ ] Plate and pill never wrap at 360; the sheet scrolls at 360×640.
- [ ] Completed / driver-cancelled handling unchanged; tutorial demo still works.
