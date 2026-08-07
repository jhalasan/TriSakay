# Dashboard Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two `<PlaceholderBox>` wireframes on the Admin Dashboard ("Rides Over Time (Week)", "Ride Status") with real, responsive Recharts charts.

**Architecture:** Add `recharts` to `apps/admin`. Add two typed mock datasets and two new service functions (mirroring the existing mock-service pattern). Build two presentational chart components under `apps/admin/src/components/charts/` that consume that data. Wire both into `Dashboard.tsx` in place of the placeholders, inside the same unchanged `.panel` wrappers.

**Tech Stack:** React 19, TypeScript, Vite, Recharts 3.x, `node:test` (existing test runner for the service layer — no component-testing library exists in this repo, matching the established pattern).

## Global Constraints

- Chart library: Recharts (per spec decision — no other chart library exists in the repo).
- No dark-mode branching — the app has only one theme (`tokens.css`: `color-scheme: light`).
- Ride Status chart uses the app's real `TripStatus` values/labels (`forming`/`active`/`completed`/`cancelled` → `Forming`/`Active`/`Completed`/`Cancelled` via `titleCaseLabel`) — no separate "Pending" relabeling (per spec decision).
- Both charts render at `height={220}` inside `ResponsiveContainer` so the `.panel` cards keep their current size (matches `PlaceholderBox`'s default height).
- Colors are literal hex values transcribed from `apps/admin/src/styles/tokens.css` and `apps/admin/src/components/Badge/Badge.module.css` (Recharts requires literal color strings, not CSS custom properties) — comment each with the token/class it mirrors.
- `PlaceholderBox` itself is not deleted — it's still used by `Reports.tsx`, `RideMonitoring.tsx`, `DocumentPanel.tsx`. Only its two call sites in `Dashboard.tsx` are removed.
- Mock service functions get a `// TODO: replace mock with a real Supabase aggregate query against trips/ride_requests once live (see docs/CONTEXT.MD §9)` comment, matching the existing note style in `services/monitoring.ts`.
- File imports of local `.ts` modules use explicit `.ts` extensions (`allowImportingTsExtensions` in `apps/admin/tsconfig.json`) — e.g. `from '../mocks/rides.ts'`. Component imports (resolving to a folder's `index.ts` barrel) omit the extension — e.g. `from '../components/StatTile'`.

---

### Task 1: Add `recharts` dependency

**Files:**
- Modify: `apps/admin/package.json`

**Interfaces:**
- Produces: `recharts` importable from anywhere in `apps/admin/src`.

- [ ] **Step 1: Add the dependency**

In `apps/admin/package.json`, add to `"dependencies"` (keep alphabetical with the existing entries):

```json
    "recharts": "^3.10.1",
```

So the block reads:

```json
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-router-dom": "^7.1.1",
    "recharts": "^3.10.1",
    "zustand": "^5.0.2",
    "@trisakay/shared": "1.0.0",
    "@trisakay/utils": "1.0.0"
  },
```

- [ ] **Step 2: Install**

Run from the repo root: `npm install`
Expected: lockfile updates, `node_modules/recharts` exists, no peer-dependency errors (recharts 3.x declares `react`/`react-dom` `^19.0.0` as a supported peer range).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json apps/admin/package.json
git commit -m "chore(admin): add recharts dependency for dashboard charts"
```

---

### Task 2: Ride chart types, mock data, and service functions

**Files:**
- Modify: `apps/admin/src/types/ride.ts`
- Modify: `apps/admin/src/mocks/rides.ts`
- Modify: `apps/admin/src/services/monitoring.ts`
- Modify: `apps/admin/tests/services.test.ts`

**Interfaces:**
- Produces:
  - `RidesPerDay { day: string; count: number }` (types/ride.ts)
  - `RideStatusCount { status: TripStatus; count: number }` (types/ride.ts)
  - `MOCK_RIDES_PER_DAY: RidesPerDay[]` (mocks/rides.ts)
  - `MOCK_RIDE_STATUS_COUNTS: RideStatusCount[]` (mocks/rides.ts)
  - `getRidesOverTime(): Promise<ServiceResult<RidesPerDay[]>>` (services/monitoring.ts)
  - `getRideStatusBreakdown(): Promise<ServiceResult<RideStatusCount[]>>` (services/monitoring.ts)

- [ ] **Step 1: Write the failing test**

Open `apps/admin/tests/services.test.ts`. Change the existing monitoring import (line 7) from:

```ts
import { listActiveTricycles, listRecentActivity } from '../src/services/monitoring.ts';
```

to:

```ts
import { getRideStatusBreakdown, getRidesOverTime, listActiveTricycles, listRecentActivity } from '../src/services/monitoring.ts';
```

Then replace the existing `monitoring service resolves...` test (currently around line 64-68) with:

```ts
test('monitoring service resolves active tricycles, recent activity, and dashboard chart data', async () => {
  const [tricycles, activity, ridesOverTime, statusBreakdown] = await Promise.all([
    listActiveTricycles(),
    listRecentActivity(),
    getRidesOverTime(),
    getRideStatusBreakdown(),
  ]);
  assert.ok(Array.isArray(tricycles.data));
  assert.ok(Array.isArray(activity.data));

  assert.equal(ridesOverTime.data.length, 7);
  assert.ok(ridesOverTime.data.every((d) => typeof d.day === 'string' && typeof d.count === 'number'));

  assert.equal(statusBreakdown.data.length, 4);
  const statuses = statusBreakdown.data.map((d) => d.status).sort();
  assert.deepEqual(statuses, ['active', 'cancelled', 'completed', 'forming']);
  assert.ok(statusBreakdown.data.every((d) => typeof d.count === 'number'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace apps/admin run test`
Expected: FAIL — `getRidesOverTime`/`getRideStatusBreakdown` are not exported from `services/monitoring.ts` (TypeScript/module resolution error).

- [ ] **Step 3: Add the types**

In `apps/admin/src/types/ride.ts`, append after the existing `RecentActivityRow` interface:

```ts

/** One point on the "Rides Over Time (Week)" dashboard chart — completed rides for a single day. */
export interface RidesPerDay {
  day: string; // e.g. 'Mon'
  count: number;
}

/** One slice of the "Ride Status" dashboard donut chart. */
export interface RideStatusCount {
  status: TripStatus;
  count: number;
}
```

- [ ] **Step 4: Add the mock data**

In `apps/admin/src/mocks/rides.ts`, update the import line and append two new exports:

```ts
import type { ActiveTricycleRow, RecentActivityRow, RidesPerDay, RideStatusCount } from '../types/ride';
```

```ts

/** Completed rides per day, Monday–Sunday, for the current week. */
export const MOCK_RIDES_PER_DAY: RidesPerDay[] = [
  { day: 'Mon', count: 42 },
  { day: 'Tue', count: 51 },
  { day: 'Wed', count: 47 },
  { day: 'Thu', count: 58 },
  { day: 'Fri', count: 73 },
  { day: 'Sat', count: 89 },
  { day: 'Sun', count: 61 },
];

/** Ride counts grouped by TripStatus, for the "Ride Status" donut chart. */
export const MOCK_RIDE_STATUS_COUNTS: RideStatusCount[] = [
  { status: 'completed', count: 421 },
  { status: 'active', count: 12 },
  { status: 'forming', count: 5 },
  { status: 'cancelled', count: 34 },
];
```

- [ ] **Step 5: Add the service functions**

In `apps/admin/src/services/monitoring.ts`, update the imports and append two new functions:

```ts
import { MOCK_ACTIVE_TRICYCLES, MOCK_RECENT_ACTIVITY, MOCK_RIDES_PER_DAY, MOCK_RIDE_STATUS_COUNTS } from '../mocks/rides.ts';
import { wait } from '../mocks/delay.ts';
import type { ActiveTricycleRow, RecentActivityRow, RidesPerDay, RideStatusCount } from '../types/ride';
import type { ServiceResult } from './drivers';
```

```ts

/**
 * Dashboard "Rides Over Time (Week)" chart data.
 * TODO: replace mock with a real Supabase aggregate query against
 * trips/ride_requests once live (see docs/CONTEXT.MD §9).
 */
export async function getRidesOverTime(): Promise<ServiceResult<RidesPerDay[]>> {
  await wait();
  return { data: MOCK_RIDES_PER_DAY, error: null };
}

/**
 * Dashboard "Ride Status" chart data.
 * TODO: replace mock with a real Supabase aggregate query against
 * trips/ride_requests once live (see docs/CONTEXT.MD §9).
 */
export async function getRideStatusBreakdown(): Promise<ServiceResult<RideStatusCount[]>> {
  await wait();
  return { data: MOCK_RIDE_STATUS_COUNTS, error: null };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm --workspace apps/admin run test`
Expected: PASS — all tests in `services.test.ts`, including the updated monitoring test.

- [ ] **Step 7: Typecheck**

Run from repo root: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src/types/ride.ts apps/admin/src/mocks/rides.ts apps/admin/src/services/monitoring.ts apps/admin/tests/services.test.ts
git commit -m "feat(admin): add mock data and service functions for dashboard charts"
```

---

### Task 3: Chart theme + "Rides Over Time" line chart component

**Files:**
- Create: `apps/admin/src/components/charts/chartTheme.ts`
- Create: `apps/admin/src/components/charts/charts.module.css`
- Create: `apps/admin/src/components/charts/RidesOverTimeChart.tsx`
- Create: `apps/admin/src/components/charts/index.ts`

**Interfaces:**
- Consumes: `RidesPerDay` (from Task 2, `apps/admin/src/types/ride.ts`).
- Produces: `RidesOverTimeChart(props: { data: RidesPerDay[]; loading?: boolean })`, and theme constants `LINE_COLOR`, `GRID_COLOR`, `AXIS_COLOR`, `TOOLTIP_BG`, `TOOLTIP_BORDER`, `MONO_FONT`, `STATUS_COLORS` for reuse by Task 4.

- [ ] **Step 1: Create the shared chart theme**

Create `apps/admin/src/components/charts/chartTheme.ts`:

```ts
import type { TripStatus } from '../../types/ride';

/**
 * Recharts requires literal color strings, not CSS custom properties, so
 * these are transcribed by hand from styles/tokens.css and
 * Badge/Badge.module.css. Keep in sync if either source changes.
 */
export const LINE_COLOR = '#002E60'; // --primary
export const GRID_COLOR = '#EBEFF2'; // --line-soft
export const AXIS_COLOR = '#5A646B'; // --ink-soft
export const TOOLTIP_BG = '#FFFFFF'; // --panel
export const TOOLTIP_BORDER = '#DCE2E6'; // --line
export const MONO_FONT = 'ui-monospace, Menlo, Consolas, monospace'; // --mono

/** Mirrors Badge's tone colors so the Ride Status donut matches status badges elsewhere on the dashboard. */
export const STATUS_COLORS: Record<TripStatus, string> = {
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

- [ ] **Step 3: Create the line chart component**

Create `apps/admin/src/components/charts/RidesOverTimeChart.tsx`:

```tsx
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RidesPerDay } from '../../types/ride';
import { AXIS_COLOR, GRID_COLOR, LINE_COLOR, MONO_FONT, TOOLTIP_BG, TOOLTIP_BORDER } from './chartTheme';
import styles from './charts.module.css';

export interface RidesOverTimeChartProps {
  data: RidesPerDay[];
  loading?: boolean;
}

const AXIS_TICK = { fill: AXIS_COLOR, fontFamily: MONO_FONT, fontSize: 10 };

/** "Rides Over Time (Week)" dashboard panel — completed rides per day, Mon–Sun. */
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
        <Line
          type="monotone"
          dataKey="count"
          name="Completed rides"
          stroke={LINE_COLOR}
          strokeWidth={2}
          dot={{ r: 3, fill: LINE_COLOR }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 4: Create the barrel file**

Create `apps/admin/src/components/charts/index.ts`:

```ts
export * from './RidesOverTimeChart';
```

(Task 4 appends a second `export *` line to this same file — do not overwrite it there.)

- [ ] **Step 5: Typecheck**

Run from repo root: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/components/charts/chartTheme.ts apps/admin/src/components/charts/charts.module.css apps/admin/src/components/charts/RidesOverTimeChart.tsx apps/admin/src/components/charts/index.ts
git commit -m "feat(admin): add RidesOverTimeChart component"
```

---

### Task 4: "Ride Status" donut chart component

**Files:**
- Create: `apps/admin/src/components/charts/RideStatusChart.tsx`
- Modify: `apps/admin/src/components/charts/index.ts`

**Interfaces:**
- Consumes: `RideStatusCount` (Task 2, `types/ride.ts`); `AXIS_COLOR`, `MONO_FONT`, `STATUS_COLORS`, `TOOLTIP_BG`, `TOOLTIP_BORDER` (Task 3, `chartTheme.ts`); `titleCaseLabel` (`apps/admin/src/lib/format.ts`); `styles.loading` (Task 3, `charts.module.css`).
- Produces: `RideStatusChart(props: { data: RideStatusCount[]; loading?: boolean })`.

- [ ] **Step 1: Create the donut chart component**

Create `apps/admin/src/components/charts/RideStatusChart.tsx`:

```tsx
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { RideStatusCount } from '../../types/ride';
import { titleCaseLabel } from '../../lib/format';
import { AXIS_COLOR, MONO_FONT, STATUS_COLORS, TOOLTIP_BG, TOOLTIP_BORDER } from './chartTheme';
import styles from './charts.module.css';

export interface RideStatusChartProps {
  data: RideStatusCount[];
  loading?: boolean;
}

const LEGEND_STYLE = { fontFamily: MONO_FONT, fontSize: 11, color: AXIS_COLOR };

/** "Ride Status" dashboard panel — ride counts grouped by TripStatus. */
export function RideStatusChart({ data, loading = false }: RideStatusChartProps) {
  if (loading) {
    return <div className={styles.loading}>Loading…</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="status"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          labelLine={false}
          label={({ name, percent }: { name: string; percent: number }) => `${titleCaseLabel(name)} ${Math.round(percent * 100)}%`}
        >
          {data.map((entry) => (
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

- [ ] **Step 2: Update the barrel file**

In `apps/admin/src/components/charts/index.ts`, add a second line so the file reads:

```ts
export * from './RidesOverTimeChart';
export * from './RideStatusChart';
```

- [ ] **Step 3: Typecheck**

Run from repo root: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/components/charts/RideStatusChart.tsx apps/admin/src/components/charts/index.ts
git commit -m "feat(admin): add RideStatusChart component"
```

---

### Task 5: Wire both charts into the Dashboard

**Files:**
- Modify: `apps/admin/src/routes/Dashboard.tsx`

**Interfaces:**
- Consumes: `RidesOverTimeChart`, `RideStatusChart` (Tasks 3–4, `../components/charts`); `getRidesOverTime`, `getRideStatusBreakdown` (Task 2, `../services/monitoring`); `RidesPerDay`, `RideStatusCount` (Task 2, `../types/ride`).

- [ ] **Step 1: Update imports**

In `apps/admin/src/routes/Dashboard.tsx`, replace the import block (lines 1-13) with:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatTile } from '../components/StatTile';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { RideStatusChart, RidesOverTimeChart } from '../components/charts';
import { listDrivers } from '../services/drivers';
import { getRideStatusBreakdown, getRidesOverTime, listActiveTricycles, listRecentActivity } from '../services/monitoring';
import { listVerificationCases } from '../services/verification';
import { listComplaints } from '../services/complaints';
import type { RecentActivityRow, RideStatusCount, RidesPerDay } from '../types/ride';
import { titleCaseLabel } from '../lib/format';
```

(This drops the now-unused `PlaceholderBox` import.)

- [ ] **Step 2: Add chart state and fetch the new data**

Replace the `Dashboard` function body's state + effect (from `export function Dashboard() {` through the closing of the `useEffect`) with:

```tsx
export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<RecentActivityRow[]>([]);
  const [ridesOverTime, setRidesOverTime] = useState<RidesPerDay[]>([]);
  const [rideStatus, setRideStatus] = useState<RideStatusCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [drivers, tricycles, cases, complaints, recent, overTime, statusBreakdown] = await Promise.all([
        listDrivers(),
        listActiveTricycles(),
        listVerificationCases(),
        listComplaints(),
        listRecentActivity(),
        getRidesOverTime(),
        getRideStatusBreakdown(),
      ]);
      if (cancelled) return;
      setStats({
        totalDrivers: drivers.data.length,
        activeRides: tricycles.data.filter((t) => t.tripStatus === 'active').length,
        pendingVerifications: cases.data.filter((c) => c.overallStatus === 'pending').length,
        openComplaints: complaints.data.filter((c) => !['resolved', 'dismissed'].includes(c.status)).length,
      });
      setActivity(recent.data);
      setRidesOverTime(overTime.data);
      setRideStatus(statusBreakdown.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
```

- [ ] **Step 3: Replace the placeholder panels**

Replace:

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
          <RidesOverTimeChart data={ridesOverTime} loading={loading} />
        </div>
        <div className="panel">
          <div className="panel-title">Ride Status</div>
          <RideStatusChart data={rideStatus} loading={loading} />
        </div>
      </div>
```

- [ ] **Step 4: Typecheck**

Run from repo root: `npm run typecheck`
Expected: no errors (confirms `PlaceholderBox` removal left no dangling references and the new props/types line up).

- [ ] **Step 5: Run the full admin test suite**

Run: `npm --workspace apps/admin run test`
Expected: PASS (unaffected by this UI-only change, but confirms nothing else broke).

- [ ] **Step 6: Manual verification in the browser**

Run: `npm run dev:admin`, open the printed local URL, navigate to the Dashboard (default route).
Expected:
- "Rides Over Time (Week)" shows a line chart with 7 points (Mon–Sun), grid lines, and a tooltip on hover.
- "Ride Status" shows a donut chart with 4 colored slices, a legend below it, and count + percent visible (in labels/tooltip).
- Both panels keep their existing card size/spacing/rounded corners/shadow (no layout shift vs. before).
- Resize the browser window (or devtools responsive mode) — both charts resize fluidly, no overflow or clipping.
- Open the browser devtools console — no errors or warnings.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/routes/Dashboard.tsx
git commit -m "feat(admin): replace dashboard chart placeholders with Recharts charts"
```

---
