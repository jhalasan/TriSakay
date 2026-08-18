# Admin Real Charts, Documents, Map & Visual Refinement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the last four wireframe `PlaceholderBox` surfaces in `apps/admin` (2 Dashboard charts, 2 Reports charts, driver/discount document images, the Ride Monitoring live map) with real, backend-driven content, and refine (not restructure) the existing visual system.

**Architecture:** New real Supabase-backed aggregate queries land in `packages/services/src/admin/{dashboard,reports,monitoring}.ts` and `packages/services/src/storage/index.ts`, following the file's own established convention (client-side aggregation, no multi-hop PostgREST embeds, `{ data, error }` result shape, `getSupabaseClient()`/`__setSupabaseClientForTests()`). Thin `apps/admin/src/services/*.ts` wrappers expose them to the UI, same one-file-per-feature pattern already used everywhere in this app. New presentational components (`components/charts/*`, `components/DocumentImage`, `components/LiveMap`) consume that data; `recharts` (charts) and `leaflet`/`react-leaflet` (map) are the two new dependencies. Document images need no new backend permission — verified live that `driver-docs`/`discount-ids` Storage buckets already allow `is_pso()` reads via RLS. The map holds NFR-2.5's coarse-location constraint by rounding coordinates to a ~1.1km grid before they ever render.

**Tech Stack:** React 19, TypeScript, Vite, Recharts 3.x, Leaflet 1.9.x + react-leaflet 4.x, `node:test` (existing service-layer test runner — no component-testing library exists in this repo).

**Spec:** `docs/superpowers/specs/2026-08-18-admin-real-visuals-design.md`

## Global Constraints

- No dark mode — `tokens.css` stays `color-scheme: light` only.
- No sidebar/topbar/page-layout restructuring — visual refinement only touches spacing, color, shadow, hover states, and typography inside the existing structure (user explicitly declined a deeper redesign).
- The map must never render or expose a driver's literal `current_lat`/`current_lng` — only coordinates rounded to 2 decimal places (~1.1km grid), matching NFR-2.5.
- Both chart panels' components render at `height={220}` inside `ResponsiveContainer`/a fixed-height loading state so `.panel` cards never shift size versus their current `PlaceholderBox` (also 220px default).
- Local imports of `.ts` modules use explicit `.ts` extensions (`allowImportingTsExtensions` in `apps/admin/tsconfig.json`); component imports resolving to a folder's `index.ts` barrel omit the extension.
- Chart/map colors are literal hex strings transcribed from `tokens.css`/`Badge.module.css`, commented with the token they mirror — Recharts/Leaflet need literal values, not CSS custom properties.
- `PlaceholderBox` itself is not deleted — `DocumentImage`'s and `LiveMap`'s own loading/error states reuse its `.ph-box` CSS class directly (not the component) so there's no new runtime dependency on it, but the "no content" visual language stays consistent.
- Every new/changed file: run `npm run typecheck` from repo root before committing; it must stay clean.

---

### Task 1: Add `recharts`, `leaflet`, `react-leaflet` dependencies

**Files:**
- Modify: `apps/admin/package.json`

**Interfaces:**
- Produces: `recharts`, `leaflet`, `react-leaflet` importable from anywhere in `apps/admin/src`.

- [ ] **Step 1: Add the dependencies**

In `apps/admin/package.json`, update the `dependencies` block to:

```json
  "dependencies": {
    "leaflet": "^1.9.4",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-leaflet": "^4.2.1",
    "react-router-dom": "^7.1.1",
    "recharts": "^3.10.1",
    "zustand": "^5.0.2",
    "@trisakay/services": "1.0.0",
    "@trisakay/shared": "1.0.0",
    "@trisakay/utils": "1.0.0"
  },
```

And add a `devDependencies` entry for Leaflet's types:

```json
  "devDependencies": {
    "@types/leaflet": "^1.9.12",
    "@vitejs/plugin-react": "^5.0.0",
    "typescript": "^5.9.2",
    "vite": "^5.4.10"
  },
```

(`react-leaflet@4.x` is the last major supporting React 18-style peer ranges compatible with this repo's pinned React 19.1.0 without a peer-dep override; `react-leaflet@5.x` requires React 19's `use()` APIs more aggressively and is not needed here.)

- [ ] **Step 2: Install**

Run from the repo root: `npm install`
Expected: lockfile updates, `node_modules/recharts`, `node_modules/leaflet`, `node_modules/react-leaflet` all exist, no peer-dependency errors.

- [ ] **Step 3: Commit**

```bash
git add package-lock.json apps/admin/package.json
git commit -m "chore(admin): add recharts, leaflet, react-leaflet dependencies"
```

---

### Task 2: Dashboard chart data — `getRidesPerDay`, `getTripStatusBreakdown`

**Files:**
- Modify: `packages/services/src/admin/dashboard.ts`
- Modify: `apps/admin/src/services/dashboard.ts`
- Test: `packages/services/tests/admin-dashboard.test.ts`

**Interfaces:**
- Produces:
  - `RidesPerDayPoint { day: string; count: number }` (`packages/services/src/admin/dashboard.ts`)
  - `TripStatusCount { status: 'forming' | 'active' | 'completed' | 'cancelled'; count: number }` (same file)
  - `getRidesPerDay(): Promise<{ data: RidesPerDayPoint[]; error: string | null }>`
  - `getTripStatusBreakdown(): Promise<{ data: TripStatusCount[]; error: string | null }>`
  - `apps/admin/src/services/dashboard.ts` re-exports both, wrapped in the app's `ServiceResult` shape, matching every other function in that file.

- [ ] **Step 1: Write the failing tests**

Open `packages/services/tests/admin-dashboard.test.ts`. Add to the top import:

```ts
import { getAdminDashboardStats, getRidesPerDay, getTripStatusBreakdown, listExpiringFranchises, listOverdueComplaints, listRecentTripActivity } from '../src/admin/dashboard.ts';
```

Append at the end of the file:

```ts
test('getRidesPerDay groups completed ride_requests into calendar-day buckets, oldest first', async () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0).toISOString();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 9, 0, 0).toISOString();

  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'ride_requests') {
        return {
          select: () => ({
            eq: () => ({
              gte: async () => ({
                data: [{ requested_at: yesterday }, { requested_at: today }, { requested_at: today }],
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await getRidesPerDay();
  assert.equal(error, null);
  assert.equal(data.length, 7);
  assert.equal(data[5].count, 1); // yesterday
  assert.equal(data[6].count, 2); // today
});

test('getRidesPerDay returns 7 zero-count days (not an error) when nothing happened this week', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ eq: () => ({ gte: async () => ({ data: [], error: null }) }) }) }),
  } as any);

  const { data, error } = await getRidesPerDay();
  assert.equal(error, null);
  assert.equal(data.length, 7);
  assert.ok(data.every((d) => d.count === 0));
});

test('getRidesPerDay returns { data: [], error } when the query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ eq: () => ({ gte: async () => ({ data: null, error: { message: 'connection refused' } }) }) }) }),
  } as any);

  const { data, error } = await getRidesPerDay();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('getTripStatusBreakdown issues one count query per TripStatus and maps them', async () => {
  const captured: { column: string; value: unknown }[] = [];

  __setSupabaseClientForTests({
    from: (table: string) => {
      assert.equal(table, 'trips');
      return {
        select: () => ({
          eq: async (column: string, value: unknown) => {
            captured.push({ column, value });
            const counts: Record<string, number> = { forming: 2, active: 5, completed: 421, cancelled: 34 };
            return { count: counts[value as string], error: null };
          },
        }),
      };
    },
  } as any);

  const { data, error } = await getTripStatusBreakdown();
  assert.equal(error, null);
  assert.deepEqual(data, [
    { status: 'forming', count: 2 },
    { status: 'active', count: 5 },
    { status: 'completed', count: 421 },
    { status: 'cancelled', count: 34 },
  ]);
  assert.ok(captured.every((c) => c.column === 'status'));
});

test('getTripStatusBreakdown returns { data: [], error } when any one count query errors', async () => {
  __setSupabaseClientForTests({
    from: () => ({
      select: () => ({
        eq: async (_column: string, value: unknown) =>
          value === 'active' ? { count: null, error: { message: 'connection refused' } } : { count: 1, error: null },
      }),
    }),
  } as any);

  const { data, error } = await getTripStatusBreakdown();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --workspace packages/services run test`
Expected: FAIL — `getRidesPerDay`/`getTripStatusBreakdown` are not exported from `admin/dashboard.ts`.

- [ ] **Step 3: Implement in `packages/services/src/admin/dashboard.ts`**

Append at the end of the file:

```ts

export interface RidesPerDayPoint {
  day: string; // e.g. 'Mon 8/17'
  count: number;
}

export interface GetRidesPerDayResult {
  data: RidesPerDayPoint[];
  error: string | null;
}

/**
 * "Rides Over Time (Week)" dashboard chart — completed ride_requests for
 * each of the last 7 calendar days (local wall-clock, matching the rest of
 * this app's en-PH rendering), oldest first. Always returns exactly 7
 * points, zero-filled, so the chart never shows a gap for a quiet day.
 */
export async function getRidesPerDay(): Promise<GetRidesPerDayResult> {
  const client = getSupabaseClient();
  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);

  const { data, error } = await client
    .from('ride_requests')
    .select('requested_at')
    .eq('status', 'completed')
    .gte('requested_at', since.toISOString());

  if (error) return { data: [], error: error.message };

  const days: { key: string; day: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ key: d.toLocaleDateString('en-CA'), day: d.toLocaleDateString('en-PH', { weekday: 'short', month: 'numeric', day: 'numeric' }) });
  }

  const countByKey = new Map<string, number>();
  for (const row of data ?? []) {
    const key = new Date(row.requested_at).toLocaleDateString('en-CA');
    countByKey.set(key, (countByKey.get(key) ?? 0) + 1);
  }

  return { data: days.map(({ key, day }) => ({ day, count: countByKey.get(key) ?? 0 })), error: null };
}

export interface TripStatusCount {
  status: 'forming' | 'active' | 'completed' | 'cancelled';
  count: number;
}

export interface GetTripStatusBreakdownResult {
  data: TripStatusCount[];
  error: string | null;
}

const TRIP_STATUSES: TripStatusCount['status'][] = ['forming', 'active', 'completed', 'cancelled'];

/** "Ride Status" dashboard donut — ride counts by TripStatus, all-time, 4 parallel counts (same idiom as getAdminDashboardStats). */
export async function getTripStatusBreakdown(): Promise<GetTripStatusBreakdownResult> {
  const client = getSupabaseClient();

  const results = await Promise.all(
    TRIP_STATUSES.map((status) => client.from('trips').select('*', { count: 'exact', head: true }).eq('status', status))
  );

  const firstError = results.find((r) => r.error)?.error;
  if (firstError) return { data: [], error: firstError.message };

  return { data: TRIP_STATUSES.map((status, i) => ({ status, count: results[i].count ?? 0 })), error: null };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm --workspace packages/services run test`
Expected: PASS.

- [ ] **Step 5: Add the thin `apps/admin` wrapper**

In `apps/admin/src/services/dashboard.ts`, update the import block and add the two wrappers:

```ts
import {
  getAdminDashboardStats,
  getRidesPerDay as getRidesPerDayShared,
  getTripStatusBreakdown as getTripStatusBreakdownShared,
  listExpiringFranchises as listExpiringFranchisesShared,
  listOverdueComplaints as listOverdueComplaintsShared,
  listRecentTripActivity as listRecentTripActivityShared,
} from '@trisakay/services';
import type { ExpiringFranchiseRow, OverdueComplaintRow, RecentTripActivityRow, RidesPerDayPoint, TripStatusCount } from '@trisakay/services';
import type { ServiceResult } from './drivers';

export type { ExpiringFranchiseRow, OverdueComplaintRow, RecentTripActivityRow, RidesPerDayPoint, TripStatusCount };
```

Append at the end of the file:

```ts

export async function getRidesPerDay(): Promise<ServiceResult<RidesPerDayPoint[]>> {
  const { data, error } = await getRidesPerDayShared();
  return { data, error };
}

export async function getTripStatusBreakdown(): Promise<ServiceResult<TripStatusCount[]>> {
  const { data, error } = await getTripStatusBreakdownShared();
  return { data, error };
}
```

- [ ] **Step 6: Typecheck**

Run from repo root: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/services/src/admin/dashboard.ts packages/services/tests/admin-dashboard.test.ts apps/admin/src/services/dashboard.ts
git commit -m "feat(admin): add getRidesPerDay/getTripStatusBreakdown dashboard chart queries"
```

---

### Task 3: Reports chart data — `getRidesRevenueOverTime`, `getPeakHourHistogram`

**Files:**
- Modify: `packages/services/src/admin/reports.ts`
- Modify: `apps/admin/src/services/reports.ts`
- Test: `packages/services/tests/admin-reports.test.ts`

**Interfaces:**
- Produces:
  - `RidesRevenuePoint { day: string; rides: number; revenue: number }`
  - `getRidesRevenueOverTime(sinceIso: string): Promise<{ data: RidesRevenuePoint[]; error: string | null }>`
  - `PeakHourBucket { hourLabel: string; count: number }`
  - `getPeakHourHistogram(sinceIso: string): Promise<{ data: PeakHourBucket[]; error: string | null }>`
  - `apps/admin/src/services/reports.ts`: `getRidesRevenueOverTime(range: ReportDateRange)`, `getPeakHourHistogram(range: ReportDateRange)`, both applying `dateRangeSinceIso(range)` the same way `getReportSummary`/`listTransactions` already do.
- Consumes: `dateRangeSinceIso` (existing, `apps/admin/src/services/reports.ts`).

- [ ] **Step 1: Write the failing tests**

Open `packages/services/tests/admin-reports.test.ts`. Update the import:

```ts
import { getAdminReportSummary, getPeakHourHistogram, getRidesRevenueOverTime, listTransactionsForAdmin } from '../src/admin/reports.ts';
```

Append at the end of the file:

```ts
test('getPeakHourHistogram returns 12 two-hour buckets and labels each one', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'ride_requests') {
        return {
          select: () => ({
            eq: () => ({
              gte: async () => ({
                data: [{ requested_at: todayAt(6, 15) }, { requested_at: todayAt(7, 40) }, { requested_at: todayAt(14, 0) }],
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await getPeakHourHistogram('2026-08-01T00:00:00.000Z');
  assert.equal(error, null);
  assert.equal(data.length, 12);
  assert.deepEqual(data[3], { hourLabel: '6:00 AM–8:00 AM', count: 2 });
  assert.deepEqual(data[7], { hourLabel: '2:00 PM–4:00 PM', count: 1 });
  assert.equal(data.reduce((sum, b) => sum + b.count, 0), 3);
});

test('getPeakHourHistogram returns { data: [], error } when the query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ eq: () => ({ gte: async () => ({ data: null, error: { message: 'connection refused' } }) }) }) }),
  } as any);

  const { data, error } = await getPeakHourHistogram('2026-08-01T00:00:00.000Z');
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('getRidesRevenueOverTime buckets completed rides and paid revenue by calendar day', async () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0).toISOString();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 9, 0, 0).toISOString();
  const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0).toISOString();

  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'ride_requests') {
        return {
          select: () => ({
            eq: () => ({ gte: async () => ({ data: [{ requested_at: yesterday }, { requested_at: today }], error: null }) }),
          }),
        };
      }
      if (table === 'transactions') {
        return {
          select: () => ({
            eq: () => ({ gte: async () => ({ data: [{ amount: '18.00', created_at: yesterday }, { amount: '24.50', created_at: today }], error: null }) }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await getRidesRevenueOverTime(since);
  assert.equal(error, null);
  assert.equal(data.length, 2);
  assert.equal(data[0].rides, 1);
  assert.equal(data[0].revenue, 18);
  assert.equal(data[1].rides, 1);
  assert.equal(data[1].revenue, 24.5);
});

test('getRidesRevenueOverTime returns { data: [], error } when the rides query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ eq: () => ({ gte: async () => ({ data: null, error: { message: 'connection refused' } }) }) }) }),
  } as any);

  const { data, error } = await getRidesRevenueOverTime('2026-08-01T00:00:00.000Z');
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --workspace packages/services run test`
Expected: FAIL — new exports don't exist yet.

- [ ] **Step 3: Refactor the peak-hour histogram out of `peakTwoHourWindowLabel` and add both new functions**

In `packages/services/src/admin/reports.ts`, replace the `peakTwoHourWindowLabel` function (and its call site inside `getAdminReportSummary`) so the 12-bucket histogram is computed once and reused. Replace:

```ts
  const peakHourLabel = totalRides > 0 ? peakTwoHourWindowLabel(rides!.map((r) => r.requested_at)) : '—';

  return { data: { totalRides, totalRevenue, averageFare, peakHourLabel }, error: null };
}

function emptySummary(): AdminReportSummary {
  return { totalRides: 0, totalRevenue: 0, averageFare: 0, peakHourLabel: '—' };
}

/** Uses local wall-clock hours (not UTC) deliberately — matches lib/format.ts's en-PH date/time rendering, so "peak hour" means the PSO's own local time, not a UTC bucket. */
function peakTwoHourWindowLabel(timestamps: string[]): string {
  const counts = new Array(12).fill(0); // 12 two-hour buckets covering a day
  for (const ts of timestamps) {
    const hour = new Date(ts).getHours();
    counts[Math.floor(hour / 2)]++;
  }
  let peakBucket = 0;
  for (let i = 1; i < counts.length; i++) {
    if (counts[i] > counts[peakBucket]) peakBucket = i;
  }
  const startHour = peakBucket * 2;
  return `${formatHour(startHour)}–${formatHour(startHour + 2)}`;
}
```

with:

```ts
  const peakHourLabel = totalRides > 0 ? peakLabelFromHistogram(twoHourHistogram(rides!.map((r) => r.requested_at))) : '—';

  return { data: { totalRides, totalRevenue, averageFare, peakHourLabel }, error: null };
}

function emptySummary(): AdminReportSummary {
  return { totalRides: 0, totalRevenue: 0, averageFare: 0, peakHourLabel: '—' };
}

/** Uses local wall-clock hours (not UTC) deliberately — matches lib/format.ts's en-PH date/time rendering, so "peak hour" means the PSO's own local time, not a UTC bucket. */
function twoHourHistogram(timestamps: string[]): number[] {
  const counts = new Array(12).fill(0); // 12 two-hour buckets covering a day
  for (const ts of timestamps) {
    const hour = new Date(ts).getHours();
    counts[Math.floor(hour / 2)]++;
  }
  return counts;
}

function peakLabelFromHistogram(counts: number[]): string {
  let peakBucket = 0;
  for (let i = 1; i < counts.length; i++) {
    if (counts[i] > counts[peakBucket]) peakBucket = i;
  }
  return bucketLabel(peakBucket);
}

function bucketLabel(bucketIndex: number): string {
  const startHour = bucketIndex * 2;
  return `${formatHour(startHour)}–${formatHour(startHour + 2)}`;
}
```

Then append at the end of the file:

```ts

export interface PeakHourBucket {
  hourLabel: string;
  count: number;
}

export interface GetPeakHourHistogramResult {
  data: PeakHourBucket[];
  error: string | null;
}

/** "Peak Hours" report chart — the same 12 two-hour buckets getAdminReportSummary's peakHourLabel is derived from, exposed in full. */
export async function getPeakHourHistogram(sinceIso: string): Promise<GetPeakHourHistogramResult> {
  const client = getSupabaseClient();
  const { data, error } = await client.from('ride_requests').select('requested_at').eq('status', 'completed').gte('requested_at', sinceIso);

  if (error) return { data: [], error: error.message };

  const counts = twoHourHistogram((data ?? []).map((r) => r.requested_at));
  return { data: counts.map((count, i) => ({ hourLabel: bucketLabel(i), count })), error: null };
}

export interface RidesRevenuePoint {
  day: string;
  rides: number;
  revenue: number;
}

export interface GetRidesRevenueOverTimeResult {
  data: RidesRevenuePoint[];
  error: string | null;
}

/** "Rides / Revenue" report chart — completed ride_requests and paid transactions in range, bucketed by local calendar day, oldest first. */
export async function getRidesRevenueOverTime(sinceIso: string): Promise<GetRidesRevenueOverTimeResult> {
  const client = getSupabaseClient();

  const [{ data: rides, error: ridesError }, { data: paidTxns, error: txnsError }] = await Promise.all([
    client.from('ride_requests').select('requested_at').eq('status', 'completed').gte('requested_at', sinceIso),
    client.from('transactions').select('amount, created_at').eq('status', 'paid').gte('created_at', sinceIso),
  ]);

  if (ridesError) return { data: [], error: ridesError.message };
  if (txnsError) return { data: [], error: txnsError.message };

  const ridesByDay = new Map<string, number>();
  for (const r of rides ?? []) {
    const key = new Date(r.requested_at).toLocaleDateString('en-CA');
    ridesByDay.set(key, (ridesByDay.get(key) ?? 0) + 1);
  }

  const revenueByDay = new Map<string, number>();
  for (const t of paidTxns ?? []) {
    const key = new Date(t.created_at).toLocaleDateString('en-CA');
    revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + Number(t.amount));
  }

  const dayKeys = [...new Set([...ridesByDay.keys(), ...revenueByDay.keys()])].sort();
  const data = dayKeys.map((key) => ({
    day: new Date(key).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
    rides: ridesByDay.get(key) ?? 0,
    revenue: revenueByDay.get(key) ?? 0,
  }));

  return { data, error: null };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm --workspace packages/services run test`
Expected: PASS, including the pre-existing `getAdminReportSummary` peak-hour test (unaffected by the refactor — same computed label, different internal path).

- [ ] **Step 5: Add the thin `apps/admin` wrapper**

In `apps/admin/src/services/reports.ts`, update the import and append:

```ts
import { getAdminReportSummary, getPeakHourHistogram as getPeakHourHistogramShared, getRidesRevenueOverTime as getRidesRevenueOverTimeShared, listTransactionsForAdmin } from '@trisakay/services';
import type { PeakHourBucket, ReportSummary, RidesRevenuePoint, TransactionRow } from '../types/report';
import type { ServiceResult } from './drivers';
```

(This adds `PeakHourBucket`/`RidesRevenuePoint` to the existing type import — Step 1 of the next task adds them to `types/report.ts`.)

Append at the end of the file:

```ts

export async function getRidesRevenueOverTime(range: ReportDateRange): Promise<ServiceResult<RidesRevenuePoint[]>> {
  const { data, error } = await getRidesRevenueOverTimeShared(dateRangeSinceIso(range));
  return { data, error };
}

export async function getPeakHourHistogram(range: ReportDateRange): Promise<ServiceResult<PeakHourBucket[]>> {
  const { data, error } = await getPeakHourHistogramShared(dateRangeSinceIso(range));
  return { data, error };
}
```

- [ ] **Step 6: Add the two new types to `apps/admin/src/types/report.ts`**

Append at the end of the file:

```ts

export interface RidesRevenuePoint {
  day: string;
  rides: number;
  revenue: number;
}

export interface PeakHourBucket {
  hourLabel: string;
  count: number;
}
```

- [ ] **Step 7: Typecheck**

Run from repo root: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/services/src/admin/reports.ts packages/services/tests/admin-reports.test.ts apps/admin/src/services/reports.ts apps/admin/src/types/report.ts
git commit -m "feat(admin): add getRidesRevenueOverTime/getPeakHourHistogram report chart queries"
```

---

### Task 4: Live map data — `getActiveTricycleLocations`

**Files:**
- Modify: `packages/services/src/admin/monitoring.ts`
- Modify: `apps/admin/src/services/monitoring.ts`
- Test: `packages/services/tests/admin-monitoring.test.ts`

**Interfaces:**
- Produces:
  - `ActiveTricycleLocationCell { lat: number; lng: number; count: number; driverNames: string[] }`
  - `getActiveTricycleLocations(): Promise<{ data: ActiveTricycleLocationCell[]; error: string | null }>`
  - `apps/admin/src/services/monitoring.ts`: `getActiveTricycleLocations(): Promise<ServiceResult<ActiveTricycleLocationCell[]>>`

- [ ] **Step 1: Write the failing tests**

Open `packages/services/tests/admin-monitoring.test.ts`. Update the import:

```ts
import { getActiveTricycleLocations, listActiveTricyclesForAdmin } from '../src/admin/monitoring.ts';
```

Append at the end of the file:

```ts
test('getActiveTricycleLocations rounds coordinates to 2 decimals and groups drivers sharing a grid cell', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'driver_profiles') {
        return {
          select: () => ({
            eq: async () => ({
              data: [
                { user_id: 'drv1', current_lat: 6.116243, current_lng: 125.171738 },
                { user_id: 'drv2', current_lat: 6.116291, current_lng: 125.171701 }, // rounds to the same cell as drv1
                { user_id: 'drv3', current_lat: 6.204, current_lng: 125.09 },
                { user_id: 'drv4', current_lat: null, current_lng: null }, // dropped — no fix
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'users') {
        return {
          select: () => ({
            in: async () => ({
              data: [
                { id: 'drv1', full_name: 'Ronnie Bautista' },
                { id: 'drv2', full_name: 'Ariel Cabahug' },
                { id: 'drv3', full_name: 'Juan Dela Cruz' },
              ],
              error: null,
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await getActiveTricycleLocations();
  assert.equal(error, null);
  assert.equal(data.length, 2);

  const shared = data.find((c) => c.count === 2)!;
  assert.equal(shared.lat, 6.12);
  assert.equal(shared.lng, 125.17);
  assert.deepEqual([...shared.driverNames].sort(), ['Ariel Cabahug', 'Ronnie Bautista']);

  const solo = data.find((c) => c.count === 1)!;
  assert.equal(solo.lat, 6.2);
  assert.equal(solo.lng, 125.09);
  assert.deepEqual(solo.driverNames, ['Juan Dela Cruz']);
});

test('getActiveTricycleLocations returns an empty list without further queries when no one is on duty', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'driver_profiles') return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await getActiveTricycleLocations();
  assert.deepEqual(data, []);
  assert.equal(error, null);
});

test('getActiveTricycleLocations returns { data: [], error } when the driver_profiles query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: () => ({ eq: async () => ({ data: null, error: { message: 'connection refused' } }) }) }),
  } as any);

  const { data, error } = await getActiveTricycleLocations();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --workspace packages/services run test`
Expected: FAIL — `getActiveTricycleLocations` is not exported yet.

- [ ] **Step 3: Implement**

Append at the end of `packages/services/src/admin/monitoring.ts`:

```ts

export interface ActiveTricycleLocationCell {
  lat: number;
  lng: number;
  count: number;
  driverNames: string[];
}

export interface GetActiveTricycleLocationsResult {
  data: ActiveTricycleLocationCell[];
  error: string | null;
}

/** ~1.1km grid cell — never exposes a driver's literal coordinates. */
function roundToGrid(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * FR-5.1/5.2 map data. Coordinates are rounded to a coarse grid before
 * anything else touches them, per NFR-2.5 — multiple drivers in the same
 * cell collapse into one marker with a count, never individual exact pins.
 * Only `is_available` drivers with a live fix are included; the same
 * `clear_location_when_offline` trigger that nulls current_lat/current_lng
 * on sign-off (docs/SCHEMA.MD §4.7) means an offline driver is naturally
 * excluded here without an extra filter.
 */
export async function getActiveTricycleLocations(): Promise<GetActiveTricycleLocationsResult> {
  const client = getSupabaseClient();

  const { data: profiles, error: profilesError } = await client
    .from('driver_profiles')
    .select('user_id, current_lat, current_lng')
    .eq('is_available', true);

  if (profilesError) return { data: [], error: profilesError.message };

  const located = (profiles ?? []).filter(
    (p): p is typeof p & { current_lat: number; current_lng: number } => p.current_lat != null && p.current_lng != null
  );
  if (located.length === 0) return { data: [], error: null };

  const driverIds = located.map((p) => p.user_id);
  const { data: users, error: usersError } = await client.from('users').select('id, full_name').in('id', driverIds);
  if (usersError) return { data: [], error: usersError.message };

  const nameById = new Map((users ?? []).map((u) => [u.id, u.full_name]));

  const cellByKey = new Map<string, ActiveTricycleLocationCell>();
  for (const p of located) {
    const lat = roundToGrid(p.current_lat);
    const lng = roundToGrid(p.current_lng);
    const key = `${lat},${lng}`;
    const name = nameById.get(p.user_id) ?? '—';
    const existing = cellByKey.get(key);
    if (existing) {
      existing.count += 1;
      existing.driverNames.push(name);
    } else {
      cellByKey.set(key, { lat, lng, count: 1, driverNames: [name] });
    }
  }

  return { data: [...cellByKey.values()], error: null };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm --workspace packages/services run test`
Expected: PASS.

- [ ] **Step 5: Add the thin `apps/admin` wrapper**

In `apps/admin/src/services/monitoring.ts`, replace the whole file with:

```ts
import { getActiveTricycleLocations as getActiveTricycleLocationsShared, listActiveTricyclesForAdmin } from '@trisakay/services';
import type { ActiveTricycleLocationCell } from '@trisakay/services';
import type { ActiveTricycleRow } from '../types/ride';
import type { ServiceResult } from './drivers';

export type { ActiveTricycleLocationCell };

/** Read-only (FR-5.1, 5.2). Location stays coarse per NFR-2.5. */
export async function listActiveTricycles(): Promise<ServiceResult<ActiveTricycleRow[]>> {
  const { data, error } = await listActiveTricyclesForAdmin();
  return { data, error };
}

export async function getActiveTricycleLocations(): Promise<ServiceResult<ActiveTricycleLocationCell[]>> {
  const { data, error } = await getActiveTricycleLocationsShared();
  return { data, error };
}
```

- [ ] **Step 6: Typecheck**

Run from repo root: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/services/src/admin/monitoring.ts packages/services/tests/admin-monitoring.test.ts apps/admin/src/services/monitoring.ts
git commit -m "feat(admin): add getActiveTricycleLocations coarse-grid map query"
```

---

### Task 5: Signed document URLs — `getSignedDocumentUrl`

**Files:**
- Modify: `packages/services/src/storage/index.ts`
- Create: `apps/admin/src/services/documents.ts`
- Test: `packages/services/tests/admin-documents.test.ts`

**Interfaces:**
- Produces:
  - `getSignedDocumentUrl(bucket: 'driver-docs' | 'discount-ids', path: string, expirySeconds?: number): Promise<{ url: string | null; error: string | null }>` (`packages/services/src/storage/index.ts`)
  - `apps/admin/src/services/documents.ts`: `getSignedDocumentUrl(bucket, path): Promise<{ url: string | null; error: string | null }>` (thin re-export — no `ServiceResult` wrapping needed since this return shape has no `data`/`error` pair to normalize beyond what the shared function already returns).

- [ ] **Step 1: Write the failing test**

Create `packages/services/tests/admin-documents.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { getSignedDocumentUrl } from '../src/storage/index.ts';

test('getSignedDocumentUrl requests a signed URL from the given bucket/path with the given expiry', async () => {
  let captured: { bucket: string; path: string; expiry: number } | null = null;

  __setSupabaseClientForTests({
    storage: {
      from: (bucket: string) => ({
        createSignedUrl: async (path: string, expiry: number) => {
          captured = { bucket, path, expiry };
          return { data: { signedUrl: 'https://example.test/signed/abc' }, error: null };
        },
      }),
    },
  } as any);

  const { url, error } = await getSignedDocumentUrl('driver-docs', 'drv1/drivers_license-123.jpg', 120);
  assert.equal(error, null);
  assert.equal(url, 'https://example.test/signed/abc');
  assert.deepEqual(captured, { bucket: 'driver-docs', path: 'drv1/drivers_license-123.jpg', expiry: 120 });
});

test('getSignedDocumentUrl defaults the expiry to 300 seconds', async () => {
  let capturedExpiry: number | null = null;

  __setSupabaseClientForTests({
    storage: {
      from: () => ({
        createSignedUrl: async (_path: string, expiry: number) => {
          capturedExpiry = expiry;
          return { data: { signedUrl: 'https://example.test/signed/abc' }, error: null };
        },
      }),
    },
  } as any);

  await getSignedDocumentUrl('discount-ids', 'p1/senior_citizen-front-123.jpg');
  assert.equal(capturedExpiry, 300);
});

test('getSignedDocumentUrl returns { url: null, error } when Storage rejects the request', async () => {
  __setSupabaseClientForTests({
    storage: {
      from: () => ({ createSignedUrl: async () => ({ data: null, error: { message: 'Object not found' } }) }),
    },
  } as any);

  const { url, error } = await getSignedDocumentUrl('driver-docs', 'missing/path.jpg');
  assert.equal(url, null);
  assert.equal(error, 'Object not found');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace packages/services run test`
Expected: FAIL — `getSignedDocumentUrl` is not exported from `storage/index.ts`.

- [ ] **Step 3: Implement**

Append at the end of `packages/services/src/storage/index.ts`:

```ts

export interface GetSignedDocumentUrlResult {
  url: string | null;
  error: string | null;
}

/**
 * Time-limited read URL for a private-bucket document (driver verification
 * photos, discount ID photos). Both buckets already grant `is_pso()` a
 * `SELECT` policy on `storage.objects` (verified live against the project),
 * so a signed-in PSO/Supervisor/Admin session can call this directly — no
 * RPC or service-role key needed, unlike the write-side account actions.
 */
export async function getSignedDocumentUrl(
  bucket: 'driver-docs' | 'discount-ids',
  path: string,
  expirySeconds = 300
): Promise<GetSignedDocumentUrlResult> {
  const { data, error } = await getSupabaseClient().storage.from(bucket).createSignedUrl(path, expirySeconds);
  if (error) return { url: null, error: error.message };
  return { url: data.signedUrl, error: null };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm --workspace packages/services run test`
Expected: PASS.

- [ ] **Step 5: Create the `apps/admin` wrapper**

Create `apps/admin/src/services/documents.ts`:

```ts
import { getSignedDocumentUrl as getSignedDocumentUrlShared } from '@trisakay/services';

export type DocumentBucket = 'driver-docs' | 'discount-ids';

/** Thin wrapper matching this app's one-file-per-feature service convention. */
export async function getSignedDocumentUrl(bucket: DocumentBucket, path: string): Promise<{ url: string | null; error: string | null }> {
  return getSignedDocumentUrlShared(bucket, path);
}
```

- [ ] **Step 6: Typecheck**

Run from repo root: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/services/src/storage/index.ts packages/services/tests/admin-documents.test.ts apps/admin/src/services/documents.ts
git commit -m "feat(admin): add getSignedDocumentUrl for private-bucket document rendering"
```

---

### Task 6: Chart theme + Dashboard charts (`RidesOverTimeChart`, `RideStatusChart`)

**Files:**
- Create: `apps/admin/src/components/charts/chartTheme.ts`
- Create: `apps/admin/src/components/charts/charts.module.css`
- Create: `apps/admin/src/components/charts/RidesOverTimeChart.tsx`
- Create: `apps/admin/src/components/charts/RideStatusChart.tsx`
- Create: `apps/admin/src/components/charts/index.ts`
- Modify: `apps/admin/src/routes/Dashboard.tsx`

**Interfaces:**
- Consumes: `RidesPerDayPoint`, `TripStatusCount` (Task 2); `getRidesPerDay`, `getTripStatusBreakdown` (Task 2, `../services/dashboard`); `titleCaseLabel` (`../lib/format`).
- Produces: `RidesOverTimeChart(props: { data: RidesPerDayPoint[]; loading?: boolean })`, `RideStatusChart(props: { data: TripStatusCount[]; loading?: boolean })`, theme constants reused by Task 7.

- [ ] **Step 1: Create the shared chart theme**

Create `apps/admin/src/components/charts/chartTheme.ts`:

```ts
/**
 * Recharts requires literal color strings, not CSS custom properties, so
 * these are transcribed by hand from styles/tokens.css and
 * Badge/Badge.module.css. Keep in sync if either source changes.
 */
export const LINE_COLOR = '#002E60'; // --primary
export const REVENUE_COLOR = '#477434'; // --success
export const GRID_COLOR = '#EBEFF2'; // --line-soft
export const AXIS_COLOR = '#5A646B'; // --ink-soft
export const TOOLTIP_BG = '#FFFFFF'; // --panel
export const TOOLTIP_BORDER = '#DCE2E6'; // --line
export const MONO_FONT = 'ui-monospace, Menlo, Consolas, monospace'; // --mono

/** Mirrors Badge's tone colors so the Ride Status donut matches status badges elsewhere on the dashboard. */
export const STATUS_COLORS: Record<'forming' | 'active' | 'completed' | 'cancelled', string> = {
  forming: '#e3b341', // Badge .warn border
  active: '#002E60', // --primary / Badge .info
  completed: '#477434', // --success / Badge .success
  cancelled: '#B3261E', // --danger / Badge .danger
};
```

- [ ] **Step 2: Create the shared chart CSS**

Create `apps/admin/src/components/charts/charts.module.css`:

```css
.loading {
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink-soft);
  font-size: 12px;
}
```

- [ ] **Step 3: Create `RidesOverTimeChart`**

Create `apps/admin/src/components/charts/RidesOverTimeChart.tsx`:

```tsx
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RidesPerDayPoint } from '../../services/dashboard';
import { AXIS_COLOR, GRID_COLOR, LINE_COLOR, MONO_FONT, TOOLTIP_BG, TOOLTIP_BORDER } from './chartTheme';
import styles from './charts.module.css';

export interface RidesOverTimeChartProps {
  data: RidesPerDayPoint[];
  loading?: boolean;
}

const AXIS_TICK = { fill: AXIS_COLOR, fontFamily: MONO_FONT, fontSize: 10 };

/** "Rides Over Time (Week)" dashboard panel — completed rides per day, oldest to newest. */
export function RidesOverTimeChart({ data, loading = false }: RidesOverTimeChartProps) {
  if (loading) {
    return <div className={styles.loading}>Loading…</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="day" tick={AXIS_TICK} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}`, borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: AXIS_COLOR, fontFamily: MONO_FONT, fontSize: 10 }}
          formatter={(value: number) => [`${value} rides`, 'Completed']}
        />
        <Line type="monotone" dataKey="count" name="Completed rides" stroke={LINE_COLOR} strokeWidth={2} dot={{ r: 3, fill: LINE_COLOR }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 4: Create `RideStatusChart`**

Create `apps/admin/src/components/charts/RideStatusChart.tsx`:

```tsx
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { TripStatusCount } from '../../services/dashboard';
import { titleCaseLabel } from '../../lib/format';
import { AXIS_COLOR, MONO_FONT, STATUS_COLORS, TOOLTIP_BG, TOOLTIP_BORDER } from './chartTheme';
import styles from './charts.module.css';

export interface RideStatusChartProps {
  data: TripStatusCount[];
  loading?: boolean;
}

const LEGEND_STYLE = { fontFamily: MONO_FONT, fontSize: 11, color: AXIS_COLOR };

/** "Ride Status" dashboard panel — all-time ride counts grouped by TripStatus. */
export function RideStatusChart({ data, loading = false }: RideStatusChartProps) {
  if (loading) {
    return <div className={styles.loading}>Loading…</div>;
  }

  const nonZero = data.filter((d) => d.count > 0);
  if (nonZero.length === 0) {
    return <div className={styles.loading}>No rides recorded yet.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={nonZero}
          dataKey="count"
          nameKey="status"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          labelLine={false}
          label={({ name, percent }: { name: string; percent: number }) => `${titleCaseLabel(name)} ${Math.round(percent * 100)}%`}
        >
          {nonZero.map((entry) => (
            <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} stroke={TOOLTIP_BG} strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}`, borderRadius: 8, fontSize: 12 }}
          formatter={(value: number, name: string) => [`${value} rides`, titleCaseLabel(name)]}
        />
        <Legend formatter={(value: string) => titleCaseLabel(value)} wrapperStyle={LEGEND_STYLE} iconType="circle" iconSize={8} />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 5: Create the barrel file**

Create `apps/admin/src/components/charts/index.ts`:

```ts
export * from './RidesOverTimeChart';
export * from './RideStatusChart';
```

(Task 7 appends two more `export *` lines to this same file.)

- [ ] **Step 6: Wire into `Dashboard.tsx`**

In `apps/admin/src/routes/Dashboard.tsx`:

Replace the import block (the current lines importing `PlaceholderBox` and the dashboard services) with:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatTile } from '../components/StatTile';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { RideStatusChart, RidesOverTimeChart } from '../components/charts';
import {
  getDashboardStats,
  getRidesPerDay,
  getTripStatusBreakdown,
  listExpiringFranchises,
  listOverdueComplaints,
  listRecentTripActivity,
  type DashboardStats,
  type ExpiringFranchiseRow,
  type OverdueComplaintRow,
  type RecentTripActivityRow,
  type RidesPerDayPoint,
  type TripStatusCount,
} from '../services/dashboard';
import { formatRelativeTime, titleCaseLabel } from '../lib/format';
```

Add two state slots and fetch calls. Replace the `Dashboard` function's state/effect block:

```tsx
export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [overdue, setOverdue] = useState<OverdueComplaintRow[]>([]);
  const [overdueError, setOverdueError] = useState<string | null>(null);
  const [expiring, setExpiring] = useState<ExpiringFranchiseRow[]>([]);
  const [expiringError, setExpiringError] = useState<string | null>(null);
  const [activity, setActivity] = useState<RecentTripActivityRow[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [ridesPerDay, setRidesPerDay] = useState<RidesPerDayPoint[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<TripStatusCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [statsResult, overdueResult, expiringResult, activityResult, ridesResult, statusResult] = await Promise.all([
        getDashboardStats(),
        listOverdueComplaints(),
        listExpiringFranchises(),
        listRecentTripActivity(),
        getRidesPerDay(),
        getTripStatusBreakdown(),
      ]);
      if (cancelled) return;

      setStats(statsResult.data);
      setStatsError(statsResult.error);
      setOverdue(overdueResult.data);
      setOverdueError(overdueResult.error);
      setExpiring(expiringResult.data);
      setExpiringError(expiringResult.error);
      setActivity(activityResult.data);
      setActivityError(activityResult.error);
      setRidesPerDay(ridesResult.data);
      setStatusBreakdown(statusResult.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
```

Replace the two-chart block:

```tsx
      <div className="two-col">
        <div className="panel">
          <div className="panel-title">Rides Over Time (Week)</div>
          <PlaceholderBox label="Rides over time — chart" />
        </div>
        <div className="panel">
          <div className="panel-title">Ride Status</div>
          <PlaceholderBox label="Ride status — chart" />
        </div>
      </div>
```

with:

```tsx
      <div className="two-col">
        <div className="panel">
          <div className="panel-title">Rides Over Time (Week)</div>
          <RidesOverTimeChart data={ridesPerDay} loading={loading} />
        </div>
        <div className="panel">
          <div className="panel-title">Ride Status</div>
          <RideStatusChart data={statusBreakdown} loading={loading} />
        </div>
      </div>
```

- [ ] **Step 7: Typecheck**

Run from repo root: `npm run typecheck`
Expected: no errors (confirms `PlaceholderBox`'s import removal left no dangling reference).

- [ ] **Step 8: Manual verification**

Run: `npm run dev:admin`, sign in, open the Dashboard (default route).
Expected: "Rides Over Time (Week)" shows a 7-point line chart; "Ride Status" shows a donut with a legend; both keep the existing card size; no console errors.

- [ ] **Step 9: Commit**

```bash
git add apps/admin/src/components/charts apps/admin/src/routes/Dashboard.tsx
git commit -m "feat(admin): replace Dashboard chart placeholders with real Recharts charts"
```

---

### Task 7: Reports charts (`RidesRevenueChart`, `PeakHoursChart`)

**Files:**
- Create: `apps/admin/src/components/charts/RidesRevenueChart.tsx`
- Create: `apps/admin/src/components/charts/PeakHoursChart.tsx`
- Modify: `apps/admin/src/components/charts/index.ts`
- Modify: `apps/admin/src/routes/Reports.tsx`

**Interfaces:**
- Consumes: `RidesRevenuePoint`, `PeakHourBucket` (Task 3); `getRidesRevenueOverTime`, `getPeakHourHistogram` (Task 3, `../services/reports`); `formatCurrency` (`../lib/format`); chart theme constants (Task 6).
- Produces: `RidesRevenueChart(props: { data: RidesRevenuePoint[]; loading?: boolean })`, `PeakHoursChart(props: { data: PeakHourBucket[]; loading?: boolean })`.

- [ ] **Step 1: Create `RidesRevenueChart`**

Create `apps/admin/src/components/charts/RidesRevenueChart.tsx`:

```tsx
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RidesRevenuePoint } from '../../types/report';
import { formatCurrency } from '../../lib/format';
import { AXIS_COLOR, GRID_COLOR, LINE_COLOR, MONO_FONT, REVENUE_COLOR, TOOLTIP_BG, TOOLTIP_BORDER } from './chartTheme';
import styles from './charts.module.css';

export interface RidesRevenueChartProps {
  data: RidesRevenuePoint[];
  loading?: boolean;
}

const AXIS_TICK = { fill: AXIS_COLOR, fontFamily: MONO_FONT, fontSize: 10 };

/** "Rides / Revenue" report panel — completed rides (bars) and paid revenue (line) per day in the selected range. */
export function RidesRevenueChart({ data, loading = false }: RidesRevenueChartProps) {
  if (loading) {
    return <div className={styles.loading}>Loading…</div>;
  }
  if (data.length === 0) {
    return <div className={styles.loading}>No rides in this range.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="day" tick={AXIS_TICK} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
        <YAxis yAxisId="rides" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis yAxisId="revenue" orientation="right" tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}`, borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: AXIS_COLOR, fontFamily: MONO_FONT, fontSize: 10 }}
          formatter={(value: number, name: string) => (name === 'Revenue' ? [formatCurrency(value), name] : [`${value} rides`, name])}
        />
        <Bar yAxisId="rides" dataKey="rides" name="Rides" fill={LINE_COLOR} radius={[3, 3, 0, 0]} />
        <Line yAxisId="revenue" type="monotone" dataKey="revenue" name="Revenue" stroke={REVENUE_COLOR} strokeWidth={2} dot={{ r: 3, fill: REVENUE_COLOR }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Create `PeakHoursChart`**

Create `apps/admin/src/components/charts/PeakHoursChart.tsx`:

```tsx
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PeakHourBucket } from '../../types/report';
import { AXIS_COLOR, GRID_COLOR, LINE_COLOR, MONO_FONT, TOOLTIP_BG, TOOLTIP_BORDER } from './chartTheme';
import styles from './charts.module.css';

export interface PeakHoursChartProps {
  data: PeakHourBucket[];
  loading?: boolean;
}

const AXIS_TICK = { fill: AXIS_COLOR, fontFamily: MONO_FONT, fontSize: 9 };

/** "Peak Hours" report panel — completed rides per 2-hour window across the selected range. */
export function PeakHoursChart({ data, loading = false }: PeakHoursChartProps) {
  if (loading) {
    return <div className={styles.loading}>Loading…</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="hourLabel" tick={AXIS_TICK} axisLine={{ stroke: GRID_COLOR }} tickLine={false} interval={1} angle={-30} textAnchor="end" height={40} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}`, borderRadius: 8, fontSize: 12 }}
          formatter={(value: number) => [`${value} rides`, 'Completed']}
        />
        <Bar dataKey="count" name="Completed rides" fill={LINE_COLOR} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 3: Update the barrel file**

In `apps/admin/src/components/charts/index.ts`, add two lines so the file reads:

```ts
export * from './RidesOverTimeChart';
export * from './RideStatusChart';
export * from './RidesRevenueChart';
export * from './PeakHoursChart';
```

- [ ] **Step 4: Wire into `Reports.tsx`**

In `apps/admin/src/routes/Reports.tsx`, replace the import block:

```tsx
import { useEffect, useState } from 'react';
import { Select } from '../components/Select';
import { Button } from '../components/Button';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { StatTile } from '../components/StatTile';
import { PeakHoursChart, RidesRevenueChart } from '../components/charts';
import { getPeakHourHistogram, getReportSummary, getRidesRevenueOverTime, listTransactions, type ReportDateRange } from '../services/reports';
import type { PeakHourBucket, ReportSummary, RidesRevenuePoint, TransactionRow } from '../types/report';
import { formatCurrency, formatDateTime, paymentMethodLabel, titleCaseLabel } from '../lib/format';
import { downloadCsv, toCsv } from '../lib/csv';
import styles from './Reports.module.css';
```

Add chart state and fetch them alongside the existing summary/transactions call. Replace the `Reports` function's state + effect:

```tsx
export function Reports() {
  const [dateRange, setDateRange] = useState<ReportDateRange>('30d');
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [ridesRevenue, setRidesRevenue] = useState<RidesRevenuePoint[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHourBucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getReportSummary(dateRange),
      listTransactions(dateRange),
      getRidesRevenueOverTime(dateRange),
      getPeakHourHistogram(dateRange),
    ]).then(([s, t, rr, ph]) => {
      setSummary(s.data);
      setTransactions(t.data);
      setRidesRevenue(rr.data);
      setPeakHours(ph.data);
      setLoading(false);
    });
  }, [dateRange]);
```

Replace the two-chart block:

```tsx
      <div className="two-col">
        <div className="panel">
          <div className="panel-title">Rides / Revenue</div>
          <PlaceholderBox label="Rides / revenue — chart" />
        </div>
        <div className="panel">
          <div className="panel-title">Peak Hours</div>
          <PlaceholderBox label="Peak hours — chart" />
        </div>
      </div>
```

with:

```tsx
      <div className="two-col">
        <div className="panel">
          <div className="panel-title">Rides / Revenue</div>
          <RidesRevenueChart data={ridesRevenue} loading={loading} />
        </div>
        <div className="panel">
          <div className="panel-title">Peak Hours</div>
          <PeakHoursChart data={peakHours} loading={loading} />
        </div>
      </div>
```

- [ ] **Step 5: Typecheck**

Run from repo root: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Manual verification**

Run: `npm run dev:admin`, open Reports, switch the date range selector between "Last 7 days" / "Last 30 days" / "This quarter".
Expected: both charts re-render for each range with real data, no console errors, no layout shift.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/components/charts apps/admin/src/routes/Reports.tsx
git commit -m "feat(admin): replace Reports chart placeholders with real Recharts charts"
```

---

### Task 8: Real document images (`DocumentImage`)

**Files:**
- Create: `apps/admin/src/components/DocumentImage/DocumentImage.tsx`
- Create: `apps/admin/src/components/DocumentImage/DocumentImage.module.css`
- Create: `apps/admin/src/components/DocumentImage/index.ts`
- Modify: `apps/admin/src/components/DocumentPanel/DocumentPanel.tsx`
- Modify: `apps/admin/src/routes/DriverVerification.tsx`
- Modify: `apps/admin/src/routes/DiscountReview.tsx`

**Interfaces:**
- Consumes: `getSignedDocumentUrl` (Task 5, `../../services/documents`); `DocumentBucket` (Task 5).
- Produces: `DocumentImage(props: { bucket: DocumentBucket; path: string; alt: string; height?: number })`.

- [ ] **Step 1: Create `DocumentImage`**

Create `apps/admin/src/components/DocumentImage/DocumentImage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { getSignedDocumentUrl, type DocumentBucket } from '../../services/documents';
import styles from './DocumentImage.module.css';

export interface DocumentImageProps {
  bucket: DocumentBucket;
  path: string;
  alt: string;
  height?: number;
}

type LoadState = 'loading' | 'ready' | 'error';

/**
 * Renders a private-bucket document (driver verification photos, discount
 * ID photos) via a short-lived signed URL. Falls back to the existing
 * crossed-box `.ph-box` look — reused as a CSS class, not the
 * PlaceholderBox component — while loading or on failure, so a missing/
 * expired document still reads clearly as "no image" rather than a broken
 * `<img>` icon.
 */
export function DocumentImage({ bucket, path, alt, height = 160 }: DocumentImageProps) {
  const [state, setState] = useState<LoadState>('loading');
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setUrl(null);

    getSignedDocumentUrl(bucket, path).then((res) => {
      if (cancelled) return;
      if (res.error || !res.url) {
        setState('error');
        return;
      }
      setUrl(res.url);
      setState('ready');
    });

    return () => {
      cancelled = true;
    };
  }, [bucket, path]);

  if (state === 'ready' && url) {
    return <img src={url} alt={alt} className={styles.image} style={{ height }} />;
  }

  return (
    <div className={`ph-box ${styles.fallback}`} style={{ height }}>
      <span className="ph-box__label">{state === 'error' ? "Couldn't load document" : 'Loading…'}</span>
    </div>
  );
}
```

- [ ] **Step 2: Create the CSS**

Create `apps/admin/src/components/DocumentImage/DocumentImage.module.css`:

```css
.image {
  width: 100%;
  object-fit: cover;
  border-radius: var(--r-md);
  border: 1px solid var(--line);
  display: block;
}

.fallback {
  width: 100%;
}
```

- [ ] **Step 3: Create the barrel file**

Create `apps/admin/src/components/DocumentImage/index.ts`:

```ts
export * from './DocumentImage';
```

- [ ] **Step 4: Wire into `DocumentPanel.tsx`**

`DocumentPanel` currently renders a bare `PlaceholderBox` with no document identity — it needs the `storagePath` its caller (`DriverVerification.tsx`) already has on `VerificationCase.documents[].storagePath` (see `apps/admin/src/types/verification.ts`). Replace the whole file:

```tsx
import { Badge } from '../Badge';
import { DocumentImage } from '../DocumentImage';
import type { VerificationStatus } from '../../types/driver';
import { titleCaseLabel } from '../../lib/format';
import styles from './DocumentPanel.module.css';

const STATUS_TONE: Record<VerificationStatus, 'neutral' | 'success' | 'warn' | 'danger'> = {
  unsubmitted: 'neutral',
  pending: 'warn',
  approved: 'success',
  rejected: 'danger',
};

/** Wireframe screen 4 "Driver & tricycle verification" — one labelled document box per doc_type. */
export interface DocumentPanelProps {
  label: string;
  status: VerificationStatus;
  storagePath: string;
}

export function DocumentPanel({ label, status, storagePath }: DocumentPanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <Badge label={titleCaseLabel(status)} tone={STATUS_TONE[status]} />
      </div>
      <DocumentImage bucket="driver-docs" path={storagePath} alt={label} height={120} />
    </div>
  );
}
```

- [ ] **Step 5: Pass `storagePath` from `DriverVerification.tsx`**

In `apps/admin/src/routes/DriverVerification.tsx`, change:

```tsx
              <DocumentPanel key={doc.docType} label={doc.label} status={doc.status} />
```

to:

```tsx
              <DocumentPanel key={doc.docType} label={doc.label} status={doc.status} storagePath={doc.storagePath} />
```

- [ ] **Step 6: Wire into `DiscountReview.tsx`**

In `apps/admin/src/routes/DiscountReview.tsx`, update the import:

```tsx
import { DocumentImage } from '../components/DocumentImage';
```

(removing the `PlaceholderBox` import). Replace the two ID-photo blocks:

```tsx
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 6 }}>ID — Front</div>
              <PlaceholderBox label="ID Photo" height={160} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 6 }}>ID — Back</div>
              <PlaceholderBox label="ID Photo" height={160} />
            </div>
```

with:

```tsx
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 6 }}>ID — Front</div>
              <DocumentImage bucket="discount-ids" path={selected.idPhotoFrontPath} alt={`${selected.passengerName} — ID front`} height={160} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 6 }}>ID — Back</div>
              <DocumentImage bucket="discount-ids" path={selected.idPhotoBackPath} alt={`${selected.passengerName} — ID back`} height={160} />
            </div>
```

- [ ] **Step 7: Typecheck**

Run from repo root: `npm run typecheck`
Expected: no errors — confirms `DocumentPanelProps` now requires `storagePath` everywhere it's used, and `DiscountReview`'s `selected` (a `DiscountRow`) really does carry both path fields (`apps/admin/src/types/discount.ts`).

- [ ] **Step 8: Manual verification**

Run: `npm run dev:admin`. Open Driver Verification and select a pending case with real uploaded documents (per `docs/ADMIN_TODO.MD` F4, at least one real throwaway driver has uploaded documents in the live project) — confirm each document panel loads a real image. Open Discount Review; if no real `passenger_discounts` rows exist yet (noted as a known gap in `docs/ADMIN_TODO.MD` F10), confirm the empty-state list still renders correctly and, if a row does exist, that its ID photos load or show the "Couldn't load document" fallback rather than crashing.

- [ ] **Step 9: Commit**

```bash
git add apps/admin/src/components/DocumentImage apps/admin/src/components/DocumentPanel/DocumentPanel.tsx apps/admin/src/routes/DriverVerification.tsx apps/admin/src/routes/DiscountReview.tsx
git commit -m "feat(admin): render real signed document images instead of placeholders"
```

---

### Task 9: Live map (`LiveMap`)

**Files:**
- Create: `apps/admin/src/components/LiveMap/LiveMap.tsx`
- Create: `apps/admin/src/components/LiveMap/LiveMap.module.css`
- Create: `apps/admin/src/components/LiveMap/index.ts`
- Modify: `apps/admin/src/routes/RideMonitoring.tsx`

**Interfaces:**
- Consumes: `ActiveTricycleLocationCell` (Task 4); `getActiveTricycleLocations` (Task 4, `../services/monitoring`).
- Produces: `LiveMap(props: { cells: ActiveTricycleLocationCell[]; loading?: boolean })`.

- [ ] **Step 1: Create the map CSS**

Create `apps/admin/src/components/LiveMap/LiveMap.module.css`:

```css
.wrap {
  height: 420px;
  border-radius: var(--r-md);
  overflow: hidden;
  border: 1px solid var(--line);
}

.loading {
  height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink-soft);
  font-size: 12px;
}

.markerBadge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: var(--primary);
  color: #fff;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  box-shadow: var(--shadow-button);
  border: 2px solid #fff;
}

.popup {
  font-size: 12px;
}

.popupTitle {
  font-family: var(--mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--ink-soft);
  margin-bottom: 4px;
}
```

- [ ] **Step 2: Create `LiveMap`**

Create `apps/admin/src/components/LiveMap/LiveMap.tsx`:

```tsx
import { DivIcon } from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import type { ActiveTricycleLocationCell } from '../../services/monitoring';
import styles from './LiveMap.module.css';

export interface LiveMapProps {
  cells: ActiveTricycleLocationCell[];
  loading?: boolean;
}

/**
 * General Santos City centre — transcribed from packages/ui's OsmMap
 * DEFAULT_CENTER (packages/ui is React Native-only and can't be imported
 * into this Vite app directly).
 */
const DEFAULT_CENTER: [number, number] = [6.116243, 125.171738];
const DEFAULT_ZOOM = 13;

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function cellIcon(count: number): DivIcon {
  return new DivIcon({
    html: renderToStaticMarkup(<div className={styles.markerBadge}>{count}</div>),
    className: '', // suppress Leaflet's default marker box/shadow classes
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/**
 * Ride Monitoring live map (FR-5.1, 5.2). Plots grid-snapped driver
 * clusters, never exact coordinates — getActiveTricycleLocations() already
 * rounds every point before this component ever sees it (NFR-2.5). OSM
 * tiles, same source the Driver/Passenger apps use; a browser <img>-based
 * TileLayer can't set a custom User-Agent the way the mobile WebView does,
 * which is an accepted tradeoff for this low-volume, admin-only screen.
 */
export function LiveMap({ cells, loading = false }: LiveMapProps) {
  if (loading) {
    return <div className={styles.loading}>Loading…</div>;
  }

  return (
    <div className={styles.wrap}>
      <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        {cells.map((cell) => (
          <Marker key={`${cell.lat},${cell.lng}`} position={[cell.lat, cell.lng]} icon={cellIcon(cell.count)}>
            <Popup>
              <div className={styles.popup}>
                <div className={styles.popupTitle}>{cell.count === 1 ? '1 tricycle' : `${cell.count} tricycles`}</div>
                {cell.driverNames.join(', ')}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
```

- [ ] **Step 3: Create the barrel file**

Create `apps/admin/src/components/LiveMap/index.ts`:

```ts
export * from './LiveMap';
```

- [ ] **Step 4: Import Leaflet's CSS globally**

In `apps/admin/src/main.tsx`, add the Leaflet stylesheet import above the existing `./styles/globals.css` import (Leaflet's own CSS must load before any component-level override):

```tsx
import 'leaflet/dist/leaflet.css';
import './styles/globals.css';
```

- [ ] **Step 5: Wire into `RideMonitoring.tsx`**

Update the imports:

```tsx
import { useEffect, useState } from 'react';
import { LiveMap } from '../components/LiveMap';
import { Avatar } from '../components/Avatar';
import { Badge } from '../components/Badge';
import { getActiveTricycleLocations, listActiveTricycles, type ActiveTricycleLocationCell } from '../services/monitoring';
import type { ActiveTricycleRow } from '../types/ride';
import styles from './RideMonitoring.module.css';
```

Replace the component body's state/effect and the map placeholder:

```tsx
export function RideMonitoring() {
  const [tricycles, setTricycles] = useState<ActiveTricycleRow[]>([]);
  const [cells, setCells] = useState<ActiveTricycleLocationCell[]>([]);
  const [mapLoading, setMapLoading] = useState(true);

  useEffect(() => {
    listActiveTricycles().then((res) => setTricycles(res.data));
    getActiveTricycleLocations().then((res) => {
      setCells(res.data);
      setMapLoading(false);
    });
  }, []);

  return (
    <div className="page">
      <div className={styles.layout}>
        <div className="panel">
          <div className={styles.mapHeader}>
            <div className="panel-title" style={{ marginBottom: 0 }}>
              Active Tricycles
            </div>
            <Badge label="Live" tone="success" />
          </div>
          <LiveMap cells={cells} loading={mapLoading} />
          <p className={styles.caption}>
            Locations shown are coarse and update only while a Driver is available or on an active trip — no continuous GPS trail is
            persisted (NFR-2.5).
          </p>
        </div>
```

(The rest of the file — the "On the Clock" list panel — is unchanged.)

- [ ] **Step 6: Typecheck**

Run from repo root: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Manual verification**

Run: `npm run dev:admin`, open Ride Monitoring.
Expected: real OSM tiles render (attribution visible bottom-right), any currently-available driver with a location fix shows as a numbered marker, clicking a marker shows a popup with driver name(s), the caption text is unchanged, no console errors. If no driver is currently `is_available` with a location, the map still renders (just with no markers) — confirm that empty case doesn't error either.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src/components/LiveMap apps/admin/src/routes/RideMonitoring.tsx apps/admin/src/main.tsx
git commit -m "feat(admin): replace Ride Monitoring map placeholder with a real coarse-grid Leaflet map"
```

---

### Task 10: Visual refinement (shared styles + `StatTile`)

**Files:**
- Modify: `apps/admin/src/styles/tokens.css`
- Modify: `apps/admin/src/styles/globals.css`
- Modify: `apps/admin/src/components/StatTile/StatTile.tsx`
- Modify: `apps/admin/src/components/StatTile/StatTile.module.css`

**Interfaces:**
- Produces: `StatTile` gains an optional `tone` prop (`'primary' | 'success' | 'warn' | 'danger' | 'neutral'`, default `'neutral'`) driving a left accent bar — purely additive, no existing call site breaks by omitting it.

This task only touches CSS/typography/hover treatment inside the existing layout — no component is added, removed, or repositioned.

- [ ] **Step 1: Soften `.panel-title` off the wireframe mono/uppercase look**

In `apps/admin/src/styles/globals.css`, replace:

```css
.panel-title {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.03em;
  color: var(--ink-soft);
  text-transform: uppercase;
  margin-bottom: var(--sp-md);
}
```

with:

```css
.panel-title {
  font-family: var(--font-brand);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--ink);
  margin-bottom: var(--sp-md);
}
```

- [ ] **Step 2: Add a hover lift to `.panel`**

In `apps/admin/src/styles/globals.css`, replace:

```css
.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  padding: var(--sp-lg);
  box-shadow: var(--shadow-card);
}
```

with:

```css
.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  padding: var(--sp-lg);
  box-shadow: var(--shadow-card);
  transition: box-shadow 150ms ease, border-color 150ms ease;
}
```

(No `:hover` rule on `.panel` itself — most panels aren't interactive as a whole unit. The row-level hover in `DataTable.module.css` and the case-list buttons in `DiscountReview`/`DriverVerification` already have their own hover treatment; this transition just makes any future/existing hover state on a `.panel`-based clickable element animate smoothly instead of snapping.)

- [ ] **Step 3: Add a tone accent color set to `tokens.css`**

In `apps/admin/src/styles/tokens.css`, after the existing `--danger-soft` line, add:

```css
  --warn: #a06b00;
  --warn-soft: #fff6dc;
```

(`Badge.module.css`'s `.warn` currently hardcodes `#7a5b00`/`#fff6dc` inline rather than via a token — leave that file as-is, this just gives `StatTile` and any future component a named warn token to reuse instead of a fourth hardcoded hex.)

- [ ] **Step 4: Give `StatTile` an optional tone accent**

Replace `apps/admin/src/components/StatTile/StatTile.tsx`:

```tsx
import styles from './StatTile.module.css';

export type StatTileTone = 'primary' | 'success' | 'warn' | 'danger' | 'neutral';

/** Dashboard/Reports metric card. */
export interface StatTileProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: StatTileTone;
}

export function StatTile({ label, value, hint, tone = 'neutral' }: StatTileProps) {
  return (
    <div className={`${styles.tile} ${styles[tone]}`}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}
```

Replace `apps/admin/src/components/StatTile/StatTile.module.css`:

```css
.tile {
  display: flex;
  flex-direction: column;
  gap: var(--sp-sm);
  padding: var(--sp-lg);
  border: 1px solid var(--line);
  border-left: 3px solid var(--line);
  border-radius: var(--r-md);
  background: var(--panel);
  box-shadow: var(--shadow-card);
  transition: box-shadow 150ms ease;
}

.tile:hover {
  box-shadow: 0 6px 16px rgba(0, 46, 96, 0.14);
}

.neutral {
  border-left-color: var(--line-strong);
}

.primary {
  border-left-color: var(--primary);
}

.success {
  border-left-color: var(--success);
}

.warn {
  border-left-color: var(--warn);
}

.danger {
  border-left-color: var(--danger);
}

.label {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.03em;
  color: var(--ink-soft);
  text-transform: uppercase;
}

.value {
  font-family: var(--font-brand);
  font-size: 26px;
  font-weight: 700;
  color: var(--ink);
}

.hint {
  font-size: 11px;
  color: var(--ink-faint);
}
```

- [ ] **Step 5: Apply tones on the Dashboard's stat tiles**

In `apps/admin/src/routes/Dashboard.tsx`, update the `stat-grid` block:

```tsx
      <div className="stat-grid">
        <StatTile label="Total Drivers" value={loading ? '—' : (stats?.totalDrivers ?? '—')} tone="primary" />
        <StatTile label="Active Rides" value={loading ? '—' : (stats?.activeRides ?? '—')} tone="success" />
        <StatTile label="Pending Verifications" value={loading ? '—' : (stats?.pendingVerifications ?? '—')} tone="warn" />
        <StatTile label="Open Complaints" value={loading ? '—' : (stats?.openComplaints ?? '—')} tone="danger" />
        <StatTile label="Overdue Complaints" value={loading ? '—' : overdue.length} hint="Past 3-business-day ARTA target" tone="danger" />
        <StatTile label="Expiring Franchises" value={loading ? '—' : expiring.length} hint="MTOP renewal due within 30 days" tone="warn" />
      </div>
```

(Every other `<StatTile>` call site in the app — `Reports.tsx`, etc. — keeps working unchanged since `tone` defaults to `'neutral'`.)

- [ ] **Step 6: Typecheck**

Run from repo root: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Manual verification**

Run: `npm run dev:admin`. Visually check every route (Dashboard, Drivers, Verification, Passengers, Ride Monitoring, Complaints, Reports, PSO Users, System Settings, Discount Review, Rating Oversight): panel titles read as normal-weight headings instead of all-caps monospace, Dashboard's stat tiles show a colored left accent per metric, nothing shifted position or broke.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src/styles/tokens.css apps/admin/src/styles/globals.css apps/admin/src/components/StatTile apps/admin/src/routes/Dashboard.tsx
git commit -m "style(admin): soften wireframe panel-title/StatTile treatment with a tone accent"
```

---
