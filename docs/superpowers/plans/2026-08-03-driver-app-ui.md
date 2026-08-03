# Driver App UI & Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `apps/driver` from the stock Expo template into a real, navigable app matching all 14 screens of the TriSakay Wireframe Kit's Driver section, using the design system `apps/passenger` already established.

**Architecture:** `expo-router` file-based navigation with the same route-group shape as passenger (`(auth)`, `(tabs)`, root-level gate screens). Per-screen Zustand stores hold either real backend state (auth/consent/location, reusing already-proven service calls) or local mock state (everything else — availability, requests, active trip, history, earnings, documents, notifications, settings). All screens compose the existing `packages/ui` component library; the only shared-package change is one new `MapPlaceholder` variant and a one-line `packages/services` fix.

**Tech Stack:** Expo SDK 54, `expo-router` 6, Zustand 5, TypeScript strict, `react-native-svg`, `expo-location`, `expo-image-picker`, `@expo-google-fonts/poppins`, `node --test` for store-logic unit tests.

## Global Constraints

- **Read the versioned docs first.** Per `AGENTS.md`, consult https://docs.expo.dev/versions/v54.0.0/ before writing any `expo-router`/`expo-location`/`expo-image-picker` code.
- **No React Hook Form, no Zod.** Neither is used anywhere in this repo yet (confirmed against `apps/passenger`, which still uses `useState` + hand-rolled predicates). Do not add them.
- **Strict TypeScript, no `any`.**
- **Weight lives in the font family name, never `fontWeight`** — see `packages/ui/src/theme/typography.ts`'s own comment. Every `Text` style spreads a `typography.*` token or sets `fontFamily` directly; never add `fontWeight`.
- **Control boundaries use `colors.lineStrong` (3.46:1), never `colors.line` (decorative only).**
- **Every screen/component gets a co-located `*.styles.ts`** using `StyleSheet.create` and tokens from `@trisakay/ui`. No inline literal colors.
- **Cross-store orchestration happens in screens, not inside store actions** — matching passenger's own `logout.tsx` (which calls both `useAuthStore.logout()` and `useBookingStore.reset()` itself, rather than one store calling another). This keeps every store independently testable and avoids circular imports between `useDriverStore` / `useRequestsStore` / `useTripStore` / `useHistoryStore` / `useEarningsStore`.
- **Mock data starts empty everywhere**, including the pending-requests queue. Interactivity comes from a simulated-arrival timer (`wait()`/`randomBetween()`, same idiom as passenger's `finding-driver.tsx`), never from seeded example rows. See spec's corrected "Mock data strategy" section.
- **Document types:** 4 rows on the Documents screen (`drivers_license`, `or_cr`, `franchise_permit`, `tricycle_photo`), matching `docs/SCHEMA.MD`'s `document_type` enum — one more than the wireframe's literal 3-row mockup, per the approved spec deviation.
- **Exact user-facing copy** (do not reword):
  - Location prompt body: `TriSakay needs your location to match you with nearby drivers and estimate pickup accurately.`
  - Cash confirmation caption: `CASH TRIPS ONLY — GCASH IS AUTO-CONFIRMED BY THE PAYMENT WEBHOOK`
  - Settlement notify caption: `CREATES A RECORD FOR PSO ONLY — NO MONEY MOVES THROUGH THE APP; SETTLEMENT HAPPENS OUTSIDE IT`
- **Out of scope — do not touch:** any real Supabase read/write beyond auth/consent/location, `match-ride-request`/`gcash-webhook` Edge Functions, multi-passenger pooling UI, tricycle registration fields (plate/cluster/seats), `eas.json`.
- Verification commands: `npm run typecheck` (root) and `npm run test:driver`.
- Full design rationale: `docs/superpowers/specs/2026-08-03-driver-app-ui-design.md`.

---

### Task 1: Foundations — dependencies, config, app shell boot

**Files:**
- Modify: `apps/driver/package.json`
- Modify: `apps/driver/app.json`
- Create: `apps/driver/babel.config.js`
- Create: `apps/driver/metro.config.js`
- Modify: `apps/driver/tsconfig.json`
- Create: `apps/driver/.env.example`
- Delete: `apps/driver/src/App.tsx` (replaced by `expo-router/entry`, no longer referenced anywhere once `index.ts` is removed in the next step)
- Modify: `apps/driver/index.ts` → delete (superseded by `expo-router/entry` as the `main` field; expo-router owns the entry point)

**Interfaces:**
- Produces: a bootable, routable Expo app with no screens yet (a bare `app/_layout.tsx` stub and `app/index.tsx` are added in Task 11 — this task only makes the workspace resolve and `expo start` boot to a blank router with no crash).

- [ ] **Step 1: Replace `apps/driver/package.json`**

```json
{
  "name": "@trisakay/driver",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start --clear --tunnel",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "test": "node --test ./tests/*.test.js"
  },
  "dependencies": {
    "@expo-google-fonts/poppins": "^0.4.1",
    "@react-native-async-storage/async-storage": "2.2.0",
    "@trisakay/services": "1.0.0",
    "@trisakay/shared": "1.0.0",
    "@trisakay/ui": "1.0.0",
    "@trisakay/utils": "1.0.0",
    "expo": "~54.0.36",
    "expo-font": "~14.0.12",
    "expo-image-picker": "~17.0.11",
    "expo-location": "~19.0.8",
    "expo-router": "~6.0.24",
    "expo-status-bar": "~3.0.9",
    "react": "19.1.0",
    "react-native": "0.81.5",
    "react-native-gesture-handler": "~2.28.0",
    "react-native-reanimated": "~4.1.1",
    "react-native-safe-area-context": "~5.6.0",
    "react-native-screens": "~4.16.0",
    "react-native-svg": "15.12.1",
    "react-native-webview": "13.15.0",
    "zustand": "^5.0.14"
  },
  "devDependencies": {
    "@types/react": "~19.1.0",
    "typescript": "~5.9.2"
  },
  "private": true
}
```

Version numbers are copied exactly from `apps/passenger/package.json` so the two apps' native dependencies never skew — Metro resolves local `node_modules` first (see Step 3), so a mismatched native-module version between the two apps would otherwise risk two different native builds of the same module.

- [ ] **Step 2: Replace `apps/driver/app.json`**

```json
{
  "expo": {
    "name": "TriSakay Driver",
    "slug": "trisakay-driver",
    "scheme": "trisakay-driver",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "../../assets/icon.png",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": {
      "image": "../../assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.trisakay.driver"
    },
    "android": {
      "package": "com.trisakay.driver",
      "adaptiveIcon": {
        "foregroundImage": "../../assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "edgeToEdgeEnabled": true,
      "predictiveBackGestureEnabled": false
    },
    "web": {
      "favicon": "../../assets/favicon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-location",
        {
          "locationWhenInUsePermission": "TriSakay needs your location to match you with nearby drivers and estimate pickup accurately.",
          "locationAlwaysAndWhenInUsePermission": false,
          "locationAlwaysPermission": false
        }
      ],
      "expo-font",
      [
        "expo-image-picker",
        {
          "photosPermission": "TriSakay needs access to your photos so you can upload verification documents.",
          "cameraPermission": "TriSakay needs access to your camera so you can upload verification documents."
        }
      ]
    ]
  }
}
```

- [ ] **Step 3: Create `apps/driver/babel.config.js` and `apps/driver/metro.config.js`**

```js
// apps/driver/babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

```js
// apps/driver/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const workspaceRoot = path.resolve(__dirname, '../..');

config.watchFolders = [...new Set([...(config.watchFolders ?? []), workspaceRoot])];

config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.extraNodeModules = {
  '@trisakay/services': path.resolve(workspaceRoot, 'packages/services/src'),
  '@trisakay/shared': path.resolve(workspaceRoot, 'packages/shared/src'),
  '@trisakay/ui': path.resolve(workspaceRoot, 'packages/ui/src'),
  '@trisakay/utils': path.resolve(workspaceRoot, 'packages/utils/src'),
};

module.exports = config;
```

- [ ] **Step 4: Update `apps/driver/tsconfig.json` to reference the workspace packages it now uses**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "jsx": "react-jsx",
    "allowJs": true,
    "baseUrl": "."
  },
  "include": ["./**/*"],
  "references": [
    { "path": "../../packages/shared" },
    { "path": "../../packages/services" },
    { "path": "../../packages/ui" },
    { "path": "../../packages/utils" }
  ]
}
```

- [ ] **Step 5: Create `apps/driver/.env.example`**

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx
```

This is a template only. Do not create or edit `apps/driver/.env.local` in this task — that file (if the developer needs one) holds real project secrets and is populated by the developer, following the same pattern `apps/passenger/.env.example` already establishes.

- [ ] **Step 6: Remove the stock template's entry files**

```bash
rm apps/driver/src/App.tsx apps/driver/index.ts
```

`apps/driver/src/` is now empty — leave it; Task 4 onward populates it. `expo-router/entry` (set as `"main"` in Step 1) replaces `index.ts` as the app's entry point.

- [ ] **Step 7: Install and verify the workspace boots with no screens**

```bash
npm install
npm --workspace apps/driver run start -- --web
```

Expected: Metro resolves every workspace package (`@trisakay/services`, `@trisakay/ui`, `@trisakay/utils`, `@trisakay/shared`) with no "Unable to resolve module" error. Because no `app/` directory exists yet, expo-router itself will either show its "Unmatched Route" screen or fail with a clear "no routes found" message rather than a bundler crash — either is the correct state for this task; screens are added starting Task 11, and this step exists only to catch dependency/config mistakes early. Stop the dev server (Ctrl+C) once Metro finishes its initial bundle with no resolution errors.

- [ ] **Step 8: Commit**

```bash
git add apps/driver/package.json apps/driver/app.json apps/driver/babel.config.js apps/driver/metro.config.js apps/driver/tsconfig.json apps/driver/.env.example apps/driver/src apps/driver/index.ts package-lock.json
git commit -m "driver: replace stock template with expo-router foundations"
```

---

### Task 2: Fix `auth.signUp`'s hardcoded passenger role

**Files:**
- Modify: `packages/services/src/auth/index.ts:7-37`
- Test: `packages/services/tests/auth.test.ts`

**Interfaces:**
- Produces: `SignUpInput.role?: 'passenger' | 'driver'` (defaults to `'passenger'` when omitted — every existing call site is unaffected).

- [ ] **Step 1: Read the existing test file to match its exact fake-client convention**

```bash
cat packages/services/tests/auth.test.ts
```

Confirm it uses `createFakeSupabaseClient` from `./fakeSupabaseClient.ts` and a `config.signUp` callback that receives the raw `auth.signUp(args)` payload — this is what the new test asserts against.

- [ ] **Step 2: Write the failing test**

Add to `packages/services/tests/auth.test.ts`:

```ts
test('signUp defaults role to passenger when omitted', async () => {
  let capturedArgs: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      signUp: async (args) => {
        capturedArgs = args;
        return { data: { session: null }, error: null };
      },
    })
  );

  await signUp({ fullName: 'Juan', email: 'juan@example.com', phone: '0900', password: 'secret1' });

  assert.equal(capturedArgs.options.data.role, 'passenger');
});

test('signUp passes role through when provided', async () => {
  let capturedArgs: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      signUp: async (args) => {
        capturedArgs = args;
        return { data: { session: null }, error: null };
      },
    })
  );

  await signUp({ fullName: 'Ana', email: 'ana@example.com', phone: '0911', password: 'secret1', role: 'driver' });

  assert.equal(capturedArgs.options.data.role, 'driver');
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
npm run test:services
```

Expected: FAIL — `SignUpInput` has no `role` property (TypeScript error) and/or the assertion against `capturedArgs.options.data.role` reads `'passenger'` unconditionally today, so the second new test fails.

- [ ] **Step 4: Fix `packages/services/src/auth/index.ts`**

```ts
export interface SignUpInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role?: 'passenger' | 'driver';
}

export async function signUp({ fullName, email, phone, password, role = 'passenger' }: SignUpInput): Promise<AuthResult> {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone,
        role,
      },
    },
  });
  return { session: data.session, error: error?.message ?? null };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm run test:services
```

Expected: PASS, all cases including the two new ones.

- [ ] **Step 6: Commit**

```bash
git add packages/services/src/auth/index.ts packages/services/tests/auth.test.ts
git commit -m "services: allow signUp to register a driver role"
```

---

### Task 3: Add a `'chart'` variant to `MapPlaceholder`

**Files:**
- Modify: `packages/ui/src/components/MapPlaceholder/MapPlaceholder.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `MapPlaceholderVariant` gains `'chart'`; `<MapPlaceholder variant="chart" caption="..." height={...} />` renders a small ascending line, no pin/route circles.

- [ ] **Step 1: Extend the variant type and add the chart branch**

Modify `packages/ui/src/components/MapPlaceholder/MapPlaceholder.tsx`:

```ts
export type MapPlaceholderVariant = 'pin' | 'route' | 'plain' | 'chart';
```

Add a new `Svg`/`Path` block alongside the existing `variant === 'route'` block (same file, inside the outer `<Svg>` after the `GRID_LINES` map, before the closing `</Svg>`):

```tsx
{variant === 'chart' && (
  <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
    <Path
      d="M 5 82 L 25 62 L 45 70 L 65 38 L 88 18"
      stroke={colors.accentBlue}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      vectorEffect="non-scaling-stroke"
    />
    <Circle cx="88%" cy="18%" r={4} fill={colors.accentBlue} />
  </Svg>
)}
```

`Circle` is already imported at the top of the file (used by the `'pin'`/`'route'` branches) — no new import needed for it; `Path` is likewise already imported for the `'route'` branch.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS (no consumer uses `'chart'` yet — this task only adds the capability; Task 18 is the first consumer).

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/MapPlaceholder/MapPlaceholder.tsx
git commit -m "ui: add MapPlaceholder chart variant for earnings screens"
```

---

### Task 4: Driver app core infra — lib, utils, types

**Files:**
- Create: `apps/driver/src/lib/supabase.ts`
- Create: `apps/driver/src/utils/validation.ts`
- Create: `apps/driver/src/utils/withTimeout.ts`
- Create: `apps/driver/src/utils/currency.ts`
- Create: `apps/driver/src/mocks/delay.ts`
- Create: `apps/driver/src/types/user.ts`
- Create: `apps/driver/src/types/request.ts`
- Create: `apps/driver/src/types/trip.ts`
- Create: `apps/driver/src/types/history.ts`
- Create: `apps/driver/src/types/earnings.ts`
- Create: `apps/driver/src/types/document.ts`
- Create: `apps/driver/src/types/notification.ts`

**Interfaces:**
- Produces: `wait(ms): Promise<void>`, `randomBetween(min, max): number`, `withTimeout<T>(promise, ms, message?): Promise<T>`, `REQUEST_TIMEOUT_MS: number`, `isValidEmail/isValidPassword/isNonEmpty(value): boolean`, `formatCurrency(amount): string`, and every type below — all consumed by Tasks 5–23.

- [ ] **Step 1: `apps/driver/src/lib/supabase.ts`**

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

- [ ] **Step 2: `apps/driver/src/utils/validation.ts`**

```ts
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPassword(value: string): boolean {
  return value.trim().length >= 6;
}

export function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}
```

- [ ] **Step 3: `apps/driver/src/utils/withTimeout.ts`**

```ts
export function withTimeout<T>(promise: Promise<T>, ms: number, message = 'Request timed out'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export const REQUEST_TIMEOUT_MS = 10_000;
```

- [ ] **Step 4: `apps/driver/src/utils/currency.ts`**

```ts
export function formatCurrency(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
```

- [ ] **Step 5: `apps/driver/src/mocks/delay.ts`**

```ts
export function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
```

- [ ] **Step 6: Type files**

`apps/driver/src/types/user.ts`:

```ts
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
}
```

`apps/driver/src/types/request.ts`:

```ts
export type PaymentMethod = 'cash' | 'gcash';

export interface PendingRequest {
  id: string;
  seats: number;
  paymentMethod: PaymentMethod;
  /** Null until the backend supplies it — a simulated arrival has no real address to show. */
  pickupLabel: string | null;
  dropoffLabel: string | null;
  fare: number | null;
  createdAt: string;
}
```

`apps/driver/src/types/trip.ts`:

```ts
import type { PaymentMethod } from './request';

export interface ActiveTrip {
  id: string;
  passengerName: string | null;
  seats: number;
  paymentMethod: PaymentMethod;
  fare: number | null;
  cashConfirmed: boolean;
  startedAt: string;
}
```

`apps/driver/src/types/history.ts`:

```ts
export interface TripHistoryItem {
  id: string;
  passengerName: string | null;
  date: string;
  fare: number | null;
  status: 'done' | 'cancelled';
}
```

`apps/driver/src/types/earnings.ts`:

```ts
export interface SettlementLogEntry {
  id: string;
  amount: number;
  loggedAt: string;
}
```

`apps/driver/src/types/document.ts`:

```ts
export type DocumentType = 'drivers_license' | 'or_cr' | 'franchise_permit' | 'tricycle_photo';
export type DocumentStatus = 'unsubmitted' | 'pending' | 'verified' | 'rejected';

export const DOCUMENT_TYPES: DocumentType[] = ['drivers_license', 'or_cr', 'franchise_permit', 'tricycle_photo'];

export const DOCUMENT_LABEL: Record<DocumentType, string> = {
  drivers_license: "Driver's license",
  or_cr: 'OR / CR',
  franchise_permit: 'Franchise / permit',
  tricycle_photo: 'Tricycle photo',
};
```

`apps/driver/src/types/notification.ts`:

```ts
export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}
```

- [ ] **Step 7: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/driver/src/lib apps/driver/src/utils apps/driver/src/mocks apps/driver/src/types
git commit -m "driver: add core lib/utils/mocks/types"
```

---

### Task 5: `useAuthStore` and `useConsentStore`

**Files:**
- Create: `apps/driver/src/store/useAuthStore.ts`
- Create: `apps/driver/src/store/useConsentStore.ts`

**Interfaces:**
- Consumes: `wait`/nothing from Task 4 directly; `withTimeout`, `REQUEST_TIMEOUT_MS` from `../utils/withTimeout`; `User` from `../types/user`; `@trisakay/services` (`signUp`, `signIn`, `signOut`, `getSession`, `onAuthStateChange`, `getCurrentUserProfile`, `getConsentStatus`, `recordConsent`, `PublicUser`).
- Produces: `useAuthStore` with `{ user, sessionUserId, isAuthenticated, isHydrating, error, login, register, logout, clearError, refreshProfile }`; `useConsentStore` with `{ status: ConsentGateStatus, error, check, accept, reset }` and exported type `ConsentGateStatus`. Both consumed by Task 11 (`_layout.tsx`, `splash.tsx`) and Task 12/13 (auth/consent screens).

- [ ] **Step 1: `apps/driver/src/store/useAuthStore.ts`**

```ts
import '../lib/supabase';
import { create } from 'zustand';
import * as authService from '@trisakay/services';
import type { PublicUser } from '@trisakay/services';
import type { User } from '../types/user';
import { REQUEST_TIMEOUT_MS, withTimeout } from '../utils/withTimeout';

type AuthSession = Awaited<ReturnType<typeof authService.getSession>>;

function toAppUser(profile: PublicUser): User {
  return {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    phone: profile.contact_no ?? undefined,
    avatarUrl: profile.avatar_url ?? undefined,
  };
}

interface AuthState {
  user: User | null;
  sessionUserId: string | null;
  isAuthenticated: boolean;
  isHydrating: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, phone: string, password: string) => Promise<'signed_in' | 'check_email' | 'error'>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => {
  let authEpoch = 0;

  function applyAuthEvent(session: AuthSession): void {
    const epoch = ++authEpoch;

    if (!session) {
      set({ user: null, sessionUserId: null, isAuthenticated: false, isHydrating: false });
      return;
    }

    set({ sessionUserId: session.user.id });

    withTimeout(authService.getCurrentUserProfile(), REQUEST_TIMEOUT_MS, 'Profile fetch timed out')
      .catch(() => null)
      .then((profile) => {
        if (epoch !== authEpoch) return;
        set({ user: profile ? toAppUser(profile) : null, isAuthenticated: true, isHydrating: false });
      });
  }

  authService.onAuthStateChange(applyAuthEvent);

  authService
    .getSession()
    .catch(() => null)
    .then(applyAuthEvent);

  return {
    user: null,
    sessionUserId: null,
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
      const { session, error } = await authService.signUp({
        fullName: name,
        email,
        phone,
        password,
        role: 'driver',
      });
      if (error) {
        set({ error });
        return 'error';
      }
      return session ? 'signed_in' : 'check_email';
    },

    logout: async () => {
      await authService.signOut();
    },

    clearError: () => set({ error: null }),

    refreshProfile: async () => {
      const profile = await authService.getCurrentUserProfile().catch(() => null);
      if (profile) set({ user: toAppUser(profile) });
    },
  };
});
```

The only behavioral difference from passenger's version is the hardcoded `role: 'driver'` in `register()`, using the param Task 2 added.

- [ ] **Step 2: `apps/driver/src/store/useConsentStore.ts`**

```ts
import '../lib/supabase';
import { create } from 'zustand';
import { getConsentStatus, recordConsent } from '@trisakay/services';
import { REQUEST_TIMEOUT_MS, withTimeout } from '../utils/withTimeout';

export type ConsentGateStatus = 'unknown' | 'checking' | 'accepted' | 'required';

const TIMEOUT_MESSAGE = 'Consent check timed out';
const UNVERIFIED_MESSAGE = 'Could not verify your acceptance.';

interface ConsentState {
  status: ConsentGateStatus;
  error: string | null;
  check: () => Promise<void>;
  accept: () => Promise<boolean>;
  reset: () => void;
}

export const useConsentStore = create<ConsentState>()((set) => {
  let requestEpoch = 0;

  return {
    status: 'unknown',
    error: null,

    check: async () => {
      const epoch = ++requestEpoch;
      set({ status: 'checking', error: null });

      try {
        const { status, error } = await withTimeout(getConsentStatus(), REQUEST_TIMEOUT_MS, TIMEOUT_MESSAGE);
        if (epoch !== requestEpoch) return;

        if (error || !status) {
          set({ status: 'required', error: error ?? UNVERIFIED_MESSAGE });
          return;
        }

        set({ status: status.bothAccepted ? 'accepted' : 'required', error: null });
      } catch {
        if (epoch !== requestEpoch) return;
        set({ status: 'required', error: UNVERIFIED_MESSAGE });
      }
    },

    accept: async () => {
      const epoch = ++requestEpoch;
      set({ error: null });

      let error: string | null;
      try {
        ({ error } = await withTimeout(recordConsent(), REQUEST_TIMEOUT_MS, TIMEOUT_MESSAGE));
      } catch {
        error = UNVERIFIED_MESSAGE;
      }

      if (epoch !== requestEpoch) {
        set({ error: UNVERIFIED_MESSAGE });
        return false;
      }

      if (error) {
        set({ error });
        return false;
      }
      set({ status: 'accepted', error: null });
      return true;
    },

    reset: () => {
      requestEpoch++;
      set({ status: 'unknown', error: null });
    },
  };
});
```

Identical to passenger's — the consent service is already role-agnostic (keyed by `user_id`), so nothing here changes.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/driver/src/store/useAuthStore.ts apps/driver/src/store/useConsentStore.ts
git commit -m "driver: add auth and consent stores"
```

---

### Task 6: `useLocationPermission`

**Files:**
- Create: `apps/driver/src/hooks/useLocationPermission.ts`

**Interfaces:**
- Produces: `useLocationPermission()` returning `{ state: 'unknown'|'granted'|'denied'|'blocked', isGranted, dismissedThisForeground, refresh, request, dismiss }`. Consumed by Task 11 (`_layout.tsx`'s prompt effect) and Task 13 (`location-permission.tsx`).

- [ ] **Step 1: Create the file, copied verbatim from `apps/passenger/src/hooks/useLocationPermission.ts`**

```ts
import { AppState, Linking, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { create } from 'zustand';

export type LocationPermissionState = 'unknown' | 'granted' | 'denied' | 'blocked';

interface LocationPermissionStore {
  state: LocationPermissionState;
  dismissedThisForeground: boolean;
  refresh: () => Promise<LocationPermissionState>;
  request: () => Promise<LocationPermissionState>;
  dismiss: () => void;
}

function toState(response: Location.LocationPermissionResponse): LocationPermissionState {
  if (response.granted) return 'granted';
  return response.canAskAgain ? 'denied' : 'blocked';
}

export const useLocationPermissionStore = create<LocationPermissionStore>()((set, get) => {
  let epoch = 0;

  return {
    state: 'unknown',
    dismissedThisForeground: false,

    refresh: async () => {
      const claimed = ++epoch;
      let next: LocationPermissionState;
      try {
        next = toState(await Location.getForegroundPermissionsAsync());
      } catch {
        next = 'unknown';
      }
      if (claimed === epoch) set({ state: next });
      return next;
    },

    request: async () => {
      if (get().state === 'blocked') {
        await Linking.openSettings().catch(() => {});
        return 'blocked';
      }

      let response: Location.LocationPermissionResponse;
      try {
        response = await Location.requestForegroundPermissionsAsync();
      } catch {
        return 'unknown';
      }

      const next = toState(response);
      epoch++;
      set({ state: next });
      return next;
    },

    dismiss: () => set({ dismissedThisForeground: true }),
  };
});

let wasBackgrounded = false;
AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
  if (nextAppState === 'background') {
    wasBackgrounded = true;
    return;
  }
  if (nextAppState !== 'active') return;

  void useLocationPermissionStore.getState().refresh();

  if (!wasBackgrounded) return;
  wasBackgrounded = false;
  useLocationPermissionStore.setState({ dismissedThisForeground: false });
});

void useLocationPermissionStore.getState().refresh();

export function useLocationPermission() {
  const state = useLocationPermissionStore((store) => store.state);
  const dismissedThisForeground = useLocationPermissionStore((store) => store.dismissedThisForeground);
  const refresh = useLocationPermissionStore((store) => store.refresh);
  const request = useLocationPermissionStore((store) => store.request);
  const dismiss = useLocationPermissionStore((store) => store.dismiss);

  return {
    state,
    isGranted: state === 'granted',
    dismissedThisForeground,
    refresh,
    request,
    dismiss,
  };
}
```

This is a straight copy — see `docs/superpowers/specs/2026-07-30-consent-and-location-permission-design.md`'s own note that this hook is deliberately not shared (no home in `packages/services` or `packages/ui` yet), which is now a real two-consumer duplication but out of scope to fix here.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/driver/src/hooks/useLocationPermission.ts
git commit -m "driver: add location permission hook"
```

---

### Task 7: `useDriverStore` and `useRequestsStore`

**Files:**
- Create: `apps/driver/src/store/useDriverStore.ts`
- Create: `apps/driver/src/store/useRequestsStore.ts`
- Test: `apps/driver/tests/requestsStore.test.js`

**Interfaces:**
- Consumes: `wait`, `randomBetween` from `../mocks/delay`; `PendingRequest` from `../types/request`.
- Produces: `useDriverStore` → `{ isAvailable, todayEarnings, todayTrips, rating, ratingCount, acceptRate, setAvailable(value), recordCompletedTrip(fare) }`. `useRequestsStore` → `{ pending: PendingRequest[], startSimulatingArrivals(), stopSimulatingArrivals(), accept(id): PendingRequest | undefined, decline(id) }`. Both consumed by Task 14 (Dashboard) and Task 15 (Requests screen); `useRequestsStore.accept`'s return value is handed to `useTripStore.startTrip` (Task 8) by the screen, not by the store itself.

- [ ] **Step 1: `apps/driver/src/store/useDriverStore.ts`**

```ts
import { create } from 'zustand';

interface DriverState {
  isAvailable: boolean;
  todayEarnings: number;
  todayTrips: number;
  rating: number | null;
  ratingCount: number;
  acceptRate: number | null;
  setAvailable: (value: boolean) => void;
  recordCompletedTrip: (fare: number) => void;
}

export const useDriverStore = create<DriverState>()((set) => ({
  isAvailable: false,
  todayEarnings: 0,
  todayTrips: 0,
  rating: null,
  ratingCount: 0,
  acceptRate: null,

  setAvailable: (value) => set({ isAvailable: value }),

  recordCompletedTrip: (fare) =>
    set((state) => ({
      todayEarnings: state.todayEarnings + fare,
      todayTrips: state.todayTrips + 1,
    })),
}));
```

- [ ] **Step 2: `apps/driver/src/store/useRequestsStore.ts`**

```ts
import { create } from 'zustand';
import { randomBetween, wait } from '../mocks/delay';
import type { PendingRequest } from '../types/request';

interface RequestsState {
  pending: PendingRequest[];
  startSimulatingArrivals: () => void;
  stopSimulatingArrivals: () => void;
  accept: (id: string) => PendingRequest | undefined;
  decline: (id: string) => void;
}

let simulationEpoch = 0;
let nextRequestId = 1;

function createPlaceholderRequest(): PendingRequest {
  return {
    id: `req-${nextRequestId++}`,
    seats: randomBetween(1, 3),
    paymentMethod: randomBetween(0, 1) === 0 ? 'cash' : 'gcash',
    pickupLabel: null,
    dropoffLabel: null,
    fare: null,
    createdAt: new Date().toISOString(),
  };
}

export const useRequestsStore = create<RequestsState>()((set, get) => ({
  pending: [],

  startSimulatingArrivals: () => {
    const epoch = ++simulationEpoch;

    async function loop() {
      while (epoch === simulationEpoch) {
        await wait(randomBetween(8000, 15000));
        if (epoch !== simulationEpoch) return;
        set((state) => ({ pending: [...state.pending, createPlaceholderRequest()] }));
      }
    }

    void loop();
  },

  stopSimulatingArrivals: () => {
    simulationEpoch++;
    set({ pending: [] });
  },

  accept: (id) => {
    const request = get().pending.find((item) => item.id === id);
    if (request) set((state) => ({ pending: state.pending.filter((item) => item.id !== id) }));
    return request;
  },

  decline: (id) => set((state) => ({ pending: state.pending.filter((item) => item.id !== id) })),
}));
```

`simulationEpoch` guards against a stale loop from a previous "go online" still appending requests after "go offline" — the same monotonic-token idiom `useAuthStore`/`useConsentStore`/`useLocationPermissionStore` already use.

- [ ] **Step 3: Write the failing store-logic test**

Create `apps/driver/tests/requestsStore.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('accept removes the request from pending and returns it', async () => {
  const { useRequestsStore } = await import('../src/store/useRequestsStore.ts');

  useRequestsStore.setState({
    pending: [
      { id: 'r1', seats: 2, paymentMethod: 'cash', pickupLabel: null, dropoffLabel: null, fare: null, createdAt: 'now' },
    ],
  });

  const accepted = useRequestsStore.getState().accept('r1');

  assert.equal(accepted.id, 'r1');
  assert.equal(useRequestsStore.getState().pending.length, 0);
});

test('accept returns undefined for an unknown id and leaves pending untouched', async () => {
  const { useRequestsStore } = await import('../src/store/useRequestsStore.ts');

  useRequestsStore.setState({
    pending: [
      { id: 'r2', seats: 1, paymentMethod: 'gcash', pickupLabel: null, dropoffLabel: null, fare: null, createdAt: 'now' },
    ],
  });

  const accepted = useRequestsStore.getState().accept('does-not-exist');

  assert.equal(accepted, undefined);
  assert.equal(useRequestsStore.getState().pending.length, 1);
});

test('decline removes the request without returning it', async () => {
  const { useRequestsStore } = await import('../src/store/useRequestsStore.ts');

  useRequestsStore.setState({
    pending: [
      { id: 'r3', seats: 1, paymentMethod: 'cash', pickupLabel: null, dropoffLabel: null, fare: null, createdAt: 'now' },
    ],
  });

  useRequestsStore.getState().decline('r3');

  assert.equal(useRequestsStore.getState().pending.length, 0);
});
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
node --version
npm run test:driver
```

Expected: `node --version` reports 22.18.0+ (this environment has 24.13.0). Node's built-in TypeScript type-stripping is unflagged and on by default at that version — `useRequestsStore.ts`'s ESM `import`/`export` syntax is auto-detected and the file is imported directly from the `.js` test with no loader, no `--experimental-strip-types` flag (unnecessary and potentially rejected as an unrecognized flag on newer Node — do not add it), and no new dependency. `npm run test:driver` should PASS immediately, all 3 cases — `apps/driver/package.json`'s `test` script from Task 1 (`node --test ./tests/*.test.js`) needs no change for this to work.

If `node --version` reports below 22.18.0 in whatever environment actually executes this plan, stop and report it rather than guessing at a flag — the fallback approach (a separate build step, or `tsx`/`ts-node` as a new dev dependency) is a real decision this plan does not make for you.

- [ ] **Step 5: Commit**

```bash
git add apps/driver/src/store/useDriverStore.ts apps/driver/src/store/useRequestsStore.ts apps/driver/tests/requestsStore.test.js
git commit -m "driver: add driver availability and requests stores with tests"
```

---

### Task 8: `useTripStore`, `useHistoryStore`, `useEarningsStore`

**Files:**
- Create: `apps/driver/src/store/useTripStore.ts`
- Create: `apps/driver/src/store/useHistoryStore.ts`
- Create: `apps/driver/src/store/useEarningsStore.ts`
- Test: `apps/driver/tests/tripStore.test.js`

**Interfaces:**
- Consumes: `PendingRequest` (Task 4/7), `ActiveTrip`, `TripHistoryItem`, `SettlementLogEntry` types (Task 4).
- Produces: `useTripStore` → `{ current: ActiveTrip | null, startTrip(request), confirmCash(), complete(): ActiveTrip | null, cancel(): ActiveTrip | null }`. `useHistoryStore` → `{ trips: TripHistoryItem[], addTrip(trip) }`. `useEarningsStore` → `{ totalTracked: number, settlementLog: SettlementLogEntry[], creditTrip(fare), notifyPsoForSettlement() }`. `complete()`/`cancel()` return the trip that was active (or `null`) — the caller (Task 16's Active Trip screen) is responsible for calling `useHistoryStore.addTrip`, `useEarningsStore.creditTrip`, and `useDriverStore.recordCompletedTrip` itself, per the Global Constraints' "orchestration in screens" rule.

- [ ] **Step 1: `apps/driver/src/store/useTripStore.ts`**

```ts
import { create } from 'zustand';
import type { PendingRequest } from '../types/request';
import type { ActiveTrip } from '../types/trip';

interface TripState {
  current: ActiveTrip | null;
  startTrip: (request: PendingRequest) => void;
  confirmCash: () => void;
  complete: () => ActiveTrip | null;
  cancel: () => ActiveTrip | null;
}

export const useTripStore = create<TripState>()((set, get) => ({
  current: null,

  startTrip: (request) =>
    set({
      current: {
        id: request.id,
        passengerName: null,
        seats: request.seats,
        paymentMethod: request.paymentMethod,
        fare: request.fare,
        cashConfirmed: false,
        startedAt: new Date().toISOString(),
      },
    }),

  confirmCash: () =>
    set((state) => (state.current ? { current: { ...state.current, cashConfirmed: true } } : state)),

  complete: () => {
    const trip = get().current;
    set({ current: null });
    return trip;
  },

  cancel: () => {
    const trip = get().current;
    set({ current: null });
    return trip;
  },
}));
```

- [ ] **Step 2: `apps/driver/src/store/useHistoryStore.ts`**

```ts
import { create } from 'zustand';
import type { TripHistoryItem } from '../types/history';

interface HistoryState {
  trips: TripHistoryItem[];
  addTrip: (trip: TripHistoryItem) => void;
}

export const useHistoryStore = create<HistoryState>()((set) => ({
  trips: [],
  addTrip: (trip) => set((state) => ({ trips: [trip, ...state.trips] })),
}));
```

- [ ] **Step 3: `apps/driver/src/store/useEarningsStore.ts`**

```ts
import { create } from 'zustand';
import type { SettlementLogEntry } from '../types/earnings';

interface EarningsState {
  totalTracked: number;
  settlementLog: SettlementLogEntry[];
  creditTrip: (fare: number) => void;
  notifyPsoForSettlement: () => void;
}

let nextEntryId = 1;

export const useEarningsStore = create<EarningsState>()((set, get) => ({
  totalTracked: 0,
  settlementLog: [],

  creditTrip: (fare) => set((state) => ({ totalTracked: state.totalTracked + fare })),

  notifyPsoForSettlement: () => {
    const entry: SettlementLogEntry = {
      id: `settle-${nextEntryId++}`,
      amount: get().totalTracked,
      loggedAt: new Date().toISOString(),
    };
    set((state) => ({ settlementLog: [entry, ...state.settlementLog] }));
  },
}));
```

- [ ] **Step 4: Write the failing test**

Create `apps/driver/tests/tripStore.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('startTrip populates current from a pending request', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');

  useTripStore.setState({ current: null });
  useTripStore.getState().startTrip({
    id: 'req-9',
    seats: 2,
    paymentMethod: 'cash',
    pickupLabel: null,
    dropoffLabel: null,
    fare: 45,
    createdAt: 'now',
  });

  const current = useTripStore.getState().current;
  assert.equal(current.id, 'req-9');
  assert.equal(current.fare, 45);
  assert.equal(current.cashConfirmed, false);
});

test('confirmCash flips cashConfirmed without touching other fields', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');

  useTripStore.setState({
    current: {
      id: 'req-9', passengerName: null, seats: 2, paymentMethod: 'cash', fare: 45, cashConfirmed: false, startedAt: 'now',
    },
  });

  useTripStore.getState().confirmCash();

  assert.equal(useTripStore.getState().current.cashConfirmed, true);
  assert.equal(useTripStore.getState().current.fare, 45);
});

test('complete clears current and returns the trip that was active', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');

  useTripStore.setState({
    current: { id: 'req-9', passengerName: null, seats: 2, paymentMethod: 'cash', fare: 45, cashConfirmed: true, startedAt: 'now' },
  });

  const completed = useTripStore.getState().complete();

  assert.equal(completed.id, 'req-9');
  assert.equal(useTripStore.getState().current, null);
});

test('complete on an empty trip returns null', async () => {
  const { useTripStore } = await import('../src/store/useTripStore.ts');

  useTripStore.setState({ current: null });

  assert.equal(useTripStore.getState().complete(), null);
});

test('useEarningsStore.creditTrip accumulates totalTracked', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');

  useEarningsStore.setState({ totalTracked: 0, settlementLog: [] });
  useEarningsStore.getState().creditTrip(45);
  useEarningsStore.getState().creditTrip(30);

  assert.equal(useEarningsStore.getState().totalTracked, 75);
});

test('useEarningsStore.notifyPsoForSettlement logs the current total', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');

  useEarningsStore.setState({ totalTracked: 120, settlementLog: [] });
  useEarningsStore.getState().notifyPsoForSettlement();

  const log = useEarningsStore.getState().settlementLog;
  assert.equal(log.length, 1);
  assert.equal(log[0].amount, 120);
});

test('useHistoryStore.addTrip prepends to trips', async () => {
  const { useHistoryStore } = await import('../src/store/useHistoryStore.ts');

  useHistoryStore.setState({ trips: [] });
  useHistoryStore.getState().addTrip({ id: 't1', passengerName: null, date: 'd1', fare: 15, status: 'done' });
  useHistoryStore.getState().addTrip({ id: 't2', passengerName: null, date: 'd2', fare: 20, status: 'done' });

  const trips = useHistoryStore.getState().trips;
  assert.equal(trips.length, 2);
  assert.equal(trips[0].id, 't2');
});
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm run test:driver
```

Expected: PASS, all 7 cases (plus the 3 from Task 7).

- [ ] **Step 6: Commit**

```bash
git add apps/driver/src/store/useTripStore.ts apps/driver/src/store/useHistoryStore.ts apps/driver/src/store/useEarningsStore.ts apps/driver/tests/tripStore.test.js
git commit -m "driver: add trip, history, and earnings stores with tests"
```

---

### Task 9: `useDocumentsStore`, `useNotificationsStore`, `useSettingsStore`

**Files:**
- Create: `apps/driver/src/store/useDocumentsStore.ts`
- Create: `apps/driver/src/store/useNotificationsStore.ts`
- Create: `apps/driver/src/store/useSettingsStore.ts`

**Interfaces:**
- Consumes: `DocumentType`, `DocumentStatus`, `DOCUMENT_TYPES` from `../types/document`; `NotificationItem` from `../types/notification`.
- Produces: `useDocumentsStore` → `{ statuses: Record<DocumentType, DocumentStatus>, submit(type) }`. `useNotificationsStore` → `{ items: NotificationItem[], markAllRead() }`. `useSettingsStore` → `{ pushNotificationsEnabled, locationTrackingEnabled, language, smsReceipts, emailReceipts, togglePushNotifications(), toggleLocationTracking(), toggleSmsReceipts(), toggleEmailReceipts() }`. Consumed by Task 20 (Documents), Task 22 (Notifications), Task 21 (Settings).

- [ ] **Step 1: `apps/driver/src/store/useDocumentsStore.ts`**

```ts
import { create } from 'zustand';
import { DOCUMENT_TYPES, type DocumentStatus, type DocumentType } from '../types/document';

interface DocumentsState {
  statuses: Record<DocumentType, DocumentStatus>;
  submit: (type: DocumentType) => void;
}

const initialStatuses = Object.fromEntries(
  DOCUMENT_TYPES.map((type) => [type, 'unsubmitted' as DocumentStatus])
) as Record<DocumentType, DocumentStatus>;

export const useDocumentsStore = create<DocumentsState>()((set) => ({
  statuses: initialStatuses,
  submit: (type) => set((state) => ({ statuses: { ...state.statuses, [type]: 'pending' } })),
}));
```

- [ ] **Step 2: `apps/driver/src/store/useNotificationsStore.ts`**

```ts
import { create } from 'zustand';
import type { NotificationItem } from '../types/notification';

interface NotificationsState {
  items: NotificationItem[];
  markAllRead: () => void;
}

export const useNotificationsStore = create<NotificationsState>()((set) => ({
  items: [],
  markAllRead: () => set((state) => ({ items: state.items.map((item) => ({ ...item, read: true })) })),
}));
```

- [ ] **Step 3: `apps/driver/src/store/useSettingsStore.ts`**

```ts
import { create } from 'zustand';

interface SettingsState {
  pushNotificationsEnabled: boolean;
  locationTrackingEnabled: boolean;
  language: string;
  smsReceipts: boolean;
  emailReceipts: boolean;
  togglePushNotifications: () => void;
  toggleLocationTracking: () => void;
  toggleSmsReceipts: () => void;
  toggleEmailReceipts: () => void;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  pushNotificationsEnabled: true,
  locationTrackingEnabled: true,
  language: 'English',
  smsReceipts: false,
  emailReceipts: true,
  togglePushNotifications: () => set((state) => ({ pushNotificationsEnabled: !state.pushNotificationsEnabled })),
  toggleLocationTracking: () => set((state) => ({ locationTrackingEnabled: !state.locationTrackingEnabled })),
  toggleSmsReceipts: () => set((state) => ({ smsReceipts: !state.smsReceipts })),
  toggleEmailReceipts: () => set((state) => ({ emailReceipts: !state.emailReceipts })),
}));
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/driver/src/store/useDocumentsStore.ts apps/driver/src/store/useNotificationsStore.ts apps/driver/src/store/useSettingsStore.ts
git commit -m "driver: add documents, notifications, and settings stores"
```

---

### Task 10: Shared local components

**Files:**
- Create: `apps/driver/src/components/ScreenHeader/ScreenHeader.tsx`
- Create: `apps/driver/src/components/ScreenHeader/ScreenHeader.styles.ts`
- Create: `apps/driver/src/components/ScreenHeader/index.ts`
- Create: `apps/driver/src/components/StatTile/StatTile.tsx`
- Create: `apps/driver/src/components/StatTile/StatTile.styles.ts`
- Create: `apps/driver/src/components/StatTile/index.ts`
- Create: `apps/driver/src/components/RequestCard/RequestCard.tsx`
- Create: `apps/driver/src/components/RequestCard/RequestCard.styles.ts`
- Create: `apps/driver/src/components/RequestCard/index.ts`
- Create: `apps/driver/src/components/DocumentUploadRow/DocumentUploadRow.tsx`
- Create: `apps/driver/src/components/DocumentUploadRow/DocumentUploadRow.styles.ts`
- Create: `apps/driver/src/components/DocumentUploadRow/index.ts`
- Create: `apps/driver/src/components/CheckboxRow/CheckboxRow.tsx`
- Create: `apps/driver/src/components/CheckboxRow/CheckboxRow.styles.ts`
- Create: `apps/driver/src/components/CheckboxRow/index.ts`

**Interfaces:**
- Produces: `<ScreenHeader title showBack? onBack? right? />`, `<StatTile label value />`, `<RequestCard request onAccept onDecline />`, `<DocumentUploadRow label status onUpload />`, `<CheckboxRow label checked onToggle />`. Consumed starting Task 12.

- [ ] **Step 1: `ScreenHeader` — copied verbatim from `apps/passenger/src/components/ScreenHeader`**

```tsx
// apps/driver/src/components/ScreenHeader/ScreenHeader.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@trisakay/ui';
import { styles } from './ScreenHeader.styles';

export interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  showBack?: boolean;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, onBack, showBack = true, right }: ScreenHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.row, { paddingTop: styles.row.paddingVertical + insets.top }]}>
      {showBack && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={onBack ?? (() => router.back())}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
      )}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {right && <View style={styles.rightSlot}>{right}</View>}
    </View>
  );
}
```

```ts
// apps/driver/src/components/ScreenHeader/ScreenHeader.styles.ts
import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  title: {
    ...typography.h1,
    color: colors.ink,
    flex: 1,
  },
  rightSlot: {
    alignItems: 'flex-end',
  },
});
```

```ts
// apps/driver/src/components/ScreenHeader/index.ts
export * from './ScreenHeader';
```

- [ ] **Step 2: `StatTile`**

```tsx
// apps/driver/src/components/StatTile/StatTile.tsx
import { Text, View } from 'react-native';
import { Card } from '@trisakay/ui';
import { styles } from './StatTile.styles';

export interface StatTileProps {
  label: string;
  value: string;
}

export function StatTile({ label, value }: StatTileProps) {
  return (
    <Card style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </Card>
  );
}
```

```ts
// apps/driver/src/components/StatTile/StatTile.styles.ts
import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  card: {
    flexBasis: '48%',
    gap: spacing.xs,
  },
  label: {
    ...typography.label,
    color: colors.inkSoft,
  },
  value: {
    ...typography.h2,
    color: colors.ink,
  },
});
```

```ts
// apps/driver/src/components/StatTile/index.ts
export * from './StatTile';
```

- [ ] **Step 3: `RequestCard`**

```tsx
// apps/driver/src/components/RequestCard/RequestCard.tsx
import { Text, View } from 'react-native';
import { Avatar, Badge, Button } from '@trisakay/ui';
import type { PendingRequest } from '../../types/request';
import { styles } from './RequestCard.styles';

export interface RequestCardProps {
  request: PendingRequest;
  onAccept: () => void;
  onDecline: () => void;
}

export function RequestCard({ request, onAccept, onDecline }: RequestCardProps) {
  const seatsLabel = `${request.seats} seat${request.seats > 1 ? 's' : ''}`;
  const routeLabel =
    request.pickupLabel && request.dropoffLabel
      ? `${request.pickupLabel} → ${request.dropoffLabel}`
      : 'New ride request';

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Avatar size="md" />
        <Text style={styles.route} numberOfLines={1}>
          {routeLabel}
        </Text>
        <Badge label={seatsLabel} tone="blue" />
      </View>
      <View style={styles.actions}>
        <View style={styles.actionButton}>
          <Button label="Decline" variant="outline" tone="neutral" size="sm" fullWidth onPress={onDecline} />
        </View>
        <View style={styles.actionButton}>
          <Button label="Accept" size="sm" fullWidth onPress={onAccept} />
        </View>
      </View>
    </View>
  );
}
```

```ts
// apps/driver/src/components/RequestCard/RequestCard.styles.ts
import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    padding: spacing.lg,
    gap: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  route: {
    ...typography.bodyStrong,
    color: colors.ink,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
});
```

```ts
// apps/driver/src/components/RequestCard/index.ts
export * from './RequestCard';
```

- [ ] **Step 4: `DocumentUploadRow`**

```tsx
// apps/driver/src/components/DocumentUploadRow/DocumentUploadRow.tsx
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Pressable, Text, View } from 'react-native';
import { Badge, colors, type BadgeTone } from '@trisakay/ui';
import type { DocumentStatus } from '../../types/document';
import { styles } from './DocumentUploadRow.styles';

export interface DocumentUploadRowProps {
  label: string;
  status: DocumentStatus;
  onUpload: () => void;
}

const STATUS_LABEL: Record<DocumentStatus, string> = {
  unsubmitted: 'Not uploaded',
  pending: 'Pending',
  verified: 'Verified',
  rejected: 'Rejected',
};

const STATUS_TONE: Record<DocumentStatus, BadgeTone> = {
  unsubmitted: 'neutral',
  pending: 'neutral',
  verified: 'green',
  rejected: 'danger',
};

export function DocumentUploadRow({ label, status, onUpload }: DocumentUploadRowProps) {
  async function handlePress() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to upload this document.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) onUpload();
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        <Badge label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />
      </View>
      <Pressable
        style={styles.uploadBox}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`Upload ${label}`}
      >
        <Ionicons name="cloud-upload-outline" size={22} color={colors.inkSoft} />
        <Text style={styles.uploadText}>Upload</Text>
      </Pressable>
    </View>
  );
}
```

```ts
// apps/driver/src/components/DocumentUploadRow/DocumentUploadRow.styles.ts
import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    ...typography.label,
    color: colors.inkSoft,
  },
  uploadBox: {
    height: 96,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.fill,
  },
  uploadText: {
    ...typography.caption,
    color: colors.inkSoft,
  },
});
```

```ts
// apps/driver/src/components/DocumentUploadRow/index.ts
export * from './DocumentUploadRow';
```

- [ ] **Step 5: `CheckboxRow`**

```tsx
// apps/driver/src/components/CheckboxRow/CheckboxRow.tsx
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { colors } from '@trisakay/ui';
import { styles } from './CheckboxRow.styles';

export interface CheckboxRowProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
}

export function CheckboxRow({ label, checked, onToggle }: CheckboxRowProps) {
  return (
    <Pressable style={styles.row} onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <Ionicons name="checkmark" size={15} color={colors.white} />}
      </View>
    </Pressable>
  );
}
```

```ts
// apps/driver/src/components/CheckboxRow/CheckboxRow.styles.ts
import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  label: {
    ...typography.body,
    color: colors.ink,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
});
```

```ts
// apps/driver/src/components/CheckboxRow/index.ts
export * from './CheckboxRow';
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: PASS. `BadgeTone` must be exported from `@trisakay/ui` — confirm:

```bash
grep -n "export type BadgeTone" packages/ui/src/components/Badge/Badge.tsx
```

Expected: present (confirmed in the design spec's component survey).

- [ ] **Step 7: Commit**

```bash
git add apps/driver/src/components
git commit -m "driver: add shared local components"
```

---

### Task 11: Root entry — `index.tsx`, `splash.tsx`, `_layout.tsx`

**Files:**
- Create: `apps/driver/app/index.tsx`
- Create: `apps/driver/app/splash.tsx`
- Create: `apps/driver/src/styles/splash.styles.ts`
- Create: `apps/driver/app/_layout.tsx`
- Create: `apps/driver/app/+not-found.tsx`

**Interfaces:**
- Consumes: `useAuthStore` (Task 5), `useConsentStore`/`ConsentGateStatus` (Task 5), `useLocationPermission` (Task 6).
- Produces: the app boots to `/splash`, which routes to `/(auth)/login`, `/consent`, or `/(tabs)/dashboard` depending on auth/consent state (those routes are added in Tasks 12–14; until then this task's manual check only confirms the redirect target logs correctly, since the routes 404 as "Unmatched Route").

- [ ] **Step 1: `apps/driver/app/index.tsx`**

```tsx
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/splash" />;
}
```

- [ ] **Step 2: `apps/driver/app/+not-found.tsx`**

```tsx
import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
        <Text style={[typography.h2, { color: colors.ink }]}>This screen doesn't exist.</Text>
        <Link href="/">
          <Text style={[typography.body, { color: colors.accentBlue }]}>Go to home screen</Text>
        </Link>
      </View>
    </>
  );
}
```

- [ ] **Step 3: `apps/driver/src/styles/splash.styles.ts`**

```ts
import { StyleSheet } from 'react-native';
import { elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  motif: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -180,
    marginLeft: -180,
  },
  badge: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxl,
    ...elevation.card,
  },
  logo: {
    width: 220,
    height: 123,
  },
  subtitle: {
    ...typography.body,
    color: 'rgba(255, 255, 255, 0.82)',
    marginTop: spacing.xl,
  },
  loader: {
    marginTop: spacing.xxl,
  },
});
```

- [ ] **Step 4: `apps/driver/app/splash.tsx`**

```tsx
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { BrandMotif, GradientSurface } from '@trisakay/ui';
import { useAuthStore } from '../src/store/useAuthStore';
import { useConsentStore, type ConsentGateStatus } from '../src/store/useConsentStore';
import { wait } from '../src/mocks/delay';
import { styles } from '../src/styles/splash.styles';

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

function waitUntilConsentResolved(): Promise<ConsentGateStatus> {
  const isSettled = (status: ConsentGateStatus) => status === 'accepted' || status === 'required';
  const hasSession = () => useAuthStore.getState().sessionUserId !== null;

  const current = useConsentStore.getState().status;
  if (isSettled(current) || !hasSession()) return Promise.resolve(current);
  if (current === 'unknown') void useConsentStore.getState().check();

  return new Promise((resolve) => {
    let done = false;
    const settle = (status: ConsentGateStatus) => {
      if (done) return;
      done = true;
      unsubscribeConsent();
      unsubscribeAuth();
      resolve(status);
    };

    const unsubscribeConsent = useConsentStore.subscribe((state) => {
      if (isSettled(state.status)) settle(state.status);
    });
    const unsubscribeAuth = useAuthStore.subscribe((state) => {
      if (state.sessionUserId === null) settle(useConsentStore.getState().status);
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

      if (!useAuthStore.getState().isAuthenticated) {
        router.replace('/(auth)/login');
        return;
      }

      const consentStatus = await waitUntilConsentResolved();
      if (cancelled) return;

      if (!useAuthStore.getState().isAuthenticated) {
        router.replace('/(auth)/login');
        return;
      }

      router.replace(consentStatus === 'accepted' ? '/(tabs)/dashboard' : '/consent');
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <GradientSurface token="hero" direction="vertical" style={styles.gradient}>
      <View style={styles.container}>
        <BrandMotif size={360} color="#FFFFFF" opacity={0.08} style={styles.motif} />
        <View style={styles.badge}>
          <Image
            source={require('../../../assets/brand/trisakay-lockup.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="TriSakay"
          />
        </View>
        <Text style={styles.subtitle}>Drive with TriSakay</Text>
        <ActivityIndicator color="#FFFFFF" style={styles.loader} />
      </View>
    </GradientSurface>
  );
}
```

The only content difference from passenger's splash is the subtitle copy and the final redirect target (`/(tabs)/dashboard` instead of `/(tabs)/home`).

- [ ] **Step 5: `apps/driver/app/_layout.tsx`**

```tsx
import { useEffect } from 'react';
import {
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors, fontFamily } from '@trisakay/ui';
import { useLocationPermission } from '../src/hooks/useLocationPermission';
import { useAuthStore } from '../src/store/useAuthStore';
import { useConsentStore, type ConsentGateStatus } from '../src/store/useConsentStore';

export const unstable_settings = { initialRouteName: 'index' };

function useRootSegment(): string | undefined {
  const segments = useSegments();
  return segments[0] as string | undefined;
}

const LOCATION_PROMPT_ROUTES: readonly string[] = ['(tabs)', 'trip', 'profile', 'complaints', 'notifications'];

function useProtectedRoute(isAuthenticated: boolean, consentStatus: ConsentGateStatus) {
  const root = useRootSegment();
  const router = useRouter();

  useEffect(() => {
    const isSplashOrRoot = root === undefined || root === 'splash';
    if (isSplashOrRoot) return;

    const inAuthGroup = root === '(auth)';
    const onConsent = root === 'consent';

    if (!isAuthenticated) {
      if (!inAuthGroup) router.replace('/(auth)/login');
      return;
    }

    if (consentStatus === 'unknown' || consentStatus === 'checking') return;

    if (consentStatus === 'required') {
      if (!onConsent) router.replace('/consent');
    } else if (inAuthGroup || onConsent) {
      router.replace('/(tabs)/dashboard');
    }
  }, [isAuthenticated, consentStatus, root, router]);
}

function useConsentSync(sessionUserId: string | null) {
  const check = useConsentStore((state) => state.check);
  const reset = useConsentStore((state) => state.reset);

  useEffect(() => {
    reset();
    if (sessionUserId === null) return;
    void check();
  }, [sessionUserId, check, reset]);
}

function useLocationPrompt(isAuthenticated: boolean, consentStatus: ConsentGateStatus) {
  const root = useRootSegment();
  const router = useRouter();
  const { state, dismissedThisForeground } = useLocationPermission();

  useEffect(() => {
    if (!isAuthenticated || consentStatus !== 'accepted') return;
    if (state === 'granted' || state === 'unknown') return;
    if (dismissedThisForeground) return;
    if (root === undefined || !LOCATION_PROMPT_ROUTES.includes(root)) return;

    router.push('/location-permission');
  }, [isAuthenticated, consentStatus, state, dismissedThisForeground, root, router]);
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    [fontFamily.regular]: Poppins_400Regular,
    [fontFamily.semibold]: Poppins_600SemiBold,
    [fontFamily.bold]: Poppins_700Bold,
    [fontFamily.extrabold]: Poppins_800ExtraBold,
  });

  if (!fontsLoaded && !fontError) return null;

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const sessionUserId = useAuthStore((state) => state.sessionUserId);
  const consentStatus = useConsentStore((state) => state.status);
  useConsentSync(sessionUserId);
  useProtectedRoute(isAuthenticated, consentStatus);
  useLocationPrompt(isAuthenticated, consentStatus);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

Only `index` is declared here deliberately — `consent`, `location-permission`, and `logout` don't exist as files yet (Task 13 creates them). Declaring a `<Stack.Screen name="...">` for a route with no matching file risks expo-router failing to resolve it at navigation time; Task 13 adds all three entries back into this same `<Stack>` once their files exist.

- [ ] **Step 6: Verify the app boots and redirects correctly with no auth screens yet**

```bash
npm --workspace apps/driver run start -- --web
```

Expected: the app loads Splash (brand lockup + spinner), waits ~1.4s, then attempts `router.replace('/(auth)/login')` — which 404s as "Unmatched Route" since Task 12 hasn't added it yet. That 404 (not a crash) is the correct state for this task. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add apps/driver/app/index.tsx apps/driver/app/splash.tsx apps/driver/app/_layout.tsx apps/driver/app/+not-found.tsx apps/driver/src/styles/splash.styles.ts
git commit -m "driver: add root layout, splash, and gating"
```

---

### Task 12: Auth screens — login, register

**Files:**
- Create: `apps/driver/app/(auth)/_layout.tsx`
- Create: `apps/driver/app/(auth)/login.tsx`
- Create: `apps/driver/app/(auth)/register.tsx`
- Create: `apps/driver/src/styles/auth/login.styles.ts`
- Create: `apps/driver/src/styles/auth/register.styles.ts`

**Interfaces:**
- Consumes: `useAuthStore` (Task 5), `isValidEmail`/`isValidPassword`/`isNonEmpty` (Task 4), `ScreenHeader` (Task 10).
- Produces: reachable `/​(auth)/login` and `/(auth)/register` routes; a successful login/register routes onward via the root layout's gate (Task 11).

- [ ] **Step 1: `apps/driver/app/(auth)/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: `apps/driver/src/styles/auth/login.styles.ts`**

```ts
import { StyleSheet } from 'react-native';
import { colors, elevation, fontFamily, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  screen: { flex: 1 },
  heroBand: { height: 156 },
  motif: { position: 'absolute', top: -60, right: -60 },
  badgeWrap: { alignItems: 'center', marginTop: -48, marginBottom: spacing.lg },
  markBadge: {
    width: 96,
    height: 96,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.card,
  },
  mark: { width: 56, height: 66 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  title: { ...typography.display, color: colors.ink, textAlign: 'center' },
  subtitle: {
    ...typography.body,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xxl,
  },
  fields: { gap: spacing.lg, marginBottom: spacing.md },
  forgotLink: { alignSelf: 'flex-end', paddingVertical: spacing.sm, marginBottom: spacing.md },
  forgotLinkText: { ...typography.caption, color: colors.accentBlue, fontFamily: fontFamily.bold },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xl },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { ...typography.label, color: colors.inkSoft },
  authError: { ...typography.caption, color: colors.danger, marginBottom: spacing.md },
  registerLink: { marginTop: spacing.lg },
});
```

- [ ] **Step 3: `apps/driver/app/(auth)/login.tsx`**

```tsx
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { BrandMotif, Button, GradientSurface, TextField } from '@trisakay/ui';
import { useAuthStore } from '../../src/store/useAuthStore';
import { isValidEmail, isValidPassword } from '../../src/utils/validation';
import { styles } from '../../src/styles/auth/login.styles';

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const authError = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
  const awaitingGate = useAuthStore((state) => state.sessionUserId !== null);

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
    <View style={styles.screen}>
      <GradientSurface token="hero" direction="diagonal" style={styles.heroBand}>
        <BrandMotif size={200} color="#FFFFFF" opacity={0.1} style={styles.motif} />
      </GradientSurface>
      <View style={styles.badgeWrap}>
        <View style={styles.markBadge}>
          <Image
            source={require('../../../../assets/brand/trisakay-mark.png')}
            style={styles.mark}
            resizeMode="contain"
            accessibilityLabel="TriSakay"
          />
        </View>
      </View>

      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Log in to start driving.</Text>

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

          <Button label="Log in" onPress={handleLogin} loading={submitting || awaitingGate} fullWidth />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button
            label="Register as driver"
            variant="outline"
            tone="neutral"
            fullWidth
            disabled={submitting || awaitingGate}
            onPress={() => router.push('/(auth)/register')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
```

- [ ] **Step 4: `apps/driver/src/styles/auth/register.styles.ts`**

```ts
import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  heroBand: { height: 110 },
  motif: { position: 'absolute', top: -40, right: -40 },
  markBadge: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: -36,
    ...elevation.card,
  },
  mark: { width: 42, height: 50 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  fields: { gap: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.md },
  authError: { ...typography.caption, color: colors.danger },
  legalText: { ...typography.caption, color: colors.inkSoft, textAlign: 'center', marginTop: spacing.lg },
});
```

- [ ] **Step 5: `apps/driver/app/(auth)/register.tsx`**

```tsx
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { BrandMotif, Button, GradientSurface, TextField } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useAuthStore } from '../../src/store/useAuthStore';
import { isNonEmpty, isValidEmail, isValidPassword } from '../../src/utils/validation';
import { styles } from '../../src/styles/auth/register.styles';

interface FormState {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterScreen() {
  const router = useRouter();
  const register = useAuthStore((state) => state.register);
  const authError = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
  const awaitingGate = useAuthStore((state) => state.sessionUserId !== null);

  const [form, setForm] = useState<FormState>({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
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
    if (form.confirmPassword !== form.password) nextErrors.confirmPassword = 'Passwords do not match.';
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
      <ScreenHeader title="Register as driver" />
      <GradientSurface token="hero" direction="diagonal" style={styles.heroBand}>
        <BrandMotif size={120} color="#FFFFFF" opacity={0.1} style={styles.motif} />
      </GradientSurface>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Image
          source={require('../../../../assets/brand/trisakay-mark.png')}
          style={styles.markBadge}
          resizeMode="contain"
          accessibilityLabel="TriSakay"
        />

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
        <TextField
          label="Confirm password"
          placeholder="••••••••"
          value={form.confirmPassword}
          onChangeText={(v) => update('confirmPassword', v)}
          error={errors.confirmPassword}
          secureTextEntry
        />

        {authError ? <Text style={styles.authError}>{authError}</Text> : null}

        <Button label="Create account" onPress={handleRegister} loading={submitting || awaitingGate} fullWidth />

        <Text style={styles.legalText}>
          By registering, you agree to TriSakay's Terms of Service and Privacy Policy, and confirm you are a
          licensed tricycle driver.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

Note the two intentional differences from passenger's register screen, per the approved spec: no avatar-picker step, and `register()` (Task 5) already passes `role: 'driver'` internally — this screen does not need to know about roles at all.

- [ ] **Step 6: Manual verification**

```bash
npm --workspace apps/driver run start -- --web
```

Expected: splash → login (with "Register as driver" button) → tapping it opens the register form. Filling it and submitting either signs in (routing onward, 404ing again at `/consent` until Task 13) or shows the "check your email" alert, matching passenger's own confirmed behavior. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add apps/driver/app/\(auth\) apps/driver/src/styles/auth
git commit -m "driver: add login and register screens"
```

---

### Task 13: Consent, location-permission, logout

**Files:**
- Create: `apps/driver/app/consent.tsx`
- Create: `apps/driver/src/styles/consent.styles.ts`
- Create: `apps/driver/app/location-permission.tsx`
- Create: `apps/driver/src/styles/location-permission.styles.ts`
- Create: `apps/driver/app/logout.tsx`
- Modify: `apps/driver/app/_layout.tsx` (register the 3 new routes in the root `<Stack>`)

**Interfaces:**
- Consumes: `useConsentStore` (Task 5), `useLocationPermission` (Task 6), `useAuthStore` (Task 5), `Card`/`Checkbox`/`Button`/`ConfirmModal` from `@trisakay/ui`.
- Produces: a fully gated app — from this task onward, login/register → consent → location prompt → tab root all connect end-to-end (the tab root itself is added in Task 14).

- [ ] **Step 1: `apps/driver/src/styles/consent.styles.ts`**

```ts
import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md },
  title: { ...typography.h1, color: colors.ink },
  version: { ...typography.caption, color: colors.inkSoft, marginTop: spacing.xs },
  scrollArea: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  paragraph: { ...typography.body, color: colors.inkSoft, marginBottom: spacing.md },
  sectionLabel: { ...typography.label, color: colors.inkSoft, marginTop: spacing.lg, marginBottom: spacing.sm },
  disclosureCard: { borderRadius: radius.md, padding: 0 },
  disclosureRow: { padding: spacing.lg },
  disclosureRowDivided: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
  disclosureTitle: { ...typography.bodyStrong, color: colors.ink, marginBottom: spacing.xs },
  disclosureBody: { ...typography.caption, color: colors.inkSoft },
  footer: { padding: spacing.xl, gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.lineSoft },
  error: { ...typography.caption, color: colors.danger },
});
```

- [ ] **Step 2: `apps/driver/app/consent.tsx`**

```tsx
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Checkbox } from '@trisakay/ui';
import { CURRENT_PRIVACY_VERSION, CURRENT_TOS_VERSION } from '@trisakay/services';
import { useConsentStore } from '../src/store/useConsentStore';
import { styles } from '../src/styles/consent.styles';

const POLICY_BODY = [
  'Placeholder — Terms of Service. By driving for TriSakay you agree to accept ride requests in good faith, treat passengers with respect, and follow the fare shown at trip completion. Fares follow City Ordinance No. 08, s. 2023.',
  'Placeholder — Privacy Policy. TriSakay collects only what matching a ride needs. The summary below is the short version; the full policy will describe each item, how long it is kept, and how to request deletion.',
  'Placeholder — Limitations. TriSakay is a prototype built for academic evaluation in Barangay Dadiangas West. Service availability is best-effort and carries no formal guarantee.',
];

const DISCLOSURES: { title: string; body: string }[] = [
  {
    title: 'Your name and contact number',
    body: 'Shared with a matched passenger only after acceptance, and only for that ride.',
  },
  {
    title: 'Your live location',
    body: 'Transmitted only while you are marked available or on an active trip. TriSakay does not keep a trail of where you go.',
  },
  {
    title: 'Trip and payment history',
    body: 'Kept on your account. PSO staff can see it as part of overseeing the tricycle service.',
  },
  {
    title: 'Verification documents',
    body: "Your license, OR/CR, franchise, and tricycle photo are visible to PSO staff for review only.",
  },
];

export default function ConsentScreen() {
  const router = useRouter();
  const error = useConsentStore((state) => state.error);
  const accept = useConsentStore((state) => state.accept);

  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleAccept() {
    setSubmitting(true);
    try {
      const saved = await accept();
      if (saved) router.replace('/(tabs)/dashboard');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Before you drive</Text>
        <Text style={styles.version}>
          Terms {CURRENT_TOS_VERSION} · Privacy {CURRENT_PRIVACY_VERSION}
        </Text>
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {POLICY_BODY.map((paragraph) => (
          <Text key={paragraph.slice(0, 24)} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}

        <Text style={styles.sectionLabel}>What we collect &amp; share</Text>
        <Card style={styles.disclosureCard}>
          {DISCLOSURES.map((item, index) => (
            <View key={item.title} style={[styles.disclosureRow, index > 0 && styles.disclosureRowDivided]}>
              <Text style={styles.disclosureTitle}>{item.title}</Text>
              <Text style={styles.disclosureBody}>{item.body}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Checkbox
          checked={checked}
          onChange={setChecked}
          label="I have read and accept the Terms of Service and Privacy Policy"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="Accept & Continue" fullWidth disabled={!checked} loading={submitting} onPress={handleAccept} />
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: `apps/driver/src/styles/location-permission.styles.ts`**

```ts
import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', backgroundColor: colors.panel, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, ...elevation.card },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...typography.h2, color: colors.ink },
  body: { ...typography.body, color: colors.inkSoft },
  blockedNote: { ...typography.caption, color: colors.danger },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
```

- [ ] **Step 4: `apps/driver/app/location-permission.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Modal, Text, View } from 'react-native';
import { Button, colors } from '@trisakay/ui';
import { useLocationPermission } from '../src/hooks/useLocationPermission';
import { styles } from '../src/styles/location-permission.styles';

export default function LocationPermissionScreen() {
  const router = useRouter();
  const { state, refresh, request, dismiss } = useLocationPermission();
  const [working, setWorking] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (state === 'granted') router.dismiss();
  }, [state, router]);

  const isBlocked = state === 'blocked';

  async function handleEnable() {
    setWorking(true);
    await request();
    setWorking(false);
  }

  function handleNotNow() {
    dismiss();
    router.dismiss();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleNotNow}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconBadge}>
            <Ionicons name="location-outline" size={26} color={colors.accentBluePressed} />
          </View>

          <Text style={styles.title}>Turn on location</Text>
          <Text style={styles.body}>
            TriSakay needs your location to match you with nearby drivers and estimate pickup accurately.
          </Text>

          {isBlocked ? (
            <Text style={styles.blockedNote}>
              Location is off for TriSakay in your device settings. Open settings to turn it on.
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Button label={isBlocked ? 'Open settings' : 'Enable location'} fullWidth loading={working} onPress={handleEnable} />
            <Button label="Not now" variant="ghost" tone="neutral" fullWidth disabled={working} onPress={handleNotNow} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

The location prompt body copy is required to match the Global Constraints' exact string verbatim.

- [ ] **Step 5: `apps/driver/app/logout.tsx`**

```tsx
import { useRouter } from 'expo-router';
import { ConfirmModal } from '@trisakay/ui';
import { useAuthStore } from '../src/store/useAuthStore';
import { useDriverStore } from '../src/store/useDriverStore';
import { useRequestsStore } from '../src/store/useRequestsStore';

export default function LogoutScreen() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  async function handleConfirm() {
    await logout();
    useRequestsStore.getState().stopSimulatingArrivals();
    useDriverStore.getState().setAvailable(false);
    router.dismiss();
  }

  return (
    <ConfirmModal
      visible
      title="Log out?"
      message="You'll need to log in again to go online."
      cancelLabel="Cancel"
      confirmLabel="Log out"
      destructive
      onCancel={() => router.dismiss()}
      onConfirm={handleConfirm}
    />
  );
}
```

Stopping the simulation and clearing availability on logout mirrors passenger's `logout.tsx` resetting `useBookingStore` — a signed-out driver must not keep synthesizing incoming requests in the background.

- [ ] **Step 6: Register the three new routes in the root `<Stack>`**

Modify `apps/driver/app/_layout.tsx` — now that `consent.tsx`, `location-permission.tsx`, and `logout.tsx` all exist, restore the entries Task 11 deliberately left out:

```tsx
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="consent" />
          <Stack.Screen name="location-permission" options={{ presentation: 'transparentModal', animation: 'fade' }} />
          <Stack.Screen name="logout" options={{ presentation: 'transparentModal', animation: 'fade' }} />
        </Stack>
```

- [ ] **Step 7: Manual verification**

```bash
npm --workspace apps/driver run start -- --web
```

Expected: after registering/logging in, the consent screen appears, requires the checkbox before "Accept & Continue" enables, and accepting routes onward (404ing at `/(tabs)/dashboard` until Task 14 — expected for this task). Stop the server.

- [ ] **Step 8: Commit**

```bash
git add apps/driver/app/consent.tsx apps/driver/app/location-permission.tsx apps/driver/app/logout.tsx apps/driver/app/_layout.tsx apps/driver/src/styles/consent.styles.ts apps/driver/src/styles/location-permission.styles.ts
git commit -m "driver: add consent, location permission, and logout screens"
```

---

### Task 14: Tabs layout + Dashboard

**Files:**
- Create: `apps/driver/app/(tabs)/_layout.tsx`
- Create: `apps/driver/app/(tabs)/dashboard.tsx`
- Create: `apps/driver/src/styles/tabs/dashboard.styles.ts`

**Interfaces:**
- Consumes: `useAuthStore`, `useDriverStore`, `useRequestsStore`, `useTripStore`, `StatTile`, `RequestCard`.
- Produces: the app is now end-to-end reachable from splash through to a real tab root — wireframe screen 4.

- [ ] **Step 1: `apps/driver/app/(tabs)/_layout.tsx`**

```tsx
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors, spacing, typography } from '@trisakay/ui';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentBlue,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarLabelStyle: { ...typography.caption, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.panel,
          borderTopColor: colors.lineSoft,
          height: 60,
          paddingBottom: spacing.xs,
          paddingTop: spacing.xs,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: 'Dashboard', tabBarIcon: ({ color, size }) => <Ionicons name="speedometer" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="requests"
        options={{ title: 'Requests', tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'History', tabBarIcon: ({ color, size }) => <Ionicons name="time" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="earnings"
        options={{ title: 'Earnings', tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 2: `apps/driver/src/styles/tabs/dashboard.styles.ts`**

```ts
import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.lg, gap: spacing.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  nameSlot: { flex: 1 },
  name: { ...typography.h2, color: colors.ink },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLabel: { ...typography.bodyStrong, color: colors.ink },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  sectionLabel: { ...typography.label, color: colors.inkSoft, marginTop: spacing.sm },
  offlineNote: { ...typography.caption, color: colors.inkSoft },
});
```

- [ ] **Step 3: `apps/driver/app/(tabs)/dashboard.tsx`**

```tsx
import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Badge, Toggle } from '@trisakay/ui';
import { RequestCard } from '../../src/components/RequestCard';
import { StatTile } from '../../src/components/StatTile';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useDriverStore } from '../../src/store/useDriverStore';
import { useRequestsStore } from '../../src/store/useRequestsStore';
import { useTripStore } from '../../src/store/useTripStore';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/tabs/dashboard.styles';

export default function DashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const isAvailable = useDriverStore((state) => state.isAvailable);
  const setAvailable = useDriverStore((state) => state.setAvailable);
  const todayEarnings = useDriverStore((state) => state.todayEarnings);
  const todayTrips = useDriverStore((state) => state.todayTrips);
  const rating = useDriverStore((state) => state.rating);
  const ratingCount = useDriverStore((state) => state.ratingCount);
  const acceptRate = useDriverStore((state) => state.acceptRate);

  const pending = useRequestsStore((state) => state.pending);
  const startSimulatingArrivals = useRequestsStore((state) => state.startSimulatingArrivals);
  const stopSimulatingArrivals = useRequestsStore((state) => state.stopSimulatingArrivals);
  const accept = useRequestsStore((state) => state.accept);
  const decline = useRequestsStore((state) => state.decline);

  const startTrip = useTripStore((state) => state.startTrip);

  function handleToggleAvailable(next: boolean) {
    setAvailable(next);
    if (next) {
      startSimulatingArrivals();
    } else {
      stopSimulatingArrivals();
    }
  }

  function handleAccept(id: string) {
    const request = accept(id);
    if (request) {
      startTrip(request);
      router.push('/trip/active');
    }
  }

  const incoming = pending[0];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topRow}>
          <Avatar name={user?.name} source={user?.avatarUrl ? { uri: user.avatarUrl } : undefined} size="lg" />
          <View style={styles.nameSlot}>
            <Text style={styles.name} numberOfLines={1}>
              {user?.name ?? 'Driver'}
            </Text>
          </View>
          <Toggle value={isAvailable} onValueChange={handleToggleAvailable} />
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>{isAvailable ? 'You are online' : 'You are offline'}</Text>
          <Badge label={isAvailable ? 'Online' : 'Offline'} tone={isAvailable ? 'green' : 'neutral'} dot />
        </View>

        <View style={styles.statGrid}>
          <StatTile label="Earnings today" value={formatCurrency(todayEarnings)} />
          <StatTile label="Trips today" value={String(todayTrips)} />
          <StatTile label="Rating" value={ratingCount > 0 && rating !== null ? rating.toFixed(1) : '—'} />
          <StatTile label="Accept rate" value={acceptRate !== null ? `${Math.round(acceptRate * 100)}%` : '—'} />
        </View>

        {incoming && (
          <View>
            <Text style={styles.sectionLabel}>Incoming request</Text>
            <RequestCard request={incoming} onAccept={() => handleAccept(incoming.id)} onDecline={() => decline(incoming.id)} />
          </View>
        )}

        {isAvailable && !incoming && (
          <Text style={styles.offlineNote}>Listening for ride requests…</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: Manual verification**

```bash
npm --workspace apps/driver run start -- --web
```

Expected: after consent, the Dashboard renders — driver name, availability toggle (off by default), 4 stat tiles all showing zero/dash values, no incoming-request card. Toggling availability ON shows "Listening for ride requests…"; after 8–15s a `RequestCard` appears; Accept navigates to `/trip/active` (404s until Task 16 — expected here). Toggling OFF clears the note and any pending card. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add apps/driver/app/\(tabs\)/_layout.tsx apps/driver/app/\(tabs\)/dashboard.tsx apps/driver/src/styles/tabs/dashboard.styles.ts
git commit -m "driver: add tabs layout and dashboard screen"
```

---

### Task 15: Ride requests screen

**Files:**
- Create: `apps/driver/app/(tabs)/requests.tsx`
- Create: `apps/driver/src/styles/tabs/requests.styles.ts`

**Interfaces:**
- Consumes: `useDriverStore`, `useRequestsStore`, `useTripStore`, `RequestCard`, `EmptyState`.

- [ ] **Step 1: `apps/driver/src/styles/tabs/requests.styles.ts`**

```ts
import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  title: { ...typography.h1, color: colors.ink },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
});
```

- [ ] **Step 2: `apps/driver/app/(tabs)/requests.tsx`**

```tsx
import { useRouter } from 'expo-router';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, EmptyState } from '@trisakay/ui';
import { RequestCard } from '../../src/components/RequestCard';
import { useDriverStore } from '../../src/store/useDriverStore';
import { useRequestsStore } from '../../src/store/useRequestsStore';
import { useTripStore } from '../../src/store/useTripStore';
import { styles } from '../../src/styles/tabs/requests.styles';

export default function RequestsScreen() {
  const router = useRouter();
  const isAvailable = useDriverStore((state) => state.isAvailable);
  const pending = useRequestsStore((state) => state.pending);
  const accept = useRequestsStore((state) => state.accept);
  const decline = useRequestsStore((state) => state.decline);
  const startTrip = useTripStore((state) => state.startTrip);

  function handleAccept(id: string) {
    const request = accept(id);
    if (request) {
      startTrip(request);
      router.push('/trip/active');
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Ride requests</Text>
        {isAvailable && <Badge label="Along route" tone="blue" />}
      </View>

      <FlatList
        data={pending}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            title={isAvailable ? 'No requests right now' : "You're offline"}
            message={isAvailable ? 'New ride requests will appear here.' : 'Go online from the Dashboard to start receiving requests.'}
          />
        }
        renderItem={({ item }) => (
          <RequestCard request={item} onAccept={() => handleAccept(item.id)} onDecline={() => decline(item.id)} />
        )}
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Manual verification**

```bash
npm --workspace apps/driver run start -- --web
```

Expected: the Requests tab shows the "You're offline" empty state while offline; toggling online on the Dashboard tab and waiting shows the same request(s) here as on the Dashboard's single preview, and Accept/Decline work identically from either screen. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add apps/driver/app/\(tabs\)/requests.tsx apps/driver/src/styles/tabs/requests.styles.ts
git commit -m "driver: add ride requests screen"
```

---

### Task 16: Active trip screen

**Files:**
- Create: `apps/driver/app/trip/_layout.tsx`
- Create: `apps/driver/app/trip/active.tsx`
- Create: `apps/driver/src/styles/trip/active.styles.ts`

**Interfaces:**
- Consumes: `useTripStore`, `useHistoryStore`, `useEarningsStore`, `useDriverStore`, `OsmMap`, `ConfirmModal`.

- [ ] **Step 1: `apps/driver/app/trip/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';

export default function TripLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: `apps/driver/src/styles/trip/active.styles.ts`**

```ts
import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  mapWrap: { height: 260 },
  statusBadgeWrap: { position: 'absolute', top: spacing.xxl, left: spacing.lg },
  content: { flex: 1, padding: spacing.lg, gap: spacing.lg },
  passengerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  passengerName: { ...typography.bodyStrong, color: colors.ink },
  seatsLabel: { ...typography.caption, color: colors.inkSoft },
  cashCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.panel,
  },
  cashRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cashLabel: { ...typography.bodyStrong, color: colors.ink },
  cashCaption: { ...typography.caption, color: colors.inkSoft },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: 'auto', paddingTop: spacing.lg },
  actionButton: { flex: 1 },
});
```

- [ ] **Step 3: `apps/driver/app/trip/active.tsx`**

```tsx
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, ConfirmModal, OsmMap, Toggle } from '@trisakay/ui';
import { useDriverStore } from '../../src/store/useDriverStore';
import { useEarningsStore } from '../../src/store/useEarningsStore';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { useTripStore } from '../../src/store/useTripStore';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/trip/active.styles';

export default function ActiveTripScreen() {
  const router = useRouter();
  const trip = useTripStore((state) => state.current);
  const confirmCash = useTripStore((state) => state.confirmCash);
  const complete = useTripStore((state) => state.complete);
  const cancel = useTripStore((state) => state.cancel);
  const addTrip = useHistoryStore((state) => state.addTrip);
  const creditTrip = useEarningsStore((state) => state.creditTrip);
  const recordCompletedTrip = useDriverStore((state) => state.recordCompletedTrip);

  const [cancelling, setCancelling] = useState(false);

  if (!trip) {
    router.replace('/(tabs)/dashboard');
    return null;
  }

  const isCash = trip.paymentMethod === 'cash';
  const canComplete = !isCash || trip.cashConfirmed;

  function handleComplete() {
    const closed = complete();
    if (!closed) return;
    const fare = closed.fare ?? 0;
    addTrip({ id: closed.id, passengerName: closed.passengerName, date: new Date().toISOString(), fare: closed.fare, status: 'done' });
    creditTrip(fare);
    recordCompletedTrip(fare);
    router.replace('/(tabs)/dashboard');
  }

  function handleConfirmCancel() {
    const closed = cancel();
    setCancelling(false);
    if (!closed) return;
    addTrip({ id: closed.id, passengerName: closed.passengerName, date: new Date().toISOString(), fare: closed.fare, status: 'cancelled' });
    router.replace('/(tabs)/dashboard');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.mapWrap}>
        <OsmMap variant="route" caption="Map · trip route" height="100%" interactive={false} />
      </View>
      <View style={styles.statusBadgeWrap}>
        <Badge label="In progress" tone="blue" dot />
      </View>

      <View style={styles.content}>
        <View style={styles.passengerRow}>
          <Avatar name={trip.passengerName ?? undefined} size="lg" />
          <View>
            <Text style={styles.passengerName}>{trip.passengerName || 'Passenger'}</Text>
            <Text style={styles.seatsLabel}>
              {trip.seats} seat{trip.seats > 1 ? 's' : ''} · {trip.fare !== null ? formatCurrency(trip.fare) : '—'}
            </Text>
          </View>
        </View>

        <View style={styles.cashCard}>
          {isCash ? (
            <>
              <View style={styles.cashRow}>
                <Text style={styles.cashLabel}>Confirm cash received</Text>
                <Toggle value={trip.cashConfirmed} onValueChange={confirmCash} disabled={trip.cashConfirmed} />
              </View>
              <Text style={styles.cashCaption}>CASH TRIPS ONLY — GCASH IS AUTO-CONFIRMED BY THE PAYMENT WEBHOOK</Text>
            </>
          ) : (
            <Text style={styles.cashCaption}>CASH TRIPS ONLY — GCASH IS AUTO-CONFIRMED BY THE PAYMENT WEBHOOK</Text>
          )}
        </View>

        <View style={styles.actions}>
          <View style={styles.actionButton}>
            <Button label="Cancel" variant="outline" tone="danger" fullWidth onPress={() => setCancelling(true)} />
          </View>
          <View style={styles.actionButton}>
            <Button label="Complete trip" fullWidth disabled={!canComplete} onPress={handleComplete} />
          </View>
        </View>
      </View>

      <ConfirmModal
        visible={cancelling}
        title="Cancel this trip?"
        message="The trip will be logged as cancelled."
        cancelLabel="Keep trip"
        confirmLabel="Cancel trip"
        destructive
        onCancel={() => setCancelling(false)}
        onConfirm={handleConfirmCancel}
      />
    </SafeAreaView>
  );
}
```

`OsmMap`'s exact prop surface (`variant`, `caption`, `height`, `interactive`) is confirmed against `apps/passenger/app/(tabs)/home.tsx` and `booking/trip-in-progress.tsx`'s usage, both already read in the design spec's research — `interactive={false}` here since the driver isn't repositioning a pin, only viewing.

- [ ] **Step 2: Manual verification**

```bash
npm --workspace apps/driver run start -- --web
```

Expected: accepting a request from Dashboard/Requests lands here. For a cash trip, "Complete trip" stays disabled until the toggle is confirmed; for a gcash trip it's enabled immediately. Both Cancel and Complete return to Dashboard and the trip appears in History (verified fully once Task 17 exists). Stop the server.

- [ ] **Step 3: Commit**

```bash
git add apps/driver/app/trip apps/driver/src/styles/trip
git commit -m "driver: add active trip screen"
```

---

### Task 17: Trip history screen

**Files:**
- Create: `apps/driver/app/(tabs)/history.tsx`
- Create: `apps/driver/src/styles/tabs/history.styles.ts`

**Interfaces:**
- Consumes: `useHistoryStore`, `formatCurrency`.

- [ ] **Step 1: `apps/driver/src/styles/tabs/history.styles.ts`**

```ts
import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  title: { ...typography.h1, color: colors.ink },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  trailingSlot: { alignItems: 'flex-end', gap: spacing.xs },
  fareText: { ...typography.bodyStrong, color: colors.ink },
});
```

- [ ] **Step 2: `apps/driver/app/(tabs)/history.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, EmptyState, ListRow } from '@trisakay/ui';
import { useHistoryStore } from '../../src/store/useHistoryStore';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/tabs/history.styles';

type FilterMode = 'all' | 'done' | 'cancelled';

const FILTER_LABEL: Record<FilterMode, string> = { all: 'Filter', done: 'Done', cancelled: 'Cancelled' };
const NEXT_FILTER: Record<FilterMode, FilterMode> = { all: 'done', done: 'cancelled', cancelled: 'all' };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export default function HistoryScreen() {
  const trips = useHistoryStore((state) => state.trips);
  const [filter, setFilter] = useState<FilterMode>('all');

  const filteredTrips = useMemo(() => {
    if (filter === 'all') return trips;
    return trips.filter((trip) => trip.status === filter);
  }, [trips, filter]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Trip history</Text>
        <Button
          label={FILTER_LABEL[filter]}
          size="sm"
          variant="outline"
          tone="neutral"
          onPress={() => setFilter((current) => NEXT_FILTER[current])}
        />
      </View>

      <FlatList
        data={filteredTrips}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyState title="No trips yet" message="Your completed trips will show up here." />}
        renderItem={({ item }) => (
          <ListRow
            title={item.passengerName || 'Passenger'}
            subtitle={formatDate(item.date)}
            leading={<Avatar name={item.passengerName ?? undefined} size="md" />}
            trailing={
              <View style={styles.trailingSlot}>
                <Badge label={item.status === 'done' ? 'Done' : 'Cancel'} tone={item.status === 'done' ? 'green' : 'danger'} />
                <Text style={styles.fareText}>{item.fare !== null ? formatCurrency(item.fare) : '—'}</Text>
              </View>
            }
          />
        )}
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Manual verification**

```bash
npm --workspace apps/driver run start -- --web
```

Expected: empty by default; completing or cancelling a trip (Task 16) adds a row here with the correct Done/Cancel badge and fare; the Filter button cycles All → Done → Cancelled → All. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add apps/driver/app/\(tabs\)/history.tsx apps/driver/src/styles/tabs/history.styles.ts
git commit -m "driver: add trip history screen"
```

---

### Task 18: Earnings & settlement screen

**Files:**
- Create: `apps/driver/app/(tabs)/earnings.tsx`
- Create: `apps/driver/src/styles/tabs/earnings.styles.ts`

**Interfaces:**
- Consumes: `useEarningsStore`, `MapPlaceholder` (`'chart'` variant, Task 3).

- [ ] **Step 1: `apps/driver/src/styles/tabs/earnings.styles.ts`**

```ts
import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.lg, gap: spacing.lg },
  title: { ...typography.h1, color: colors.ink },
  totalCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.lg,
    backgroundColor: colors.panel,
    gap: spacing.xs,
  },
  totalLabel: { ...typography.label, color: colors.inkSoft },
  totalValue: { ...typography.amount, color: colors.ink },
  sectionLabel: { ...typography.label, color: colors.inkSoft, marginTop: spacing.sm },
  logRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  logAmount: { ...typography.body, color: colors.ink },
  caption: { ...typography.caption, color: colors.inkSoft, textAlign: 'center' },
});
```

- [ ] **Step 2: `apps/driver/app/(tabs)/earnings.tsx`**

```tsx
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, EmptyState, MapPlaceholder } from '@trisakay/ui';
import { useEarningsStore } from '../../src/store/useEarningsStore';
import { formatCurrency } from '../../src/utils/currency';
import { styles } from '../../src/styles/tabs/earnings.styles';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function EarningsScreen() {
  const totalTracked = useEarningsStore((state) => state.totalTracked);
  const settlementLog = useEarningsStore((state) => state.settlementLog);
  const notifyPsoForSettlement = useEarningsStore((state) => state.notifyPsoForSettlement);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Earnings</Text>

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total earnings (tracked)</Text>
          <Text style={styles.totalValue}>{formatCurrency(totalTracked)}</Text>
        </View>

        <MapPlaceholder variant="chart" caption="Earnings chart" height={160} />

        <Text style={styles.sectionLabel}>Settlement log (record only)</Text>
        {settlementLog.length === 0 ? (
          <EmptyState title="No settlements logged" message="Notify PSO once you're ready to settle." />
        ) : (
          settlementLog.map((entry) => (
            <View key={entry.id} style={styles.logRow}>
              <Text style={styles.logAmount}>{formatCurrency(entry.amount)}</Text>
              <Badge label="Logged" tone="neutral" />
            </View>
          ))
        )}

        <Button label="Notify PSO for settlement" fullWidth onPress={notifyPsoForSettlement} />
        <Text style={styles.caption}>
          CREATES A RECORD FOR PSO ONLY — NO MONEY MOVES THROUGH THE APP; SETTLEMENT HAPPENS OUTSIDE IT
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Manual verification**

```bash
npm --workspace apps/driver run start -- --web
```

Expected: total starts at ₱0.00, grows after each completed trip (Task 16); the chart placeholder renders an ascending line (Task 3's `'chart'` variant); "Notify PSO for settlement" appends a "Logged" row for the current total. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add apps/driver/app/\(tabs\)/earnings.tsx apps/driver/src/styles/tabs/earnings.styles.ts
git commit -m "driver: add earnings and settlement screen"
```

---

### Task 19: Profile screen

**Files:**
- Create: `apps/driver/app/(tabs)/profile.tsx`
- Create: `apps/driver/src/styles/tabs/profile.styles.ts`

**Interfaces:**
- Consumes: `useAuthStore`, `useDriverStore`, `StarRating`, `Card`, `ListRow`.

- [ ] **Step 1: `apps/driver/src/styles/tabs/profile.styles.ts`**

```ts
import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.lg, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.h1, color: colors.ink },
  identity: { alignItems: 'center', gap: spacing.sm },
  editFieldWrap: { width: '100%' },
  name: { ...typography.h2, color: colors.ink },
  detailsCard: { flexDirection: 'row', gap: spacing.xl },
  detailCol: { flex: 1, gap: 2 },
  detailLabel: { ...typography.label, color: colors.inkSoft },
  detailValue: { ...typography.body, color: colors.ink },
  navGroup: { padding: 0 },
});
```

- [ ] **Step 2: `apps/driver/app/(tabs)/profile.tsx`**

```tsx
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Button, Card, ListRow, StarRating, TextField } from '@trisakay/ui';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useDriverStore } from '../../src/store/useDriverStore';
import { styles } from '../../src/styles/tabs/profile.styles';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const rating = useDriverStore((state) => state.rating);
  const ratingCount = useDriverStore((state) => state.ratingCount);

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
    const { error } = await updateProfile({ fullName: name });
    setSaving(false);
    if (error) {
      Alert.alert('Could not save', error);
      return;
    }
    setIsEditing(false);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <Button label={isEditing ? 'Done' : 'Edit'} size="sm" variant="outline" tone="neutral" loading={saving} onPress={handleToggleEdit} />
        </View>

        <View style={styles.identity}>
          <Avatar name={name} source={user?.avatarUrl ? { uri: user.avatarUrl } : undefined} size="xl" />
          {isEditing ? (
            <View style={styles.editFieldWrap}>
              <TextField value={name} onChangeText={setName} autoCapitalize="words" />
            </View>
          ) : (
            <>
              <Text style={styles.name}>{name || 'Driver'}</Text>
              {ratingCount > 0 && rating !== null && <StarRating value={Math.round(rating)} size={18} />}
            </>
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
          <ListRow title="Documents & tricycle info" onPress={() => router.push('/profile/documents')} chevron />
          <ListRow title="Settings" onPress={() => router.push('/profile/settings')} chevron divider={false} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Manual verification**

```bash
npm --workspace apps/driver run start -- --web
```

Expected: Edit toggles a name field and saves via the real `updateProfile` service call; rating stays hidden until `ratingCount > 0` (always true in this pass, since nothing sets it yet — confirmed as the correct "no invented data" state); the two nav rows push to Documents and Settings (404 until Tasks 20/21). Stop the server.

- [ ] **Step 4: Commit**

```bash
git add apps/driver/app/\(tabs\)/profile.tsx apps/driver/src/styles/tabs/profile.styles.ts
git commit -m "driver: add profile screen"
```

---

### Task 20: Documents & tricycle screen

**Files:**
- Create: `apps/driver/app/profile/documents.tsx`
- Create: `apps/driver/src/styles/profile/documents.styles.ts`

**Interfaces:**
- Consumes: `useDocumentsStore`, `DOCUMENT_TYPES`/`DOCUMENT_LABEL` (Task 4), `DocumentUploadRow` (Task 10), `ScreenHeader`.

- [ ] **Step 1: `apps/driver/src/styles/profile/documents.styles.ts`**

```ts
import { StyleSheet } from 'react-native';
import { spacing } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: spacing.lg },
});
```

- [ ] **Step 2: `apps/driver/app/profile/documents.tsx`**

```tsx
import { ScrollView, View } from 'react-native';
import { Button } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { DocumentUploadRow } from '../../src/components/DocumentUploadRow';
import { useDocumentsStore } from '../../src/store/useDocumentsStore';
import { DOCUMENT_LABEL, DOCUMENT_TYPES } from '../../src/types/document';
import { styles } from '../../src/styles/profile/documents.styles';

export default function DocumentsScreen() {
  const statuses = useDocumentsStore((state) => state.statuses);
  const submit = useDocumentsStore((state) => state.submit);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Documents & tricycle" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {DOCUMENT_TYPES.map((type) => (
          <DocumentUploadRow
            key={type}
            label={DOCUMENT_LABEL[type]}
            status={statuses[type]}
            onUpload={() => submit(type)}
          />
        ))}
        <Button label="Save & submit" fullWidth onPress={() => {}} disabled />
      </ScrollView>
    </View>
  );
}
```

"Save & submit" stays disabled in this pass — every document already transitions to `'pending'` the moment it's individually uploaded (`submit(type)`), so there is no real backend write for a batch "submit" action to trigger yet; wiring it is `docs/DRIVER_TODO.MD` step 4's job, not this one.

- [ ] **Step 3: Manual verification**

```bash
npm --workspace apps/driver run start -- --web
```

Expected: from Profile → Documents & tricycle info, 4 rows render (License, OR/CR, Franchise/permit, Tricycle photo), each "Not uploaded" initially; tapping Upload on any row opens the device photo picker (grant permission if prompted) and, on selecting an image, that row's badge flips to "Pending". Stop the server.

- [ ] **Step 4: Commit**

```bash
git add apps/driver/app/profile/documents.tsx apps/driver/src/styles/profile/documents.styles.ts
git commit -m "driver: add documents and tricycle screen"
```

---

### Task 21: Settings screen

**Files:**
- Create: `apps/driver/app/profile/settings.tsx`
- Create: `apps/driver/src/styles/profile/settings.styles.ts`

**Interfaces:**
- Consumes: `useSettingsStore`, `CheckboxRow` (Task 10), `ScreenHeader`.

- [ ] **Step 1: `apps/driver/src/styles/profile/settings.styles.ts`**

```ts
import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  rowLabel: { ...typography.body, color: colors.ink },
  rowValueSlot: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowValue: { ...typography.body, color: colors.inkSoft },
  logoutWrap: { marginTop: spacing.xl },
});
```

- [ ] **Step 2: `apps/driver/app/profile/settings.tsx`**

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Toggle, colors } from '@trisakay/ui';
import { CheckboxRow } from '../../src/components/CheckboxRow';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useSettingsStore } from '../../src/store/useSettingsStore';
import { styles } from '../../src/styles/profile/settings.styles';

const LANGUAGES = ['English', 'Filipino'];

export default function SettingsScreen() {
  const router = useRouter();
  const {
    pushNotificationsEnabled,
    locationTrackingEnabled,
    language,
    smsReceipts,
    emailReceipts,
    togglePushNotifications,
    toggleLocationTracking,
    toggleSmsReceipts,
    toggleEmailReceipts,
  } = useSettingsStore();

  function cycleLanguage() {
    const nextIndex = (LANGUAGES.indexOf(language) + 1) % LANGUAGES.length;
    useSettingsStore.setState({ language: LANGUAGES[nextIndex] });
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Push notifications</Text>
          <Toggle value={pushNotificationsEnabled} onValueChange={togglePushNotifications} />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Location tracking</Text>
          <Toggle value={locationTrackingEnabled} onValueChange={toggleLocationTracking} />
        </View>
        <Pressable style={styles.row} onPress={cycleLanguage} accessibilityRole="button">
          <Text style={styles.rowLabel}>Language</Text>
          <View style={styles.rowValueSlot}>
            <Text style={styles.rowValue}>{language}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
          </View>
        </Pressable>
        <CheckboxRow label="SMS receipts" checked={smsReceipts} onToggle={toggleSmsReceipts} />
        <CheckboxRow label="Email receipts" checked={emailReceipts} onToggle={toggleEmailReceipts} />

        <View style={styles.logoutWrap}>
          <Button label="Log out" variant="outline" tone="danger" fullWidth onPress={() => router.push('/logout')} />
        </View>
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 3: Manual verification**

```bash
npm --workspace apps/driver run start -- --web
```

Expected: all 5 rows toggle/cycle correctly; "Log out" opens the confirm modal from Task 13. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add apps/driver/app/profile/settings.tsx apps/driver/src/styles/profile/settings.styles.ts
git commit -m "driver: add settings screen"
```

---

### Task 22: Complaints screen

**Files:**
- Create: `apps/driver/app/complaints.tsx`
- Create: `apps/driver/src/styles/complaints.styles.ts`

**Interfaces:**
- Consumes: `ScreenHeader`, `EmptyState`, `TextField`, `Textarea`, `Button`, `ListRow`, `Card`, local component-free — no dedicated store needed since submissions aren't persisted anywhere yet (mirrors passenger's own complaints screen, which is also purely local `useState`).

- [ ] **Step 1: `apps/driver/src/styles/complaints.styles.ts`**

```ts
import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.h1, color: colors.ink },
  listContent: { gap: spacing.md },
  cardRow: { padding: spacing.lg, gap: spacing.sm },
  subjectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subject: { ...typography.bodyStrong, color: colors.ink },
  formGap: { gap: spacing.md },
});
```

- [ ] **Step 2: `apps/driver/app/complaints.tsx`**

```tsx
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Badge, Button, Card, EmptyState, Textarea, TextField, type BadgeTone } from '@trisakay/ui';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { isNonEmpty } from '../src/utils/validation';
import { wait } from '../src/mocks/delay';
import { styles } from '../src/styles/complaints.styles';

type ComplaintStatus = 'open' | 'review' | 'closed';

interface ComplaintRow {
  id: string;
  subject: string;
  status: ComplaintStatus;
}

const STATUS_LABEL: Record<ComplaintStatus, string> = { open: 'Open', review: 'Review', closed: 'Closed' };
const STATUS_TONE: Record<ComplaintStatus, BadgeTone> = { open: 'blue', review: 'neutral', closed: 'green' };

export default function ComplaintsScreen() {
  const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = isNonEmpty(subject) && isNonEmpty(message);

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    await wait(600);
    setComplaints((prev) => [{ id: `c-${prev.length + 1}`, subject, status: 'open' }, ...prev]);
    setSubject('');
    setMessage('');
    setSubmitting(false);
    setComposing(false);
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Complaints"
        right={
          <Text onPress={() => setComposing((prev) => !prev)} style={{ color: '#002E60' }}>
            {composing ? 'Cancel' : 'New'}
          </Text>
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {composing ? (
            <View style={styles.formGap}>
              <TextField label="Subject" placeholder="What's this about?" value={subject} onChangeText={setSubject} />
              <Textarea label="Message" placeholder="Describe what happened" value={message} onChangeText={setMessage} />
              <Button label="Submit complaint" fullWidth disabled={!canSubmit} loading={submitting} onPress={handleSubmit} />
            </View>
          ) : complaints.length === 0 ? (
            <EmptyState title="No complaints" message="Complaints you submit will appear here." />
          ) : (
            <View style={styles.listContent}>
              {complaints.map((item) => (
                <Card key={item.id} style={styles.cardRow}>
                  <View style={styles.subjectRow}>
                    <Text style={styles.subject}>{item.subject}</Text>
                    <Badge label={STATUS_LABEL[item.status]} tone={STATUS_TONE[item.status]} />
                  </View>
                </Card>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
```

Kept as local `useState` rather than a new store, matching passenger's own `complaints.tsx`, which is likewise purely local — nothing in this app persists complaints across screens yet, so a store would add a layer with no second consumer.

- [ ] **Step 3: Manual verification**

```bash
npm --workspace apps/driver run start -- --web
```

Expected: "New" opens the form; submitting adds a row with an "Open" badge and returns to the list view; "Cancel" while composing returns to the (still-empty, until a submission) list. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add apps/driver/app/complaints.tsx apps/driver/src/styles/complaints.styles.ts
git commit -m "driver: add complaints screen"
```

---

### Task 23: Notifications screen + Dashboard bell icon

**Files:**
- Create: `apps/driver/app/notifications.tsx`
- Create: `apps/driver/src/styles/notifications.styles.ts`
- Modify: `apps/driver/app/(tabs)/dashboard.tsx` (add bell icon)
- Modify: `apps/driver/src/styles/tabs/dashboard.styles.ts` (bell styles)

**Interfaces:**
- Consumes: `useNotificationsStore`, `ScreenHeader`, `EmptyState`.

- [ ] **Step 1: `apps/driver/src/styles/notifications.styles.ts`**

```ts
import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: { flex: 1 },
  markReadText: { ...typography.caption, color: colors.accentBlue },
  listContent: { padding: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  dotSlot: { width: 8, alignItems: 'center', paddingTop: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentBlue },
  textSlot: { flex: 1, gap: 2 },
  title: { ...typography.bodyStrong, color: colors.ink },
  body: { ...typography.body, color: colors.inkSoft },
  date: { ...typography.caption, color: colors.inkFaint },
});
```

- [ ] **Step 2: `apps/driver/app/notifications.tsx`**

```tsx
import { FlatList, Text, View } from 'react-native';
import { EmptyState } from '@trisakay/ui';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { useNotificationsStore } from '../src/store/useNotificationsStore';
import { styles } from '../src/styles/notifications.styles';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen() {
  const items = useNotificationsStore((state) => state.items);
  const markAllRead = useNotificationsStore((state) => state.markAllRead);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Notifications"
        right={
          <Text style={styles.markReadText} onPress={markAllRead}>
            Mark all read
          </Text>
        }
      />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyState title="You're all caught up" message="No notifications yet." />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.dotSlot}>{!item.read && <View style={styles.unreadDot} />}</View>
            <View style={styles.textSlot}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}
```

- [ ] **Step 3: Add the bell icon to Dashboard's top row**

Modify `apps/driver/app/(tabs)/dashboard.tsx` — replace the `topRow` `View` block:

```tsx
        <View style={styles.topRow}>
          <Avatar name={user?.name} source={user?.avatarUrl ? { uri: user.avatarUrl } : undefined} size="lg" />
          <View style={styles.nameSlot}>
            <Text style={styles.name} numberOfLines={1}>
              {user?.name ?? 'Driver'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            style={styles.bellButton}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.ink} />
            {unreadCount > 0 && <View style={styles.bellDot} />}
          </Pressable>
          <Toggle value={isAvailable} onValueChange={handleToggleAvailable} />
        </View>
```

Add these two imports at the top of `dashboard.tsx`:

```ts
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
```

(`Pressable` joins the existing `ScrollView, Text, View` import from `'react-native'` — combine into one import statement rather than two.) Add `colors` to the existing `@trisakay/ui` import list. Add this line inside the component, alongside the other store reads:

```ts
  const unreadCount = useNotificationsStore((state) => state.items.filter((item) => !item.read).length);
```

with its import:

```ts
import { useNotificationsStore } from '../../src/store/useNotificationsStore';
```

- [ ] **Step 4: Add bell styles to `apps/driver/src/styles/tabs/dashboard.styles.ts`**

Append to the `StyleSheet.create` object:

```ts
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.panel,
  },
```

- [ ] **Step 5: Manual verification**

```bash
npm --workspace apps/driver run start -- --web
```

Expected: Dashboard shows a bell icon between the name and the availability toggle; tapping it opens Notifications (empty state, since nothing populates this store yet — consistent with the "no invented data" rule; a real notification source is `docs/DRIVER_TODO.MD` step 16). Stop the server.

- [ ] **Step 6: Commit**

```bash
git add apps/driver/app/notifications.tsx apps/driver/src/styles/notifications.styles.ts apps/driver/app/\(tabs\)/dashboard.tsx apps/driver/src/styles/tabs/dashboard.styles.ts
git commit -m "driver: add notifications screen and dashboard bell icon"
```

---

### Task 24: Final integration verification

**Files:** none (verification only).

- [ ] **Step 1: Full workspace typecheck**

```bash
npm run typecheck
```

Expected: PASS with zero errors across every workspace, including `apps/driver`.

- [ ] **Step 2: Full driver test suite**

```bash
npm run test:driver
```

Expected: PASS, 11 total — the pre-existing `sample.test.js` scaffold plus 3 cases from Task 7 and 7 cases from Task 8.

- [ ] **Step 3: Full services test suite (confirms Task 2's fix didn't regress passenger)**

```bash
npm run test:services
```

Expected: PASS.

- [ ] **Step 4: End-to-end manual walkthrough**

```bash
npm --workspace apps/driver run start -- --web
```

Walk the full golden path in one session:

1. Splash → Login (shows "Register as driver")
2. Register a new driver account → consent screen appears
3. Accept consent → location prompt appears (grant or dismiss)
4. Land on Dashboard: name, offline status, 4 stat tiles at zero/dash
5. Toggle available ON → "Listening for ride requests…" → within ~15s a request card appears
6. Switch to the Requests tab → confirm the same request is listed there
7. Accept the request → lands on Active Trip
8. For a cash trip: confirm "Complete trip" is disabled until the cash toggle is confirmed, then enables; for a gcash trip: confirm it's enabled immediately
9. Complete the trip → returns to Dashboard; Trips today and Earnings today both incremented
10. Trip History tab shows the completed trip with a "Done" badge and correct fare
11. Earnings tab shows the same amount in "Total earnings (tracked)"; tap "Notify PSO for settlement" → a "Logged" row appears
12. Profile tab → Edit → change name → Done → confirm it persists (real Supabase write)
13. Profile → Documents & tricycle info → upload a photo for one document type → its badge flips to "Pending"
14. Profile → Settings → toggle each control, cycle language, tap Log out → confirm modal → confirms logout returns to Login
15. Log back in → confirm consent is not re-prompted (already accepted) and Dashboard loads directly

Confirm zero red-screen crashes and zero unstyled/system-font text (a Poppins load failure) anywhere in the walkthrough.

- [ ] **Step 5: Final commit (only if Step 4 required fixes)**

If the walkthrough surfaced any bug fixes, stage and commit them individually with descriptive messages — do not bundle unrelated fixes into one commit. If Step 4 passed clean with no changes needed, there is nothing to commit for this task.
