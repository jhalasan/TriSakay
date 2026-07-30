# Consent Gate + Location Permission (Passenger App) — Design

## Context

FR-11 in `docs/CONTEXT.MD` is LOCKED and unimplemented. It requires two things before a user reaches any core feature: an explicit, auditable acceptance of the Terms of Service and Privacy Policy (FR-11.1–11.3, UC45), and a plain-language location-permission prompt with graceful degradation when declined (FR-11.4–11.5, UC46).

The backend half already exists. `public.user_consents` is live on the TriSakay project (`ygdgbvxxqrkxlezpckif`) with RLS enabled and 0 rows — append-only by design, `consents_insert_own` allows `user_id = auth.uid()` inserts, `consents_read` allows the owner or PSO to select. **No schema or RLS change is needed. This sub-project is client-side only.**

This continues the sequential decomposition started by `2026-07-30-supabase-auth-wiring-design.md`, which wired the passenger app's auth to Supabase. Consent goes next because it is a gate: it sits between login and every other screen, so any later sub-project that adds a core feature would otherwise have to be retrofitted behind it.

### Three corrections to the original brief

The task description assumed facts that do not hold in this repo. Recorded here so the plan does not silently inherit them:

1. **There is no React Hook Form or Zod.** Forms use `useState` plus hand-rolled predicates in `apps/passenger/src/utils/validation.ts` (see `register.tsx`). This spec follows that pattern and introduces neither library.
2. **`expo-location` is not installed**, and there is no `AppState` usage anywhere in the repo. There is no existing lifecycle pattern to match — this spec establishes the first one.
3. **`packages/services/src/supabase/database.types.ts` is stale.** It covers 15 tables but not `user_consents`; it was generated before the full `SCHEMA.MD` apply.

## Shared-package placement

Decided with the user, weighing the "no duplicated logic between Passenger and Driver" rule against the cost of refactoring now.

| Piece | Home | Why |
|---|---|---|
| Consent read/write + version constants | `packages/services/src/consents/` | Pure TypeScript over `supabase-js`. Zero RN dependency, so it stays Node-testable and both apps can use it unchanged. |
| `Checkbox` primitive | `packages/ui/src/components/Checkbox/` | A genuine reusable primitive that the design system is simply missing. Not consent-specific. |
| `useLocationPermission` | `apps/passenger/src/hooks/` | **Deliberately not shared yet.** See below. |
| Consent screen, permission modal | `apps/passenger/app/` | Screens, not components. Passenger-specific copy and routing. |

`useLocationPermission` stays in the passenger app because `packages/services` is a pure-TS package whose tests run under `node --test` against its `.ts` sources; importing `expo-location` there would break that. `packages/ui` is a component library, not a home for device-capability hooks. `apps/driver` is still a 30-line stub, so there is no duplication to avoid today.

**Follow-up (out of scope):** when the Driver app grows past its stub, extract `useLocationPermission` into a new `packages/native` workspace for device concerns (location now; notifications, camera later). Deferred because creating a fourth workspace — package.json, tsconfig, project reference, root `paths` entry — is disproportionate for one hook with one consumer.

## Database types

Regenerate `packages/services/src/supabase/database.types.ts` from the live project via the Supabase MCP `generate_typescript_types` tool, the same manual-regeneration convention the auth spec established.

The regenerated file must be **diffed before committing**. It is expected to add `user_consents`; anything else that changed is unreviewed schema drift and must be reported rather than absorbed silently.

## Consent service (`packages/services/src/consents/index.ts`)

Version constants at the top of the file, so forcing re-consent later is a one-line change:

```ts
export const CURRENT_TOS_VERSION = 'v1.0';
export const CURRENT_PRIVACY_VERSION = 'v1.0';

export type PolicyType = 'terms_of_service' | 'privacy_policy';
export type UserConsentRow = Database['public']['Tables']['user_consents']['Row'];

export interface ConsentStatus {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  bothAccepted: boolean;
}

getConsentStatus(): Promise<{ status: ConsentStatus | null; error: string | null }>
recordConsent(): Promise<{ error: string | null }>
```

Errors are returned as strings rather than thrown, matching the auth service's established shape.

**`getConsentStatus`** selects `policy_type, policy_version` for the signed-in user, filtered with `.in('policy_type', ['terms_of_service', 'privacy_policy'])`, then compares versions in TypeScript. Version matching is done client-side rather than as a PostgREST `.or(and(...))` filter: it avoids interpolating values into a filter string, and the row set is tiny (one row per acceptance event, per user).

Checking for the *existence* of a row at the current version is equivalent to the brief's "most recent `accepted_at` per `policy_type`" because the table is append-only and versions only move forward — a row at the current version cannot be superseded by anything.

**`recordConsent`** writes both rows in a single `.insert([tos, privacy])` call. One statement means there is no half-consented state if the connection drops mid-write.

`accepted_at` is omitted from the insert and left to the column's `default now()`. The database clock is the one worth defending in an audit; a client clock is trivially wrong or spoofed.

Both functions resolve the user id from the active session and return an error when there is none, rather than writing a row that RLS would reject anyway.

## Navigation & gating

```
splash ──await auth hydration──┬─ not authed ─────────────────────> /(auth)/login
                               └─ authed ──await consent check──┬─ required ──> /consent
                                                                └─ accepted ──> /(tabs)/home
```

**`app/consent.tsx`** is a full-screen route registered in the root `Stack` (not in `(auth)`, not in `(tabs)`).

**`useConsentStore`** (`apps/passenger/src/store/useConsentStore.ts`) mirrors `useAuthStore`'s shape:

```ts
status: 'unknown' | 'checking' | 'accepted' | 'required'
error: string | null
check(): Promise<void>
accept(): Promise<boolean>   // true only on a confirmed write
reset(): void
```

A store rather than screen-local state because two separate consumers need it: the root layout's gate and the consent screen itself.

**`app/_layout.tsx`** — `useProtectedRoute` gains a third branch, ordered so auth always wins:

1. not authenticated and not in `(auth)` → `/(auth)/login`
2. authenticated, consent not `accepted`, not already on `consent` → `/consent`
3. authenticated, consent `accepted`, and in `(auth)` or on `consent` → `/(tabs)/home`

The same layout runs an effect that calls `check()` when `isAuthenticated` flips true and `reset()` when it flips false. Driving it from the layout rather than from inside `useConsentStore` keeps consent decoupled from `useAuthStore`'s internals, and guarantees a second user signing in on the same device gets a fresh check instead of inheriting the first user's `accepted`.

**`app/splash.tsx`** awaits the consent check alongside the existing hydration wait, using the same `waitUntil`-style subscription already written there for `isHydrating`. Without this the splash would route to Home and the gate would immediately bounce to `/consent`, flashing a screen the user is not entitled to see yet.

## Consent screen

A `ScrollView` of placeholder ToS / Privacy Policy body text (real copy is being finalised separately), followed by a "What we collect & share" `Card` in plain language covering all four FR-11.2 disclosures:

- **Name and contact number** — visible to a matched driver during an active ride only
- **Live location** — only while a ride is active or availability is on; never kept as a location trail (NFR-2.5)
- **Ride and payment history** — visible to PSO staff for oversight
- **Payment details** — shared with GCash for processing only (FR-9)

A pinned footer holds the `Checkbox` ("I have read and accept the Terms of Service and Privacy Policy") and a `Button label="Accept & Continue" disabled={!checked} fullWidth`.

No `ScreenHeader` — it renders a back chevron by default, and there is nothing to navigate back to from a gate.

Styling follows the existing convention exactly: a co-located `consent.styles.ts`, tokens from `@trisakay/ui` (`colors`, `spacing`, `typography`, `radius`), no new design patterns.

## Location permission

Install via `npx expo install expo-location` so the version is resolved against Expo SDK 54 rather than pinned by hand. Add the `expo-location` config plugin to `apps/passenger/app.json` with a foreground usage description; Android's `ACCESS_FINE_LOCATION` is added by the plugin.

Per `AGENTS.md`, the exact v54 `expo-location` docs (https://docs.expo.dev/versions/v54.0.0/) are to be read before writing this code.

**`useLocationPermission()`** exposes a discriminated state rather than booleans with hidden meaning:

```ts
type LocationPermissionState = 'unknown' | 'granted' | 'denied' | 'blocked';
// 'blocked' = denied with canAskAgain === false — the OS will not re-prompt
```

It is backed by a module-level zustand store so that one `AppState` listener serves every consumer, however many screens call the hook. This mirrors how `useAuthStore` registers `onAuthStateChange` once at store creation.

On every `AppState` transition to `active` the store re-reads `Location.getForegroundPermissionsAsync()` **and** clears a `dismissedThisForeground` flag. That flag is what makes "Not now" honest: it suppresses the automatic prompt for the current foreground session only, and is never persisted.

`request()` branches on state — `Location.requestForegroundPermissionsAsync()` when the OS will still prompt, `Linking.openSettings()` when `blocked`.

**`app/location-permission.tsx`** is a route registered with `presentation: 'transparentModal', animation: 'fade'`, the same shape as the existing `logout.tsx`. Copy: *"TriSakay needs your location to match you with nearby drivers and estimate pickup accurately."* Actions: **Enable location** → `request()`; **Not now** → sets `dismissedThisForeground` and `router.dismiss()`.

A root-layout effect pushes that route when the user is authenticated, consent is accepted, permission is not granted, and it has not been dismissed this foreground. Inline CTAs navigate to the same route directly, bypassing the dismissed flag — so a dismissed prompt still reappears the moment a location-dependent action is attempted, as well as on the next resume.

**Disabled, not hidden**, at the two points that genuinely need GPS:

- `app/(tabs)/home.tsx` — "Where to?" (entry to the booking flow)
- `app/booking/confirm.tsx` — "Request ride" (the pickup-dependent action)

Each gets `disabled` plus a `Pressable` "Location required — tap to enable" beneath it, routing to `/location-permission`.

`app/booking/set-destination.tsx` is deliberately left alone: searching for a destination does not require the device's location.

## Error handling

Every failure is surfaced; none silently advances the user past the gate.

| Failure | Behaviour |
|---|---|
| Consent check fails (offline, unreachable) | **Fail closed.** Render the consent screen with "Couldn't verify your acceptance — you can accept again below." A network blip cannot slip a user past a legal gate, and the append-only table makes a redundant re-acceptance harmless. |
| Consent insert fails | Inline error, "Accept & Continue" stays enabled, no navigation to Home. |
| Session lost mid-consent | The auth branch of the gate takes priority and routes to login. |
| Permission read throws | State resolves to `'unknown'`, treated as not-granted. Location-dependent CTAs stay disabled rather than opening a broken flow. |
| Permission permanently denied | State is `'blocked'`; the primary action becomes "Open Settings" via `Linking.openSettings()`. |

Offline users are blocked at the consent gate by design. They are already unable to book — every ride action needs Supabase — so failing closed here costs nothing that was available anyway.

## Testing

`packages/services/tests/consents.test.ts`, following the existing `node --test` + `__setSupabaseClientForTests` convention. `tests/fakeSupabaseClient.ts` must be extended first: it currently models only `.select().eq().single()` and `.update().eq()`, while consents need `.in()` returning an array and `.insert()` returning an error or null.

Cases: both versions present → `accepted`; one version stale → `required`; no rows → `required`; query error → error propagated, status null; insert error → error returned; insert payload shape (two rows, correct types and versions, no client `accepted_at`).

The React Native pieces — screens, hooks, `AppState` wiring — have **no test infrastructure in this repo** (no Jest, no React Native Testing Library). Adding a test framework is explicitly not part of this sub-project; those are verified by running the app against the live project.

Manual verification: fresh user reaches `/consent` after login and cannot skip it; accepting writes exactly two rows and lands on Home; relaunch skips consent; bumping `CURRENT_TOS_VERSION` re-triggers the screen; denying location disables both CTAs; enabling in system Settings and returning to the app clears the prompt without a reinstall.

## Explicitly out of scope

- Final Terms of Service and Privacy Policy copy (placeholder text ships; content is being finalised separately)
- Any `apps/driver` or `apps/admin` change, including the Driver app's own consent gate (UC45 covers all roles; Driver gets it when Driver exists)
- Extraction of `useLocationPermission` into `packages/native` — see the follow-up note above
- Background/`always` location permission — NFR-2.5 forbids continuous tracking, so foreground is the only permission requested
- Actually *using* the location once granted (resolving a real pickup point still comes from `useBookingStore`'s mock); this sub-project only governs the permission

## Unrelated finding

The Supabase advisor reports RLS disabled on `public.spatial_ref_sys`, exposing it to the anon key. It is PostGIS's built-in coordinate-system reference table (8,500 rows, no user data), so the practical risk is low — but it is flagged here rather than dropped. Not addressed by this sub-project.
