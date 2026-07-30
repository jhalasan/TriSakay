# Consent Gate + Location Permission (Passenger App) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the passenger app behind an auditable Terms of Service / Privacy Policy acceptance recorded in `public.user_consents`, and add a foreground location-permission prompt that re-checks on every app resume and disables (never hides) location-dependent actions while permission is missing.

**Architecture:** Consent read/write lives in `packages/services` as pure TypeScript over the existing Supabase client singleton, with the policy versions as two exported constants. A `useConsentStore` Zustand store feeds a new full-screen `/consent` route and a third branch in the root layout's existing `useProtectedRoute` gate. Location permission lives in one Zustand-backed hook in the passenger app that registers a single module-level `AppState` listener, feeding a `transparentModal` route and a shared inline-notice component.

**Tech Stack:** `expo-location` (version resolved by `npx expo install` for Expo SDK 54), `@supabase/supabase-js` 2.111.0, expo-router 6, Zustand 5, TypeScript strict, `node --test` for `packages/services`.

## Global Constraints

- **Read the versioned docs first.** Per `AGENTS.md`, consult https://docs.expo.dev/versions/v54.0.0/sdk/location/ before writing any `expo-location` code. The confirmed v54 surface this plan is built on: `Location.getForegroundPermissionsAsync()` and `Location.requestForegroundPermissionsAsync()` both return `Promise<Location.LocationPermissionResponse>` with fields `status`, `granted: boolean`, `canAskAgain: boolean`, `expires`, and optional `ios`.
- **Strict TypeScript, no `any`.** The one exception is the existing `packages/services/tests/*.ts` files, which already use `any` for captured fake-client arguments — match the surrounding style there and nowhere else.
- **No new libraries.** This repo has no React Hook Form, no Zod, no Jest, and no React Native Testing Library. Do not add any of them. Forms use `useState` plus the predicates in `apps/passenger/src/utils/validation.ts`.
- **`packages/services` must not import React Native or `expo-*` code.** It runs under plain `node --test`. Location code goes in the passenger app only.
- **`packages/services` import extensions:** inside `packages/services/src` and `packages/services/tests`, every relative *value* import needs an explicit `.ts` extension (`from '../supabase/client.ts'`). `import type` is erased and needs none. App-side imports of `@trisakay/services` are resolved by Metro and must not have extensions.
- **Generated file:** `packages/services/src/supabase/database.types.ts` is machine-generated. Never hand-edit it; regenerate via the Supabase MCP `generate_typescript_types` tool.
- **Styling:** every screen/component gets a co-located `*.styles.ts` using `StyleSheet.create` and tokens from `@trisakay/ui` (`colors`, `spacing`, `radius`, `typography`, `elevation`). No inline literal colors, no new design patterns. Control boundaries use `colors.lineStrong` (3.46:1), never `colors.line` (decorative only).
- **Policy versions** are `'v1.0'` for both ToS and Privacy in this plan.
- **Exact user-facing copy** (do not reword):
  - Location prompt body: `TriSakay needs your location to match you with nearby drivers and estimate pickup accurately.`
  - Inline disabled notice: `Location required — tap to enable`
  - Consent checkbox: `I have read and accept the Terms of Service and Privacy Policy`
  - Consent primary button: `Accept & Continue`
- **Out of scope — do not touch:** `apps/driver`, `apps/admin`, any schema or RLS change, background/`always` location permission, actually consuming the location once granted, and `app/booking/set-destination.tsx` (destination search does not need GPS).
- Live Supabase project: `ygdgbvxxqrkxlezpckif`. `public.user_consents` already exists with RLS enabled — no migration is needed.
- Verification commands: `npm run typecheck` (root, runs `tsc -b`) and `npm run test:services`.

---

### Task 1: Consent service in `packages/services`

**Files:**
- Modify: `packages/services/src/supabase/database.types.ts` (regenerate)
- Create: `packages/services/src/consents/index.ts`
- Modify: `packages/services/src/index.ts`
- Modify: `packages/services/tests/fakeSupabaseClient.ts`
- Test: `packages/services/tests/consents.test.ts`

**Interfaces:**
- Consumes: `getSupabaseClient()` from `../supabase/client.ts`, `type Database` from `../supabase/database.types`.
- Produces: `CURRENT_TOS_VERSION: string`, `CURRENT_PRIVACY_VERSION: string`, `type PolicyType = 'terms_of_service' | 'privacy_policy'`, `type UserConsentRow`, `type UserConsentInsert`, `interface ConsentStatus { termsAccepted: boolean; privacyAccepted: boolean; bothAccepted: boolean }`, `getConsentStatus(): Promise<{ status: ConsentStatus | null; error: string | null }>`, `recordConsent(): Promise<{ error: string | null }>`. All re-exported from the `@trisakay/services` package root.

- [ ] **Step 1: Regenerate the database types and inspect the diff**

The checked-in types cover 15 tables but not `user_consents` — they predate the full `SCHEMA.MD` apply. Regenerate using the Supabase MCP tool `generate_typescript_types` with `project_id: "ygdgbvxxqrkxlezpckif"`, and overwrite `packages/services/src/supabase/database.types.ts` with the result.

Then inspect what changed:

```bash
git diff --stat packages/services/src/supabase/database.types.ts
git diff packages/services/src/supabase/database.types.ts | grep -E '^[-+]\s{6}\w+: \{'
```

Expected: `user_consents` appears as an addition. **If any table other than `user_consents` was added, removed, or changed, stop and report it** — that is unreviewed schema drift, not part of this task.

Confirm the new table block exists:

```bash
grep -n "user_consents" packages/services/src/supabase/database.types.ts | head -5
```

- [ ] **Step 2: Extend the fake Supabase client to model the consents table**

The existing fake only models `.select().eq().single()` and `.update().eq()`, and its `from()` ignores the table name. Consents need `.select().eq().in()` resolving to an array, and `.insert()`. Replace the whole file with:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/supabase/database.types';

export interface FakeConsentRow {
  policy_type: string;
  policy_version: string;
}

export interface FakeClientConfig {
  signUp?: (args: unknown) => Promise<{ data: { session: unknown }; error: { message: string } | null }>;
  signInWithPassword?: (
    args: unknown
  ) => Promise<{ data: { session: unknown }; error: { message: string } | null }>;
  getSession?: () => Promise<{ data: { session: unknown } }>;
  signOut?: () => Promise<void>;
  userRow?: Record<string, unknown> | null;
  updateError?: string | null;
  /** Rows `user_consents` selects resolve to. */
  consentRows?: FakeConsentRow[];
  consentSelectError?: string | null;
  consentInsertError?: string | null;
  /** Receives the array passed to `.insert()`, so tests can assert the payload shape. */
  onConsentInsert?: (rows: unknown) => void;
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

  const usersTable = {
    select: usersQuery.select,
    eq: usersQuery.eq,
    single: usersQuery.single,
    update: () => updateQuery,
  };

  // `.in()` terminates the consent query, so it is the only awaitable link.
  const consentsQuery = {
    select: () => consentsQuery,
    eq: () => consentsQuery,
    in: async () =>
      config.consentSelectError
        ? { data: null, error: { message: config.consentSelectError } }
        : { data: config.consentRows ?? [], error: null },
  };

  const consentsTable = {
    select: consentsQuery.select,
    insert: async (rows: unknown) => {
      config.onConsentInsert?.(rows);
      return { error: config.consentInsertError ? { message: config.consentInsertError } : null };
    },
  };

  const from = (table: string) => (table === 'user_consents' ? consentsTable : usersTable);

  return { auth, from } as unknown as SupabaseClient<Database>;
}
```

- [ ] **Step 3: Run the existing service tests to confirm the fake rewrite broke nothing**

Run: `npm run test:services`
Expected: PASS — all existing `auth.test.ts` and `client.test.ts` tests still green. The `from()` change is backward compatible because the auth service only ever calls `from('users')`.

- [ ] **Step 4: Write the failing consent tests**

Create `packages/services/tests/consents.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TOS_VERSION,
  getConsentStatus,
  recordConsent,
} from '../src/consents/index.ts';

const SESSION = { data: { session: { user: { id: 'u1' } } } };

test('getConsentStatus reports bothAccepted when both current versions are on file', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      consentRows: [
        { policy_type: 'terms_of_service', policy_version: CURRENT_TOS_VERSION },
        { policy_type: 'privacy_policy', policy_version: CURRENT_PRIVACY_VERSION },
      ],
    })
  );

  const { status, error } = await getConsentStatus();
  assert.equal(error, null);
  assert.deepEqual(status, { termsAccepted: true, privacyAccepted: true, bothAccepted: true });
});

test('getConsentStatus treats a stale policy version as not accepted', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      consentRows: [
        { policy_type: 'terms_of_service', policy_version: 'v0.9' },
        { policy_type: 'privacy_policy', policy_version: CURRENT_PRIVACY_VERSION },
      ],
    })
  );

  const { status } = await getConsentStatus();
  assert.equal(status?.termsAccepted, false);
  assert.equal(status?.privacyAccepted, true);
  assert.equal(status?.bothAccepted, false);
});

test('getConsentStatus reports nothing accepted when the user has no consent rows', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ getSession: async () => SESSION, consentRows: [] })
  );

  const { status, error } = await getConsentStatus();
  assert.equal(error, null);
  assert.deepEqual(status, { termsAccepted: false, privacyAccepted: false, bothAccepted: false });
});

test('getConsentStatus surfaces a query error instead of reporting a false status', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ getSession: async () => SESSION, consentSelectError: 'network down' })
  );

  const { status, error } = await getConsentStatus();
  assert.equal(status, null);
  assert.equal(error, 'network down');
});

test('getConsentStatus reports an error when there is no active session', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ getSession: async () => ({ data: { session: null } }) })
  );

  const { status, error } = await getConsentStatus();
  assert.equal(status, null);
  assert.equal(error, 'Not signed in');
});

test('recordConsent inserts both policy rows in one call and lets the database set accepted_at', async () => {
  let captured: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => SESSION,
      onConsentInsert: (rows) => {
        captured = rows;
      },
    })
  );

  const { error } = await recordConsent();
  assert.equal(error, null);
  assert.equal(captured.length, 2);
  assert.deepEqual(captured, [
    { user_id: 'u1', policy_type: 'terms_of_service', policy_version: CURRENT_TOS_VERSION },
    { user_id: 'u1', policy_type: 'privacy_policy', policy_version: CURRENT_PRIVACY_VERSION },
  ]);
  // accepted_at must come from the column default (the database clock), not the client.
  assert.equal('accepted_at' in captured[0], false);
});

test('recordConsent returns the error message when the insert fails', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ getSession: async () => SESSION, consentInsertError: 'insert failed' })
  );

  const { error } = await recordConsent();
  assert.equal(error, 'insert failed');
});

test('recordConsent returns an error when there is no active session', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ getSession: async () => ({ data: { session: null } }) })
  );

  const { error } = await recordConsent();
  assert.equal(error, 'Not signed in');
});
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npm run test:services`
Expected: FAIL — `Cannot find module '../src/consents/index.ts'`.

- [ ] **Step 6: Write the consent service**

Create `packages/services/src/consents/index.ts`:

```ts
import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types';

/**
 * Bumping either constant re-opens the consent gate for every user: the check
 * below compares these against the versions already recorded in
 * `public.user_consents`, so forcing re-consent is a one-line change here.
 */
export const CURRENT_TOS_VERSION = 'v1.0';
export const CURRENT_PRIVACY_VERSION = 'v1.0';

export type PolicyType = 'terms_of_service' | 'privacy_policy';

export type UserConsentRow = Database['public']['Tables']['user_consents']['Row'];
export type UserConsentInsert = Database['public']['Tables']['user_consents']['Insert'];

export interface ConsentStatus {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  bothAccepted: boolean;
}

async function getSignedInUserId(): Promise<string | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * Existence of a row at the current version is equivalent to "the most recent
 * acceptance is current": `user_consents` is append-only and versions only move
 * forward, so nothing can supersede a row already at the current version.
 *
 * Versions are compared in TypeScript rather than as a PostgREST `.or(and(...))`
 * filter — it keeps the constants out of a filter string, and the row set is a
 * handful of rows per user.
 */
export async function getConsentStatus(): Promise<{ status: ConsentStatus | null; error: string | null }> {
  const userId = await getSignedInUserId();
  if (!userId) return { status: null, error: 'Not signed in' };

  const { data, error } = await getSupabaseClient()
    .from('user_consents')
    .select('policy_type, policy_version')
    .eq('user_id', userId)
    .in('policy_type', ['terms_of_service', 'privacy_policy']);

  if (error) return { status: null, error: error.message };

  const rows = data ?? [];
  const hasAccepted = (policyType: PolicyType, version: string): boolean =>
    rows.some((row) => row.policy_type === policyType && row.policy_version === version);

  const termsAccepted = hasAccepted('terms_of_service', CURRENT_TOS_VERSION);
  const privacyAccepted = hasAccepted('privacy_policy', CURRENT_PRIVACY_VERSION);

  return {
    status: { termsAccepted, privacyAccepted, bothAccepted: termsAccepted && privacyAccepted },
    error: null,
  };
}

export async function recordConsent(): Promise<{ error: string | null }> {
  const userId = await getSignedInUserId();
  if (!userId) return { error: 'Not signed in' };

  // Both rows in one statement, so a dropped connection can never leave a user
  // consented to one policy and not the other. `accepted_at` is deliberately
  // omitted: the column's `default now()` uses the database clock, which is the
  // one worth defending in an audit — a client clock is trivially wrong.
  const rows: UserConsentInsert[] = [
    { user_id: userId, policy_type: 'terms_of_service', policy_version: CURRENT_TOS_VERSION },
    { user_id: userId, policy_type: 'privacy_policy', policy_version: CURRENT_PRIVACY_VERSION },
  ];

  const { error } = await getSupabaseClient().from('user_consents').insert(rows);
  return { error: error?.message ?? null };
}
```

- [ ] **Step 7: Re-export the module from the package root**

Modify `packages/services/src/index.ts` — add the consents line alongside the existing exports:

```ts
export * from './supabase';
export * from './auth';
export * from './booking';
export * from './consents';
export * from './notifications';
export * from './location';
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm run test:services`
Expected: PASS — all consent tests plus the pre-existing auth/client tests.

Then: `npm run typecheck`
Expected: PASS with no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/services/src/consents packages/services/src/index.ts packages/services/src/supabase/database.types.ts packages/services/tests/consents.test.ts packages/services/tests/fakeSupabaseClient.ts
git commit -m "feat(services): add consent service backed by user_consents"
```

---

### Task 2: `Checkbox` primitive in `packages/ui`

**Files:**
- Create: `packages/ui/src/components/Checkbox/Checkbox.tsx`
- Create: `packages/ui/src/components/Checkbox/Checkbox.styles.ts`
- Create: `packages/ui/src/components/Checkbox/index.ts`
- Modify: `packages/ui/src/components/index.ts`

**Interfaces:**
- Produces: `Checkbox` component and `CheckboxProps { checked: boolean; onChange: (checked: boolean) => void; label?: string }` (extends `Omit<PressableProps, 'style' | 'onPress'>`), exported from `@trisakay/ui`.

There is no test framework for `packages/ui`; this task is verified by `npm run typecheck` and visually in Task 4.

- [ ] **Step 1: Write the component**

Create `packages/ui/src/components/Checkbox/Checkbox.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View, type PressableProps } from 'react-native';
import { colors } from '../../theme';
import { styles } from './Checkbox.styles';

export interface CheckboxProps extends Omit<PressableProps, 'style' | 'onPress'> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function Checkbox({ checked, onChange, label, disabled = false, ...pressableProps }: CheckboxProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [styles.row, pressed && !disabled && styles.rowPressed, disabled && styles.disabled]}
      {...pressableProps}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <Ionicons name="checkmark" size={16} color={colors.white} />}
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </Pressable>
  );
}
```

- [ ] **Step 2: Write the styles**

Create `packages/ui/src/components/Checkbox/Checkbox.styles.ts`:

```ts
import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowPressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.45,
  },
  /** 24px with a 44px effective target via the row's hitSlop — the box itself
   *  stays small so it reads as a checkbox rather than a button. */
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.lineStrong, // control boundary, not a divider
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  label: {
    ...typography.body,
    color: colors.ink,
    flex: 1,
  },
});
```

- [ ] **Step 3: Add the barrel files**

Create `packages/ui/src/components/Checkbox/index.ts`:

```ts
export * from './Checkbox';
```

Modify `packages/ui/src/components/index.ts` — insert the `Checkbox` line so the list stays alphabetical (between `Card` and `ConfirmModal`):

```ts
export * from './Card';
export * from './Checkbox';
export * from './ConfirmModal';
```

- [ ] **Step 4: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS with no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Checkbox packages/ui/src/components/index.ts
git commit -m "feat(ui): add Checkbox primitive"
```

---

### Task 3: Consent store and consent screen

**Files:**
- Create: `apps/passenger/src/store/useConsentStore.ts`
- Create: `apps/passenger/app/consent.tsx`
- Create: `apps/passenger/app/consent.styles.ts`

**Interfaces:**
- Consumes: `getConsentStatus()`, `recordConsent()`, `CURRENT_TOS_VERSION`, `CURRENT_PRIVACY_VERSION` from `@trisakay/services` (Task 1); `Checkbox` from `@trisakay/ui` (Task 2).
- Produces: `useConsentStore` and `type ConsentGateStatus = 'unknown' | 'checking' | 'accepted' | 'required'`. Store shape: `{ status: ConsentGateStatus; error: string | null; check: () => Promise<void>; accept: () => Promise<boolean>; reset: () => void }`. Task 4 depends on all of these.

The route is not yet reachable at the end of this task — Task 4 wires the gate. Verify with `npm run typecheck`.

> **Naming note:** the store's status type is `ConsentGateStatus`, deliberately *not* `ConsentStatus` — `@trisakay/services` already exports an interface by that name (Task 1) and both are imported into this app.

- [ ] **Step 1: Write the store**

Create `apps/passenger/src/store/useConsentStore.ts`:

```ts
import { create } from 'zustand';
import { getConsentStatus, recordConsent } from '@trisakay/services';

export type ConsentGateStatus = 'unknown' | 'checking' | 'accepted' | 'required';

interface ConsentState {
  status: ConsentGateStatus;
  error: string | null;
  check: () => Promise<void>;
  /** Resolves true only on a confirmed write — never optimistically. */
  accept: () => Promise<boolean>;
  reset: () => void;
}

export const useConsentStore = create<ConsentState>()((set) => ({
  status: 'unknown',
  error: null,

  check: async () => {
    // Set synchronously so concurrent callers (the root layout and the splash
    // screen both trigger this on cold start) see 'checking' and skip.
    set({ status: 'checking', error: null });

    const { status, error } = await getConsentStatus();

    if (error || !status) {
      // Fail closed. An unverifiable consent state is treated as not accepted,
      // so a network blip can never let a user past a legal gate. Re-accepting
      // costs nothing — user_consents is append-only.
      set({ status: 'required', error: error ?? 'Could not verify your acceptance.' });
      return;
    }

    set({ status: status.bothAccepted ? 'accepted' : 'required', error: null });
  },

  accept: async () => {
    set({ error: null });
    const { error } = await recordConsent();
    if (error) {
      set({ error });
      return false;
    }
    set({ status: 'accepted', error: null });
    return true;
  },

  reset: () => set({ status: 'unknown', error: null }),
}));
```

- [ ] **Step 2: Write the consent screen**

Create `apps/passenger/app/consent.tsx`. The ToS/Privacy body is explicitly marked placeholder copy — real text is being finalised separately and drops into `POLICY_BODY` unchanged.

```tsx
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Checkbox } from '@trisakay/ui';
import { CURRENT_PRIVACY_VERSION, CURRENT_TOS_VERSION } from '@trisakay/services';
import { useConsentStore } from '../src/store/useConsentStore';
import { styles } from './consent.styles';

/** Placeholder. Final legal copy is being drafted separately and replaces this verbatim. */
const POLICY_BODY = [
  'Placeholder — Terms of Service. By using TriSakay you agree to book rides in good faith, to treat drivers with respect, and to pay the fare shown at the end of each trip. Fares follow City Ordinance No. 08, s. 2023.',
  'Placeholder — Privacy Policy. TriSakay collects only what a ride needs. The summary below is the short version; the full policy will describe each item, how long it is kept, and how to request deletion.',
  'Placeholder — Limitations. TriSakay is a prototype built for academic evaluation in Barangay Dadiangas West. Service availability is best-effort and carries no formal guarantee.',
];

/** FR-11.2 — the four disclosures that must be stated in plain language. */
const DISCLOSURES: { title: string; body: string }[] = [
  {
    title: 'Your name and contact number',
    body: 'Shared with your driver only after you are matched, and only for that ride.',
  },
  {
    title: 'Your live location',
    body: 'Used only while a ride is active. TriSakay does not keep a trail of where you go.',
  },
  {
    title: 'Ride and payment history',
    body: 'Kept on your account. PSO staff can see it as part of overseeing the tricycle service.',
  },
  {
    title: 'Payment details',
    body: 'Sent to GCash to process your payment. TriSakay never stores your GCash credentials.',
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
    const saved = await accept();
    setSubmitting(false);
    // Only navigate on a confirmed write. On failure the store's `error` is
    // already set and renders below the button, and the user can retry.
    if (saved) router.replace('/(tabs)/home');
  }

  return (
    // No ScreenHeader: it renders a back chevron by default, and there is
    // nothing to go back to from a gate.
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Before you ride</Text>
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
        <Button
          label="Accept & Continue"
          fullWidth
          disabled={!checked}
          loading={submitting}
          onPress={handleAccept}
        />
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Write the styles**

Create `apps/passenger/app/consent.styles.ts`:

```ts
import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  title: {
    ...typography.h1,
    color: colors.ink,
  },
  version: {
    ...typography.caption,
    color: colors.inkSoft,
  },
  /** Explicit flex: a ScrollView between fixed siblings otherwise sizes to content. */
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  paragraph: {
    ...typography.body,
    color: colors.inkSoft,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.inkSoft,
    marginTop: spacing.md,
  },
  disclosureCard: {
    padding: 0,
  },
  disclosureRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  disclosureRowDivided: {
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  disclosureTitle: {
    ...typography.bodyStrong,
    color: colors.ink,
  },
  disclosureBody: {
    ...typography.caption,
    color: colors.inkSoft,
  },
  /** Pinned so the primary action stays reachable no matter how long the policy runs. */
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    backgroundColor: colors.panel,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
});
```

- [ ] **Step 4: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS with no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/passenger/src/store/useConsentStore.ts apps/passenger/app/consent.tsx apps/passenger/app/consent.styles.ts
git commit -m "feat(passenger): add consent store and consent screen"
```

---

### Task 4: Wire the consent gate into routing

**Files:**
- Modify: `apps/passenger/app/_layout.tsx`
- Modify: `apps/passenger/app/splash.tsx`

**Interfaces:**
- Consumes: `useConsentStore`, `ConsentGateStatus` from Task 3.
- Produces: the `/consent` route registered on the root `Stack`; a reachable, testable consent flow.

- [ ] **Step 1: Extend the route gate in `_layout.tsx`**

Replace the `useProtectedRoute` function and add a consent-sync hook beside it. The auth branch keeps priority; the new consent branches only run for an authenticated user:

```tsx
function useProtectedRoute(isAuthenticated: boolean, consentStatus: ConsentGateStatus) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const root = segments[0] as string | undefined;
    const isSplashOrRoot = root === undefined || root === 'splash';
    if (isSplashOrRoot) return;

    const inAuthGroup = root === '(auth)';
    const onConsent = root === 'consent';

    if (!isAuthenticated) {
      if (!inAuthGroup) router.replace('/(auth)/login');
      return;
    }

    // Consent is still resolving. Hold position rather than routing on an
    // intermediate status — moving now would flash Home before bouncing to
    // /consent, showing a screen the user is not yet entitled to see.
    if (consentStatus === 'unknown' || consentStatus === 'checking') return;

    if (consentStatus === 'required') {
      if (!onConsent) router.replace('/consent');
    } else if (inAuthGroup || onConsent) {
      router.replace('/(tabs)/home');
    }
  }, [isAuthenticated, consentStatus, segments, router]);
}

/**
 * Drives the consent check from the auth state rather than from inside
 * useConsentStore, so consent stays decoupled from useAuthStore's internals.
 * Resetting on sign-out matters: without it a second user signing in on the
 * same device would inherit the first user's `accepted`.
 */
function useConsentSync(isAuthenticated: boolean) {
  const check = useConsentStore((state) => state.check);
  const reset = useConsentStore((state) => state.reset);

  useEffect(() => {
    if (!isAuthenticated) {
      reset();
      return;
    }
    // Read through getState so an already-running check is not restarted on
    // every re-render.
    if (useConsentStore.getState().status === 'unknown') void check();
  }, [isAuthenticated, check, reset]);
}
```

Add the imports at the top of the file:

```tsx
import { useConsentStore, type ConsentGateStatus } from '../src/store/useConsentStore';
```

Update `RootLayout` to read the status, call both hooks, and register the route:

```tsx
export default function RootLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const consentStatus = useConsentStore((state) => state.status);
  useConsentSync(isAuthenticated);
  useProtectedRoute(isAuthenticated, consentStatus);

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
          <Stack.Screen name="consent" />
          <Stack.Screen
            name="logout"
            options={{ presentation: 'transparentModal', animation: 'fade' }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

Also update the doc comment above `useProtectedRoute` so it still describes what the function does:

```tsx
/**
 * expo-router@6 has no built-in Protected-route API in this SDK, so the
 * auth gate is the manual segment-watching pattern from Expo's own docs:
 * splash owns its own timed redirect, this effect is the safety net for
 * deep links, back-navigation, and logout/login transitions. It gates on
 * two things in order — authentication first, then consent (FR-11.1).
 */
```

- [ ] **Step 2: Make the splash screen await the consent check**

Modify `apps/passenger/app/splash.tsx`. Add the import and a second wait helper beside the existing `waitUntilHydrated`:

```tsx
import { useConsentStore, type ConsentGateStatus } from '../src/store/useConsentStore';

/**
 * Resolves once consent is known. Kicks off the check itself when nothing has
 * started one — the root layout normally does, but splash must not depend on
 * that ordering or it could wait forever.
 */
function waitUntilConsentResolved(): Promise<ConsentGateStatus> {
  const isSettled = (status: ConsentGateStatus) => status === 'accepted' || status === 'required';

  const current = useConsentStore.getState().status;
  if (isSettled(current)) return Promise.resolve(current);
  if (current === 'unknown') void useConsentStore.getState().check();

  return new Promise((resolve) => {
    const unsubscribe = useConsentStore.subscribe((state) => {
      if (isSettled(state.status)) {
        unsubscribe();
        resolve(state.status);
      }
    });
  });
}
```

Replace the body of the effect's async IIFE:

```tsx
(async () => {
  await Promise.all([wait(1400), waitUntilHydrated()]);
  if (cancelled) return;

  if (!useAuthStore.getState().isAuthenticated) {
    router.replace('/(auth)/login');
    return;
  }

  const consentStatus = await waitUntilConsentResolved();
  if (cancelled) return;
  router.replace(consentStatus === 'accepted' ? '/(tabs)/home' : '/consent');
})();
```

- [ ] **Step 3: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS with no errors.

- [ ] **Step 4: Verify the consent flow end to end against the live project**

Start the app: `npm run start:passenger`, then open it on a device or in the browser.

Check each of these:
1. Log in as an existing user with no consent rows → lands on the consent screen, **not** Home.
2. "Accept & Continue" is disabled until the checkbox is ticked.
3. Accepting navigates to Home. Confirm exactly two rows were written, with `accepted_at` populated by the database:
   ```sql
   select user_id, policy_type, policy_version, accepted_at
   from public.user_consents order by accepted_at desc limit 4;
   ```
   (Run via the Supabase MCP `execute_sql` tool against project `ygdgbvxxqrkxlezpckif`.)
4. Fully restart the app → goes straight to Home, no consent screen.
5. Turn off networking, then restart → the consent screen renders with the "Could not verify your acceptance." message rather than silently reaching Home.
6. Temporarily change `CURRENT_TOS_VERSION` to `'v1.1'` in `packages/services/src/consents/index.ts`, restart → the consent screen returns. **Revert it to `'v1.0'` before committing.**
7. Log out → back to login, and logging in as a different user re-runs the check rather than inheriting the previous user's state.

- [ ] **Step 5: Commit**

```bash
git add apps/passenger/app/_layout.tsx apps/passenger/app/splash.tsx
git commit -m "feat(passenger): gate the app behind ToS and privacy consent"
```

---

### Task 5: `expo-location` setup and the `useLocationPermission` hook

**Files:**
- Modify: `apps/passenger/package.json` (via `expo install`)
- Modify: `apps/passenger/app.json`
- Create: `apps/passenger/src/hooks/useLocationPermission.ts`

**Interfaces:**
- Produces: `type LocationPermissionState = 'unknown' | 'granted' | 'denied' | 'blocked'`; `useLocationPermission(): { state: LocationPermissionState; isGranted: boolean; dismissedThisForeground: boolean; refresh: () => Promise<LocationPermissionState>; request: () => Promise<LocationPermissionState>; dismiss: () => void }`; and `useLocationPermissionStore` for non-React `.getState()` access. Tasks 6 and 7 consume these.

- [ ] **Step 1: Read the versioned docs**

Read https://docs.expo.dev/versions/v54.0.0/sdk/location/ before writing code, per `AGENTS.md`. Confirm `LocationPermissionResponse` still carries `granted` and `canAskAgain`, which the state mapping below depends on.

- [ ] **Step 2: Install expo-location into the passenger workspace**

Run from `apps/passenger` (not the repo root — `expo install` resolves the version against that app's Expo SDK):

```bash
cd apps/passenger && npx expo install expo-location
```

Verify it landed in the right `package.json`:

```bash
grep -n "expo-location" apps/passenger/package.json
```
Expected: a version line under `dependencies`. Do **not** hand-edit the version.

- [ ] **Step 3: Add the config plugin**

Modify `apps/passenger/app.json` — replace the `plugins` array:

```json
"plugins": [
  "expo-router",
  [
    "expo-location",
    {
      "locationWhenInUsePermission": "TriSakay needs your location to match you with nearby drivers and estimate pickup accurately."
    }
  ]
]
```

`locationWhenInUsePermission` is iOS-only; the plugin adds Android's `ACCESS_FINE_LOCATION` automatically. Only foreground permission is requested — NFR-2.5 forbids continuous background tracking.

- [ ] **Step 4: Write the hook**

Create `apps/passenger/src/hooks/useLocationPermission.ts`:

```ts
import { AppState, Linking, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { create } from 'zustand';

/**
 * 'blocked' means denied with canAskAgain === false — the OS will not show the
 * permission dialog again, so the only remaining route is system Settings.
 * 'unknown' means the status could not be read; it is never treated as granted.
 */
export type LocationPermissionState = 'unknown' | 'granted' | 'denied' | 'blocked';

interface LocationPermissionStore {
  state: LocationPermissionState;
  /** "Not now" suppresses the automatic prompt for this foreground session only. Never persisted. */
  dismissedThisForeground: boolean;
  refresh: () => Promise<LocationPermissionState>;
  request: () => Promise<LocationPermissionState>;
  dismiss: () => void;
}

function toState(response: Location.LocationPermissionResponse): LocationPermissionState {
  if (response.granted) return 'granted';
  return response.canAskAgain ? 'denied' : 'blocked';
}

export const useLocationPermissionStore = create<LocationPermissionStore>()((set, get) => ({
  state: 'unknown',
  dismissedThisForeground: false,

  refresh: async () => {
    let next: LocationPermissionState;
    try {
      next = toState(await Location.getForegroundPermissionsAsync());
    } catch {
      // A read that throws must never be interpreted as granted — staying
      // 'unknown' keeps location-dependent actions disabled rather than
      // letting the user into a flow that cannot work.
      next = 'unknown';
    }
    set({ state: next });
    return next;
  },

  request: async () => {
    if (get().state === 'blocked') {
      // The OS will not prompt again; send the user to system Settings instead
      // of firing a request that silently resolves to denied.
      await Linking.openSettings().catch(() => {});
      return 'blocked';
    }

    let next: LocationPermissionState;
    try {
      next = toState(await Location.requestForegroundPermissionsAsync());
    } catch {
      next = 'unknown';
    }
    set({ state: next });
    return next;
  },

  dismiss: () => set({ dismissedThisForeground: true }),
}));

/**
 * One listener for the whole app, registered at module load — the same idiom
 * useAuthStore uses for onAuthStateChange. Re-reading on every foreground is
 * what makes a permission granted in system Settings take effect on return,
 * with no reinstall and no cold start.
 */
let previousAppState: AppStateStatus = AppState.currentState;
AppState.addEventListener('change', (nextAppState) => {
  const returningToForeground = previousAppState !== 'active' && nextAppState === 'active';
  previousAppState = nextAppState;
  if (!returningToForeground) return;

  useLocationPermissionStore.setState({ dismissedThisForeground: false });
  void useLocationPermissionStore.getState().refresh();
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

- [ ] **Step 5: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS with no errors. If `Location.LocationPermissionResponse` is not found, re-check the v54 docs for the exact exported type name before changing anything else.

- [ ] **Step 6: Commit**

```bash
git add apps/passenger/package.json apps/passenger/app.json apps/passenger/src/hooks/useLocationPermission.ts package-lock.json
git commit -m "feat(passenger): add expo-location and useLocationPermission hook"
```

---

### Task 6: Location permission modal route and auto-prompt

**Files:**
- Create: `apps/passenger/app/location-permission.tsx`
- Create: `apps/passenger/app/location-permission.styles.ts`
- Modify: `apps/passenger/app/_layout.tsx`

**Interfaces:**
- Consumes: `useLocationPermission` from Task 5; `ConsentGateStatus` and `useConsentStore` from Tasks 3–4.
- Produces: the `/location-permission` route, pushed automatically on resume and reachable directly from the inline notices in Task 7.

- [ ] **Step 1: Write the modal screen**

Create `apps/passenger/app/location-permission.tsx`. It matches the established modal pattern exactly — `logout.tsx` is a `transparentModal` route rendering an RN `Modal` with `transparent animationType="fade"` and `onRequestClose`. It uses its own card rather than `ConfirmModal` because it needs an icon, a third line of copy, and a state-dependent primary label; the backdrop, card, and typography styles are copied from `ConfirmModal.styles.ts` so it reads as the same component family.

Wiring `onRequestClose` to "Not now" is what makes the Android hardware back button behave like the dismiss button instead of stranding the modal.

```tsx
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Modal, Text, View } from 'react-native';
import { Button, colors } from '@trisakay/ui';
import { useLocationPermission } from '../src/hooks/useLocationPermission';
import { styles } from './location-permission.styles';

export default function LocationPermissionScreen() {
  const router = useRouter();
  const { state, request, dismiss } = useLocationPermission();
  const [working, setWorking] = useState(false);

  const isBlocked = state === 'blocked';

  async function handleEnable() {
    setWorking(true);
    const next = await request();
    setWorking(false);
    // Close only on success. After a fresh denial the sheet stays up and the
    // primary button re-labels to "Open settings", so the user can see why it
    // changed instead of the modal vanishing with nothing having happened.
    if (next === 'granted') router.dismiss();
  }

  function handleNotNow() {
    // Suppresses the automatic prompt until the next foreground — deliberately
    // not a permanent resolution.
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
              Location is turned off for TriSakay in your device settings. Open settings to turn it back on.
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Button
              label={isBlocked ? 'Open settings' : 'Enable location'}
              fullWidth
              loading={working}
              onPress={handleEnable}
            />
            <Button label="Not now" variant="ghost" tone="neutral" fullWidth onPress={handleNotNow} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: Write the styles**

Create `apps/passenger/app/location-permission.styles.ts`:

Values match `ConfirmModal.styles.ts` (backdrop, `maxWidth: 340`, `elevation.sheet`) so the two modals sit at the same visual depth:

```ts
import { StyleSheet } from 'react-native';
import { colors, elevation, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
    ...elevation.sheet,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h2,
    color: colors.ink,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  blockedNote: {
    ...typography.caption,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
```

- [ ] **Step 3: Register the route and add the auto-prompt effect in `_layout.tsx`**

Add the import:

```tsx
import { useLocationPermission } from '../src/hooks/useLocationPermission';
```

Add this hook beside `useConsentSync`:

```tsx
/**
 * Surfaces the permission prompt on every foreground while permission is
 * missing. The dismissal flag is cleared by the hook's AppState listener, so
 * "Not now" holds for this session only — FR-11.4 asks for a prompt on app
 * start, not a one-time prompt.
 */
function useLocationPrompt(isAuthenticated: boolean, consentStatus: ConsentGateStatus) {
  const segments = useSegments();
  const router = useRouter();
  const { state, dismissedThisForeground } = useLocationPermission();

  useEffect(() => {
    // Never prompt over the auth or consent gates — they come first.
    if (!isAuthenticated || consentStatus !== 'accepted') return;
    if (state === 'granted' || state === 'unknown') return;
    if (dismissedThisForeground) return;

    const root = segments[0] as string | undefined;
    if (root === undefined || root === 'splash' || root === 'location-permission') return;

    router.push('/location-permission');
  }, [isAuthenticated, consentStatus, state, dismissedThisForeground, segments, router]);
}
```

Call it from `RootLayout` after the other two, and register the route with the same presentation options `logout` uses:

```tsx
  useConsentSync(isAuthenticated);
  useProtectedRoute(isAuthenticated, consentStatus);
  useLocationPrompt(isAuthenticated, consentStatus);
```

```tsx
          <Stack.Screen name="index" />
          <Stack.Screen name="consent" />
          <Stack.Screen
            name="location-permission"
            options={{ presentation: 'transparentModal', animation: 'fade' }}
          />
          <Stack.Screen
            name="logout"
            options={{ presentation: 'transparentModal', animation: 'fade' }}
          />
```

- [ ] **Step 4: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS with no errors.

- [ ] **Step 5: Verify the permission flow on a real device**

`expo-location` needs a device or emulator — permission dialogs do not exist on web. Run `npm run start:passenger` and open on Android or iOS.

Check each of these:
1. First launch after consent → the prompt appears over Home.
2. "Not now" closes it and it does **not** immediately reappear while the app stays in the foreground.
3. Background the app and return → the prompt appears again.
4. "Enable location" → the OS dialog appears; granting closes the modal.
5. Deny twice on Android (or "Don't allow" on iOS) so the OS stops prompting → the primary button re-labels to "Open settings" and tapping it opens the app's system settings page.
6. Grant permission in system Settings, return to the app → the prompt does not reappear, with no restart.
7. On Android, the hardware back button closes the modal and behaves exactly like "Not now" — it does not reappear until the next foreground.

- [ ] **Step 6: Commit**

```bash
git add apps/passenger/app/location-permission.tsx apps/passenger/app/location-permission.styles.ts apps/passenger/app/_layout.tsx
git commit -m "feat(passenger): add location permission prompt shown on every resume"
```

---

### Task 7: Disable location-dependent actions

**Files:**
- Create: `apps/passenger/src/components/LocationRequiredNotice/LocationRequiredNotice.tsx`
- Create: `apps/passenger/src/components/LocationRequiredNotice/LocationRequiredNotice.styles.ts`
- Create: `apps/passenger/src/components/LocationRequiredNotice/index.ts`
- Modify: `apps/passenger/app/(tabs)/home.tsx`
- Modify: `apps/passenger/app/booking/confirm.tsx`

**Interfaces:**
- Consumes: `useLocationPermission` from Task 5; the `/location-permission` route from Task 6.
- Produces: `LocationRequiredNotice` — a self-contained notice that renders nothing when permission is granted, so call sites need no conditional of their own.

The notice is a component rather than repeated JSX because it appears on two screens; the project already keeps app-local components in `src/components/` (see `ScreenHeader`, `DriverInfoCard`).

- [ ] **Step 1: Write the notice component**

Create `apps/passenger/src/components/LocationRequiredNotice/LocationRequiredNotice.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { colors } from '@trisakay/ui';
import { useLocationPermission } from '../../hooks/useLocationPermission';
import { styles } from './LocationRequiredNotice.styles';

/**
 * Renders nothing once permission is granted, so call sites can drop it in
 * unconditionally next to the control it explains. Routes to the same prompt
 * the app shows on resume — tapping here bypasses the "Not now" dismissal,
 * which is the point: the user is asking for the feature right now.
 */
export function LocationRequiredNotice() {
  const router = useRouter();
  const { isGranted } = useLocationPermission();

  if (isGranted) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Location required — tap to enable"
      hitSlop={8}
      style={styles.row}
      onPress={() => router.push('/location-permission')}
    >
      <Ionicons name="location-outline" size={14} color={colors.danger} />
      <Text style={styles.text}>Location required — tap to enable</Text>
    </Pressable>
  );
}
```

- [ ] **Step 2: Write the styles and barrel file**

Create `apps/passenger/src/components/LocationRequiredNotice/LocationRequiredNotice.styles.ts`:

```ts
import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  text: {
    ...typography.caption,
    color: colors.danger,
  },
});
```

Create `apps/passenger/src/components/LocationRequiredNotice/index.ts`:

```ts
export * from './LocationRequiredNotice';
```

- [ ] **Step 3: Gate the Home CTA**

Modify `apps/passenger/app/(tabs)/home.tsx`. Add the imports:

```tsx
import { LocationRequiredNotice } from '../../src/components/LocationRequiredNotice';
import { useLocationPermission } from '../../src/hooks/useLocationPermission';
```

Add inside the component, beside the other store reads:

```tsx
  const { isGranted } = useLocationPermission();
```

Replace the pinned CTA block at the bottom of the screen:

```tsx
      {/* Pinned so the primary action stays reachable no matter what scrolls. */}
      <View style={styles.ctaWrap}>
        <Button
          label="Where to?"
          fullWidth
          disabled={!isGranted}
          onPress={() => router.push('/booking/set-destination')}
        />
        <LocationRequiredNotice />
      </View>
```

Disabled, not hidden: the rider can see the action exists and why it is unavailable.

- [ ] **Step 4: Gate the Request ride CTA**

Modify `apps/passenger/app/booking/confirm.tsx`. Add the imports:

```tsx
import { LocationRequiredNotice } from '../../src/components/LocationRequiredNotice';
import { useLocationPermission } from '../../src/hooks/useLocationPermission';
```

Add inside the component, beside the other store reads:

```tsx
  const { isGranted } = useLocationPermission();
```

Replace the footer block at the bottom of the screen:

```tsx
      <View style={styles.footer}>
        <Button label="Request ride" fullWidth disabled={!isGranted} onPress={handleRequestRide} />
        <LocationRequiredNotice />
      </View>
```

Leave `app/booking/set-destination.tsx` alone — searching for a destination does not need the device's location.

- [ ] **Step 5: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS with no errors.

- [ ] **Step 6: Verify on a device**

Run `npm run start:passenger` on Android or iOS with location permission denied.

Check each of these:
1. Home's "Where to?" is visibly disabled with "Location required — tap to enable" beneath it.
2. Tapping that notice opens the permission modal even after "Not now" was used this session.
3. Granting permission re-enables the button and the notice disappears, with no restart.
4. With permission denied, reaching `/booking/confirm` (via a saved place, or by temporarily granting, selecting a destination, then revoking) shows "Request ride" disabled with the same notice.
5. Destination search still works with permission denied.

- [ ] **Step 7: Commit**

```bash
git add apps/passenger/src/components/LocationRequiredNotice apps/passenger/app/\(tabs\)/home.tsx apps/passenger/app/booking/confirm.tsx
git commit -m "feat(passenger): disable location-dependent actions until permission is granted"
```

---

## Final verification

- [ ] Run the full check from the repo root:

```bash
npm run typecheck && npm run test:services
```
Expected: both PASS.

- [ ] Confirm `CURRENT_TOS_VERSION` and `CURRENT_PRIVACY_VERSION` are both back to `'v1.0'` if Task 4 Step 4.6 changed them:

```bash
grep -n "CURRENT_TOS_VERSION\|CURRENT_PRIVACY_VERSION" packages/services/src/consents/index.ts
```

- [ ] Confirm no stray debug code:

```bash
git diff main --stat
grep -rn "console.log" apps/passenger/src apps/passenger/app packages/services/src/consents packages/ui/src/components/Checkbox
```
Expected: no matches.

## Known follow-ups (not this plan)

- Extract `useLocationPermission` into a `packages/native` workspace once `apps/driver` grows past its stub — it cannot live in `packages/services` (which must stay Node-testable) or `packages/ui` (components only).
- The Driver app needs its own consent gate; UC45 covers all roles.
- Final Terms of Service and Privacy Policy copy replaces `POLICY_BODY` in `apps/passenger/app/consent.tsx`.
- `public.spatial_ref_sys` has RLS disabled (PostGIS reference data, no user rows). Flagged by the Supabase advisor, unrelated to this work.
