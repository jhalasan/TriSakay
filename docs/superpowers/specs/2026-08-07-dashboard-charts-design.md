# Dashboard charts — design spec

**Date:** 2026-08-07
**Scope:** Replace the two placeholder wireframes on the Admin Dashboard ("Rides Over Time (Week)" and "Ride Status") with functional Recharts charts.

## Problem

`apps/admin/src/routes/Dashboard.tsx` renders `<PlaceholderBox>` (a CSS crossed-X box, wireframe kit §Part 0) for both the "Rides Over Time (Week)" and "Ride Status" panels instead of real charts. No chart library is installed in `apps/admin` yet. The app has no dark theme (`tokens.css` declares `color-scheme: light` only, single palette), so no theme-branching is needed.

## Design

**Dependency**: add `recharts` to `apps/admin/package.json`.

**New `apps/admin/src/components/charts/`**:
- `chartTheme.ts` — exports literal hex colors transcribed from `tokens.css` / `Badge.module.css` (Recharts needs literal color strings, not CSS custom properties). `LINE_COLOR = '#002E60'` (--primary). `STATUS_COLORS` keyed by `TripStatus`, reusing the exact `Badge` tone colors so the donut stays visually consistent with status badges elsewhere: `forming: '#e3b341'` (warn), `active: '#002E60'` (info/primary), `completed: '#477434'` (success), `cancelled: '#B3261E'` (danger).
- `RidesOverTimeChart.tsx` — `ResponsiveContainer` (height 220, matching `PlaceholderBox`'s default so the `.panel` card doesn't change size) > `LineChart` with `CartesianGrid` (stroke `--line-soft` equivalent `#EBEFF2`), `XAxis` (Mon–Sun), `YAxis` (ride count), `Tooltip`, and a single `Line` (`type="monotone"`, stroke `LINE_COLOR`, `strokeWidth={2}`, no dots or small dots). Props: `data: RidesPerDay[]`.
- `RideStatusChart.tsx` — `ResponsiveContainer` (height 220) > `PieChart` with `Pie` (`innerRadius`/`outerRadius` set for a donut), one `Cell` per status colored via `STATUS_COLORS`, `Legend`, `Tooltip`, and labels showing count + percent. Props: `data: RideStatusCount[]`.
- Axis/legend/tooltip text sized and colored to match the existing `.panel-title` aesthetic (`--mono`, small size, `--ink-soft`); tooltip background/border/radius matches `.panel` (`--panel` bg, `--line` border, `--r-sm`).

**Data** (`apps/admin/src/types/ride.ts`):
```ts
export interface RidesPerDay { day: string; count: number }
export interface RideStatusCount { status: TripStatus; count: number }
```

**Mock data** (`apps/admin/src/mocks/rides.ts`): `MOCK_RIDES_PER_DAY` (7 entries, Mon–Sun, realistic completed-ride counts) and `MOCK_RIDE_STATUS_COUNTS` (4 entries, one per `TripStatus`).

**Service** (`apps/admin/src/services/monitoring.ts`): add `getRidesOverTime()` and `getRideStatusBreakdown()`, following the existing `ServiceResult`/`wait()` mock pattern in this file, each with a `// TODO: replace mock with a real Supabase aggregate query against trips/ride_requests once live (see docs/CONTEXT.MD §9)` comment.

**`Dashboard.tsx`**:
- Fetch both new datasets in the existing `Promise.all`.
- Replace the two `<PlaceholderBox>` calls with `<RidesOverTimeChart data={...} />` and `<RideStatusChart data={...} />`, inside the same unchanged `.panel`/`.panel-title` wrappers.
- While `loading` is true, render a plain `Loading…` placeholder at the same 220px height in place of the chart (avoids layout shift; doesn't reuse `PlaceholderBox`, which stays reserved for true wireframe-stage sections).

**Status label**: chart uses the app's real `TripStatus` values/labels (`Forming`, `Active`, `Completed`, `Cancelled`) via the existing `titleCaseLabel` helper — no separate "Pending" relabeling, so it stays consistent with the `Badge` labels used in "Recent Activity" on the same page.

## Explicitly out of scope

- `PlaceholderBox` itself is not removed — still used by `Reports.tsx`, `RideMonitoring.tsx`, and `DocumentPanel.tsx`. Only its two call sites in `Dashboard.tsx` are removed.
- No dark-mode styling — the app has no dark theme to branch on.
- No real backend wiring — `getRidesOverTime()`/`getRideStatusBreakdown()` return mock data with a `TODO` marking the future Supabase integration point, per the existing pattern in `services/monitoring.ts` and `services/reports.ts`.

## Testing

No existing test coverage on `Dashboard.tsx` (matches the existing pattern for route-level components in this codebase — see `apps/admin/tests/`, which covers services/lib, not routes). Verified by: `npm run build` (typecheck via `tsc` in the Vite build) from `apps/admin`, and a manual check via the dev server that both charts render with real tooltips/legend/grid and no console errors, and resize correctly.
