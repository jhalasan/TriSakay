# Driver App — UI & Navigation (Wireframe Implementation) — Design

## Context

`apps/driver` is still the stock `create-expo-app` template — `src/App.tsx` renders a static "Driver App" placeholder and nothing else. No `expo-router`, no screens, no stores, no Supabase wiring. `docs/DRIVER_TODO.MD` already lays out the full staged backend-wiring build order (18 steps); this sub-project is narrower — it builds the **real UI and navigation**, matching the 14-screen `TriSakay-Wireframe-Kit.pdf` (Part 1 · Driver) exactly, using the same design system `apps/passenger` already established (Poppins fonts, `packages/ui` component library, `expo-router` structure, per-screen Zustand stores, co-located `.styles.ts` files).

`packages/ui` turned out to already contain a full component library — `Avatar`, `Badge`, `Button`, `Card`, `Checkbox`, `ConfirmModal`, `EmptyState`, `GradientSurface`, `ListRow`, `MapPlaceholder`, `OsmMap`, `SegmentedControl`, `Spinner`, `StarRating`, `Stepper`, `TextField`, `Textarea`, `Toggle` — plus theme tokens (`colors`, `spacing`, `typography`, `radius`, `elevation`, `motion`). Every element the wireframe kit draws (buttons, toggles, star ratings, status badges, avatars, list rows, empty states) already has a matching real component. This sub-project composes those, it does not invent a new visual language.

### Decisions made with the user

1. **Backend scope:** UI + navigation is built for real; domain data (ride requests, earnings, trip history, documents) is mock-first, following the exact precedent `apps/passenger` set (`docs/PASSENGER_TODO.MD`: real screens, "deliberately emptied seams" for data, wired to Supabase screen-by-screen later per `docs/DRIVER_TODO.MD`).
2. **Auth/consent/location are wired for real now**, not mocked — they're small, already-proven, and every other screen depends on them. The only backend change in this whole sub-project is a one-line fix to `packages/services/src/auth/index.ts`.
3. **Navigation IA:** the 5-tab bar is **Dashboard · Requests · History · Earnings · Profile** — this is what the wireframe's bottom nav literally shows across screens 4, 5, 7, 8, 9. Complaints and Notifications are not tabs; they're reached via links (Complaints from Dashboard, Notifications via a bell icon), matching the wireframe screens that show no bottom nav at all (11, 12, 13).
4. **Document types (screen 10):** the wireframe shows 3 upload rows (License, OR/CR, Tricycle photo), but `docs/SCHEMA.MD`'s `document_type` enum has a 4th value, `franchise_permit` — which the Admin app's own verification wireframe (same PDF, page 25) *does* show as a 4th box. This build includes all 4 rows, since omitting one leaves a real document type permanently unuploadable. Flagged here as a deliberate deviation from the driver screen's literal mockup, not an oversight.
5. **Tricycle registration fields** (plate no., cluster, seat capacity) appear in no driver wireframe screen at all — only document uploads do. Not built in any form this pass; tracked as a gap, not invented.
6. **Active Trip models one primary passenger**, matching the wireframe's single-passenger screen 6 exactly. Multi-passenger pooling (FR-2.5b) is real product scope but has no wireframe screen to build against yet — deferred, not simplified-and-shipped as if it were pooling.

## Foundations

`apps/driver/package.json` gains the same dependency set that took `apps/passenger` from template to real app: `expo-router` (and `"main": "expo-router/entry"`), `zustand`, `expo-location`, `expo-image-picker`, `@react-native-async-storage/async-storage`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-safe-area-context`, `react-native-screens`, `react-native-svg`, `react-native-webview` (needed transitively by `@trisakay/ui`'s `OsmMap`), `@expo-google-fonts/poppins`, `@trisakay/services`, `@trisakay/ui`, `@trisakay/utils`. `react-hook-form` and `zod` are **not** added — passenger itself hasn't adopted them in any screen yet (`docs/PASSENGER_TODO.MD` step 0), so there is no pattern to match; driver forms use the same hand-rolled `useState` + `validation.ts` predicates passenger's auth screens use.

`babel.config.js` and `metro.config.js` are copied from `apps/passenger`'s (both are generic Expo Router configs, nothing passenger-specific in either). `app.json` needs the `expo-location` config plugin added (foreground usage description), same as passenger's.

Brand assets (`assets/brand/trisakay-lockup.png`, `trisakay-mark.png`) are imported via relative path straight from the shared root `assets/`, exactly as passenger does — no duplication into `apps/driver`.

Per `AGENTS.md`, the exact v54 Expo docs (https://docs.expo.dev/versions/v54.0.0/) are read before writing any `expo-location`/`expo-image-picker`/`expo-router` code, matching the convention the auth/consent sub-project already established.

## Services change

`packages/services/src/auth/index.ts`:

```ts
export interface SignUpInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role?: 'passenger' | 'driver';   // new, defaults to 'passenger'
}

export async function signUp({ fullName, email, phone, password, role = 'passenger' }: SignUpInput) {
  // ...options.data.role: role   (was the hardcoded string 'passenger')
}
```

Every existing passenger call site (`apps/passenger/src/store/useAuthStore.ts`) omits the new param and is unaffected. Driver's `register()` action passes `role: 'driver'`.

## Navigation tree

```
app/
  index.tsx                 → Redirect to /splash
  splash.tsx                 → brand splash, hydration + consent wait, same routing shape as passenger's
  consent.tsx                 → ToS/Privacy gate (screen content identical pattern to passenger's; consent
                                  service itself is already role-agnostic, keyed by user_id)
  location-permission.tsx      → transparentModal gate, copied pattern
  logout.tsx                    → ConfirmModal, copied pattern
  (auth)/
    login.tsx                    → wireframe screen 2 (adds "Register as driver" secondary button)
    register.tsx                  → wireframe screen 3
  (tabs)/
    _layout.tsx                    → 5-tab bar: Dashboard, Requests, History, Earnings, Profile
    dashboard.tsx                   → wireframe screen 4
    requests.tsx                     → wireframe screen 5
    history.tsx                       → wireframe screen 7
    earnings.tsx                       → wireframe screen 8
    profile.tsx                         → wireframe screen 9
  trip/
    active.tsx               → wireframe screen 6 (pushed, no tab bar)
  profile/
    documents.tsx              → wireframe screen 10 (pushed from Profile)
    settings.tsx                 → wireframe screen 13 (pushed from Profile)
  complaints.tsx               → wireframe screen 11 (pushed from Dashboard)
  notifications.tsx              → wireframe screen 12 (pushed via Dashboard's bell icon)
```

Root `_layout.tsx` reuses passenger's exact gating shape: `useProtectedRoute(isAuthenticated, consentStatus)`, `useConsentSync(sessionUserId)`, `useLocationPrompt(...)`, all re-pointed at `/(tabs)/dashboard` instead of `/(tabs)/home`. `LOCATION_PROMPT_ROUTES` becomes `['(tabs)', 'trip', 'profile', 'complaints', 'notifications']`.

## State layer

All stores live in `apps/driver/src/store/`, each its own file, same shape convention as passenger's (a `create<...>()((set) => ...)` slice, no shared store package — passenger's own stores aren't shared either, so there's no existing pattern to extract into `packages/*` yet).

| Store | Shape | Notes |
|---|---|---|
| `useAuthStore` | identical to passenger's (session hydration, epoch-guarded profile fetch, `login`/`register`/`logout`/`refreshProfile`) | `register()` calls `signUp({ ..., role: 'driver' })`. |
| `useConsentStore` | identical to passenger's | Consent service (`packages/services/src/consents`) is already generic — no change needed there. |
| `useLocationPermissionStore` / `useLocationPermission()` | identical to passenger's (`AppState`-driven, `granted/denied/blocked/unknown`) | Copied, not shared — same reasoning the consent/location spec already recorded: `packages/services` is pure-TS and `packages/ui` is components-only, so a device-capability hook has no home yet with only one real consumer at a time. Now that driver exists too, this becomes a two-consumer duplication; noted as a real follow-up candidate for a future `packages/native`, but not extracted in this pass — that's a separate refactor, not part of building the driver UI. |
| `useDriverStore` | `{ isAvailable, todayEarnings, todayTrips, rating, ratingCount, acceptRate, toggleAvailability() }` | All stat fields start at 0 / `null` (rating hidden until `ratingCount > 0`, same rule `DriverInfoCard` already follows). `toggleAvailability` is local-only (no `driver_profiles` write yet — that's `docs/DRIVER_TODO.MD` step 6). |
| `useRequestsStore` | `{ pending: MockRideRequest[], startSimulatingArrivals(), stopSimulatingArrivals(), accept(id), decline(id) }` | **Corrected from the original draft.** `mocks/drivers.ts` and `mocks/notifications.ts` in passenger are both literally empty arrays — passenger never seeds realistic fake data anywhere, including its own interactive booking simulation (`finding-driver.tsx` waits via `wait()`/`randomBetween()`, then calls `pickRandomDriver()`, which falls through to an empty placeholder record `{name: '', plateNumber: '', rating: null}` that the UI renders gracefully). `pending` therefore starts **empty**, matching that precedent exactly. `useDriverStore.toggleAvailability()` calls `startSimulatingArrivals()` when going online: the same `wait()`/`randomBetween()` idiom as `finding-driver.tsx` runs on a loop while available, appending one placeholder-shaped pending request (real `id`, `seats`, `paymentMethod`, `status: 'pending'`; empty/`null` pickup/dropoff label and fare, rendered by the UI the same way `DriverInfoCard` renders an empty driver name) every 8–15s. Going offline calls `stopSimulatingArrivals()` and clears `pending`. `accept(id)` removes it from `pending` and calls `useTripStore.startTrip(request)`. |
| `useTripStore` | `{ current: ActiveTrip \| null, startTrip(request), confirmCash(), complete(), cancel(reason?) }` | `complete()`/`cancel()` append a row to `useHistoryStore` and (on completion) credit `useEarningsStore`, then clear `current`. |
| `useHistoryStore` | `{ trips: TripHistoryItem[] }` | Starts **empty** — persistent-record convention, same as passenger's `seedRideHistory = []`. |
| `useEarningsStore` | `{ totalTracked, settlementLog: SettlementLogEntry[], notifyPsoForSettlement() }` | Starts at 0 / empty; grows only from `useTripStore.complete()`. `notifyPsoForSettlement()` is local-only for this pass (appends a "Logged" row) — no real `notifications` table write yet. |
| `useDocumentsStore` | `{ documents: Record<DocumentType, DocumentStatus> }` | Starts `'unsubmitted'` for all 4 types — real starting state for a fresh account, not just a UI convenience. |
| `useNotificationsStore` | identical shape to passenger's (`items`, `markAllRead`) | Starts empty. |
| `useSettingsStore` | identical shape to passenger's (push/location toggles, language, 2 checkbox rows) | Same fields — the wireframe's Settings screen (13) is field-for-field identical to passenger's. |

## Screen-by-screen

| # | Screen | Route | Composed from | Behavior |
|---|---|---|---|---|
| 1 | Splash | `app/splash.tsx` | `BrandMotif`, `GradientSurface`, `ActivityIndicator` | Copied from passenger; same hydration/consent wait; routes to `/(auth)/login`, `/consent`, or `/(tabs)/dashboard`. |
| 2 | Log in | `app/(auth)/login.tsx` | `TextField`, `Button`, `BrandMotif`, `GradientSurface` | Same as passenger's login, plus a secondary `Button variant="outline"` "Register as driver" → `/(auth)/register`. |
| 3 | Register | `app/(auth)/register.tsx` | `TextField`, `Button`, `ScreenHeader` | Name/email/phone/password/confirm, no avatar-picker step (wireframe screen 3 has none). Calls `register()` → `role: 'driver'`. |
| 4 | Dashboard | `app/(tabs)/dashboard.tsx` | `Avatar`, `Toggle`, `Badge`, `StatTile` ×4 (new), `RequestCard` (new) | Toggle drives `useDriverStore.isAvailable`. Stat grid reads `useDriverStore`. One `RequestCard` shown only when `useRequestsStore.pending[0]` exists and the driver is available — no `EmptyState` here, matching the wireframe's single-card layout exactly. |
| 5 | Ride requests | `app/(tabs)/requests.tsx` | `Badge`, `FlatList` of `RequestCard`, `EmptyState` | Full `useRequestsStore.pending` list. `EmptyState` ("No requests right now") when empty and available; a distinct "You're offline" notice when `!isAvailable`. |
| 6 | Active trip | `app/trip/active.tsx` | `OsmMap variant="route"`, `Badge`, passenger `Avatar`+row, `Toggle` (cash confirm), `Button` ×2 | No tab bar. Cash toggle/caption only rendered for `paymentMethod === 'cash'`; gcash trips show the caption only. "Complete trip" disabled until cash-confirmed or method is gcash. Complete/Cancel both route back to `/(tabs)/dashboard`. |
| 7 | Trip history | `app/(tabs)/history.tsx` | `Button` (3-state filter cycle, same as passenger's), `FlatList` (`Avatar`, `Badge`, fare text), `EmptyState` | Reads `useHistoryStore`. |
| 8 | Earnings & settlement | `app/(tabs)/earnings.tsx` | `Card`, `MapPlaceholder` (new `chart` variant — see below), settlement rows (`Badge` "Logged"), `Button` | Copy is strict about "tracked, not disbursed" (FR-9.6). "Notify PSO for settlement" is local-only. |
| 9 | Profile | `app/(tabs)/profile.tsx` | `Avatar`, `Button` (Edit), `StarRating` (read-only), `Card`, `ListRow` ×2 | Same edit-in-place pattern as passenger's `profile.tsx`. Rating hidden when `ratingCount === 0`. |
| 10 | Documents & tricycle | `app/profile/documents.tsx` | `ScreenHeader`, `DocumentUploadRow` (new) ×4, `Button` "Save & submit" | 4 rows per the flagged decision above (License, OR/CR, Tricycle photo, Franchise/Permit). Each row: status `Badge` + upload box using `expo-image-picker`, same picker call passenger's register.tsx already uses. |
| 11 | Complaints | `app/complaints.tsx` | `ScreenHeader`, `FlatList` (`Badge` Open/Review/Closed, `Button` "View"), form fields reused from passenger's complaint form | Reached from a Dashboard link. `View` shows a minimal read-only detail (title/message/status) — the wireframe kit has no dedicated detail screen to match beyond the list. |
| 12 | Notifications | `app/notifications.tsx` | `ScreenHeader`, `FlatList`, `EmptyState` | Identical structure to passenger's. Reached via Dashboard's bell icon. |
| 13 | Settings | `app/profile/settings.tsx` | `Toggle` ×2, language row, `CheckboxRow` (new, copied from passenger's local one) ×2, `Button` "Log out" | Field-for-field identical to passenger's settings.tsx. |
| 14 | Log out | `app/logout.tsx` | `ConfirmModal` | Identical to passenger's. |

## New components

**`apps/driver/src/components/`** (local, screen-specific — same file-per-component + co-located `.styles.ts` convention passenger uses for `ScreenHeader`, `PulseBeacon`, etc.):
- `StatTile` — dashboard 2×2 grid cell (label + value), thin wrapper over `Card`
- `RequestCard` — avatar + seats `Badge` + Accept/Decline `Button` pair; shared by Dashboard's single preview and the full Requests list
- `DocumentUploadRow` — status `Badge` + upload box + `expo-image-picker` trigger, one per document type
- `CheckboxRow` — copied from passenger's `settings.tsx`-local one (it isn't in `packages/ui` either; not worth promoting for two call sites)

**`packages/ui`** (one addition, because it's a genuine gap in the shared library, not a driver-specific need): `MapPlaceholder` gains a `'chart'` variant alongside its existing `'pin' | 'route' | 'plain'` — same crossed-box visual language, just without the pin/route SVG overlays, for the Earnings screen's chart placeholder. This is the only `packages/ui` change in the whole sub-project.

## Mock data strategy

**Corrected from the original draft** after checking `apps/passenger/src/mocks/drivers.ts` and `mocks/notifications.ts` directly: both are literally empty arrays. Passenger invents no realistic fake data anywhere, including inside its own interactive booking simulation — `finding-driver.tsx` waits, then calls `pickRandomDriver()`, which (since `drivers` is empty) always returns a placeholder-shaped empty record `{name: '', plateNumber: '', rating: null}`; the UI (`DriverInfoCard`) is what renders that gracefully, not seeded content. There is exactly one category, not two:

- **All data starts empty.** Trip history, complaints, notifications, settlement log, documents (`'unsubmitted'`), and the pending-requests queue all start with nothing in them — real starting state for a fresh account, matching `EmptyState`'s own "no invented sample content" rule everywhere.
- **Interactivity comes from simulated timing, not seeded data.** The Requests board becomes non-empty only through `useRequestsStore.startSimulatingArrivals()` (triggered by `useDriverStore.toggleAvailability()` going online), which reuses the exact `wait()`/`randomBetween()` idiom `finding-driver.tsx` already established — appending one placeholder-shaped pending request every 8–15s while online, structurally real (`id`, `seats`, `paymentMethod`, `status`) but with empty/`null` text fields the UI renders gracefully (same pattern as an empty driver name rendering "Driver assigned"). This keeps the Requests → Accept → Active Trip → Complete → History/Earnings chain exercisable end-to-end without inventing any fake copy.

## Error handling

Nothing in this pass talks to the network except auth/consent/location (already-proven code, copied verbatim in behavior). Their failure handling is identical to passenger's (see `2026-07-30-consent-and-location-permission-design.md`'s table) — fail-closed consent, disabled-not-hidden location-gated actions, `'unknown'` never treated as granted.

Every other screen is local-store-only in this pass, so there is no network failure mode to handle yet — that arrives with `docs/DRIVER_TODO.MD`'s backend-wiring steps.

## Testing

`apps/driver/tests/` gets a `sample.test.js`-equivalent scaffold matching `apps/passenger`'s (`node --test`), extended with basic store-logic tests where meaningful (e.g. `useRequestsStore.accept()` moves the request into `useTripStore.current` and removes it from `pending`; `useTripStore.complete()` credits `useEarningsStore` and appends to `useHistoryStore`). No React Native component-level testing — matching the consent/location spec's own note that this repo has no Jest / RNTL infrastructure, and adding one is out of scope here too.

Manual verification (Expo web, fastest to drive in this environment): splash → login → "Register as driver" → consent → location prompt → dashboard toggle ON → accept a mock request → active trip → confirm cash (or observe gcash auto-note) → complete trip → history and earnings both reflect it → profile → documents (upload flow reachable) → settings → logout. Plus `npm run typecheck` passing for the whole workspace.

## Explicitly out of scope

- Real Supabase reads/writes for anything beyond auth/consent/location (`docs/DRIVER_TODO.MD` steps 6–16 cover this staged rollout)
- The `match-ride-request` and `gcash-webhook` Edge Functions (neither exists anywhere in the repo yet — both are cross-app blockers already flagged in `docs/DRIVER_TODO.MD`)
- Multi-passenger pooling UI on the Active Trip screen (no wireframe screen exists for it yet)
- Tricycle registration fields (plate no., cluster, seat capacity) — no wireframe screen shows them
- Extracting `useLocationPermission` into a shared `packages/native` workspace (now a real two-consumer duplication, but a separate refactor from this sub-project)
- Final legal copy for the consent screen (passenger's own placeholder text is reused verbatim)
- `eas.json` / internal distribution build (`docs/DRIVER_TODO.MD` step 18, shared with passenger)
