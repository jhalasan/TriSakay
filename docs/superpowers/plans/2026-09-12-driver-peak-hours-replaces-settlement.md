# Replace Driver Settlement Notice with Peak-Hours Analytics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the driver app's "Notify PSO for settlement" feature (self-reported, unverifiable, gates nothing) and replace it with a peak-demand-hours chart on the same Earnings screen, backed by a new city-wide aggregate RPC — giving drivers the same kind of "when's it busy" signal the Admin app's Reports screen already gives PSO.

**Architecture:** A new `security definer` Postgres function `get_peak_hour_histogram(p_since timestamptz)` returns 12 two-hour bucket counts from `ride_requests` (aggregate only, no PII, safe for any authenticated driver to call — the driver-side equivalent of `get_driver_accept_rate`). A new shared service wraps it. The driver Earnings screen swaps its settlement-log section for a small bar chart built the same way `EarningsBarChart` already is (plain RN Views, no chart library). The `settlements` table, its trigger, and the `settlement_notice` enum value are left in the database untouched — no destructive migration — only the client-side plumbing that called it is removed. Admin's own, already-working `getPeakHourHistogram` (in `packages/admin`/`packages/services/src/admin/reports.ts`) is not touched at all; the new RPC and service function are named distinctly to avoid any collision.

**Tech Stack:** Supabase Postgres (SQL migration via Supabase MCP `apply_migration`), TypeScript shared service package (`packages/services`), React Native / Expo driver app, `node:test` + `node:assert/strict` for all TS/JS tests (this repo has no local Postgres test harness — DB changes are verified manually via Supabase MCP, per `docs/SCHEMA.MD`'s own note that it is a reference doc, not the applied path).

**Spec:** This plan's own Architecture section above, decided in conversation on 2026-09-12 (no separate spec doc — the decision and its rationale are captured directly here and in `docs/CONTEXT.MD`'s FR-2.12 addition in Task 8).

## Global Constraints

- Do not drop or alter the existing `settlements` table, `notify_pso_on_settlement()` trigger, or `settlement_notice` enum value — leave them in the database, unused. (Dropping an enum value is disruptive and there is no benefit to it.)
- Do not touch `apps/admin`'s existing Reports/`PeakHoursChart`/`getPeakHourHistogram` code at all — it already works and is out of scope.
- New RPC/service names must not collide with the existing exported `PeakHourBucket` type or `getPeakHourHistogram` function already re-exported from `packages/services/src/admin/reports.ts` via the package barrel (`packages/services/src/index.ts` does `export * from './admin/reports.ts'`).
- "Peak hour" bucketing must use **Asia/Manila local wall-clock time**, not UTC — this matches the existing admin implementation's stated reasoning (`packages/services/src/admin/reports.ts:54`: "matches lib/format.ts's en-PH date/time rendering, so 'peak hour' means the PSO's own local time, not a UTC bucket"). The new RPC must replicate this via `at time zone 'Asia/Manila'`, not `extract(hour from ...)` on the raw UTC timestamp.
- Every i18n key added or removed must be added/removed in **both** `packages/shared/src/i18n/en.ts` and `packages/shared/src/i18n/fil.ts` — `packages/shared/tests/i18n.test.ts` asserts the two dictionaries have identical key structures and fails the whole suite if they diverge.
- Match existing code conventions exactly: RPC/service doc-comments in the same style as `get_driver_accept_rate` / `getDriverAcceptRate`; RN bar chart in the same plain-flex-percentage-height style as `EarningsBarChart` (no `react-native-svg`, no chart library); test files use `node:test` + `node:assert/strict` + the existing `createFakeSupabaseClient` fake (services) or `__setSupabaseClientForTests` (driver app), matching whichever the neighboring test file in that task already uses.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260912100000_add_get_peak_hour_histogram.sql` | New `get_peak_hour_histogram(p_since timestamptz)` SQL function |
| `docs/SCHEMA.MD` | Reference copy of the new function (Section 4) + one-line note on `settlements` no longer being wired to any UI |
| `packages/services/src/analytics/index.ts` | New `getDriverPeakHourHistogram()` service wrapping the RPC, + `DriverPeakHourBucket` type |
| `packages/services/src/index.ts` | Add barrel export for the new module |
| `packages/services/tests/analytics.test.ts` | Unit tests for `getDriverPeakHourHistogram()` |
| `packages/services/src/settlements/index.ts` | **Delete** — no longer called from anywhere after Task 4 |
| `packages/services/tests/settlements.test.ts` | **Delete** — tests the deleted module |
| `apps/driver/src/components/PeakHoursBarChart/PeakHoursBarChart.tsx` | New presentational bar chart, 12 two-hour buckets |
| `apps/driver/src/components/PeakHoursBarChart/PeakHoursBarChart.styles.ts` | Its styles (mirrors `EarningsBarChart.styles.ts`) |
| `apps/driver/src/types/earnings.ts` | Remove `SettlementLogEntry`, add `PeakHourBucket` |
| `apps/driver/src/store/useEarningsStore.ts` | Remove settlement state/actions, add `peakHours`/`peakHoursError` loaded in `load()` |
| `apps/driver/tests/earningsStore.test.js` | Remove settlement-related tests, add peak-hours tests |
| `apps/driver/app/(tabs)/earnings.tsx` | Remove settlement-log UI + "Notify PSO" button, add Peak Hours chart section |
| `apps/driver/src/styles/tabs/earnings.styles.ts` | Remove now-unused `logPanel`/`logRow`/`logRowLast`/`logTextSlot`/`logAmount`/`logDate`/`caption` styles |
| `packages/shared/src/i18n/en.ts`, `fil.ts` | Remove settlement copy keys, add peak-hours copy keys under `driver.earnings` |
| `docs/CONTEXT.MD` | Add FR-2.12 (driver peak-hours analytics); supersede Section 11 item 2; update Section 16 |
| `docs/IMPLEMENTATION_INVENTORY.MD` | Update Driver app / Backend sections to reflect the swap |

---

### Task 1: Database — `get_peak_hour_histogram` RPC

**Files:**
- Create: `supabase/migrations/20260912100000_add_get_peak_hour_histogram.sql`
- Modify: `docs/SCHEMA.MD` (add the function under Section 4, add a note to the `settlements` table comment)

**Interfaces:**
- Produces: SQL function `public.get_peak_hour_histogram(p_since timestamptz) returns table(bucket_index integer, bucket_count integer)` — 12 rows, one per two-hour bucket (`bucket_index` 0–11, bucket 0 = 12:00–1:59 AM local time), `bucket_count` is the count of `ride_requests` with `status = 'completed'` and `requested_at >= p_since`, bucketed by Asia/Manila local hour. Every task after this one calls it only through the Task 2 service wrapper, never directly.

- [ ] **Step 1: Write the migration file**

```sql
-- Backs the driver Earnings screen's peak-hours chart. Replaces the
-- earlier "Notify PSO for settlement" feature (self-reported, gated
-- nothing) with a genuinely decision-useful signal: which hours are
-- busiest, so a driver can choose when to go online. City-wide and
-- aggregate-only (bucket counts, no ride/user rows) so it's safe to
-- expose to any authenticated driver — a driver has no direct RLS read
-- across other drivers'/passengers' ride_requests (see docs/SCHEMA.MD
-- Section 7.5), so this mirrors get_driver_accept_rate's shape: a
-- SECURITY DEFINER function that returns only a safe aggregate.
--
-- Buckets by Asia/Manila LOCAL wall-clock hour, not UTC — same reasoning
-- as the admin Reports "Peak Hours" chart (packages/services/src/admin/
-- reports.ts): "peak hour" means the PSO/driver's own local time.
-- generate_series ensures all 12 buckets are returned even when a bucket
-- has zero rides, so the chart always renders 12 bars.
create or replace function public.get_peak_hour_histogram(p_since timestamptz)
returns table(bucket_index integer, bucket_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.bucket_index,
    count(rr.id)::integer as bucket_count
  from generate_series(0, 11) as b(bucket_index)
  left join public.ride_requests rr
    on rr.status = 'completed'
    and rr.requested_at >= p_since
    and floor(extract(hour from rr.requested_at at time zone 'Asia/Manila') / 2)::integer = b.bucket_index
  group by b.bucket_index
  order by b.bucket_index;
$$;

comment on function public.get_peak_hour_histogram is
  'Driver-facing peak-hours chart (Earnings screen). Aggregate-only (12 two-hour bucket counts, Asia/Manila local time) — no PII. See get_driver_accept_rate for the same SECURITY DEFINER aggregate-only pattern.';
```

- [ ] **Step 2: Apply the migration and verify it manually**

This repo has no local Postgres test harness — migrations are applied and checked via the Supabase MCP tools (`mcp__claude_ai_Supabase__apply_migration`, then `mcp__claude_ai_Supabase__execute_sql`), per `docs/SCHEMA.MD`'s own header note.

Apply the migration, then run:

```sql
select * from public.get_peak_hour_histogram(now() - interval '30 days');
```

Expected: exactly 12 rows, `bucket_index` 0 through 11 in order, `bucket_count` a non-negative integer on every row (0 is fine if there's no seed data yet).

- [ ] **Step 3: Add the function to `docs/SCHEMA.MD`**

Insert the same `create or replace function public.get_peak_hour_histogram(...)` block (Steps above) into `docs/SCHEMA.MD`, in Section 4 ("FUNCTIONS & TRIGGERS"), directly after the existing `get_driver_accept_rate` reference if one exists there, or after Section 4.10 (`notify_pso_on_emergency`) — follow the existing numbering scheme (next available `4.x`).

Also add one sentence to the `settlements` table's existing comment (Section 3.8, added in a prior change — search for `comment on table public.settlements`):

```sql
comment on table public.settlements is
  'FR-9.6 settlement notice log only. No real money is disbursed or tracked as a balance here. As of 2026-09-12 no client UI writes to this table anymore (replaced by the peak-hours analytics feature) — left in place rather than dropped.';
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260912100000_add_get_peak_hour_histogram.sql docs/SCHEMA.MD
git commit -m "feat(db): add get_peak_hour_histogram RPC for driver-facing demand analytics"
```

---

### Task 2: Shared service — `getDriverPeakHourHistogram`

**Files:**
- Create: `packages/services/src/analytics/index.ts`
- Modify: `packages/services/src/index.ts:16` (add `export * from './analytics/index.ts';` — anywhere in the alphabetically-ish grouped list is fine, but place it near `./admin/reports.ts` for discoverability)
- Test: `packages/services/tests/analytics.test.ts`

**Interfaces:**
- Consumes: `getSupabaseClient` from `../supabase/client.ts` (same import every other service module uses); `createFakeSupabaseClient` from `../tests/fakeSupabaseClient.ts` (test only) — its `rpc` config field has signature `(fn: string, args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>`.
- Produces: `export interface DriverPeakHourBucket { hourLabel: string; count: number }`; `export async function getDriverPeakHourHistogram(sinceIso: string): Promise<{ data: DriverPeakHourBucket[]; error: string | null }>`. Task 4 (the driver store) imports both directly from `@trisakay/services`.

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/services/tests/analytics.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import { getDriverPeakHourHistogram } from '../src/analytics/index.ts';

test('getDriverPeakHourHistogram maps 12 buckets to hour-range labels, calling the RPC with the given since-date', async () => {
  let capturedArgs: unknown = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn, args) => {
        assert.equal(fn, 'get_peak_hour_histogram');
        capturedArgs = args;
        return {
          data: Array.from({ length: 12 }, (_, i) => ({ bucket_index: i, bucket_count: i === 3 ? 7 : 0 })),
          error: null,
        };
      },
    })
  );

  const { data, error } = await getDriverPeakHourHistogram('2026-08-01T00:00:00.000Z');

  assert.equal(error, null);
  assert.deepEqual(capturedArgs, { p_since: '2026-08-01T00:00:00.000Z' });
  assert.equal(data.length, 12);
  assert.deepEqual(data[3], { hourLabel: '6:00 AM–8:00 AM', count: 7 });
  assert.equal(data[0].count, 0);
});

test('getDriverPeakHourHistogram surfaces an RPC error instead of guessing', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async () => ({ data: null, error: { message: 'network down' } }),
    })
  );

  const { data, error } = await getDriverPeakHourHistogram('2026-08-01T00:00:00.000Z');

  assert.equal(error, 'network down');
  assert.deepEqual(data, []);
});

test('getDriverPeakHourHistogram fills a missing bucket with 0 rather than dropping it', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      // Only 11 rows returned — bucket 5 missing, simulating a defensive
      // client-side fill if the RPC's own generate_series ever regresses.
      rpc: async () => ({
        data: Array.from({ length: 12 }, (_, i) => i).filter((i) => i !== 5).map((i) => ({ bucket_index: i, bucket_count: 2 })),
        error: null,
      }),
    })
  );

  const { data, error } = await getDriverPeakHourHistogram('2026-08-01T00:00:00.000Z');

  assert.equal(error, null);
  assert.equal(data.length, 12);
  assert.equal(data[5].count, 0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/services && npx tsx --test tests/analytics.test.ts` (match whichever exact test-run command the package's `package.json` `test` script uses — check `packages/services/package.json` first and use that script filtered to this file if it supports a path argument).
Expected: FAIL — `Cannot find module '../src/analytics/index.ts'`.

- [ ] **Step 3: Write the implementation**

```typescript
// packages/services/src/analytics/index.ts
import { getSupabaseClient } from '../supabase/client.ts';

export interface DriverPeakHourBucket {
  hourLabel: string;
  count: number;
}

export interface GetDriverPeakHourHistogramResult {
  data: DriverPeakHourBucket[];
  error: string | null;
}

/** Uses local Asia/Manila wall-clock hours server-side (see the get_peak_hour_histogram SQL function) — the label formatting here must stay in sync with that bucketing, not recompute it client-side. */
function formatHour(hour24: number): string {
  const h = hour24 % 24;
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${period}`;
}

function bucketLabel(bucketIndex: number): string {
  const startHour = bucketIndex * 2;
  return `${formatHour(startHour)}–${formatHour(startHour + 2)}`;
}

/**
 * Driver-facing "peak hours" chart data (Earnings screen). Calls the
 * get_peak_hour_histogram RPC — a SECURITY DEFINER aggregate over ALL
 * drivers' completed ride_requests, safe for any authenticated driver to
 * call since it returns only 12 bucket counts, no rows. Distinct from
 * (and does not replace) the Admin app's own getPeakHourHistogram in
 * admin/reports.ts, which queries ride_requests directly under PSO's own
 * RLS — that one stays as-is.
 */
export async function getDriverPeakHourHistogram(sinceIso: string): Promise<GetDriverPeakHourHistogramResult> {
  const { data, error } = await getSupabaseClient().rpc('get_peak_hour_histogram', { p_since: sinceIso });
  if (error) return { data: [], error: error.message };

  const counts = new Array(12).fill(0);
  for (const row of (data ?? []) as { bucket_index: number; bucket_count: number }[]) {
    counts[row.bucket_index] = row.bucket_count;
  }

  return { data: counts.map((count, i) => ({ hourLabel: bucketLabel(i), count })), error: null };
}
```

- [ ] **Step 4: Add the barrel export**

In `packages/services/src/index.ts`, add this line (placed near the other non-admin service exports, e.g. directly above `export * from './admin/accounts.ts';`):

```typescript
export * from './analytics/index.ts';
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: same command as Step 2.
Expected: PASS, all 3 tests green.

- [ ] **Step 6: Commit**

```bash
git add packages/services/src/analytics/index.ts packages/services/src/index.ts packages/services/tests/analytics.test.ts
git commit -m "feat(services): add getDriverPeakHourHistogram for the driver peak-hours chart"
```

---

### Task 3: Driver component — `PeakHoursBarChart`

**Files:**
- Create: `apps/driver/src/components/PeakHoursBarChart/PeakHoursBarChart.tsx`
- Create: `apps/driver/src/components/PeakHoursBarChart/PeakHoursBarChart.styles.ts`

**Interfaces:**
- Consumes: `DriverPeakHourBucket { hourLabel: string; count: number }` (from Task 2, re-exported via `@trisakay/services`, imported into `apps/driver/src/types/earnings.ts` as `PeakHourBucket` in Task 4 — this component takes that local `PeakHourBucket` type by prop, same pattern `EarningsBarChartProps` uses for `DailyEarning`).
- Produces: `export function PeakHoursBarChart({ data, height, highlightLabel }: PeakHoursBarChartProps)`. Task 5 (`earnings.tsx`) renders this directly; no store or test in this task — this repo does not unit-test presentational RN components (see `EarningsBarChart`, which also has none; only stores/hooks have `apps/driver/tests/*.test.js` files).

- [ ] **Step 1: Write the styles file**

```typescript
// apps/driver/src/components/PeakHoursBarChart/PeakHoursBarChart.styles.ts
import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@trisakay/ui';

export const styles = StyleSheet.create({
  container: {
    padding: spacing.xs,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  barTrack: {
    width: '55%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 6,
  },
  barPast: {
    backgroundColor: colors.accentBlueSoft,
  },
  barPeak: {
    backgroundColor: colors.accentGreen,
  },
  barValue: {
    ...typography.caption,
    fontSize: 9,
    lineHeight: 12,
    color: colors.inkSoft,
  },
  barLabel: {
    fontSize: 8,
    lineHeight: 11,
    fontFamily: typography.body.fontFamily,
    color: colors.inkFaint,
    textAlign: 'center',
  },
  barLabelPeak: {
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.ink,
  },
});
```

- [ ] **Step 2: Write the component**

```typescript
// apps/driver/src/components/PeakHoursBarChart/PeakHoursBarChart.tsx
import { Text, View } from 'react-native';
import type { PeakHourBucket } from '../../types/earnings';
import { styles } from './PeakHoursBarChart.styles';

export interface PeakHoursBarChartProps {
  data: PeakHourBucket[];
  height?: number;
}

const LABEL_HEIGHT = 30;

/**
 * Plain flex/percentage-height bars, same approach as EarningsBarChart —
 * a fixed-height parent lets RN size a percentage-height child directly,
 * no react-native-svg needed. All 12 two-hour buckets are always shown
 * (the backing RPC zero-fills empty ones), so a driver can see quiet
 * hours as flat bars, not missing ones. Labels are abbreviated to just
 * the bucket's start hour (e.g. "6A", "2P") to fit 12 columns on a phone
 * screen — the full "6:00 AM–8:00 AM" range lives in hourLabel for
 * anything that needs the unabbreviated form later.
 */
function shortLabel(hourLabel: string): string {
  const startPart = hourLabel.split('–')[0]; // "6:00 AM"
  const [time, period] = startPart.split(' ');
  const hour = time.split(':')[0];
  return `${hour}${period[0]}`;
}

export function PeakHoursBarChart({ data, height = 130 }: PeakHoursBarChartProps) {
  const trackHeight = Math.max(height - LABEL_HEIGHT, 32);
  const max = Math.max(...data.map((bucket) => bucket.count), 1);
  const peakIndex = data.reduce((best, bucket, i) => (bucket.count > data[best].count ? i : best), 0);

  return (
    <View style={styles.container}>
      <View style={[styles.barsRow, { height }]}>
        {data.map((bucket, i) => {
          const barHeightPercent = Math.max((bucket.count / max) * 100, 4);
          const isPeak = i === peakIndex && bucket.count > 0;
          return (
            <View key={bucket.hourLabel} style={styles.barColumn}>
              <View style={[styles.barTrack, { height: trackHeight }]}>
                <View style={[styles.bar, isPeak ? styles.barPeak : styles.barPast, { height: `${barHeightPercent}%` }]} />
              </View>
              <Text style={[styles.barLabel, isPeak && styles.barLabelPeak]} numberOfLines={1}>
                {shortLabel(bucket.hourLabel)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Verify it type-checks**

Run: `cd apps/driver && npx tsc --noEmit` (or whatever the app's existing `typecheck` script is — check `apps/driver/package.json`).
Expected: no new errors from these two files. (`PeakHourBucket` will not exist yet — this step is expected to show that one error until Task 4 Step 1 adds the type; if running this task standalone, temporarily add `export interface PeakHourBucket { hourLabel: string; count: number }` to `apps/driver/src/types/earnings.ts` now, and leave it — Task 4 will find it already there and skip re-adding it.)

- [ ] **Step 4: Commit**

```bash
git add apps/driver/src/components/PeakHoursBarChart
git commit -m "feat(driver): add PeakHoursBarChart presentational component"
```

---

### Task 4: Driver store — swap settlement state for peak-hours state

**Files:**
- Modify: `apps/driver/src/types/earnings.ts`
- Modify: `apps/driver/src/store/useEarningsStore.ts`
- Modify: `apps/driver/tests/earningsStore.test.js`

**Interfaces:**
- Consumes: `getDriverPeakHourHistogram` from `@trisakay/services` (Task 2); `PeakHoursBarChartProps['data']` type shape (Task 3) — both use the same `{ hourLabel: string; count: number }` shape, kept as separate type declarations per this repo's existing convention (`DriverDailyEarning` in services vs. local `DailyEarning` in `apps/driver/src/types/earnings.ts` are likewise separately declared, structurally identical types).
- Produces: `useEarningsStore` state gains `peakHours: PeakHourBucket[]` and `peakHoursError: string | null`, both populated by `load()`. `settlementLog`, `settlementsError`, `notifying`, and `notifyPsoForSettlement` are removed entirely — Task 5 (`earnings.tsx`) must not reference any of them after this task.

- [ ] **Step 1: Update the types file**

```typescript
// apps/driver/src/types/earnings.ts
export interface DailyEarning {
  date: string;
  ridesCompleted: number;
  totalCollected: number;
}

export interface PeakHourBucket {
  hourLabel: string;
  count: number;
}
```

(This removes `SettlementLogEntry` entirely — confirm no other file still imports it before moving on: `grep -rn "SettlementLogEntry" apps/driver/src` should return nothing once Task 5 is also done.)

- [ ] **Step 2: Write the failing/updated tests**

Replace `apps/driver/tests/earningsStore.test.js` in full with:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');

const SESSION = { data: { session: { user: { id: 'driver1' } } } };

function driverEarningsView(rows) {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => Promise.resolve({ data: rows, error: null }),
  };
  return query;
}

function peakHourRpc(bucketCounts) {
  return async (fn, args) => {
    assert.equal(fn, 'get_peak_hour_histogram');
    assert.ok(typeof args.p_since === 'string');
    return { data: bucketCounts.map((count, i) => ({ bucket_index: i, bucket_count: count })), error: null };
  };
}

test('load() populates totalTracked and dailyBreakdown from the real service call', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    auth: { getSession: async () => SESSION },
    from: (table) =>
      table === 'v_driver_earnings'
        ? driverEarningsView([
            { earning_date: '2026-08-19', rides_completed: 2, total_collected: 45 },
            { earning_date: '2026-08-20', rides_completed: 1, total_collected: 30 },
          ])
        : {},
    rpc: peakHourRpc(new Array(12).fill(0)),
  });

  useEarningsStore.setState({ totalTracked: 0, dailyBreakdown: [], error: null });
  await useEarningsStore.getState().load();

  assert.equal(useEarningsStore.getState().totalTracked, 75);
  assert.deepEqual(useEarningsStore.getState().dailyBreakdown, [
    { date: '2026-08-19', ridesCompleted: 2, totalCollected: 45 },
    { date: '2026-08-20', ridesCompleted: 1, totalCollected: 30 },
  ]);
  assert.equal(useEarningsStore.getState().error, null);
});

test('load() also populates peakHours from the real RPC call, 12 buckets', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    auth: { getSession: async () => SESSION },
    from: (table) => (table === 'v_driver_earnings' ? driverEarningsView([]) : {}),
    rpc: peakHourRpc([0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 0, 0]),
  });

  useEarningsStore.setState({ peakHours: [], peakHoursError: null });
  await useEarningsStore.getState().load();

  const peakHours = useEarningsStore.getState().peakHours;
  assert.equal(peakHours.length, 12);
  assert.equal(peakHours[3].count, 7);
  assert.equal(useEarningsStore.getState().peakHoursError, null);
});

test('load() reports 0 total and an empty breakdown when there are no rows yet', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    auth: { getSession: async () => SESSION },
    from: (table) => (table === 'v_driver_earnings' ? driverEarningsView([]) : {}),
    rpc: peakHourRpc(new Array(12).fill(0)),
  });

  useEarningsStore.setState({ totalTracked: 999, dailyBreakdown: [{ date: 'x', ridesCompleted: 1, totalCollected: 1 }], error: null });
  await useEarningsStore.getState().load();

  assert.equal(useEarningsStore.getState().totalTracked, 0);
  assert.deepEqual(useEarningsStore.getState().dailyBreakdown, []);
});

test('load() surfaces a query error and leaves prior state alone', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    auth: { getSession: async () => SESSION },
    from: (table) =>
      table === 'v_driver_earnings'
        ? { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: null, error: { message: 'network down' } }) }) }) }
        : {},
    rpc: peakHourRpc(new Array(12).fill(0)),
  });

  const priorBreakdown = [{ date: '2026-08-18', ridesCompleted: 1, totalCollected: 10 }];
  useEarningsStore.setState({ totalTracked: 10, dailyBreakdown: priorBreakdown, error: null });
  await useEarningsStore.getState().load();

  assert.equal(useEarningsStore.getState().error, 'network down');
  assert.equal(useEarningsStore.getState().totalTracked, 10);
  assert.deepEqual(useEarningsStore.getState().dailyBreakdown, priorBreakdown);
});

test('load() surfaces a peak-hours RPC error without touching earnings state', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');
  const { __setSupabaseClientForTests } = await import('@trisakay/services/src/supabase/client.ts');

  __setSupabaseClientForTests({
    auth: { getSession: async () => SESSION },
    from: (table) => (table === 'v_driver_earnings' ? driverEarningsView([]) : {}),
    rpc: async () => ({ data: null, error: { message: 'rpc down' } }),
  });

  useEarningsStore.setState({ peakHours: [{ hourLabel: 'x', count: 1 }], peakHoursError: null });
  await useEarningsStore.getState().load();

  assert.equal(useEarningsStore.getState().peakHoursError, 'rpc down');
  assert.equal(useEarningsStore.getState().error, null);
});

test('reset() clears every field back to initial state', async () => {
  const { useEarningsStore } = await import('../src/store/useEarningsStore.ts');

  useEarningsStore.setState({
    totalTracked: 500,
    dailyBreakdown: [{ date: '2026-08-20', ridesCompleted: 2, totalCollected: 90 }],
    loading: true,
    error: 'stale error',
    peakHours: [{ hourLabel: 'x', count: 1 }],
    peakHoursError: 'stale peak-hours error',
  });

  useEarningsStore.getState().reset();

  assert.equal(useEarningsStore.getState().totalTracked, 0);
  assert.deepEqual(useEarningsStore.getState().dailyBreakdown, []);
  assert.equal(useEarningsStore.getState().loading, false);
  assert.equal(useEarningsStore.getState().error, null);
  assert.deepEqual(useEarningsStore.getState().peakHours, []);
  assert.equal(useEarningsStore.getState().peakHoursError, null);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd apps/driver && node --test tests/earningsStore.test.js` (match the exact command in `apps/driver/package.json`'s `test` script if different).
Expected: FAIL — `peakHours`/`peakHoursError` undefined on the store, or `notifyPsoForSettlement`-shaped tests no longer present (this file was fully replaced, so failures will be "store has no `peakHours` property" style, from the store's current settlement-only shape).

- [ ] **Step 4: Rewrite the store**

```typescript
// apps/driver/src/store/useEarningsStore.ts
import { create } from 'zustand';
import { getDriverEarnings, getDriverPeakHourHistogram } from '@trisakay/services';
import type { DailyEarning, PeakHourBucket } from '../types/earnings';

interface EarningsState {
  totalTracked: number;
  dailyBreakdown: DailyEarning[];
  loading: boolean;
  error: string | null;
  peakHours: PeakHourBucket[];
  peakHoursError: string | null;
  load: () => Promise<void>;
  reset: () => void;
}

/** 30-day lookback for the peak-hours chart — enough sample size without dragging in the driver's entire ride history. */
function thirtyDaysAgoIso(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

export const useEarningsStore = create<EarningsState>()((set) => ({
  totalTracked: 0,
  dailyBreakdown: [],
  loading: false,
  error: null,
  peakHours: [],
  peakHoursError: null,

  load: async () => {
    set({ loading: true, error: null, peakHoursError: null });

    const [earnings, peakHours] = await Promise.all([getDriverEarnings(), getDriverPeakHourHistogram(thirtyDaysAgoIso())]);

    if (earnings.error || earnings.totalTracked === null || earnings.breakdown === null) {
      set({ loading: false, error: earnings.error ?? 'Could not load earnings.', peakHours: peakHours.data, peakHoursError: peakHours.error });
      return;
    }

    set({
      loading: false,
      totalTracked: earnings.totalTracked,
      dailyBreakdown: earnings.breakdown,
      peakHours: peakHours.data,
      peakHoursError: peakHours.error,
    });
  },

  reset: () =>
    set({
      totalTracked: 0,
      dailyBreakdown: [],
      loading: false,
      error: null,
      peakHours: [],
      peakHoursError: null,
    }),
}));
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: same command as Step 3.
Expected: PASS, all 6 tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/driver/src/types/earnings.ts apps/driver/src/store/useEarningsStore.ts apps/driver/tests/earningsStore.test.js
git commit -m "feat(driver): replace settlement store state with peak-hours analytics"
```

---

### Task 5: Driver Earnings screen — swap the UI section

**Files:**
- Modify: `apps/driver/app/(tabs)/earnings.tsx`
- Modify: `apps/driver/src/styles/tabs/earnings.styles.ts`
- Modify: `packages/shared/src/i18n/en.ts`
- Modify: `packages/shared/src/i18n/fil.ts`

**Interfaces:**
- Consumes: `useEarningsStore` fields from Task 4 (`peakHours`, `peakHoursError` — `settlementLog`/`settlementsError`/`notifying`/`notifyPsoForSettlement` no longer exist); `PeakHoursBarChart` from Task 3; `t.driver.earnings.*` i18n keys defined in this task.
- Produces: the rendered screen. No later task consumes this file.

- [ ] **Step 1: Update i18n copy — remove settlement keys, add peak-hours keys**

In `packages/shared/src/i18n/en.ts`, inside the `earnings: { ... }` block (currently lines ~601–616), replace:

```typescript
      settlementLog: 'Settlement log (record only)',
      noSettlementsTitle: 'No settlements logged',
      noSettlementsMessage: "Notify PSO once you're ready to settle.",
      logged: 'Logged',
      notifyPso: 'Notify PSO for settlement',
      caption: 'CREATES A RECORD FOR PSO ONLY — NO MONEY MOVES THROUGH THE APP; SETTLEMENT HAPPENS OUTSIDE IT',
```

with:

```typescript
      peakHoursLabel: 'Busiest hours (last 30 days)',
      peakHoursCaption: 'Based on completed rides city-wide — use it to decide when to go online.',
      noPeakHoursTitle: 'Not enough data yet',
      noPeakHoursMessage: 'Peak-hour trends will show up here once more rides complete.',
```

In `packages/shared/src/i18n/fil.ts`, inside the matching `earnings: { ... }` block, replace:

```typescript
      settlementLog: 'Talaan ng Settlement (Para sa Record Lamang)',
      noSettlementsTitle: 'Walang naitalang settlement',
      noSettlementsMessage: 'Abisuhan ang PSO kapag handa ka nang mag-settle.',
      logged: 'Naitala',
      notifyPso: 'Abisuhan ang PSO para sa Settlement',
      caption: 'GUMAGAWA LANG ITO NG RECORD PARA SA PSO — WALANG PERANG DUMADAAN SA APP; ANG SETTLEMENT AY GINAGAWA SA LABAS NITO',
```

with:

```typescript
      peakHoursLabel: 'Pinaka-abalang oras (nakaraang 30 araw)',
      peakHoursCaption: 'Batay sa natapos na biyahe sa buong lungsod — gamitin ito para malaman kung kailan magonline.',
      noPeakHoursTitle: 'Wala pang sapat na datos',
      noPeakHoursMessage: 'Lalabas dito ang peak-hour trends kapag mas marami nang natapos na biyahe.',
```

- [ ] **Step 2: Run the i18n parity test**

Run: `cd packages/shared && npx tsx --test tests/i18n.test.ts` (match the actual script name in `packages/shared/package.json`).
Expected: PASS — both dictionaries changed together, key structures still match.

- [ ] **Step 3: Update the screen**

In `apps/driver/app/(tabs)/earnings.tsx`, remove these store reads:

```typescript
  const settlementLog = useEarningsStore((state) => state.settlementLog);
  const settlementsError = useEarningsStore((state) => state.settlementsError);
  const notifying = useEarningsStore((state) => state.notifying);
  const notifyPsoForSettlement = useEarningsStore((state) => state.notifyPsoForSettlement);
```

replace with:

```typescript
  const peakHours = useEarningsStore((state) => state.peakHours);
  const peakHoursError = useEarningsStore((state) => state.peakHoursError);
```

Remove the now-unused `formatDate` helper function (it was only used to render `entry.loggedAt` in the settlement log) — confirm nothing else in the file calls it before deleting.

Add the `PeakHoursBarChart` import:

```typescript
import { PeakHoursBarChart } from '../../src/components/PeakHoursBarChart/PeakHoursBarChart';
```

Replace this whole block:

```typescript
        <Text style={styles.sectionLabel}>{t.driver.earnings.settlementLog}</Text>
        {settlementLog.length === 0 ? (
          <EmptyState title={t.driver.earnings.noSettlementsTitle} message={t.driver.earnings.noSettlementsMessage} />
        ) : (
          <View style={styles.logPanel}>
            {settlementLog.map((entry, index) => (
              <View key={entry.id} style={[styles.logRow, index === settlementLog.length - 1 && styles.logRowLast]}>
                <View style={styles.logTextSlot}>
                  <Text style={styles.logAmount}>{formatCurrency(entry.amount)}</Text>
                  <Text style={styles.logDate}>{formatDate(entry.loggedAt)}</Text>
                </View>
                <Badge label={t.driver.earnings.logged} tone="neutral" />
              </View>
            ))}
          </View>
        )}

        {settlementsError && <Text style={styles.error}>{settlementsError}</Text>}
        <Button label={t.driver.earnings.notifyPso} fullWidth loading={notifying} onPress={() => void notifyPsoForSettlement()} />
        <Text style={styles.caption}>{t.driver.earnings.caption}</Text>
```

with:

```typescript
        <Text style={styles.sectionLabel}>{t.driver.earnings.peakHoursLabel}</Text>
        {peakHours.every((bucket) => bucket.count === 0) ? (
          <EmptyState title={t.driver.earnings.noPeakHoursTitle} message={t.driver.earnings.noPeakHoursMessage} />
        ) : (
          <View style={styles.chartPanel}>
            <PeakHoursBarChart data={peakHours} height={130} />
          </View>
        )}
        {peakHoursError && <Text style={styles.error}>{peakHoursError}</Text>}
        <Text style={styles.caption}>{t.driver.earnings.peakHoursCaption}</Text>
```

Check the `Badge` and `Button` imports at the top of the file — if nothing else in this file uses `Badge` or `Button` after this change, remove them from the `import { ... } from '@trisakay/ui'` line (keep `EmptyState`, `GradientSurface`, `colors`, `BrandMotif` — those are still used by the total-earnings card above).

- [ ] **Step 4: Update the styles file**

In `apps/driver/src/styles/tabs/earnings.styles.ts`, remove these now-unused keys: `logPanel`, `logRow`, `logRowLast`, `logTextSlot`, `logAmount`, `logDate`. Keep `caption` and `error` — both are still used (by `peakHoursCaption` and `peakHoursError` respectively).

- [ ] **Step 5: Manually verify in the app**

Run the driver app (`cd apps/driver && npx expo start`), sign in as a driver with some completed ride history, open the Earnings tab, and confirm:
- The settlement log section and "Notify PSO for settlement" button are gone.
- A "Busiest hours" bar chart renders with 12 bars.
- If there's no ride history yet, the empty state message shows instead of a chart.

- [ ] **Step 6: Commit**

```bash
git add apps/driver/app/\(tabs\)/earnings.tsx apps/driver/src/styles/tabs/earnings.styles.ts packages/shared/src/i18n/en.ts packages/shared/src/i18n/fil.ts
git commit -m "feat(driver): swap settlement-notice UI for a peak-hours chart on Earnings"
```

---

### Task 6: Remove the now-dead settlements service module

**Files:**
- Delete: `packages/services/src/settlements/index.ts`
- Delete: `packages/services/tests/settlements.test.ts`
- Modify: `packages/services/src/index.ts:16` (remove `export * from './settlements/index.ts';`)

**Interfaces:**
- Consumes: nothing — this task only runs after Task 5, once no file anywhere imports `notifyPsoForSettlement` or `listMySettlements`.
- Produces: nothing new. Confirms no orphaned exports remain.

- [ ] **Step 1: Confirm nothing still references the module**

Run: `grep -rn "notifyPsoForSettlement\|listMySettlements\|settlements/index" --include=*.ts --include=*.tsx apps packages | grep -v node_modules | grep -v /dist/`
Expected: no output (empty). If anything shows up, stop and fix that call site first — do not delete the module out from under a live caller.

- [ ] **Step 2: Delete the files**

```bash
git rm packages/services/src/settlements/index.ts packages/services/tests/settlements.test.ts
```

- [ ] **Step 3: Remove the barrel export line**

In `packages/services/src/index.ts`, delete the line `export * from './settlements/index.ts';`.

- [ ] **Step 4: Run the full services test suite**

Run: whatever the `packages/services` `package.json` defines as its `test` script (run the whole suite, not just one file, to catch any remaining reference).
Expected: PASS, no failures, no "module not found" errors.

- [ ] **Step 5: Commit**

```bash
git add packages/services/src/index.ts
git commit -m "chore(services): remove dead settlements module now that the driver UI no longer calls it"
```

---

### Task 7: Documentation — reconcile CONTEXT.MD and the implementation inventory

**Files:**
- Modify: `docs/CONTEXT.MD`
- Modify: `docs/IMPLEMENTATION_INVENTORY.MD`

**Interfaces:**
- Consumes: nothing code-level — this task is pure documentation reconciliation, done last so it describes the actually-shipped result of Tasks 1–6.
- Produces: nothing consumed by later tasks (this is the last task).

- [ ] **Step 1: Add FR-2.12 to `docs/CONTEXT.MD`**

Directly after the existing `FR-2.11` line (currently: `- FR-2.11 Completed/cancelled rides logged to ride history`), add:

```markdown
- FR-2.12 *(New — replaces the earlier settlement-notice feature, see Section 11 item 2 and Section 16)* Driver views a peak-demand-hours chart (12 two-hour buckets, aggregated city-wide from completed rides, no per-ride or per-user data exposed) on the Earnings screen, to help decide when to go online. Backed by a SECURITY DEFINER aggregate function (`get_peak_hour_histogram`), the same pattern already used for the Dashboard's Accept-rate stat (`get_driver_accept_rate`).
```

- [ ] **Step 2: Supersede Section 11 item 2**

Find the existing line (Section 11, "Wireframe Kit Review — Changes Required"):

```markdown
2. Rename **"Request payout"** to something like "Submit settlement request" — no real money is disbursed; earnings are simulated/tracked only (see FR-9.6).
```

Replace it with:

```markdown
2. ~~Rename **"Request payout"** to "Submit settlement request"~~ — **superseded 2026-09-12.** The settlement-notice button was removed entirely rather than kept and renamed: it was self-reported and unverifiable, and gated no account state (see the peak-hours FR-2.12 addition instead). The underlying `settlements` table/trigger are left in the database, unused, rather than dropped.
```

- [ ] **Step 3: Update Section 16 (Implementation Status)**

Find this sentence in the "Driver app" paragraph of Section 16:

```markdown
real settlement backend wired to the earnings "Notify PSO" button (renamed from "Request payout" per Section 11 item 2 — no real payout, tracking only);
```

Replace it with:

```markdown
a peak-demand-hours chart on the Earnings screen (FR-2.12), replacing the earlier settlement-notice button — see Section 11 item 2;
```

- [ ] **Step 4: Update `docs/IMPLEMENTATION_INVENTORY.MD`**

In the "Driver App" section, find:

```markdown
- Earnings tab: simulated/tracked earnings, "Notify PSO for settlement" action wired to a real settlement backend (no real payout — tracking/notification only, per FR-9.6)
```

Replace with:

```markdown
- Earnings tab: simulated/tracked earnings, plus a peak-demand-hours chart (FR-2.12) backed by a city-wide aggregate RPC — replaces the earlier settlement-notice button
```

In the "Shared Backend" section, find:

```markdown
- Settlement tracking (`settlements` table/migration) backing the driver "Notify PSO" action
```

Replace with:

```markdown
- `get_peak_hour_histogram` RPC (aggregate-only, Asia/Manila local time) backing the driver Earnings peak-hours chart (FR-2.12). The earlier `settlements` table/trigger backing the removed "Notify PSO" action are left in the database, unused, rather than dropped.
```

- [ ] **Step 5: Commit**

```bash
git add docs/CONTEXT.MD docs/IMPLEMENTATION_INVENTORY.MD
git commit -m "docs: record the settlement-to-peak-hours swap (FR-2.12)"
```

---

## Self-Review Notes

- **Spec coverage:** removal of the settlement UI (Tasks 4–6), new peak-hours RPC/service/UI (Tasks 1–3, 5), FR/doc reconciliation (Task 7) — all three parts of the decision are covered.
- **No destructive DB change:** confirmed Task 1 only adds a function; the Global Constraints section explicitly forbids touching `settlements`/`notify_pso_on_settlement`/`settlement_notice`.
- **No collision with admin's existing analytics:** confirmed the new type/function names (`DriverPeakHourBucket`, `getDriverPeakHourHistogram`, SQL function `get_peak_hour_histogram`) are distinct from admin's (`PeakHourBucket`, `getPeakHourHistogram` in `admin/reports.ts`); admin files are not in the File Structure table at all.
- **i18n parity:** every key removed/added in Task 5 Step 1 touches both `en.ts` and `fil.ts` in the same step, and Step 2 runs the parity test immediately after.
