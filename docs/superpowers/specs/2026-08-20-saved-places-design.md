# Saved Places Design

## Goal

Let a rider save a pickup/destination they've searched for, and re-book to it
in one tap from Home — replacing the currently-dead `SHORTCUTS` UI in
`apps/passenger/app/(tabs)/home.tsx`, which is a hardcoded empty array with
no way to add anything to it.

## Scope

In scope: saving a place from the search-result/dropped-pin rows on
`set-pickup.tsx`/`set-destination.tsx`, a Home/Work/Custom kind per place,
listing and deleting saved places on Home, one-tap re-booking from Home.

Out of scope (explicitly deferred): renaming a saved place after creation,
a dedicated "Manage saved places" screen, saving from the Confirm Ride
screen, any limit/paging on custom places beyond what's reasonable for a
personal list.

## Data model

New table, one row per saved place, `kind` distinguishing the two fixed
slots from freeform entries:

```sql
-- ---------------------------------------------------------------------
-- 2.x TYPES (added to section 2, alongside payment_method etc.)
-- ---------------------------------------------------------------------
create type saved_place_kind as enum ('home', 'work', 'custom');

-- ---------------------------------------------------------------------
-- 3.x saved_places (added to section 3, alongside notifications)
-- ---------------------------------------------------------------------
-- A rider's saved pickup/destination shortcuts (FR: one-tap re-booking).
-- 'home' and 'work' are singleton slots per rider — the partial unique
-- index below enforces at most one of each; saving a second Home replaces
-- the first (upsert in the service layer) rather than erroring. 'custom'
-- places are unlimited, distinguished only by having no such uniqueness
-- constraint.
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

```sql
-- ---------------------------------------------------------------------
-- 7.x RLS (added to section 7, alongside notif_own)
-- ---------------------------------------------------------------------
alter table public.saved_places enable row level security;

create policy saved_places_own on public.saved_places
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

`latitude`/`longitude` as plain `double precision` columns (not PostGIS —
already dropped from this project per `docs/SCHEMA.MD`'s `ride_requests`
history) mirrors how coordinates are already carried on `LocationPoint`
throughout the passenger app; no new geo type introduced.

## Service layer

New `packages/services/src/saved-places/index.ts`, mirroring the shape of
`packages/services/src/notifications/index.ts` (same `getSignedInUserId`
guard pattern) but with plain CRUD instead of a Realtime subscription — a
rider's own saved-places list has no reason to update from outside their
own actions, so there's nothing to subscribe to.

```ts
export interface SavedPlaceRow {
  id: string;
  kind: 'home' | 'work' | 'custom';
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

listSavedPlaces(): Promise<{ data: SavedPlaceRow[]; error: string | null }>

saveSavedPlace(input: {
  kind: 'home' | 'work' | 'custom';
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}): Promise<{ data: SavedPlaceRow | null; error: string | null }>
// Upsert on (user_id, kind) for 'home'/'work' — onConflict targets the
// partial unique index, so saving a second Home overwrites the first
// instead of erroring. 'custom' always inserts a new row.

deleteSavedPlace(id: string): Promise<{ error: string | null }>
```

## UI

### Saving (set-pickup.tsx / set-destination.tsx)

Each `ListRow` in the results `FlatList` (and the always-visible
dropped-pin row) gains a bookmark icon in its `trailing` slot — additive,
`ListRow` already supports `trailing`. Tapping it opens a small
`MapOverlaySheet`-style action list with three rows: **Save as Home**,
**Save as Work**, **Save as "\<result's own label\>"** — no free-text input
in this version, the custom label is always the place's own resolved name.
Selecting an option calls `saveSavedPlace` and, on success, dismisses the
sheet — no toast/snackbar primitive exists anywhere in this codebase yet,
so this introduces none. The bookmark icon on that result row switches
from outline to filled for the rest of the session as the visible
confirmation.

The bookmark sits as a sibling `Pressable` inside `ListRow`'s `trailing`
slot; React Native's touch responder resolves to the innermost pressable,
so it does not also fire the row's own `onPress` (select-this-result).
This is the same nesting `ListRow` already tolerates for its built-in
`chevron`.

### Listing and using (home.tsx)

`SHORTCUTS` (currently a hardcoded `const [] = []`) is replaced by a new
`useSavedPlacesStore` (Zustand), mirroring the existing `useHistoryStore`
shape exactly (`items`/`loading`/`error`/`load()`, same
`apps/passenger/src/store/useHistoryStore.ts` pattern already used for
Ride History) plus a `remove(id)` action. Home calls `load()` from
`useFocusEffect` (`expo-router`, same as `history.tsx` already does) —
saving a place on `set-destination.tsx` and navigating back to Home must
show it, and a focus-triggered refetch is this codebase's established way
to do that, not a one-off local-state pattern. Icon per row is derived
from `kind`
client-side (`home` → house icon, `work` → briefcase icon, `custom` →
generic pin), not stored in the database — a presentation detail, not
data.

`handleShortcutPress` already exists and does the right thing (`setDropoff`
+ `router.push('/booking/confirm')`) — it currently has no caller since
`SHORTCUTS` is always empty; wiring real data in makes it reachable, no
change to that function itself.

Long-press on a saved-place row reveals a delete affordance (confirm via
a simple `Alert.alert`, matching the pattern already used for the avatar-
upload failure case in `register.tsx` — no new confirmation primitive).
Deleting calls `deleteSavedPlace(id)` and refetches.

## Error handling

- `listSavedPlaces` failure on Home: falls back to the existing
  `EmptyState` (title/message swapped for an error-flavored variant) —
  same shape the screen already renders for the true-empty case, no new
  layout.
- `saveSavedPlace`/`deleteSavedPlace` failure: `Alert.alert` with the
  service's returned error message — matches the existing error-surfacing
  convention elsewhere in the passenger app (e.g. `register.tsx`'s avatar
  upload failure), not a new pattern.

## Testing

- `packages/services/tests/saved-places.test.ts` — new, mirroring the
  mocking style of `packages/services/tests/admin-passengers.test.ts`
  (or `notifications`'s own test file if one exists) for `listSavedPlaces`,
  `saveSavedPlace` (both the plain-insert and the home/work-upsert paths),
  and `deleteSavedPlace`.
- No new i18n-parity risk beyond the existing `en`/`fil` parity test
  already covering every new key added.

## Global constraints for the implementation plan

- Every new DB object (type, table, index, policy) goes into
  `docs/SCHEMA.MD` in its existing numbered sections (2.x types, 3.x
  tables, 6.x indexes if separated there, 7.x policies) — this repo keeps
  that file as the schema's source of truth, applied via the Supabase MCP
  tool, not a separate migrations directory (none exists in this repo).
- New i18n keys go in both `packages/shared/src/i18n/en.ts` and
  `fil.ts` — the parity test enforces this.
- Follow the existing `packages/services/src/<module>/index.ts` module
  shape (see `notifications/index.ts`) — one module, named exports, no
  default export.
