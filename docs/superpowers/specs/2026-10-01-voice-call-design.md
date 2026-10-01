# In-app voice call — design

Implements UAT C2 (docs/UAT_PANELIST_REVIEW_ADRALES.md): a voice call between the passenger and their driver, entirely inside the app, with no phone number ever shown or shared. Chat (C1) is already live; this sits beside it.

## Agreed with the user
- Voice only, in-app, no phone numbers (user, 2026-10-01).
- Provider: **Agora** (`react-native-agora`), chosen over LiveKit and self-built WebRTC for the larger free allowance (10,000 participant-minutes a month, about 5,000 call minutes), the least code, and because the UAT plan already assumed it.
- Incoming call when the other app is closed or the phone is locked: **a loud high-priority notification, tap to answer**, plus a full-screen answer screen when the app is open. The lock-screen system call UI is not part of this build.

## What exists today
- `features.rideCall` (packages/shared/src/constants) is `false`; the Call buttons are already drawn behind it: passenger `app/booking/trip.tsx`, driver `app/trip/active.tsx` (one per passenger). Their `onPress` is an empty stub.
- Chat provides the pattern to copy: a two-party RLS predicate through `ride_requests.trip_id -> trips.driver_id` (follows a transfer automatically), a pg_net trigger to an edge function authenticated with the shared Vault secret (`notify-new-message`), and `useChatNotifications` (Android channel, foreground handler, tap routing).
- The passenger Android manifest already declares `RECORD_AUDIO`; the driver app needs it added.

## Rules
- **Who:** the ride's passenger and its current assigned driver, either can start a call.
- **When:** only while `ride_requests.status` is `assigned` or `ongoing`, and the caller's account is active.
- **One active call per ride**, and a person can be in only one call at a time: calling someone already on a call fails with "busy".
- **Ring window:** 30 seconds. After that the call is `missed`. Answering after the window is refused by the server.
- **Attempt limit:** at most 6 call attempts per ride per hour, and 40 per user per day. Failed attempts count.
- **Never recorded.** Only metadata is kept: who, when, how long, how it ended.
- **No phone numbers anywhere:** screens show first name and photo only; the Agora user id is a random number per call; the channel name is the call id.

## Data (migration)
Table `ride_calls`:
- `id uuid pk`, `ride_request_id` (fk), `caller_id`, `callee_id` (fk users), `status` check in (`ringing`, `answered`, `declined`, `cancelled`, `missed`, `ended`), `created_at`, `answered_at`, `ended_at`, `end_reason text`.
- Partial unique indexes: one non-final call per ride; one non-final call per caller and per callee (for "busy").
- RLS: select for the two parties (same predicate as `ride_messages`); no insert, update or delete policy and no table grant, so every change goes through the functions below. Added to the realtime publication so the apps can watch their own calls.

Functions (security definer, authenticated only, each checks `auth.uid()` and account status):
- `start_ride_call(p_ride_request_id)` — checks party, ride status, limits and busy; derives the callee on the server; inserts a `ringing` row; returns the call id.
- `answer_ride_call(p_call_id)` — callee only, call still `ringing` and inside the 30-second window.
- `decline_ride_call(p_call_id)` — callee only, while `ringing`.
- `end_ride_call(p_call_id)` — while `ringing` only the caller may end it (it becomes `cancelled`; the callee uses decline); while `answered` either party may end it (it becomes `ended`, with the duration).
- `expire_ringing_calls()` — marks `ringing` rows older than 30 seconds `missed`, and ends `answered` or `ringing` rows whose ride has left `assigned`/`ongoing`, or whose driver is no longer the ride's current driver (a transfer ends the call, so the old driver can't stay on a passenger's call). Run every minute by pg_cron; answer/end also expire a stale row they touch, so a late cron can't leave a call stuck.

## Server
- **`call-token` edge function** (verify_jwt on): body `{ callId }`. Confirms the caller is a party to the call, the call is `ringing` or `answered`, the ride is still `assigned`/`ongoing`, and both parties are still the ride's passenger and current driver. Returns `{ appId, channel, uid, token }`: channel is `call_<callId>`, uid is a random positive integer, token is an Agora RTC token (publisher role) valid for one hour, built with the Agora token library and the `AGORA_APP_CERTIFICATE` secret. `AGORA_APP_ID` is also read from the environment.
- **`notify-incoming-call` edge function** (shared-secret auth, like `notify-new-message`): triggered after insert on `ride_calls` with status `ringing`. Looks up the callee's push token and sends an Expo push, priority high, on the Android channel `calls`, text "Incoming call from your driver/passenger", data `{ type: 'incoming_call', callId, rideRequestId }`. No name, no number.
- **Known limit, accepted by the user:** Android plays the push sound once, not as a looping ringtone, and Do Not Disturb or blocked notifications can silence it. The answer screen itself (app open) shows and vibrates until answered or timed out.

## Apps (passenger and driver)
- `packages/services/src/calls/index.ts`: `startRideCall`, `answerRideCall`, `declineRideCall`, `endRideCall`, `getCallToken`, `subscribeToMyCalls` (realtime on `ride_calls`, refetch on subscribe, same shape as `subscribeToTransferInvites`). Unit tests with the fake client.
- Audio engine wrapper around `react-native-agora` (audio only, communication profile): `join`, `setMuted`, `setSpeaker`, `leave`, remote-joined and remote-left events, and the microphone permission request at call time. Shared between the apps.
- Shared screens in `packages/ui`: `IncomingCallScreen` (photo, first name, Answer, Decline) and `InCallScreen` (photo, first name, state text, timer, Mute, Speaker, End).
- Routes: passenger `app/booking/call.tsx`; driver `app/trip/call/[rideRequestId].tsx`.
- A root-level hook in each app (`useIncomingCalls`, next to `useChatNotifications`) watches for a `ringing` call addressed to the user: it opens the answer screen immediately when the app is in the foreground, routes a tapped notification to the same screen, and closes the screen if the caller hangs up first. It registers the `calls` Android channel (importance max, vibration).
- `features.rideCall` is switched to `true`; the Call buttons start a call and navigate to the call screen. The driver's button is per passenger. Hidden when the ride is not `assigned`/`ongoing`, as today.
- States shown to the caller: calling, ringing, connected, busy, declined, no answer, ended, connection lost (leaves after the other side has been gone about 15 seconds).
- English and Filipino strings.
- Dependencies: `react-native-agora` in both apps (autolinked), `RECORD_AUDIO` in the driver manifest, one rebuild of each app.

## Rulings
- **No separate "alternate provider" abstraction:** the wrapper is thin and Agora-specific; switching later is a rewrite of one file. Cost if wrong: one file.
- **Server-authoritative timeouts** (cron plus checks inside the functions) rather than trusting each phone's timer.
- **Per-call channels and ids** rather than per-ride, so an old token can never join a later call.
- **Counting failed attempts** toward the limits, to stop request spam.
- **Missed-call notifications and a call log screen are not built** (the row is stored, nothing reads it yet).

## Verification
- Rolled-back SQL checks: a non-party can't read calls or start one; can't start on a completed, cancelled or pending ride; second call on a ride, and busy callee, are refused; only the callee can answer or decline; answering after 30 seconds is refused; both parties can end; expiry marks stale rows; clients cannot insert, update or delete `ride_calls`; attempt limits trip.
- Unit tests: calls service wrappers, the token-builder input checks, `call-token` authorization decisions as a pure function.
- Typecheck for both apps and all packages; full services test suite stays green.
- On device (needs the user): two Android phones, one with each app. Call both directions, answer, decline, no answer (missed), caller cancels while ringing, mute, speaker, end, and a call with the app closed (tap the notification).

## Needs from the user
- A free Agora project: App ID and App Certificate. The App Certificate goes in Supabase secrets as `AGORA_APP_CERTIFICATE` (never in chat or files); the App ID as `AGORA_APP_ID`.
- A second Android phone for the on-device test.

## Not in this build
Lock-screen system call UI, missed-call notifications, a PSO call-history view, call recording, group calls, Bluetooth handling beyond the platform default, iOS, and a looping ringtone while the app is closed.
