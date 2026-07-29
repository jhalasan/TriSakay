# Supabase Client + Auth + Profile Wiring (Passenger App) — Design

## Context

TriSakay's passenger app (`apps/passenger`) is a fully built Expo Router UI running entirely on local mock data and Zustand stores — it has never talked to a backend. The real Postgres schema from `docs/SCHEMA.MD` is now live on the Supabase project **TriSakay** (`ygdgbvxxqrkxlezpckif`). `packages/services` is a stub package (each sub-folder just exports a `"<x> service ready"` string) referencing a leftover `pocketbase` module inconsistent with the locked Supabase decision.

This is the first of several sequential sub-projects to replace the passenger app's mocks with real backend calls (decomposition agreed with the user, since the full rewire spans auth, booking/fare, realtime trip tracking, payments, ratings, history, notifications, complaints, and destination geocoding — too much for one spec). This sub-project covers **only**: the shared Supabase client, the Auth service, and wiring `useAuthStore` + the login/register/logout/profile screens to it. Everything else (ride requests, fare quotes, payments, ratings, notifications, complaints, geocoding) is out of scope here and will get its own spec.

Auth and profile go first because every other table's RLS policy is keyed off `auth.uid()` — nothing else can be tested against the real database without a real session.

## Architecture

**Singleton client pattern.** `packages/services` exposes `initSupabase({ url, anonKey, storage })`, called once at app startup, which creates and stores a module-level `SupabaseClient<Database>` instance. All service functions (auth now; booking/notifications/etc. later) read that shared instance internally rather than taking a client parameter.

Rejected alternatives:
- **React Context provider** — this codebase has zero context providers; global Zustand stores are the established pattern. Introducing Context here would be a new, unnecessary pattern.
- **Explicit client parameter on every service call** — better testability in isolation, but forces every screen/store to thread a client through, fighting the existing flat-function-module shape of `packages/services/src/*/index.ts`.

**Why the storage adapter is injected, not hardcoded.** Session persistence needs different storage per platform: Expo (React Native) needs `@react-native-async-storage/async-storage`; the Vite admin app (future sub-project) needs nothing extra (browser default). `packages/services` must stay platform-agnostic — importing React Native code there would break Vite's web bundle — so each app supplies its own storage adapter when it calls `initSupabase`.

## Database types

Generate real TypeScript types from the live schema via the Supabase MCP `generate_typescript_types` tool into `packages/services/src/supabase/database.types.ts` (checked in, regenerated manually whenever the schema changes — no build-time codegen step for this prototype). The client is typed `SupabaseClient<Database>` so every query is checked against the actual table/column shapes.

## Config / env vars

- `apps/passenger/.env.local` (gitignored via the existing `.env*.local` rule) holds `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`, populated with the real TriSakay project's URL and publishable/anon key (fetched via MCP, not hardcoded in source).
- `apps/passenger/.env.example` is committed, documenting the two required keys with placeholder values.
- New dependency: `@react-native-async-storage/async-storage` added to `apps/passenger/package.json`.
- Admin app (`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`) is not wired in this sub-project — the factory supports it, but no admin screens are touched yet.

## Schema change

Extend the existing `handle_new_auth_user()` trigger function (already live) to also copy `contact_no` from `raw_user_meta_data->>'phone'` — currently it only copies `full_name` and `role`, silently dropping the phone number collected at registration. Applied as a new migration (`create or replace function`, same trigger, no table changes).

## Auth service API (`packages/services/src/auth/index.ts`)

```
signUp({ fullName, email, phone, password }): Promise<{ session: Session | null; error: string | null }>
signIn({ email, password }): Promise<{ session: Session | null; error: string | null }>
signOut(): Promise<void>
getSession(): Promise<Session | null>
onAuthStateChange(callback: (session: Session | null) => void): () => void   // returns unsubscribe
getCurrentUserProfile(): Promise<PublicUser | null>   // reads public.users for the active session
updateProfile({ fullName }: { fullName: string }): Promise<{ error: string | null }>
```

Errors are returned as plain strings (Supabase error messages passed through), not thrown — callers (the Zustand store) surface them directly to the UI without try/catch boilerplate at every call site.

**Operational note (user-managed, not code):** new Supabase projects require email confirmation before a session is issued by default. Per the user's choice, they will disable "Confirm email" in the Supabase Dashboard (Authentication → Providers → Email) for now, to test registration/login immediately without needing inbox access. The register screen still handles both outcomes gracefully (session returned → home; no session → "check your email" message) so it keeps working if confirmation is re-enabled later.

## Store & screen changes (`apps/passenger`)

- **`useAuthStore`**: adds `isHydrating: boolean` (true until the initial session check resolves) and `error: string | null`. `login`/`register` become `async`, call the auth service, and set `error` on failure instead of throwing. On store creation, hydrates from `getSession()` + `getCurrentUserProfile()` and subscribes via `onAuthStateChange` to stay in sync with token refresh / remote sign-out.
- **`splash.tsx`**: waits for `isHydrating === false` (with the current 1400ms treated as a floor, not a fixed delay) before redirecting, so a returning logged-in user skips straight to `/(tabs)/home`.
- **`login.tsx`**: on failure, shows the store's `error` inline (same visual pattern already used for validation errors).
- **`register.tsx`**: passes `phone` through to `signUp` (previously collected but dropped); on failure shows the error; on success with no session, alerts "check your email" and routes to login instead of home.
- **`profile.tsx`**: "Done" now calls `updateProfile({ fullName: name })` instead of only updating local component state.
- **`_layout.tsx`**: no logic change — still gates on `isAuthenticated`, which is now real.
- **`logout.tsx`**: unchanged call shape; `logout()` internally now calls `authService.signOut()`.

## Testing

- `packages/services` gets `node --test` unit tests (matching the existing `node --test ./tests/*.test.js` convention used by the apps) for the auth service functions, run against a lightweight fake Supabase client (no network calls) to verify request shapes and error propagation.
- End-to-end verification: the user registers and logs in for real against the live TriSakay Supabase project via Expo (web or device), which we do once implementation is complete.

## Explicitly out of scope

Ride requests, fare quotes/RPC, realtime trip tracking, payments, ratings, ride history, notifications, complaints, destination geocoding, and any `apps/driver` / `apps/admin` changes — each gets its own future spec.
