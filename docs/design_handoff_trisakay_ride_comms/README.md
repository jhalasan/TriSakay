# TriSakay — Ride communication handoff (driver Call/Message · passenger matched ride · ride chat)

One package for three connected pieces of work. Build them together, because they share components and routes.

| Part | What | Route(s) | Spec |
|---|---|---|---|
| **A** | Driver accepted ride: **Call + Message** row on the passenger strip, unread badges, in-app message preview | `apps/driver/app/trip/active.tsx` | this file §4 |
| **B** | Passenger **matched ride** redesign (white floating sheet, 3 stages, plate tag, Call/Message, SOS FAB, cancel with reason, driver-changed banner) | `apps/passenger/app/booking/trip.tsx` | `PART_B_PASSENGER_MATCHED_RIDE.md` |
| **C** | **Ride chat** redesign for both apps (header with trip context, grouped bubbles, quick-reply bubbles, masked-number token, report sheet, retry bar, read-only state) | `apps/passenger/app/booking/chat.tsx`, `apps/driver/app/trip/chat/[rideRequestId].tsx`, `packages/ui` Chat* | `PART_C_RIDE_CHAT.md` |

Claude Code prompt: `CLAUDE_CODE_PROMPT.md`.

**Repo baseline:** `jhalasan/TriSakay@main` as of 2026-09-29, **including the C1 ride-chat merge** (`ride_messages` table, `ride-chat` bucket, `notify-new-message` function, `useChatStore`, `ChatBubble`, `ChatComposer`, `QuickReplyRow`, `TypingDots`). This package **restyles** that chat. It adds no tables or services beyond the optional items flagged in §6.

## 0. What this supersedes (read first)

1. **Quick-reply bottom sheets are gone.** The earlier handoffs specified a "Message {name}" quick-reply sheet plus a "Message sent" toast: driver v2 §6.8 / frame 4d / PNG 14, and passenger matched ride §5.2 / §5.4 / PNGs 02 and 07. **Do not build them.** In every place, **Message opens the chat screen** (Part C). Quick replies live inside the chat as chips.
2. The driver v2 README remains the spec for everything else on `trip/active.tsx`: stages, primary actions, options sheet, SOS FAB. Part A only covers the contact row and chat entry points.
3. The `design_handoff_trisakay_passenger_matched_ride/` folder is replaced by Part B here.
4. `apps/passenger/PRODUCT.md` still says "No in-app call or chat." Update that line as part of this work (Phase 6 of the prompt).

## 1. Folder contents

```
README.md                         ← overview, ground rules, tokens, Part A, data, index
PART_B_PASSENGER_MATCHED_RIDE.md  ← passenger trip.tsx spec
PART_C_RIDE_CHAT.md               ← chat screens + shared components spec
CLAUDE_CODE_PROMPT.md             ← paste into Claude Code
screens/                          ← 2× PNGs (780×1688 = 390×844)
prototypes/                       ← open in a browser (keep support.js + assets/ beside them)
  TriSakay Driver Redesign.dc.html               frames 4a–4c (ignore 4d, superseded)
  TriSakay Passenger Matched Ride Redesign.dc.html  frames 5a (interactive) and 5b
  TriSakay Chat Redesign.dc.html                 frames 6a–6e (passenger), 7a–7b (driver)
```

PNG caveats: icons drawn with `<use href>` may render **empty or offset**, and html-to-image sometimes wraps text that doesn't wrap in the browser (e.g. the "I've arrived" button in A1, the cancel reasons in B4/B5). **The HTML prototype is the source of truth.**

## 2. Ground rules (apply to all three parts)

1. The HTML is a **reference, not code**. Rebuild in React Native with `StyleSheet.create` in each app's `src/styles/**`, tokens and components from `@trisakay/ui`, Ionicons and Expo Router.
2. **No new colour tokens.** Every hex maps to §3. If you find one that doesn't, stop and report it. The only exceptions are the placeholder map ground `#E7EBE4` and the canvas grey `#e9eaec`.
3. **Never set `fontWeight`.** Use `fontFamily.*`. Where no typography token matches, write a local style with `moderateScale`. Do not add tokens.
4. Never put a shadow on a view that also has `overflow:'hidden'` + `borderRadius`. Move the shadow to a wrapper. Android uses `elevation`.
5. **Restyle, don't rewrite logic.** Keep every store, service call, subscription, RLS-dependent behaviour, guard, tutorial target and redirect. The chat services in `packages/services/src/chat` are **not modified** except where §6 says so.
6. All copy goes through `packages/shared/src/i18n/en.ts` **and** `fil.ts`. Reuse existing keys (the `chat.*` and `driver.chat.*` blocks already exist). Add new keys to both files. No inline strings.
7. Hit targets are at least 44px. The quick-reply chips are 36px tall visually on passenger (use `hitSlop` to reach 44) and 44px on driver.
8. Quick replies are always sent as **codes** (`sendQuickReply(id, code)`). The receiver renders each code in their own language. Never send the label string.

## 3. Token map (all parts)

| Hex | Token | Used for |
|---|---|---|
| `#002E60` | `colors.accentBlue` | primary, sent bubble, send button, progress fill, unread badges, status dot, route |
| `#002043` | `colors.accentBluePressed` | initials, received quick-reply text, gradient end, privacy-tip text |
| `#E3EDF7` | `colors.accentBlueSoft` | avatar bg, Call/Message bg, received quick-reply bubble, privacy tip bg, transfer banner |
| `#477434` | `colors.accentGreen` | trike marker, pickup ring, "online/arriving" dot, Seen icon, star/shield |
| `#3B602B` | `colors.accentGreenPressed` | "Seen" text, check icons |
| `#E9F7E3` | `colors.accentGreenSoft` | driver-here tile |
| `#B3261E` | `colors.danger` | SOS, Cancel ride, send-error text/icon, Report message |
| `#FBEAE8` | `colors.dangerSoft` | send-error bar bg, report icon tile |
| `#14191D` | `colors.ink` | primary text, plate border |
| `#5A646B` | `colors.inkSoft` | secondary text, icons |
| `#666F75` | `colors.inkFaint` | timestamps, placeholders, day label, disabled |
| `#838B91` | `colors.lineStrong` | outline buttons, masked-token dashed border, typing dots |
| `#DCE2E6` | `colors.line` | handles, chip borders, input border, image placeholder |
| `#EBEFF2` | `colors.lineSoft` | header bottom border, composer top border, received bubble border |
| `#EDF1F4` | `colors.fill` | system pills, disabled send, secondary "Cancel" |
| `#F6F7F9` | `colors.bg` | chat bg, input bg, camera button bg, strips |
| `#FFFFFF` | `colors.white` / `colors.panel` | header, composer bar, received bubble, sheets |
| `rgba(10,14,17,.58)` | `colors.overlay` | scrims |

Radii: floating sheet 26 · bottom sheets 28 (top corners only) · bubbles 18 with a 6 tail corner · preview banner 18 · strips/banners/primary buttons 16 · outline buttons/rows 14 · Call/Message 12 · pills/chips/input 999 · plate tag 9 (8 in chat header).

## 4. Part A — Driver: Call + Message on the accepted ride (`trip/active.tsx`)

Screens: `A1-driver-heading-to-pickup.png`, `A2-driver-two-passengers.png`, `C7-driver-trip-chat-entry.png`. Prototype frames 4a/4b (Driver) and 7b (Chat).

### 4.1 Contact row on the passenger strip (top passenger)
- The strip (bg `bg`, radius 16, padding `10 10 10 12`) becomes a **column, gap 10**:
  - Row 1: 40px avatar · name (semibold 15, 1 line) over sub-line "{seats} seats · ₱{fare} · {payment}" (13, inkSoft) · **⋯** 44×44 (radius 13, white, 1px `line`) → options sheet (unchanged, v2 §6.6).
  - Row 2: **two equal buttons**, gap 8, each `flex:1`, minHeight 44, radius 12, bg accentBlueSoft, 17px icon + semibold 14 accentBlue label.
    - **Call** (`call-outline`) → §4.3.
    - **Message** (`chatbubble-ellipses-outline`) → `router.push('/trip/chat/' + passenger.id)`. This is the existing route; keep it.
- Show both for passengers with status `assigned` or `ongoing` only.

### 4.2 Unread state on Message
- Source: the existing `unreadByRideRequestId` state in `active.tsx`. Keep its one-shot fetch. Also refetch on screen focus (`useFocusEffect`) so the count clears after returning from chat.
- `unread > 0`: the Message button switches to **filled**. Bg accentBlue, white icon + label "Message {firstName}", plus a count pill after the label: 22px min, radius 11, white bg, extrabold 12 accentBlue, `99+` cap. Add shadow `0 6 14 rgba(0,46,96,.25)` on a wrapper.
- `unread = 0`: soft style (§4.1).
- **"Then" rows** (other passengers, v2 §6.5): replace today's small chat icon + dot with a 44px tile (radius 13, accentBlueSoft, chat icon 17 accentBlue) → `/trip/chat/{id}`. When unread, add a count badge at top −4 / right −4: 20px, radius 10, accentBlue, 2px white border, extrabold 10.5 white.

### 4.3 Call
- **The repo has no call feature today** (the only `tel:` is 911 in emergency). The chat also strips phone numbers on purpose (L11 privacy), so a raw `tel:` would undermine that.
- Build Call behind a feature flag, `features.rideCall` (default **off**), with this behaviour:
  - A masked/proxy number is available on the ride → `Linking.openURL('tel:' + masked)`.
  - Otherwise, when the flag is on and the product owner approves raw numbers → `tel:` + passenger contact number.
  - Flag off, or no number → **do not render Call**. Message stretches to full width.
- Phase 0 of the prompt asks for this decision before anything is built.

### 4.4 In-app message preview banner (C7)
- **New and optional behaviour.** When a chat message arrives while the driver is on `trip/active` (not in the chat), show a banner.
- Position absolute `top = safeArea + 76` (below the status pill), left/right 12. White, radius 18, padding `12 12 12 14`, shadow `0 10 28 rgba(0,20,45,.22)`.
- Row gap 12: 40px avatar · column ("{firstName} · {stage label}" bold 14 ink + preview, 13 inkSoft, 1 line, ellipsis) · **Reply** button (minHeight 36, radius 10, accentBlueSoft, semibold 13 accentBlue). Tap anywhere → that passenger's chat.
- Preview text: text → body; quick_reply → localised label; image → "Photo" with an image icon. Auto-hide after 4 s; swipe up dismisses. Only the latest message is shown (replace, don't stack).
- Source: subscribe to `ride_messages` INSERT for the current trip's passenger ids while `active.tsx` is focused, and unsubscribe on blur. Do not reuse `useChatStore` for this; it's single-thread. If this is too heavy, skip the banner and rely on the push notification plus the badges. Say which you chose in Phase 0.
- Push notifications (lock screen) stay as shipped: title only, no content.

## 5. Parts B and C
See `PART_B_PASSENGER_MATCHED_RIDE.md` and `PART_C_RIDE_CHAT.md`.

## 6. Data and backend — confirm in Phase 0

| Need | Used by | Exists today? | If missing |
|---|---|---|---|
| `ride_messages` + services (list, send text/quick/photo, mark read, typing, report) | C | **Yes** (C1 merge) | — |
| Unread count per ride | A, B | Yes: `unreadByRideRequestId` (driver), `unreadMessageCount` (passenger) | — |
| Ride status `assigned` / `ongoing` / ended | B, C read-only | Yes (`ride_requests.status`) | — |
| Driver arrived flag | B stage 2 | Yes (`f4_driver_arrived` migration) | — |
| Driver transfer event | B banner | Yes (`ride_transfers`, `respond_transfer`) | compare driver id on update |
| Plate number on booking | B, C header | check the `tricycles` join in the booking store | required; flag if missing |
| ETA minutes | B, C header | probably not (distance only) | km ÷ 15 km/h, rounded, "about"; else hide |
| Phone / masked number | A/B Call | **No** | Call hidden behind `features.rideCall` |
| Cancel reasons + reason code | B cancel | check `ReasonPickerModal` and the cancel service | 4 placeholders in Part B |
| `system` chat messages (accepted, transferred, ended) | C system pills | **Kind exists, nothing writes it** | render client-side pills from ride events (Part C §C5) — no DB writes |
| Last message per ride for the preview banner | A, B banner | derivable from `ride_messages` | skip the banner |

## 7. Screen index

| PNG | Part | Frame | State |
|---|---|---|---|
| A1-driver-heading-to-pickup | A | Driver 4a | contact row, stage 1 |
| A2-driver-two-passengers | A | Driver 4b | contact row + "Then" list |
| B1-passenger-on-the-way | B | Matched 5a | stage 1 |
| B2-passenger-driver-here | B | 5a | stage 2 |
| B3-passenger-riding | B | 5a | stage 3, no Cancel |
| B4-passenger-cancel-no-reason | B | 5a | cancel sheet, disabled |
| B5-passenger-cancel-reason-selected | B | 5a | cancel sheet, enabled |
| B6-passenger-driver-changed | B | 5b | transfer banner |
| C1-passenger-chat-active | C | Chat 6a | all message kinds |
| C2-passenger-chat-empty | C | 6b | empty + composer focused |
| C3-passenger-chat-read-only | C | 6c | ride ended |
| C4-passenger-report-sheet | C | 6d | long-press → report |
| C5-passenger-trip-unread-entry | B+C | 6e | preview banner + filled Message with count |
| C6-driver-chat-two-passengers | C | 7a | passenger switcher + send failed |
| C7-driver-trip-chat-entry | A+C | 7b | preview banner + "Then" badge |

The driver chat's empty, read-only and report states use the **same shared components** as C2–C4. Only the copy and quick replies differ (Part C §C8).
