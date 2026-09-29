# Part C — Ride chat redesign (both apps)

Screens: `C1`–`C4`, `C6` (plus the entry points in `C5`, `C7`). Prototype: `prototypes/TriSakay Chat Redesign.dc.html` (frames 6a–6e passenger, 7a–7b driver).
Routes: `apps/passenger/app/booking/chat.tsx` · `apps/driver/app/trip/chat/[rideRequestId].tsx`.
Shared components (restyle and extend these; don't fork them): `packages/ui/src/components/{ChatBubble,ChatComposer,QuickReplyRow,TypingDots}`.

**What does not change:** `useChatStore` (connect/disconnect, typing timeout), `packages/services/src/chat` (list/send/photo/markRead/typing/report), signed-URL loading, `preparePhotoForChat`, `useChatNotifications`, `notify-new-message`, RLS and the rate limit. Both screens keep their current data flow; this is presentation plus a few derived values.

## C1. Screen structure (top → bottom)

```
SafeArea top
┌ ChatHeader ────────────────────────────────┐  white, 1px lineSoft bottom
│ ‹  (JS) Jomar Santos              [PLATE] │
│        ● Arriving in 4 min        TRK 4821│
│ [ Maria · Pickup | Ben · On board ① ]     │  driver + ≥2 passengers only
└────────────────────────────────────────────┘
[🛡 Numbers are hidden automatically. Long-press a message to report it.  ✕]  privacy tip (dismissible)
FlatList (bg colors.bg, padding 12/16/8, content anchored to bottom)
   TODAY
   (● Jomar accepted your ride · 9:38 AM)        ← system pill (client-derived)
   ⚡ On my way                                  ← received quick reply
   9:39 AM
                   I'm at the waiting shed…      ← sent text
                                     9:40 AM
   Sige po… text me at [🛡 number hidden]        ← received text w/ masked token
   …
   (• • •)                                       ← typing bubble
[⚠ Couldn't send that message.        Retry]     ← send-error bar (only on error)
[⚡ Where are you?] [⚡ I'm at the pickup point] [⚡ Please wait]   ← QuickReplyRow
┌ ChatComposer ──────────────────────────────┐
│ (📷)  ( Message Jomar…            )  (➤)   │
└────────────────────────────────────────────┘  + bottom inset
        — or, when the ride has ended —
┌ ReadOnlyBar: 🔒 This ride has ended…  [ Report a problem with this ride ] ┐
```

## C2. ChatHeader (new, `packages/ui/src/components/ChatHeader`)
Replaces `ScreenHeader` + a right-side avatar on both screens.
- Container: white, padding `insets.top+10 12 10 6`, 1px `lineSoft` bottom border, column gap 10.
- Row (gap 8, centred):
  - Back: 44×44, `chevron-back` 20 ink → `router.back()`.
  - `Avatar` 40 (initials bold 14 accentBluePressed on accentBlueSoft).
  - Column (flex 1): name semibold 16/21 ink (1 line, ellipsis) over the **status line**: 7px dot + medium 12.5/17 inkSoft (1 line, ellipsis).
  - Right slot:
    - **Passenger:** compact plate tag. White, 1.5px ink border, radius 8, padding 2/8; `PLATE` semibold 8.5 +0.8 uppercase inkSoft over the plate, extrabold 13 +0.5 ink. Hidden when the ride has ended.
    - **Driver:** empty.
- Status line content:

| App | Ride state | Dot | Text |
|---|---|---|---|
| Passenger | assigned, not arrived | accentGreen | `Arriving in {eta} min` (fallback `On the way`) |
| Passenger | assigned, arrived | accentGreen | `Waiting at pickup` |
| Passenger | ongoing | accentBlue | `On the way to drop-off` |
| Driver | passenger assigned | 8px ring, 2px accentGreen border | `Pickup next · {pickupShort}` (or `Pickup · …` if not next) |
| Driver | passenger ongoing | 8px square r2 accentBlue | `On board · drop at {dropoffShort}` |
| Both | completed | lineStrong | `Ride completed · {time}` |
| Both | cancelled | lineStrong | `Ride cancelled · {time}` |

- Data: passenger uses `useBookingStore` (driver, plate, eta, status, arrived); driver uses `useTripStore().current.passengers` (already read by the screen). No new queries.
- **Passenger switcher (driver only, C6):** rendered when `current.passengers.filter(assigned|ongoing).length ≥ 2`.
  - Segmented: bg `bg`, radius 12, padding 3, margin-left 6. Segments flex 1, minHeight 36, radius 9.
  - Active: white bg, shadow `0 1 4 rgba(0,46,96,.12)`, bold 13 accentBlue. Inactive: semibold 13 inkSoft.
  - Label: `{firstName} · {Pickup|On board}`. Unread count pill after the label when > 0 (18px, radius 9, accentBlue, extrabold 10.5 white).
  - Tap → `router.replace('/trip/chat/' + id)`. `useChatStore.connect` re-runs through the existing effect deps, so no store change is needed. Unread counts come from the same per-ride fetch `active.tsx` uses; lift it into a small hook, `useUnreadByRide(passengerIds)`, and use it on both screens.

## C3. Privacy tip (new, inline in each screen)
- Row under the header: bg accentBlueSoft, padding 8/16, gap 8. Shield icon 13 accentBlue · text medium 11.5/16 accentBluePressed, flex 1: `Numbers are hidden automatically. Long-press a message to report it.` · close icon 12 inkSoft (hitSlop 16).
- Dismissal persists **per user** in local storage (`chatTipDismissedAt`). Show it on the first 3 chats, or until dismissed.
- Not shown in read-only state or in the empty state (the empty state has its own note).

## C4. Message list rendering
Derive display rows in a pure helper, `buildChatRows(messages, selfId, rideEvents, locale)` in `packages/shared` (unit-test it), which returns `{type:'day'|'system'|'message'|'typing', …}`.

**Grouping:** consecutive messages from the same sender within 3 minutes form a group.
- Gap inside a group: 2px. Gap between groups: 8px (the timestamp row provides it).
- Tail corner: only the **last** bubble of a group gets the 6px corner (bottom-left received, bottom-right sent). Middle bubbles on the received side use `6 18 18 6`; the prototype shows this in C6 ("May dala po akong 2 bayong").
- **Timestamp row** only after the last bubble of a group: regular 11/15 inkFaint, padding `2 4 8`, aligned to the bubble side. Format `h:mm A` (existing `formatTime`).
- **Seen:** only on the **most recent sent message that has `readAt`**, appended to its group's timestamp row: ` · ` + `checkmark-done` 13 accentGreen + semibold "Seen" accentGreenPressed. Remove the per-bubble `readLabel` (it shows on every read message today).

**Day separator:** centred `TODAY` / `YESTERDAY` / `SEP 28`. Semibold 11/15 +0.6 uppercase inkFaint, padding `4 0 6`.

**Bubble kinds (`ChatBubble` restyle):**
| Kind | Sent | Received |
|---|---|---|
| `text` | accentBlue bg, regular 15/21 white | white bg, 1px lineSoft border, regular 15/21 ink |
| `quick_reply` | accentBlue bg, `flash` icon 12 accentBlueSoft + semibold 15/21 white | **accentBlueSoft bg, no border**, `flash` 12 accentBlue + semibold 15/21 accentBluePressed |
| `image` | 210×180, radius as a bubble, cover; placeholder `line` bg + image icon 30 lineStrong while the signed URL loads; tap → full-screen viewer (`Modal`, black bg, pinch optional, close 44 top-right) | same |
| `system` | → system pill (C5), never a bubble | |

- Bubble: maxWidth 78%, radius 18 (tail 6), padding 9/14, gap 4. **No time or meta inside the bubble any more**; it moves to the timestamp row.
- **Masked phone token:** when `containsMaskedPhone`, split `body` on the literal `[phone number removed]` and render each occurrence as an inline token: bg `bg`, 1px **dashed** lineStrong, radius 6, padding 0/6, shield 11 inkSoft + medium 13/19 inkSoft text `number hidden`. On sent bubbles, use bg `rgba(255,255,255,.14)`, a dashed border `rgba(255,255,255,.5)` and white text/icon. **Remove** the separate italic `maskedNotice` line; the token is the notice. Keep `maskedNotice` as the token's accessibilityLabel.
- Long-press (received only, as today) → C9 report sheet instead of `Alert.alert`. Add light haptics. While the sheet is open the pressed bubble shows lifted (scale 1.03, shadow `0 8 24 rgba(0,0,0,.25)`) above the scrim.

**Typing:** when `otherPartyTyping`, append a received-style bubble (white, lineSoft border, radius `18 18 18 6`, padding 13/16) containing `TypingDots` (lineStrong). This replaces today's bare dots row.

## C5. System pills (client-derived, no DB writes)
Centred pill: bg `fill`, radius 999, padding 5/12, gap 6, icon 12 + medium 12/16 inkSoft. Inserted by `buildChatRows` from ride timestamps the screen already has:
- accepted (`assigned_at`/trip created): `checkmark-circle` accentGreen · passenger `{driver} accepted your ride · {time}`; driver `You accepted {passenger}'s ride · {time}`.
- driver changed (passenger only, from B6): `swap-horizontal` accentBlue · `Your ride moved to {newDriver} · {time}`.
- arrived: `location` accentGreen · passenger `{driver} arrived at pickup · {time}`; driver `You arrived at pickup · {time}`.
- ended: `lock-closed` inkSoft · `Ride completed · chat closed` / `Ride cancelled · chat closed`.
If a timestamp isn't available, skip that pill. If a `system` row ever arrives from the DB, render it as a pill with its body.

## C6. Error bar (send / photo / rate limit)
Shown above the chips when `sendError` or `chatError` is set; it replaces the red text lines at the top.
- Row: bg dangerSoft, padding 10/16, gap 10. Alert icon 15 danger · medium 13/18 **danger** text, flex 1 · **Retry** button (minHeight 32, padding 0/10, radius 8, white bg, bold 13 danger).
- Retry: for text → `handleSend()` (the draft is still in the field, since the current code only clears on success). For a quick reply → re-send the last code (store it in a `lastFailed` ref). For a photo → re-open the picker. For a connection error (`chatError`) → `disconnect(); connect(...)`.
- Rate limit: the server error `You're sending messages too quickly…` → show the i18n `chat.rateLimited` (new key) and **no Retry**; auto-clear after 10 s.
- Dismiss automatically on the next successful send.

## C7. QuickReplyRow restyle
- Horizontal `ScrollView`, padding `6 16 8`, gap 8 (kept).
- Chip: white bg, 1px `line` border, radius 999, padding 0/13, `flash` icon 11 accentBlue + semibold 13.5/18 ink, `numberOfLines={1}`.
  - **Passenger:** minHeight 36, `hitSlop` 4.
  - **Driver:** minHeight **44**, padding 0/15, icon 12, text 14.5/19 (larger targets for use while driving).
- Add a `size: 'md' | 'lg'` prop (driver = `lg`). Disabled: opacity .5 (kept).
- Codes (unchanged): passenger `where_are_you`, `at_pickup_point`, `please_wait`; driver `im_here`, `on_my_way`, `arriving_2_min`.
- Hidden in read-only state.

## C8. ChatComposer restyle
- Bar: white, 1px lineSoft top border, padding `10 12 {insets.bottom+10}`, row gap 8, `alignItems:'flex-end'`.
- Camera: 44×44 circle, bg `bg`, `camera-outline` 21 inkSoft. Kept conditional on `onAttachPhoto`.
- Input wrap: flex 1, minHeight 44, maxHeight 120, radius 22, 1px `line` border, bg `bg`, padding 0/16; text regular 15/20 ink; placeholder inkFaint.
  - **Focused:** 1.5px accentBlue border, white bg (C2).
  - Placeholder is personalised: passenger `Message {driverFirst}…`, driver `Message {passengerFirst}…`. New keys with `{{name}}`; keep the old keys as the fallback when the name is unknown.
  - Counter: when `length ≥ 900`, show `{n}/1000` (medium 11 inkFaint) right-aligned above the input.
- Send: 44×44 circle. Enabled: accentBlue bg, `send` 17 white. Disabled: `fill` bg, inkFaint icon. Sending: `ActivityIndicator` white in place of the icon.
- Ride not `assigned`/`ongoing` → render **ReadOnlyBar** instead of the chips and composer (C10).

## C9. Report sheet (C4) — replaces the two `Alert.alert` calls
- Scrim `overlay`; bottom sheet white, top radius 28, padding `10 18 {inset+26}`, gap 14, handle.
- Header row gap 12: 44 tile (radius 14, dangerSoft, `flag-outline` 19 danger) · `Report this message?` (extrabold 20/26 −0.3 ink) over `From {name} · {time}` (12.5 inkSoft).
- Body 14/21 inkSoft: `We'll send it to the PSO as a conduct complaint on this ride. You can follow it in Complaints.`
- Buttons (column gap 10, minHeight 54, radius 16): **Report message** (1.5px danger border, bold 15.5 danger) → the existing `reportMessage(...)`, with a spinner · **Cancel** (fill bg, semibold 15.5 ink).
- Result: toast (ink bg, radius 14, check/alert icon) `Reported. We'll review it.` / existing `reportFailed`. Place the toast above the composer.
- Photo messages: body text `Reported a chat message (photo).` (as today in the service).

## C10. Read-only bar (C3)
Condition: the ride status is not `assigned`/`ongoing` (RLS blocks inserts then). Detect it from the booking/trip store, and also when a send fails with an RLS error.
- Bar: white, 1px lineSoft top border, padding `14 16 {inset+18}`, gap 10.
- Row: `lock-closed-outline` 18 inkSoft + medium 13.5/19 inkSoft `This ride has ended. You can still read this chat, but you can't send new messages.`
- Button: outline minHeight 48, radius 14, 1.5px lineStrong, `flag-outline` 15 + semibold 14.5 ink `Report a problem with this ride` → passenger `/complaints/new?rideRequestId={id}` (new route in this merge); driver `/complaints?rideRequestId={id}`. Prefill the ride.
- Append the ended system pill (C5) to the list.

## C11. Empty state (C2)
When `!loading && messages.length === 0`: centred column, padding 0/40, gap 10.
- 56 tile (radius 18, accentBlueSoft, `chatbubble-ellipses-outline` 26 accentBlue).
- Title bold 18/24 ink: passenger `Say hi to {driverFirst}`; driver `Message {passengerFirst}`.
- Body 13.5/20 inkSoft: passenger `Tell him where to find you. Tap a quick reply below or type your own.` (use neutral "them" if gender is unknown; pick one and keep it consistent). Driver: `Let them know you're on the way. Use a quick reply while driving.`
- Note (medium 12 inkSoft, shield 12 accentGreen): `Phone numbers are hidden automatically`.
- Replaces `EmptyState` on this screen. The chips and composer stay visible.

## C12. Loading
While `loading && messages.length === 0`: 3 skeleton bubbles (alternating sides, `fill` bg, 44px tall, widths 60/45/70%). No spinner.

## C13. i18n (add to `en.ts` + `fil.ts`, under the existing `chat` and `driver.chat`)
```
chat.headerArriving "Arriving in {{n}} min" · headerOnTheWay "On the way" · headerWaiting "Waiting at pickup"
chat.headerRiding "On the way to drop-off" · headerCompleted "Ride completed · {{time}}" · headerCancelled "Ride cancelled · {{time}}"
chat.plate "Plate"
chat.tip "Numbers are hidden automatically. Long-press a message to report it."
chat.today "Today" · yesterday "Yesterday"
chat.numberHidden "number hidden"
chat.inputPlaceholderNamed "Message {{name}}…"
chat.retry "Retry" · rateLimited "You're sending messages too quickly. Wait a moment."
chat.reportTitle "Report this message?" · reportFrom "From {{name}} · {{time}}"
chat.reportBody "We'll send it to the PSO as a conduct complaint on this ride. You can follow it in Complaints."
chat.reportDone "Reported. We'll review it."
chat.readOnly "This ride has ended. You can still read this chat, but you can't send new messages."
chat.reportRide "Report a problem with this ride"
chat.emptyTitleNamed "Say hi to {{name}}" · emptyBodyPassenger "…" · emptyNote "Phone numbers are hidden automatically"
chat.sys.accepted "{{name}} accepted your ride · {{time}}" · sys.moved "Your ride moved to {{name}} · {{time}}"
chat.sys.arrived "{{name}} arrived at pickup · {{time}}" · sys.completed "Ride completed · chat closed" · sys.cancelled "Ride cancelled · chat closed"
chat.photo "Photo" (preview banner)
driver.chat.* — same keys, driver copy: headerPickupNext "Pickup next · {{place}}" · headerOnBoard "On board · drop at {{place}}"
  sys.accepted "You accepted {{name}}'s ride · {{time}}" · sys.arrived "You arrived at pickup · {{time}}"
  emptyTitleNamed "Message {{name}}" · emptyBodyDriver "Let them know you're on the way. Use a quick reply while driving."
  switcherPickup "{{name}} · Pickup" · switcherOnBoard "{{name}} · On board"
```
Supply Filipino strings for every new key (follow the existing `fil.ts` tone).

## C14. Accessibility
- Bubbles: `accessibilityLabel` = `{sender}, {text | "photo" | quick-reply label}, {time}{, seen}`.
- Masked token: label = `maskedNotice`.
- Typing bubble: `accessibilityLiveRegion="polite"`, label `{name} is typing`.
- Error bar: `accessibilityRole="alert"`.
- Respect reduced motion (TypingDots already does).

## C15. Acceptance
- [ ] C1, C2, C3, C4, C6 match at 390×844. Check 360 width: the header name/status line, chips and plate don't wrap.
- [ ] Grouping, tail corners, a single Seen on the latest read sent message, and day separators are all correct over a 30-message thread (unit-test `buildChatRows`).
- [ ] Quick replies are sent as codes and render in the receiver's language (test en ↔ fil).
- [ ] The masked token renders for every `[phone number removed]` occurrence and the italic notice is gone.
- [ ] Long-press on a received message → report sheet → complaint filed; there's no long-press on sent messages.
- [ ] Error bar: text retry keeps the draft; rate-limit copy has no retry; a connection error reconnects.
- [ ] Read-only bar appears after completed/cancelled; history is still readable; Report routes with the ride prefilled.
- [ ] Driver switcher appears only with ≥ 2 active passengers, switches threads, and shows unread counts.
- [ ] `useChatStore`, services, RLS and push are untouched; typecheck, lint and existing chat tests pass.
