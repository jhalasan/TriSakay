# Emergency/SOS Alert (FR-12) — Design

**Scope:** `apps/driver`, `apps/passenger`, `apps/admin`, plus `packages/services` and `packages/ui`. No backend/schema changes — `emergency_alerts`, its enums, RLS policies, and the `notify_pso_on_emergency()` trigger are already live (`docs/SCHEMA.MD` §3.7/4.10/7.13).

Cross-reference: `docs/CONTEXT.MD` FR-12.1–12.7, NFR-4, wireframe review items 8–10 (§11); `docs/DRIVER_TODO.MD` item 20; `docs/PASSENGER_TODO.MD` item 15; `docs/ADMIN_TODO.MD` F15.

## Decisions made during brainstorming

1. **"PSO has been notified" fires automatically** when the emergency screen opens (matches FR-12.3's "in parallel" wording and the wireframe's "confirmation line," not a button). Fire-and-forget — never blocks or gates the 911 button. A failure shows a quiet inline message with manual retry (NFR-4 treats this as an expected best-effort path).
2. **FR-4.9's complaint-form nudge is out of scope for this pass** — left as an easy follow-up once this screen exists to link to.
3. **Context is read from the existing trip store, not route params** — both apps already hold the active trip in `useTripStore`/`useBookingStore`; the new emergency screen reads the same store, matching how every other trip sub-screen already works.

## A. Shared service module — `packages/services/src/emergency/index.ts`

```ts
export interface TriggerEmergencyAlertInput {
  rideRequestId: string | null;
  triggeredRole: 'passenger' | 'driver';
  counterpartId: string | null;
  lat: number;
  lng: number;
}
export async function triggerEmergencyAlert(input: TriggerEmergencyAlertInput): Promise<{ error: string | null }>
```

Mirrors `submitComplaint`'s exact shape: `getSignedInUserId()` via `auth.getSession()`, then an explicit `.insert()` (`emergency_alerts.triggered_by` has no default, unlike a trigger-populated column). No read/list function — neither app ever displays a user's own past alerts.

## B. Shared UI component — `packages/ui/src/components/HoldToConfirmButton`

New component (no hold-to-confirm pattern exists anywhere in this codebase). Press-and-hold ~900ms with a visible filling progress indicator; releasing early cancels. Danger-toned, full-width. Lives in `packages/ui` since both driver and passenger need it.

**Testing note:** this repo has zero component-render tests anywhere (only `node:test` over pure functions/Zustand stores). This component's gesture/timing behavior is verified live in Expo web, not unit tests — matching how every other gesture-driven RN screen here is verified.

## C. Driver app (`apps/driver`)

- `src/store/useTripStore.ts`: widen `ActiveTrip` with `passengerId: string | null`; widen `setPassengerInfo(id, name, avatarUrl)`. Data already exists — `getTripPassengerInfo()` already returns `passengerId`, the one call site (`src/hooks/useAcceptRideRequest.ts`) currently discards it.
- `app/trip/active.tsx`: add the SOS `HoldToConfirmButton`, always visible, navigates to `app/trip/emergency.tsx` on hold-confirm.
- New `app/trip/emergency.tsx`: reads `trip` from `useTripStore` (`trip.id` = rideRequestId, `trip.passengerId` = counterpartId). On mount: GPS fix via `Location.getCurrentPositionAsync` (same call already used in `dashboard.tsx`) → `triggerEmergencyAlert()` once, ref-guarded against double-fire. Status line: "Notifying PSO of your location…" → success/failure-with-retry. Independent **"Call 911 / PNP"** button via `Linking.openURL('tel:911')`, always enabled regardless of the alert insert's outcome (NFR-4). Back link returns to the active trip, unaffected.
- New `src/styles/trip/emergency.styles.ts`.

## D. Passenger app (`apps/passenger`)

Same shape:
- `app/booking/trip.tsx`: add the SOS button (driver info already loaded here).
- New `app/booking/emergency.tsx`: reads `driver`/`rideRequestId` from `useBookingStore` (`driver.id` = counterpartId, already a real `users.id` per `get_trip_driver_info`). Same GPS-fix → auto-fire → 911-button pattern.
- New i18n keys in `packages/shared/src/i18n/{en,fil}.ts` (passenger uses `t.*`; driver uses plain strings, matching each app's existing convention).
- New `src/styles/booking/emergency.styles.ts`.

## E. Admin app (`apps/admin`)

- New `packages/services/src/admin/emergency.ts`: `listEmergencyAlertsForAdmin()` (real `emergency_alerts` read, names resolved via the established `resolveUserNames()` follow-up-query convention — no multi-hop embed) and `markEmergencyAlertReviewed(id, notes?)` (`status: 'reviewed'`, stamps `reviewed_by`/`reviewed_at`, under the existing `emergency_review_supervisor` RLS policy — no new RPC). One-shot fetch on load, no Realtime — matches every other admin screen, and FR-12.7 explicitly says this isn't meant to be real-time-monitored.
- New `apps/admin/src/routes/EmergencyAlerts.tsx`: table (time, role, triggered-by name, status) + click-to-expand detail panel (lat/lng with a "View on map" Google Maps link, linked ride id, counterpart name, notes) — same list+inline-panel shape as `Complaints.tsx`. "Mark Reviewed" + optional notes wrapped in `RoleGate min="supervisor"`; the screen itself is reachable by any PSO Staff+ (FR-12.4).
- New `apps/admin/src/store/useEmergencyAlertsStore.ts` + thin `apps/admin/src/services/emergency.ts` wrapper, new sidebar entry (`/emergency-alerts`) — same one-file-per-feature convention as every other F-item.
- `emergency_status` has 3 values (`logged`/`reviewed`/`closed`), but the wireframe review (item 10) names only one action, "Mark Reviewed." This pass wires exactly that one action → `status = 'reviewed'`. `closed` is left unused/unreachable from the UI — not a gap being silently dropped, just matching what the wireframe actually specifies; revisit only if a real product need for a distinct "closed" step shows up.

## F. Testing

- `packages/services/tests/emergency.test.ts` (trigger success, not-signed-in, insert error)
- `packages/services/tests/admin-emergency.test.ts` (list + mark-reviewed, mirrors `admin-complaints.test.ts`)
- `apps/admin/tests/services.test.ts` gets the emergency block added
- No test for `HoldToConfirmButton` itself (see note in section B) — verified live in Expo web

## Explicitly out of scope

- FR-4.9's complaint-form safety nudge (decision 2 above).
- A dedicated local PNP GenSan number — the spec says "911 national hotline and/or PNP GenSan" but no specific local number is documented anywhere in this repo; hardcoding an unresearched number would be worse than the universal 911 line, so only 911 is wired.
- Realtime updates on the admin Emergency Alerts screen (decision in section E).
