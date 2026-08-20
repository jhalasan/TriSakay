# Saved Places Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a rider save a pickup/destination as Home, Work, or a custom
labeled place, and re-book to it in one tap from Home — replacing the
currently-dead hardcoded-empty `SHORTCUTS` array in
`apps/passenger/app/(tabs)/home.tsx`.

**Architecture:** One new Supabase table (`saved_places`, RLS-scoped to
`user_id = auth.uid()`) behind a new `packages/services/src/saved-places`
module. A bookmark icon on each search-result/dropped-pin row in
`set-pickup.tsx`/`set-destination.tsx` opens a small bottom-sheet component
(`SavePlaceSheet`) offering Home/Work/Custom. Home gets a new
`useSavedPlacesStore` (mirroring the existing `useHistoryStore` shape) that
lists and deletes, refetched on screen focus.

**Tech Stack:** Supabase (Postgres + RLS), `@supabase/supabase-js`, Zustand,
Expo Router, React Native.

**Spec:** `docs/superpowers/specs/2026-08-20-saved-places-design.md`

## Global Constraints

- Every new DB object goes into `docs/SCHEMA.MD` in its existing numbered
  sections (types in §2, tables in §3, indexes in §6 if that's where this
  repo keeps them — check the file's own section boundaries before
  inserting), applied via the Supabase MCP tool. This repo has no
  migrations directory — `docs/SCHEMA.MD` is the schema's source of truth.
- **Task 1 touches the live linked Supabase project
  (`ygdgbvxxqrkxlezpckif`) and must not be run without the human
  operator's explicit go-ahead at execution time** — this is a
  side-effecting change to shared infrastructure, not local code. Every
  other task is normal local code work.
- New i18n keys go in both `packages/shared/src/i18n/en.ts` and `fil.ts` —
  the existing parity test (`packages/shared/tests/`) enforces both files
  declare the same key structure.
- Follow the existing `packages/services/src/<module>/index.ts` shape:
  one module, named exports, no default export, `getSignedInUserId()`
  guard at the top of every function that needs the signed-in user's id
  (copy the exact helper already in `packages/services/src/notifications/index.ts`).
- Component files follow the existing folder convention:
  `apps/passenger/src/components/<Name>/<Name>.tsx` +
  `<Name>.styles.ts` + `index.ts` (`export * from './<Name>';`) — see
  `apps/passenger/src/components/LocationRequiredNotice/`.
- Run `npx tsc --build apps/passenger/tsconfig.json` (not plain
  `--noEmit`) after touching `packages/shared` or `packages/services` —
  the passenger app's project references resolve to `dist/*.d.ts`, so a
  plain typecheck can pass against a stale build.

---

### Task 1: Database schema — `saved_places` table + RLS

**Files:**
- Modify: `docs/SCHEMA.MD` (add to §2 types, §3 tables, §6 indexes, §7 RLS
  policies — insert each block next to its nearest existing sibling, e.g.
  the `saved_place_kind` enum next to `payment_method`, the table next to
  `notifications`, the policy next to `notif_own`)

**Interfaces:**
- Produces: `public.saved_places` table with columns `id uuid`,
  `user_id uuid`, `kind saved_place_kind` (`'home' | 'work' | 'custom'`),
  `label text`, `address text`, `latitude double precision`,
  `longitude double precision`, `created_at timestamptz`. RLS policy
  `saved_places_own` (full CRUD, own rows only). Later tasks' service
  layer and generated TypeScript types depend on this exact shape.

- [ ] **Step 1: Add the `saved_place_kind` enum**

Add to `docs/SCHEMA.MD` §2 (TYPES), next to `payment_method`:

```sql
create type saved_place_kind as enum ('home', 'work', 'custom');
```

- [ ] **Step 2: Add the `saved_places` table**

Add to `docs/SCHEMA.MD` §3 (TABLES), next to `notifications`:

```sql
-- 3.x saved_places -------------------------------------------------------
-- A rider's saved pickup/destination shortcuts (one-tap re-booking from
-- Home). 'home' and 'work' are singleton slots per rider — the partial
-- unique index below enforces at most one of each as a DB-level safety
-- net; the service layer implements "replace the existing one" as its
-- normal-path behavior (see saveSavedPlace in Task 2), not by relying on
-- this index as an ON CONFLICT arbiter. 'custom' places are unlimited.
create table public.saved_places (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  kind        saved_place_kind not null default 'custom',
  label       text not null,
  address     text not null,
  latitude    double precision not null,
  longitude   double precision not null,
  created_at  timestamptz not null default now()
);

create unique index idx_saved_places_singleton_kind
  on public.saved_places (user_id, kind)
  where kind in ('home', 'work');

create index idx_saved_places_user on public.saved_places (user_id, created_at desc);

comment on table public.saved_places is
  'Rider-saved pickup/destination shortcuts for one-tap re-booking from Home. At most one home/work row per rider (idx_saved_places_singleton_kind); unlimited custom rows.';
```

- [ ] **Step 3: Add the RLS policy**

Add to `docs/SCHEMA.MD` §7 (RLS POLICIES), next to `notif_own`:

```sql
alter table public.saved_places enable row level security;

create policy saved_places_own on public.saved_places
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

- [ ] **Step 4: Apply the migration to the live project**

Confirm with the human operator before running this step — it changes
the live linked Supabase project, not local code. Once confirmed, apply
the three SQL blocks above (enum, table + indexes, RLS) via the Supabase
MCP tool's `apply_migration` against project `ygdgbvxxqrkxlezpckif`.

- [ ] **Step 5: Verify the table and policy exist**

Via the Supabase MCP tool's `execute_sql` (or `list_tables`), confirm:
`select * from public.saved_places limit 1;` returns zero rows with no
error (table + columns exist), and
`select policyname from pg_policies where tablename = 'saved_places';`
returns `saved_places_own`.

- [ ] **Step 6: Regenerate TypeScript types**

Run the Supabase MCP tool's `generate_typescript_types` for project
`ygdgbvxxqrkxlezpckif` and overwrite
`packages/services/src/supabase/database.types.ts` with the result.
Confirm the new file contains a `saved_places` entry under `Tables` and
a `saved_place_kind` entry under `Enums`.

- [ ] **Step 7: Commit**

```bash
git add docs/SCHEMA.MD packages/services/src/supabase/database.types.ts
git commit -m "feat(db): add saved_places table, RLS, and regenerated types"
```

---

### Task 2: Service layer — `packages/services/src/saved-places`

**Files:**
- Create: `packages/services/src/saved-places/index.ts`
- Modify: `packages/services/src/index.ts` (add
  `export * from './saved-places/index.ts';`, alphabetically after
  `ratings`)
- Test: `packages/services/tests/saved-places.test.ts`

**Interfaces:**
- Consumes: `Database['public']['Tables']['saved_places']['Row']` and
  `Database['public']['Enums']['saved_place_kind']` from
  `packages/services/src/supabase/database.types.ts` (Task 1).
  `getSupabaseClient()` from `../supabase/client.ts`.
- Produces:
  - `export type SavedPlaceKind = 'home' | 'work' | 'custom'`
  - `export type SavedPlaceRow = Database['public']['Tables']['saved_places']['Row']`
  - `export async function listSavedPlaces(): Promise<{ data: SavedPlaceRow[]; error: string | null }>`
  - `export interface SaveSavedPlaceInput { kind: SavedPlaceKind; label: string; address: string; latitude: number; longitude: number }`
  - `export async function saveSavedPlace(input: SaveSavedPlaceInput): Promise<{ data: SavedPlaceRow | null; error: string | null }>`
  - `export async function deleteSavedPlace(id: string): Promise<{ error: string | null }>`
  - All four consumed by Task 4 (`SavePlaceSheet`) and Task 7 (Home).

- [ ] **Step 1: Write the service module**

```ts
// packages/services/src/saved-places/index.ts
import { getSupabaseClient } from '../supabase/client.ts';
import type { Database } from '../supabase/database.types.ts';

export type SavedPlaceKind = Database['public']['Enums']['saved_place_kind'];
export type SavedPlaceRow = Database['public']['Tables']['saved_places']['Row'];

async function getSignedInUserId(): Promise<string | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.user.id ?? null;
}

export interface ListSavedPlacesResult {
  data: SavedPlaceRow[];
  error: string | null;
}

/** Lists the signed-in user's own saved places, newest first (RLS: `saved_places_own`, `user_id = auth.uid()`). */
export async function listSavedPlaces(): Promise<ListSavedPlacesResult> {
  const userId = await getSignedInUserId();
  if (!userId) return { data: [], error: 'Not signed in' };

  const { data, error } = await getSupabaseClient()
    .from('saved_places')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return { data: data ?? [], error: error?.message ?? null };
}

export interface SaveSavedPlaceInput {
  kind: SavedPlaceKind;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface SaveSavedPlaceResult {
  data: SavedPlaceRow | null;
  error: string | null;
}

/**
 * Inserts a new saved place — except for 'home'/'work', which overwrite
 * whatever row of that kind already exists (queried, then updated by id)
 * rather than inserting a second one. Implemented as an explicit
 * select-then-write instead of a Postgres upsert: the uniqueness
 * constraint on (user_id, kind) is a *partial* index (only 'home'/'work'
 * rows), and supabase-js's `.upsert({ onConflict })` has no way to target
 * a partial index's WHERE predicate, so relying on it here would either
 * fail to find an arbiter or silently not apply to the rows that need it.
 */
export async function saveSavedPlace(input: SaveSavedPlaceInput): Promise<SaveSavedPlaceResult> {
  const userId = await getSignedInUserId();
  if (!userId) return { data: null, error: 'Not signed in' };
  const client = getSupabaseClient();

  if (input.kind === 'custom') {
    const { data, error } = await client
      .from('saved_places')
      .insert({ user_id: userId, ...input })
      .select()
      .single();
    return { data: data ?? null, error: error?.message ?? null };
  }

  const { data: existing } = await client
    .from('saved_places')
    .select('id')
    .eq('user_id', userId)
    .eq('kind', input.kind)
    .maybeSingle();

  if (existing) {
    const { data, error } = await client
      .from('saved_places')
      .update(input)
      .eq('id', existing.id)
      .select()
      .single();
    return { data: data ?? null, error: error?.message ?? null };
  }

  const { data, error } = await client
    .from('saved_places')
    .insert({ user_id: userId, ...input })
    .select()
    .single();
  return { data: data ?? null, error: error?.message ?? null };
}

export interface DeleteSavedPlaceResult {
  error: string | null;
}

/** Deletes one of the signed-in user's own saved places (RLS scopes this to their own rows regardless; the extra `user_id` filter makes that scoping visible in the query itself). */
export async function deleteSavedPlace(id: string): Promise<DeleteSavedPlaceResult> {
  const userId = await getSignedInUserId();
  if (!userId) return { error: 'Not signed in' };

  const { error } = await getSupabaseClient()
    .from('saved_places')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  return { error: error?.message ?? null };
}
```

- [ ] **Step 2: Register the module's exports**

In `packages/services/src/index.ts`, add (alphabetically, after the
`ratings` line):

```ts
export * from './saved-places/index.ts';
```

- [ ] **Step 3: Write the test file**

```ts
// packages/services/tests/saved-places.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import { listSavedPlaces, saveSavedPlace, deleteSavedPlace } from '../src/saved-places/index.ts';

test('listSavedPlaces returns the signed-in user\'s own rows, newest first', async () => {
  const capturedFilters: { column: string; value: unknown }[] = [];
  let orderedBy: { column: string; ascending: boolean } | null = null;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
      from: (table) => {
        assert.equal(table, 'saved_places');
        return {
          select: () => ({
            eq: (column: string, value: unknown) => {
              capturedFilters.push({ column, value });
              return {
                order: (column2: string, opts: { ascending: boolean }) => {
                  orderedBy = { column: column2, ascending: opts.ascending };
                  return Promise.resolve({
                    data: [
                      { id: 'p1', kind: 'home', label: 'Home', address: '123 Main St', latitude: 6.1, longitude: 125.2, user_id: 'u1', created_at: 'now' },
                    ],
                    error: null,
                  });
                },
              };
            },
          }),
        };
      },
    })
  );

  const { data, error } = await listSavedPlaces();

  assert.equal(error, null);
  assert.deepEqual(capturedFilters, [{ column: 'user_id', value: 'u1' }]);
  assert.deepEqual(orderedBy, { column: 'created_at', ascending: false });
  assert.equal(data.length, 1);
  assert.equal(data[0].kind, 'home');
});

test('listSavedPlaces returns an error when there is no active session', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient({ getSession: async () => ({ data: { session: null } }) }));

  const { data, error } = await listSavedPlaces();
  assert.equal(error, 'Not signed in');
  assert.deepEqual(data, []);
});

test('saveSavedPlace inserts a new row for kind "custom"', async () => {
  let insertedRow: unknown = null;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
      from: (table) => {
        assert.equal(table, 'saved_places');
        return {
          insert: (row: unknown) => {
            insertedRow = row;
            return {
              select: () => ({
                single: async () => ({ data: { id: 'p2', ...(row as object) }, error: null }),
              }),
            };
          },
        };
      },
    })
  );

  const { data, error } = await saveSavedPlace({
    kind: 'custom',
    label: 'General Santos City Hall',
    address: 'Jersey St, GenSan',
    latitude: 6.11,
    longitude: 125.17,
  });

  assert.equal(error, null);
  assert.deepEqual(insertedRow, {
    user_id: 'u1',
    kind: 'custom',
    label: 'General Santos City Hall',
    address: 'Jersey St, GenSan',
    latitude: 6.11,
    longitude: 125.17,
  });
  assert.equal(data?.id, 'p2');
});

test('saveSavedPlace updates the existing row when saving "home" a second time', async () => {
  let updatedRow: unknown = null;
  let updatedId: string | null = null;

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: 'existing-home-id' }, error: null }),
            }),
          }),
        }),
        update: (row: unknown) => {
          updatedRow = row;
          return {
            eq: (column: string, value: unknown) => {
              assert.equal(column, 'id');
              updatedId = value as string;
              return {
                select: () => ({
                  single: async () => ({ data: { id: 'existing-home-id', ...(row as object) }, error: null }),
                }),
              };
            },
          };
        },
      }),
    })
  );

  const { data, error } = await saveSavedPlace({
    kind: 'home',
    label: 'Home',
    address: '456 New St',
    latitude: 6.2,
    longitude: 125.3,
  });

  assert.equal(error, null);
  assert.equal(updatedId, 'existing-home-id');
  assert.deepEqual(updatedRow, {
    kind: 'home',
    label: 'Home',
    address: '456 New St',
    latitude: 6.2,
    longitude: 125.3,
  });
  assert.equal(data?.id, 'existing-home-id');
});

test('deleteSavedPlace scopes the delete to the signed-in user', async () => {
  const capturedFilters: { column: string; value: unknown }[] = [];

  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
      from: () => ({
        delete: () => ({
          eq: (column: string, value: unknown) => {
            capturedFilters.push({ column, value });
            return {
              eq: (column2: string, value2: unknown) => {
                capturedFilters.push({ column: column2, value: value2 });
                return Promise.resolve({ error: null });
              },
            };
          },
        }),
      }),
    })
  );

  const { error } = await deleteSavedPlace('p1');

  assert.equal(error, null);
  assert.deepEqual(capturedFilters, [
    { column: 'id', value: 'p1' },
    { column: 'user_id', value: 'u1' },
  ]);
});
```

- [ ] **Step 4: Run the tests**

Run: `cd packages/services && npm test`
Expected: all 5 new tests pass, plus the existing suite still green.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --build apps/passenger/tsconfig.json`
Expected: no errors. (This also builds `packages/services`, which this
task's own project depends on directly.)

- [ ] **Step 6: Commit**

```bash
git add packages/services/src/saved-places packages/services/src/index.ts packages/services/tests/saved-places.test.ts
git commit -m "feat(services): add saved-places CRUD module"
```

---

### Task 3: i18n copy

**Files:**
- Modify: `packages/shared/src/i18n/en.ts`
- Modify: `packages/shared/src/i18n/fil.ts`

**Interfaces:**
- Produces: `t.common.cancel`, `t.common.delete`, `t.home.savedPlacesErrorTitle`,
  `t.home.savedPlacesErrorMessage`, `t.home.deleteSavedPlaceTitle`,
  `t.home.deleteSavedPlaceMessage`, `t.home.deleteSavedPlaceAccessibilityLabel`,
  and a new top-level group `t.savePlace` with `title`, `homeLabel`,
  `workLabel`, `saveAsPrefix`, `saveAccessibilityLabel`,
  `savedAccessibilityLabel` — consumed by Task 4 (`SavePlaceSheet`),
  Tasks 5/6 (bookmark buttons), and Task 7 (Home's delete confirm).

- [ ] **Step 1: Add the keys to `en.ts`**

In `packages/shared/src/i18n/en.ts`, change the `common` block:

```ts
  common: {
    gcash: 'GCash',
    cash: 'Cash',
    cancel: 'Cancel',
    delete: 'Delete',
  },
```

Add these four keys to the existing `home` block, directly after
`noSavedPlacesMessage`:

```ts
    noSavedPlacesMessage: 'Places you save will appear here for one-tap booking.',
    savedPlacesErrorTitle: "Couldn't load saved places",
    savedPlacesErrorMessage: 'Something went wrong. Try again later.',
    deleteSavedPlaceTitle: 'Remove this saved place?',
    deleteSavedPlaceMessage: 'This cannot be undone.',
    deleteSavedPlaceAccessibilityLabel: 'Remove saved place',
```

Add a new top-level group, directly after the `home` block closes (i.e.
between `home: { ... },` and `settings: { ... },`):

```ts
  savePlace: {
    title: 'Save this place',
    homeLabel: 'Home',
    workLabel: 'Work',
    saveAsPrefix: 'Save as',
    saveAccessibilityLabel: 'Save this place',
    savedAccessibilityLabel: 'Saved',
  },
```

- [ ] **Step 2: Add the matching keys to `fil.ts`**

In `packages/shared/src/i18n/fil.ts`, change the `common` block:

```ts
  common: {
    gcash: 'GCash',
    cash: 'Cash',
    cancel: 'Kanselahin',
    delete: 'Tanggalin',
  },
```

Add to the `home` block, directly after `noSavedPlacesMessage`:

```ts
    noSavedPlacesMessage: 'Makikita rito ang mga lugar na iyong ise-save para sa mas mabilis na pag-book.',
    savedPlacesErrorTitle: 'Hindi ma-load ang mga naka-save na lugar',
    savedPlacesErrorMessage: 'May nagkamali. Subukang muli mamaya.',
    deleteSavedPlaceTitle: 'Alisin ang naka-save na lugar na ito?',
    deleteSavedPlaceMessage: 'Hindi na ito maibabalik.',
    deleteSavedPlaceAccessibilityLabel: 'Alisin ang naka-save na lugar',
```

Add the new top-level group, directly after the `home` block closes:

```ts
  savePlace: {
    title: 'I-save ang lugar na ito',
    homeLabel: 'Tahanan',
    workLabel: 'Trabaho',
    saveAsPrefix: 'I-save bilang',
    saveAccessibilityLabel: 'I-save ang lugar na ito',
    savedAccessibilityLabel: 'Na-save na',
  },
```

- [ ] **Step 3: Run the i18n parity test**

Run: `cd packages/shared && npm test`
Expected: both parity tests pass (identical key structure, no empty
strings).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --build apps/passenger/tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/i18n/en.ts packages/shared/src/i18n/fil.ts
git commit -m "feat(i18n): add saved-places copy"
```

---

### Task 4: `SavePlaceSheet` component

**Files:**
- Create: `apps/passenger/src/components/SavePlaceSheet/SavePlaceSheet.tsx`
- Create: `apps/passenger/src/components/SavePlaceSheet/SavePlaceSheet.styles.ts`
- Create: `apps/passenger/src/components/SavePlaceSheet/index.ts`

**Interfaces:**
- Consumes: `saveSavedPlace` from `@trisakay/services` (Task 2), `t.savePlace.*`/`t.common.cancel` from `useTranslation()` (Task 3), `LocationPoint` from `apps/passenger/src/types/booking.ts`.
- Produces: `export interface SavePlaceSheetProps { place: LocationPoint | null; onClose: () => void; onSaved: (place: LocationPoint) => void }` and `export function SavePlaceSheet(props: SavePlaceSheetProps)` — consumed by Task 5 and Task 6. `onSaved` fires with the same `place` object that was passed in, once the save succeeds — callers use it to mark that point as saved without re-fetching.

- [ ] **Step 1: Write the styles**

```ts
// apps/passenger/src/components/SavePlaceSheet/SavePlaceSheet.styles.ts
import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
  },
  title: {
    ...typography.h3,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  optionRowDisabled: {
    opacity: 0.5,
  },
  optionLabel: {
    ...typography.body,
    color: colors.ink,
    flex: 1,
  },
});
```

- [ ] **Step 2: Write the component**

```tsx
// apps/passenger/src/components/SavePlaceSheet/SavePlaceSheet.tsx
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, Text, View } from 'react-native';
import { colors } from '@trisakay/ui';
import { saveSavedPlace, type SavedPlaceKind } from '@trisakay/services';
import { useTranslation } from '../../hooks/useTranslation';
import type { LocationPoint } from '../../types/booking';
import { styles } from './SavePlaceSheet.styles';

export interface SavePlaceSheetProps {
  /** Non-null shows the sheet; null hides it. */
  place: LocationPoint | null;
  onClose: () => void;
  /** Fires with the same `place` once the save succeeds, before `onClose`. */
  onSaved: (place: LocationPoint) => void;
}

const OPTION_ICON: Record<SavedPlaceKind, keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  work: 'briefcase-outline',
  custom: 'location-outline',
};

export function SavePlaceSheet({ place, onClose, onSaved }: SavePlaceSheetProps) {
  const t = useTranslation();
  const [saving, setSaving] = useState<SavedPlaceKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(kind: SavedPlaceKind) {
    if (!place || saving) return;
    setSaving(kind);
    setError(null);

    const label = kind === 'home' ? t.savePlace.homeLabel : kind === 'work' ? t.savePlace.workLabel : place.label;
    const { error: saveError } = await saveSavedPlace({
      kind,
      label,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
    });

    setSaving(null);
    if (saveError) {
      setError(saveError);
      return;
    }
    onSaved(place);
    onClose();
  }

  const options: { kind: SavedPlaceKind; label: string }[] = [
    { kind: 'home', label: `${t.savePlace.saveAsPrefix} ${t.savePlace.homeLabel}` },
    { kind: 'work', label: `${t.savePlace.saveAsPrefix} ${t.savePlace.workLabel}` },
    { kind: 'custom', label: `${t.savePlace.saveAsPrefix} "${place?.label ?? ''}"` },
  ];

  return (
    <Modal visible={place !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t.common.cancel}
      >
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t.savePlace.title}</Text>
          {error && <Text style={styles.errorText}>{error}</Text>}
          {options.map((option) => (
            <Pressable
              key={option.kind}
              accessibilityRole="button"
              style={[styles.optionRow, saving !== null && styles.optionRowDisabled]}
              disabled={saving !== null}
              onPress={() => handleSave(option.kind)}
            >
              <Ionicons name={OPTION_ICON[option.kind]} size={20} color={colors.accentBluePressed} />
              <Text style={styles.optionLabel} numberOfLines={1}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 3: Write the barrel file**

```ts
// apps/passenger/src/components/SavePlaceSheet/index.ts
export * from './SavePlaceSheet';
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --build apps/passenger/tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/passenger/src/components/SavePlaceSheet
git commit -m "feat(passenger): add SavePlaceSheet component"
```

---

### Task 5: Wire saving into `set-destination.tsx`

**Files:**
- Modify: `apps/passenger/app/booking/set-destination.tsx`

**Interfaces:**
- Consumes: `SavePlaceSheet` from `../../src/components/SavePlaceSheet`
  (Task 4).

- [ ] **Step 1: Add the bookmark button and sheet state**

In `apps/passenger/app/booking/set-destination.tsx`, add to the imports:

```ts
import { SavePlaceSheet } from '../../src/components/SavePlaceSheet';
```

Add two new state variables, directly after the existing `pinDropped`
state declaration:

```ts
  const [pinDropped, setPinDropped] = useState(false);
  const [placeToSave, setPlaceToSave] = useState<LocationPoint | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  function keyFor(point: LocationPoint) {
    return `${point.latitude},${point.longitude}`;
  }
```

- [ ] **Step 2: Add the bookmark to each result row**

In the `FlatList`'s `renderItem`, change the `ListRow` to add a
`trailing` prop:

```tsx
          renderItem={({ item }) => (
            <ListRow
              title={item.label}
              subtitle={item.address}
              leading={
                <View style={[styles.resultIcon, selected?.address === item.address && styles.resultIconSelected]}>
                  <Ionicons
                    name="location-outline"
                    size={18}
                    color={selected?.address === item.address ? colors.accentBluePressed : colors.inkSoft}
                  />
                </View>
              }
              trailing={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={savedKeys.has(keyFor(item)) ? t.savePlace.savedAccessibilityLabel : t.savePlace.saveAccessibilityLabel}
                  hitSlop={8}
                  onPress={() => setPlaceToSave(item)}
                >
                  <Ionicons
                    name={savedKeys.has(keyFor(item)) ? 'bookmark' : 'bookmark-outline'}
                    size={20}
                    color={colors.accentBluePressed}
                  />
                </Pressable>
              }
              onPress={() => handleSelectResult(item)}
            />
          )}
```

This requires `Pressable` in the `react-native` import at the top of the
file — add it: `import { FlatList, Pressable, Text, View } from 'react-native';`.

- [ ] **Step 3: Render the sheet**

Directly before the closing `</SafeAreaView>`, add:

```tsx
      <SavePlaceSheet
        place={placeToSave}
        onClose={() => setPlaceToSave(null)}
        onSaved={(point) => setSavedKeys((prev) => new Set(prev).add(keyFor(point)))}
      />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --build apps/passenger/tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run the passenger app (web is sufficient — see the `run` skill /
`apps/passenger`'s existing dev-server pattern used earlier in this
project). Navigate Home → Request a Tricycle → Where to?, search for a
place, tap the bookmark icon on a result row, tap "Save as Home" (or
Work, or the quoted custom option), confirm the sheet closes and the
bookmark icon on that row switches to filled. Expected: no console
errors; if `Task 1` has been applied to the live project, the row is
now queryable via `select * from public.saved_places` for that user.

- [ ] **Step 6: Commit**

```bash
git add apps/passenger/app/booking/set-destination.tsx
git commit -m "feat(passenger): add save-place bookmark to destination search results"
```

---

### Task 6: Wire saving into `set-pickup.tsx`

**Files:**
- Modify: `apps/passenger/app/booking/set-pickup.tsx`

**Interfaces:**
- Consumes: `SavePlaceSheet` from `../../src/components/SavePlaceSheet`
  (Task 4). Same `keyFor`/`savedKeys`/`placeToSave` shape as Task 5, but
  scoped to this file's `ResultItem` union (`{kind:'current-location'} |
  {kind:'point', point}`) — the bookmark only renders for `kind ===
  'point'` rows, not the "Use current location" action row (that row is
  a live action, not a static searched result, matching the design
  spec's scope).

- [ ] **Step 1: Add the bookmark button and sheet state**

In `apps/passenger/app/booking/set-pickup.tsx`, add to the imports:

```ts
import { SavePlaceSheet } from '../../src/components/SavePlaceSheet';
```

Add two new state variables, directly after the existing `pinDropped`
state declaration:

```ts
  const [pinDropped, setPinDropped] = useState(false);
  const [placeToSave, setPlaceToSave] = useState<LocationPoint | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  function keyFor(point: LocationPoint) {
    return `${point.latitude},${point.longitude}`;
  }
```

- [ ] **Step 2: Add the bookmark to each point row**

In the `FlatList`'s `renderItem`, the `item.kind === 'point'` branch's
`ListRow` gains a `trailing` prop (the `current-location` branch is
untouched):

```tsx
            ) : (
              <ListRow
                title={item.point.label}
                subtitle={item.point.address}
                leading={
                  <View style={[styles.resultIcon, selected?.address === item.point.address && styles.resultIconSelected]}>
                    <Ionicons
                      name="location-outline"
                      size={18}
                      color={selected?.address === item.point.address ? colors.accentBluePressed : colors.inkSoft}
                    />
                  </View>
                }
                trailing={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={savedKeys.has(keyFor(item.point)) ? t.savePlace.savedAccessibilityLabel : t.savePlace.saveAccessibilityLabel}
                    hitSlop={8}
                    onPress={() => setPlaceToSave(item.point)}
                  >
                    <Ionicons
                      name={savedKeys.has(keyFor(item.point)) ? 'bookmark' : 'bookmark-outline'}
                      size={20}
                      color={colors.accentBluePressed}
                    />
                  </Pressable>
                }
                onPress={() => handleSelectResult(item.point)}
              />
            )
```

This requires `Pressable` in the `react-native` import at the top of the
file — add it: `import { FlatList, Pressable, Text, View } from 'react-native';`.

- [ ] **Step 3: Render the sheet**

Directly before the closing `</SafeAreaView>`, add:

```tsx
      <SavePlaceSheet
        place={placeToSave}
        onClose={() => setPlaceToSave(null)}
        onSaved={(point) => setSavedKeys((prev) => new Set(prev).add(keyFor(point)))}
      />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --build apps/passenger/tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Same flow as Task 5 Step 5, but via Home → Request a Tricycle → Pickup
point → search or drop a pin, confirming the "Use current location" row
has no bookmark while every searched/dropped-pin row does.

- [ ] **Step 6: Commit**

```bash
git add apps/passenger/app/booking/set-pickup.tsx
git commit -m "feat(passenger): add save-place bookmark to pickup search results"
```

---

### Task 7: Home dashboard — real saved places

**Files:**
- Create: `apps/passenger/src/store/useSavedPlacesStore.ts`
- Modify: `apps/passenger/app/(tabs)/home.tsx`

**Interfaces:**
- Consumes: `listSavedPlaces`, `deleteSavedPlace`, `SavedPlaceRow` from
  `@trisakay/services` (Task 2).
- Produces: `useSavedPlacesStore` with `{ items: SavedPlaceRow[]; loading:
  boolean; error: string | null; load(): Promise<void>; remove(id:
  string): Promise<{ error: string | null }> }` — this is the last task
  in the plan, nothing downstream depends on it.

- [ ] **Step 1: Write the store**

```ts
// apps/passenger/src/store/useSavedPlacesStore.ts
import { create } from 'zustand';
import { deleteSavedPlace, listSavedPlaces, type SavedPlaceRow } from '@trisakay/services';

interface SavedPlacesState {
  items: SavedPlaceRow[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  remove: (id: string) => Promise<{ error: string | null }>;
}

export const useSavedPlacesStore = create<SavedPlacesState>()((set, get) => ({
  items: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    const { data, error } = await listSavedPlaces();
    if (error) {
      set({ loading: false, error });
      return;
    }
    set({ loading: false, items: data });
  },

  remove: async (id) => {
    const { error } = await deleteSavedPlace(id);
    if (!error) {
      set({ items: get().items.filter((item) => item.id !== id) });
    }
    return { error };
  },
}));
```

- [ ] **Step 2: Rewrite `home.tsx`'s saved-places section**

In `apps/passenger/app/(tabs)/home.tsx`, replace the imports block:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, BrandMotif, EmptyState, GradientSurface, Spinner, colors } from '@trisakay/ui';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useBookingStore } from '../../src/store/useBookingStore';
import { useNotificationsStore } from '../../src/store/useNotificationsStore';
import { useSavedPlacesStore } from '../../src/store/useSavedPlacesStore';
import type { SavedPlaceRow } from '@trisakay/services';
import type { LocationPoint } from '../../src/types/booking';
import { styles } from '../../src/styles/tabs/home.styles';
```

(Adds `Spinner` from `@trisakay/ui`, `useSavedPlacesStore`, and
`SavedPlaceRow`; the rest matches the file's existing import list.)

Remove the now-dead `SHORTCUTS` constant entirely:

```tsx
/** Saved places come from the rider's account. Empty until the backend lands. */
const SHORTCUTS: { icon: keyof typeof Ionicons.glyphMap; point: LocationPoint }[] = [];
```

Add, directly after the `getGreetingIcon` function:

```ts
const KIND_ICON: Record<SavedPlaceRow['kind'], keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  work: 'briefcase-outline',
  custom: 'location-outline',
};
```

Add `useCallback`, `useFocusEffect`, and `Alert` where needed. Change the
top of the import list's `react`/`expo-router`/`react-native` lines to:

```tsx
import { useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
```

- [ ] **Step 3: Wire the store into the component**

Inside `HomeScreen()`, replace the existing `dropoff`-setting/store-hook
block (keep `router`, `user`, `unreadCount`, `t` as they are) and add:

```ts
  const setDropoff = useBookingStore((state) => state.setDropoff);
  const unreadCount = useNotificationsStore((state) => state.items.filter((n) => !n.read).length);
  const t = useTranslation();
  const savedPlaces = useSavedPlacesStore((state) => state.items);
  const savedPlacesLoading = useSavedPlacesStore((state) => state.loading);
  const savedPlacesError = useSavedPlacesStore((state) => state.error);
  const loadSavedPlaces = useSavedPlacesStore((state) => state.load);
  const removeSavedPlace = useSavedPlacesStore((state) => state.remove);

  useFocusEffect(
    useCallback(() => {
      void loadSavedPlaces();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  function handleShortcutPress(point: LocationPoint) {
    setDropoff(point);
    router.push('/booking/confirm');
  }

  async function performDeleteSavedPlace(id: string) {
    const { error } = await removeSavedPlace(id);
    if (error) Alert.alert(t.home.savedPlacesErrorTitle, error);
  }

  function handleDeleteSavedPlace(item: SavedPlaceRow) {
    Alert.alert(
      t.home.deleteSavedPlaceTitle,
      t.home.deleteSavedPlaceMessage,
      [
        { text: t.common.cancel, style: 'cancel' },
        { text: t.common.delete, style: 'destructive', onPress: () => void performDeleteSavedPlace(item.id) },
      ]
    );
  }
```

(`handleShortcutPress` itself is unchanged from what's already in the
file — it's repeated here only so the diff is unambiguous about where it
sits relative to the new hooks.)

- [ ] **Step 4: Replace the saved-places section's JSX**

Replace the existing saved-places `<View>` block (the one containing
`t.home.savedPlaces`, the `SHORTCUTS.length === 0` check, and the
`SHORTCUTS.map`) with:

```tsx
        <View>
          <Text style={styles.sectionLabel}>{t.home.savedPlaces}</Text>
          {savedPlacesLoading && savedPlaces.length === 0 ? (
            <Spinner size="small" />
          ) : savedPlacesError ? (
            <EmptyState title={t.home.savedPlacesErrorTitle} message={t.home.savedPlacesErrorMessage} />
          ) : savedPlaces.length === 0 ? (
            <EmptyState
              title={t.home.noSavedPlacesTitle}
              message={t.home.noSavedPlacesMessage}
            />
          ) : (
            <View style={styles.shortcuts}>
              {savedPlaces.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.shortcutRow}
                  onPress={() =>
                    handleShortcutPress({
                      label: item.label,
                      address: item.address,
                      latitude: item.latitude,
                      longitude: item.longitude,
                    })
                  }
                  onLongPress={() => handleDeleteSavedPlace(item)}
                  accessibilityRole="button"
                >
                  <View style={styles.shortcutIcon}>
                    <Ionicons name={KIND_ICON[item.kind]} size={20} color={colors.accentBluePressed} />
                  </View>
                  <View style={styles.shortcutTextSlot}>
                    <Text style={styles.shortcutLabel}>{item.label}</Text>
                    <Text style={styles.shortcutAddress} numberOfLines={1}>
                      {item.address}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --build apps/passenger/tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Run the full passenger test suite**

Run: `cd apps/passenger && npm test`
Expected: all existing tests still pass (this task doesn't add new unit
tests of its own — `useSavedPlacesStore` is a thin wrapper over the
already-tested `saved-places` service, mirroring `useHistoryStore`,
which has no dedicated test file of its own either).

- [ ] **Step 7: Manual verification**

Run the passenger app. Save a place via Task 5 or Task 6's flow, navigate
back to Home, confirm it appears with the right icon (home/work/custom)
and the right label/address. Tap it — confirm it lands on Confirm Ride
with that address as the destination. Long-press it — confirm the delete
alert appears, and confirming removes it from Home.

- [ ] **Step 8: Commit**

```bash
git add apps/passenger/src/store/useSavedPlacesStore.ts apps/passenger/app/\(tabs\)/home.tsx
git commit -m "feat(passenger): wire Home's saved places to real data"
```
