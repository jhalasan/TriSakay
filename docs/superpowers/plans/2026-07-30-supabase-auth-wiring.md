# Supabase Client + Auth + Profile Wiring (Passenger App) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `packages/services` `pocketbase` stub with a real Supabase client + Auth service, and wire the passenger app's login/register/logout/profile screens to it, so the user can register and log in for real against the live TriSakay Supabase project.

**Architecture:** A module-level Supabase client singleton lives in `packages/services`, initialized once per app via `initSupabase({ url, anonKey, storage })`. All service functions (starting with Auth) read that shared instance internally. The passenger app supplies its own AsyncStorage-backed storage adapter and env vars at startup; `packages/services` stays platform-agnostic (no React Native imports) so it can later serve the Vite admin app too.

**Tech Stack:** `@supabase/supabase-js` 2.111.0, `@react-native-async-storage/async-storage` (version resolved by `expo install` for Expo SDK 54), TypeScript, Zustand, `node --test` (Node 24 runs `.ts` test files natively — no ts-node/babel needed).

## Global Constraints

- `packages/services` must not import any React Native or DOM-only code — the storage adapter is always injected by the calling app, never imported directly inside `packages/services`.
- Auth service functions return `{ error: string | null }` (or embed it in a result object) rather than throwing — callers (the Zustand store) must not need try/catch.
- Generated file `packages/services/src/supabase/database.types.ts` is machine-generated — never hand-edit; regenerate via the same MCP tool call if the schema changes.
- Real secrets (Supabase URL/anon key) go in `apps/passenger/.env.local` (already covered by the repo's `.env*.local` gitignore rule); `apps/passenger/.env.example` is committed with placeholder values.
- Test convention: mirror the existing `node --test ./tests/*.test.<ext>` pattern used by `apps/driver`/`apps/admin`, but as `.test.ts` files (Node 24 runs these directly, confirmed working in this environment).
- Out of scope for this plan: ride requests, fare quotes/RPC, realtime trip tracking, payments, ratings, ride history, notifications, complaints, destination geocoding, and any `apps/driver` / `apps/admin` code. Do not touch those.
- Live Supabase project: `ygdgbvxxqrkxlezpckif` (name "TriSakay"), URL `https://ygdgbvxxqrkxlezpckif.supabase.co`. The `SCHEMA.MD` schema (including `handle_new_auth_user` trigger) is already applied.

---

### Task 1: Supabase client module (`packages/services`)

**Files:**
- Modify: `packages/services/package.json`
- Create: `packages/services/src/supabase/database.types.ts` (generated, see Step 2)
- Create: `packages/services/src/supabase/client.ts`
- Create: `packages/services/src/supabase/index.ts`
- Test: `packages/services/tests/client.test.ts`

**Interfaces:**
- Produces: `initSupabase(config: { url: string; anonKey: string; storage?: SupportedStorage }): SupabaseClient<Database>`, `getSupabaseClient(): SupabaseClient<Database>` (throws if `initSupabase` hasn't been called), `__setSupabaseClientForTests(client: SupabaseClient<Database>): void`, and re-exported `type Database`.

- [ ] **Step 1: Install the Supabase JS client into the `packages/services` workspace**

Run from the repo root:
```bash
npm install @supabase/supabase-js@^2.111.0 --workspace packages/services
```

- [ ] **Step 2: Generate real database types from the live schema**

Call the Supabase MCP tool `mcp__plugin_supabase_supabase__generate_typescript_types` with `project_id: "ygdgbvxxqrkxlezpckif"`, and save its full `types` output **verbatim** to a new file `packages/services/src/supabase/database.types.ts`. Do not hand-edit or reformat the generated content — it defines a `Database` type covering every table (`users`, `driver_profiles`, `tricycles`, `driver_documents`, `trips`, `ride_requests`, `transactions`, `ratings`, `complaints`, `account_actions`, `fare_config`, `system_settings`, `notifications`) plus views and enums from `SCHEMA.MD`.

- [ ] **Step 3: Write the failing test for the client module**

Create `packages/services/tests/client.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { getSupabaseClient, initSupabase } from '../src/supabase/client';

test('getSupabaseClient throws before initSupabase has been called', () => {
  assert.throws(() => getSupabaseClient(), /not initialized/);
});

test('initSupabase returns a client and getSupabaseClient returns the same instance', () => {
  const client = initSupabase({ url: 'https://example.supabase.co', anonKey: 'test-anon-key' });
  assert.equal(getSupabaseClient(), client);
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `node --test packages/services/tests/client.test.ts`
Expected: FAIL — `Cannot find module '../src/supabase/client'` (module does not exist yet).

- [ ] **Step 5: Implement the client module**

Create `packages/services/src/supabase/client.ts`:

```ts
import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';
import type { Database } from './database.types';

export interface InitSupabaseConfig {
  url: string;
  anonKey: string;
  storage?: SupportedStorage;
}

let client: SupabaseClient<Database> | null = null;

export function initSupabase(config: InitSupabaseConfig): SupabaseClient<Database> {
  client = createClient<Database>(config.url, config.anonKey, {
    auth: {
      storage: config.storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!client) {
    throw new Error(
      'Supabase client not initialized. Call initSupabase() once at app startup before using any service.'
    );
  }
  return client;
}

export function __setSupabaseClientForTests(fake: SupabaseClient<Database>): void {
  client = fake;
}
```

Create `packages/services/src/supabase/index.ts`:

```ts
export * from './client';
export type { Database } from './database.types';
```

Modify `packages/services/package.json` to add the dependency and a test script (result should read):

```json
{
  "name": "@trisakay/services",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "private": true,
  "scripts": {
    "test": "node --test ./tests/*.test.ts"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.111.0"
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `node --test packages/services/tests/client.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/services/package.json packages/services/src/supabase packages/services/tests/client.test.ts
git commit -m "feat(services): add Supabase client singleton and generated database types"
```

---

### Task 2: Auth service implementation (`packages/services`)

**Files:**
- Create: `packages/services/src/auth/index.ts` (replaces the stub content)
- Delete: `packages/services/src/pocketbase/index.ts`
- Modify: `packages/services/src/index.ts`
- Test: `packages/services/tests/auth.test.ts`
- Test helper: `packages/services/tests/fakeSupabaseClient.ts`

**Interfaces:**
- Consumes: `getSupabaseClient`, `__setSupabaseClientForTests` from `../src/supabase/client` (Task 1); `type Database` from `../src/supabase/database.types` (Task 1).
- Produces: `signUp(input: SignUpInput): Promise<AuthResult>`, `signIn(input: SignInInput): Promise<AuthResult>`, `signOut(): Promise<void>`, `getSession(): Promise<Session | null>`, `onAuthStateChange(cb: (session: Session | null) => void): () => void`, `getCurrentUserProfile(): Promise<PublicUser | null>`, `updateProfile(input: { fullName: string }): Promise<{ error: string | null }>`, and the type `PublicUser = Database['public']['Tables']['users']['Row']`. These are consumed by Task 5 (`useAuthStore`).

- [ ] **Step 1: Write the test helper (fake Supabase client)**

Create `packages/services/tests/fakeSupabaseClient.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/supabase/database.types';

export interface FakeClientConfig {
  signUp?: (args: unknown) => Promise<{ data: { session: unknown }; error: { message: string } | null }>;
  signInWithPassword?: (
    args: unknown
  ) => Promise<{ data: { session: unknown }; error: { message: string } | null }>;
  getSession?: () => Promise<{ data: { session: unknown } }>;
  signOut?: () => Promise<void>;
  userRow?: Record<string, unknown> | null;
  updateError?: string | null;
}

export function createFakeSupabaseClient(config: FakeClientConfig = {}): SupabaseClient<Database> {
  const auth = {
    signUp: async (args: unknown) =>
      config.signUp ? config.signUp(args) : { data: { session: null }, error: null },
    signInWithPassword: async (args: unknown) =>
      config.signInWithPassword ? config.signInWithPassword(args) : { data: { session: null }, error: null },
    signOut: config.signOut ?? (async () => {}),
    getSession: config.getSession ?? (async () => ({ data: { session: null } })),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  };

  const usersQuery = {
    select: () => usersQuery,
    eq: () => usersQuery,
    single: async () =>
      config.userRow
        ? { data: config.userRow, error: null }
        : { data: null, error: { message: 'not found' } },
  };

  const updateQuery = {
    eq: async () => ({ error: config.updateError ? { message: config.updateError } : null }),
  };

  const from = () => ({
    select: usersQuery.select,
    eq: usersQuery.eq,
    single: usersQuery.single,
    update: () => updateQuery,
  });

  return { auth, from } as unknown as SupabaseClient<Database>;
}
```

- [ ] **Step 2: Write the failing tests**

Create `packages/services/tests/auth.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client';
import { createFakeSupabaseClient } from './fakeSupabaseClient';
import {
  getCurrentUserProfile,
  onAuthStateChange,
  signIn,
  signOut,
  signUp,
  updateProfile,
} from '../src/auth';

test('signUp sends full name, phone, and default role as signup metadata', async () => {
  let capturedArgs: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      signUp: async (args) => {
        capturedArgs = args;
        return { data: { session: null }, error: null };
      },
    })
  );

  await signUp({
    fullName: 'Juan Dela Cruz',
    email: 'juan@example.com',
    phone: '09171234567',
    password: 'secret1',
  });

  assert.equal(capturedArgs.email, 'juan@example.com');
  assert.equal(capturedArgs.password, 'secret1');
  assert.deepEqual(capturedArgs.options.data, {
    full_name: 'Juan Dela Cruz',
    phone: '09171234567',
    role: 'passenger',
  });
});

test('signUp returns the error message when Supabase rejects the signup', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      signUp: async () => ({ data: { session: null }, error: { message: 'Email already registered' } }),
    })
  );

  const result = await signUp({ fullName: 'A', email: 'dup@example.com', phone: '0917', password: 'secret1' });
  assert.equal(result.error, 'Email already registered');
  assert.equal(result.session, null);
});

test('signIn returns a session on success', async () => {
  const fakeSession = { access_token: 'abc', user: { id: 'u1' } };
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      signInWithPassword: async () => ({ data: { session: fakeSession }, error: null }),
    })
  );

  const result = await signIn({ email: 'juan@example.com', password: 'secret1' });
  assert.deepEqual(result.session, fakeSession);
  assert.equal(result.error, null);
});

test('signOut calls the underlying auth.signOut', async () => {
  let called = false;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      signOut: async () => {
        called = true;
      },
    })
  );
  await signOut();
  assert.equal(called, true);
});

test('getCurrentUserProfile returns null when there is no active session', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient({ getSession: async () => ({ data: { session: null } }) }));
  const profile = await getCurrentUserProfile();
  assert.equal(profile, null);
});

test('getCurrentUserProfile returns the public.users row for the active session', async () => {
  const fakeSession = { user: { id: 'u1' } };
  const userRow = {
    id: 'u1',
    full_name: 'Juan',
    email: 'juan@example.com',
    contact_no: '0917',
    role: 'passenger',
  };
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => ({ data: { session: fakeSession } }),
      userRow,
    })
  );
  const profile = await getCurrentUserProfile();
  assert.deepEqual(profile, userRow);
});

test('updateProfile updates full_name and reports no error on success', async () => {
  const fakeSession = { user: { id: 'u1' } };
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ getSession: async () => ({ data: { session: fakeSession } }), updateError: null })
  );
  const result = await updateProfile({ fullName: 'New Name' });
  assert.equal(result.error, null);
});

test('updateProfile returns an error when there is no active session', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient({ getSession: async () => ({ data: { session: null } }) }));
  const result = await updateProfile({ fullName: 'New Name' });
  assert.equal(result.error, 'Not signed in');
});

test('onAuthStateChange forwards session changes and returns an unsubscribe function', () => {
  let receivedSession: unknown = 'not-called';
  let unsubscribed = false;
  __setSupabaseClientForTests({
    auth: {
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        cb('SIGNED_IN', { access_token: 'xyz' });
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                unsubscribed = true;
              },
            },
          },
        };
      },
    },
  } as any);

  const unsubscribe = onAuthStateChange((session) => {
    receivedSession = session;
  });
  assert.deepEqual(receivedSession, { access_token: 'xyz' });
  unsubscribe();
  assert.equal(unsubscribed, true);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test packages/services/tests/auth.test.ts`
Expected: FAIL — `Cannot find module '../src/auth'` (stub still exports only `authServiceStatus`).

- [ ] **Step 4: Implement the auth service**

Replace the contents of `packages/services/src/auth/index.ts`:

```ts
import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabase/client';
import type { Database } from '../supabase/database.types';

export type PublicUser = Database['public']['Tables']['users']['Row'];

export interface SignUpInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface AuthResult {
  session: Session | null;
  error: string | null;
}

export async function signUp({ fullName, email, phone, password }: SignUpInput): Promise<AuthResult> {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone,
        role: 'passenger',
      },
    },
  });
  return { session: data.session, error: error?.message ?? null };
}

export async function signIn({ email, password }: SignInInput): Promise<AuthResult> {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
  return { session: data.session, error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  await getSupabaseClient().auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session;
}

export function onAuthStateChange(callback: (session: Session | null) => void): () => void {
  const { data } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}

export async function getCurrentUserProfile(): Promise<PublicUser | null> {
  const { data: sessionData } = await getSupabaseClient().auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return null;

  const { data, error } = await getSupabaseClient().from('users').select('*').eq('id', userId).single();
  if (error) return null;
  return data;
}

export async function updateProfile({ fullName }: { fullName: string }): Promise<{ error: string | null }> {
  const { data: sessionData } = await getSupabaseClient().auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { error: 'Not signed in' };

  const { error } = await getSupabaseClient().from('users').update({ full_name: fullName }).eq('id', userId);
  return { error: error?.message ?? null };
}
```

Delete `packages/services/src/pocketbase/index.ts` (and the now-empty `packages/services/src/pocketbase/` directory).

Modify `packages/services/src/index.ts` to:

```ts
export * from './supabase';
export * from './auth';
export * from './booking';
export * from './notifications';
export * from './location';

export function getServiceStatus() {
  return 'Services ready';
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test packages/services/tests/auth.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/services/src packages/services/tests
git commit -m "feat(services): implement real Supabase auth service, remove pocketbase stub"
```

---

### Task 3: Extend the signup trigger to persist phone number

**Files:**
- No local files — this is a database migration applied directly to the live Supabase project (this repo has no `supabase/` CLI scaffold; the initial schema itself was applied the same way, via the Supabase MCP `apply_migration` tool).

**Interfaces:**
- Consumes: nothing new.
- Produces: `public.users.contact_no` now gets populated from signup metadata `phone` — relied on by Task 5's manual end-to-end verification and by any future screen reading a passenger's phone number.

- [ ] **Step 1: Apply the migration**

Call the Supabase MCP tool `mcp__plugin_supabase_supabase__apply_migration` with `project_id: "ygdgbvxxqrkxlezpckif"`, `name: "add_contact_no_to_signup_trigger"`, and this `query`:

```sql
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, full_name, email, role, contact_no)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Unnamed User'),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'passenger'),
    new.raw_user_meta_data->>'phone'
  );
  return new;
end $$;
```

- [ ] **Step 2: Verify the function was updated**

Call the Supabase MCP tool `mcp__plugin_supabase_supabase__execute_sql` with `project_id: "ygdgbvxxqrkxlezpckif"` and query:

```sql
select prosrc from pg_proc where proname = 'handle_new_auth_user';
```

Expected: the returned function source contains `contact_no` and `raw_user_meta_data->>'phone'`.

(No git commit — no local file changed. The migration is tracked server-side, same as the initial schema application.)

---

### Task 4: Wire `apps/passenger` to the Supabase client

**Files:**
- Modify: `apps/passenger/package.json`
- Create: `apps/passenger/.env.local` (gitignored)
- Create: `apps/passenger/.env.example`
- Create: `apps/passenger/src/lib/supabase.ts`
- Modify: `apps/passenger/app/_layout.tsx:1-8`

**Interfaces:**
- Consumes: `initSupabase` from `@trisakay/services` (Task 1).
- Produces: a side-effect module (`src/lib/supabase.ts`) that must be imported exactly once, before any screen calls an auth/service function — relied on by Task 5.

- [ ] **Step 1: Add the workspace dependency on `@trisakay/services`**

In `apps/passenger/package.json`, add `"@trisakay/services": "1.0.0"` to `dependencies` (alongside the existing `"@trisakay/shared": "1.0.0"`).

- [ ] **Step 2: Install AsyncStorage at the Expo-SDK-compatible version**

Run:
```bash
cd apps/passenger && npx expo install @react-native-async-storage/async-storage
```
This edits `apps/passenger/package.json` automatically with the version compatible with the installed Expo SDK 54 — do not hand-pin a version number.

- [ ] **Step 3: Relink workspace dependencies**

Run from the repo root:
```bash
npm install
```

- [ ] **Step 4: Create the env files**

Create `apps/passenger/.env.local` (already covered by the repo's `.env*.local` gitignore rule — do not remove that rule):
```
EXPO_PUBLIC_SUPABASE_URL=https://ygdgbvxxqrkxlezpckif.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_WSmpT3ChwTM_mlpiFOzIcA__5FUrK4-
```

Create `apps/passenger/.env.example` (committed):
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx
```

- [ ] **Step 5: Create the init module**

Create `apps/passenger/src/lib/supabase.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initSupabase } from '@trisakay/services';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill in your Supabase project values.'
  );
}

initSupabase({ url, anonKey, storage: AsyncStorage });
```

- [ ] **Step 6: Import it once at the app root**

In `apps/passenger/app/_layout.tsx`, add the side-effect import as the very first import (before `useEffect` etc.):

```ts
import '../src/lib/supabase';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@trisakay/ui';
import { useAuthStore } from '../src/store/useAuthStore';
```

(Rest of the file is unchanged in this task — store rewiring happens in Task 5.)

- [ ] **Step 7: Typecheck**

Run from the repo root: `npm run typecheck`
Expected: no new errors (Task 5 hasn't changed `useAuthStore` yet, so `useAuthStore` still compiles against its current shape).

- [ ] **Step 8: Commit**

```bash
git add apps/passenger/package.json apps/passenger/.env.example apps/passenger/src/lib/supabase.ts apps/passenger/app/_layout.tsx package-lock.json
git commit -m "feat(passenger): wire app startup to the Supabase client"
```

(`.env.local` is intentionally not committed — verify with `git status` that it does not appear staged.)

---

### Task 5: Rewire `useAuthStore` and update auth screens

**Files:**
- Modify: `apps/passenger/src/store/useAuthStore.ts` (full rewrite)
- Modify: `apps/passenger/app/splash.tsx`
- Modify: `apps/passenger/app/(auth)/login.tsx`
- Modify: `apps/passenger/app/(auth)/login.styles.ts`
- Modify: `apps/passenger/app/(auth)/register.tsx`
- Modify: `apps/passenger/app/(auth)/register.styles.ts`
- Modify: `apps/passenger/app/(tabs)/profile.tsx`

**Interfaces:**
- Consumes: `signIn`, `signUp`, `signOut`, `getSession`, `onAuthStateChange`, `getCurrentUserProfile`, `updateProfile`, `type PublicUser` from `@trisakay/services` (Task 2); `type User` from `../types/user` (unchanged: `{ id, name, email, phone? }`).
- Produces: nothing consumed by later tasks — this is the final task in this plan. The store's shape (`{ user, isAuthenticated, isHydrating, error }` and actions `login`, `register`, `logout`, `clearError`) and the screen changes are delivered together in one task so every commit keeps `npm run typecheck` green — the store rewrite and its call-site fixes are never split across separate commits.

- [ ] **Step 1: Replace `useAuthStore.ts`**

```ts
import { create } from 'zustand';
import * as authService from '@trisakay/services';
import type { PublicUser } from '@trisakay/services';
import type { User } from '../types/user';

function toAppUser(profile: PublicUser): User {
  return {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    phone: profile.contact_no ?? undefined,
  };
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isHydrating: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, phone: string, password: string) => Promise<'signed_in' | 'check_email'>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()((set) => {
  authService.onAuthStateChange((session) => {
    if (!session) {
      set({ user: null, isAuthenticated: false });
      return;
    }
    authService.getCurrentUserProfile().then((profile) => {
      set({ user: profile ? toAppUser(profile) : null, isAuthenticated: true });
    });
  });

  authService.getSession().then((session) => {
    if (!session) {
      set({ isHydrating: false });
      return;
    }
    authService.getCurrentUserProfile().then((profile) => {
      set({ user: profile ? toAppUser(profile) : null, isAuthenticated: true, isHydrating: false });
    });
  });

  return {
    user: null,
    isAuthenticated: false,
    isHydrating: true,
    error: null,

    login: async (email, password) => {
      set({ error: null });
      const { error } = await authService.signIn({ email, password });
      if (error) set({ error });
    },

    register: async (name, email, phone, password) => {
      set({ error: null });
      const { session, error } = await authService.signUp({ fullName: name, email, phone, password });
      if (error) {
        set({ error });
        return 'check_email';
      }
      return session ? 'signed_in' : 'check_email';
    },

    logout: async () => {
      await authService.signOut();
    },

    clearError: () => set({ error: null }),
  };
});
```

The store rewrite alone leaves `login.tsx`, `register.tsx`, `profile.tsx`, and `splash.tsx` failing typecheck (they still call the old synchronous `login(email)` / `register(name, email)` signatures) — continue directly into Step 2 below before running typecheck or committing anything, so no commit in this task ever leaves the build broken.

- [ ] **Step 2: Fix the splash screen's redirect to wait for hydration**

Replace `apps/passenger/app/splash.tsx`:

```tsx
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { colors } from '@trisakay/ui';
import { useAuthStore } from '../src/store/useAuthStore';
import { wait } from '../src/mocks/delay';
import { styles } from './splash.styles';

function waitUntilHydrated(): Promise<void> {
  if (!useAuthStore.getState().isHydrating) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = useAuthStore.subscribe((state) => {
      if (!state.isHydrating) {
        unsubscribe();
        resolve();
      }
    });
  });
}

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await Promise.all([wait(1400), waitUntilHydrated()]);
      if (cancelled) return;
      const isAuthenticated = useAuthStore.getState().isAuthenticated;
      router.replace(isAuthenticated ? '/(tabs)/home' : '/(auth)/login');
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <View style={styles.mark}>
        <Text style={styles.markText}>TS</Text>
      </View>
      <Text style={styles.title}>TriSakay</Text>
      <Text style={styles.subtitle}>Book a tricycle, hassle-free</Text>
      <ActivityIndicator color={colors.white} style={styles.loader} />
    </View>
  );
}
```

- [ ] **Step 3: Add an auth-error style**

In `apps/passenger/app/(auth)/login.styles.ts`, add to the `StyleSheet.create({...})` object (after `dividerText`):

```ts
  authError: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.md,
  },
```

In `apps/passenger/app/(auth)/register.styles.ts`, add the same block (after `fields`):

```ts
  authError: {
    ...typography.caption,
    color: colors.danger,
  },
```

- [ ] **Step 4: Wire the login screen**

In `apps/passenger/app/(auth)/login.tsx`:
- Change the store selector to also read `error` and `clearError`.
- Make `handleLogin` async and pass the password through.
- Render the error above the submit button.

```tsx
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Button, TextField } from '@trisakay/ui';
import { useAuthStore } from '../../src/store/useAuthStore';
import { isValidEmail, isValidPassword } from '../../src/utils/validation';
import { styles } from './login.styles';

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const authError = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    const nextErrors: typeof errors = {};
    if (!isValidEmail(email)) nextErrors.email = 'Enter a valid email address.';
    if (!isValidPassword(password)) nextErrors.password = 'Password must be at least 6 characters.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    clearError();
    setSubmitting(true);
    await login(email, password);
    setSubmitting(false);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.mark}>
          <Text style={styles.markText}>TS</Text>
        </View>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Log in to book your next ride.</Text>

        <View style={styles.fields}>
          <TextField
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextField
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry
            autoComplete="password"
          />
        </View>

        {authError ? <Text style={styles.authError}>{authError}</Text> : null}

        <View style={styles.forgotLink}>
          <Text
            style={styles.forgotLinkText}
            onPress={() => Alert.alert('Forgot password', 'Password recovery is not available in this preview.')}
          >
            Forgot password?
          </Text>
        </View>

        <Button label="Log in" onPress={handleLogin} loading={submitting} fullWidth />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <Button
          label="Create account"
          variant="outline"
          tone="neutral"
          fullWidth
          onPress={() => router.push('/(auth)/register')}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

(`wait` from `../../src/mocks/delay` is no longer used here and its import is dropped.)

- [ ] **Step 5: Wire the register screen**

Replace `apps/passenger/app/(auth)/register.tsx`:

```tsx
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Button, TextField, colors } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useAuthStore } from '../../src/store/useAuthStore';
import { isNonEmpty, isValidEmail, isValidPassword } from '../../src/utils/validation';
import { styles } from './register.styles';

interface FormState {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export default function RegisterScreen() {
  const router = useRouter();
  const register = useAuthStore((state) => state.register);
  const authError = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const [form, setForm] = useState<FormState>({ name: '', email: '', phone: '', password: '' });
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleRegister() {
    const nextErrors: Partial<FormState> = {};
    if (!isNonEmpty(form.name)) nextErrors.name = 'Enter your full name.';
    if (!isValidEmail(form.email)) nextErrors.email = 'Enter a valid email address.';
    if (!isNonEmpty(form.phone)) nextErrors.phone = 'Enter a contact number.';
    if (!isValidPassword(form.password)) nextErrors.password = 'Password must be at least 6 characters.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    clearError();
    setSubmitting(true);
    const outcome = await register(form.name, form.email, form.phone, form.password);
    setSubmitting(false);

    if (outcome === 'check_email') {
      Alert.alert(
        'Check your email',
        `We sent a confirmation link to ${form.email}. Confirm it, then log in.`,
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Create account" />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View>
          <View style={styles.avatarUpload}>
            <Ionicons name="camera-outline" size={26} color={colors.inkSoft} />
          </View>
          <Text style={styles.avatarUploadLabel}>Add a profile photo (optional)</Text>
        </View>

        <View style={styles.fields}>
          <TextField
            label="Full name"
            placeholder="Juan Dela Cruz"
            value={form.name}
            onChangeText={(v) => update('name', v)}
            error={errors.name}
            autoCapitalize="words"
          />
          <TextField
            label="Email"
            placeholder="you@example.com"
            value={form.email}
            onChangeText={(v) => update('email', v)}
            error={errors.email}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextField
            label="Phone number"
            placeholder="09XX XXX XXXX"
            value={form.phone}
            onChangeText={(v) => update('phone', v)}
            error={errors.phone}
            keyboardType="phone-pad"
          />
          <TextField
            label="Password"
            placeholder="••••••••"
            value={form.password}
            onChangeText={(v) => update('password', v)}
            error={errors.password}
            secureTextEntry
          />
        </View>

        {authError ? <Text style={styles.authError}>{authError}</Text> : null}

        <Button label="Register" onPress={handleRegister} loading={submitting} fullWidth />

        <Text style={styles.legalText}>
          By creating an account, you agree to TriSakay's Terms of Service and Privacy Policy.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 6: Wire the profile save action**

In `apps/passenger/app/(tabs)/profile.tsx`, add `updateProfile` from the store and call it when the user taps "Done":

```tsx
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Button, Card, ListRow, TextField } from '@trisakay/ui';
import { useAuthStore } from '../../src/store/useAuthStore';
import { styles } from './profile.styles';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);

  async function handleToggleEdit() {
    if (!isEditing) {
      setIsEditing(true);
      return;
    }
    setSaving(true);
    const { updateProfile } = await import('@trisakay/services');
    await updateProfile({ fullName: name });
    setSaving(false);
    setIsEditing(false);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Button
            label={isEditing ? 'Done' : 'Edit'}
            size="sm"
            variant="outline"
            tone="neutral"
            loading={saving}
            onPress={handleToggleEdit}
          />
        </View>

        <View style={styles.identity}>
          <Avatar name={name} size="xl" />
          {isEditing ? (
            <View style={styles.editFieldWrap}>
              <TextField value={name} onChangeText={setName} autoCapitalize="words" />
            </View>
          ) : (
            <Text style={styles.name}>{name || 'Rider'}</Text>
          )}
        </View>

        <Card style={styles.detailsCard}>
          <View style={styles.detailCol}>
            <Text style={styles.detailLabel}>Email</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {user?.email ?? '—'}
            </Text>
          </View>
          <View style={styles.detailCol}>
            <Text style={styles.detailLabel}>Phone</Text>
            <Text style={styles.detailValue}>{user?.phone ?? '—'}</Text>
          </View>
        </Card>

        <Card style={styles.navGroup}>
          <ListRow title="Payment methods" onPress={() => router.push('/profile/payment-methods')} chevron />
          <ListRow
            title="Settings"
            onPress={() => router.push('/(tabs)/settings')}
            chevron
            divider={false}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
```

Note: `updateProfile` is imported dynamically here only because `profile.tsx` is the sole call site in this task and it keeps the diff minimal; if a later sub-project adds more `@trisakay/services` calls to this screen, switch this to a normal top-level `import { updateProfile } from '@trisakay/services';` instead.

- [ ] **Step 7: Typecheck**

Run from the repo root: `npm run typecheck`
Expected: PASS, no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/passenger/src/store/useAuthStore.ts apps/passenger/app/splash.tsx apps/passenger/app/\(auth\)/login.tsx apps/passenger/app/\(auth\)/login.styles.ts apps/passenger/app/\(auth\)/register.tsx apps/passenger/app/\(auth\)/register.styles.ts apps/passenger/app/\(tabs\)/profile.tsx
git commit -m "feat(passenger): back useAuthStore with real Supabase auth and wire login/register/logout/profile screens"
```

- [ ] **Step 9: Manual end-to-end verification (this is what the user asked to test)**

1. Confirm "Confirm email" is disabled in the Supabase Dashboard → Authentication → Providers → Email (user-managed step, done earlier in this conversation).
2. From the repo root, run: `npm run start:passenger` (or `cd apps/passenger && npx expo start --web` for the fastest manual check).
3. Open the app. It should show the splash screen, then land on **Login** (no session yet).
4. Tap "Create account". Fill in name, a real-format email, a phone number, and a 6+ character password. Submit.
5. Expected: no error banner, and the app navigates to `/(tabs)/home` (since email confirmation is disabled, `signUp` returns a session immediately).
6. Go to the Profile tab. Confirm the email shown matches what was registered, and the phone number shows the digits entered (proves the Task 3 trigger fix worked).
7. Tap "Edit", change the name, tap "Done". Reload the app (or re-navigate to Profile) and confirm the new name persisted — this round-trips through `updateProfile`/`getCurrentUserProfile` against the real database.
8. Go to Logout, confirm. Confirm you land back on the Login screen.
9. Log back in with the same email/password. Confirm you land on `/(tabs)/home` with the same profile data — this proves `signIn` + session hydration works.
10. Optional: verify server-side via the Supabase MCP tool `mcp__plugin_supabase_supabase__execute_sql` with query `select id, full_name, email, contact_no, role from public.users order by created_at desc limit 5;` and confirm the new row is present with the correct `contact_no`.

If any step fails, report which step and the exact error/behavior — do not mark this task complete until all 9 required steps (10 is optional) pass.

---

## Plan Self-Review Notes

- **Spec coverage:** client/config (Task 1), database types (Task 1), auth service API (Task 2), the `handle_new_auth_user` migration (Task 3), env/config wiring (Task 4), store rewrite (Task 5), store rewrite + screen changes + testing (Task 5, merged) — every section of the approved design doc has a corresponding task.
- **Type consistency checked:** `PublicUser` (Task 2) is used identically in `useAuthStore.ts` (Task 5) via `toAppUser`. `initSupabase`'s config shape (`{ url, anonKey, storage }`, Task 1) matches exactly how it's called in `src/lib/supabase.ts` (Task 4). `register`'s return type (`'signed_in' | 'check_email'`, Task 5) matches how `register.tsx` branches on it (Task 5, same task as the store rewrite).
- **Out-of-scope guard:** no task touches `apps/driver`, `apps/admin`, or any table/feature beyond `users`/auth.
