# Admin: real charts, real document images, real map, visual refinement — design spec

**Date:** 2026-08-18
**Scope:** `apps/admin` (+ `packages/services/src/admin/*` for the new backend queries it needs). Replaces the remaining `PlaceholderBox`/wireframe artifacts with real, backend-driven content, and refines (does not restructure) the existing visual system.

## Problem

Per `docs/ADMIN_TODO.MD`, every admin screen is backend-wired except four things that were deliberately deferred:
1. Two chart placeholders on Dashboard ("Rides Over Time", "Ride Status") and two on Reports ("Rides / Revenue", "Peak Hours") — blocked on "no charting library chosen" (open decision #4).
2. ID-photo placeholders on Discount Review (front/back) and document placeholders on Driver Verification (`DocumentPanel`) — "no image rendering yet."
3. The live map on Ride Monitoring — deferred pending a map-library decision, and constrained by NFR-2.5 ("locations shown are coarse... no continuous GPS trail").
4. The overall visual system still reads as a wireframe (`.ph-box` crossed-X, all-caps monospace panel titles, flat thin-border cards) even though the brand palette (`tokens.css`) is already applied.

This pass resolves 1–3 with real data and closes the remaining "wireframe" surface texture in 4, without restructuring layout (sidebar/topbar/card composition stay as they are).

## Part 1 — Charts

**Dependency:** add `recharts` to `apps/admin/package.json` (no charting library exists repo-wide; this is the first).

**New real queries** (`packages/services/src/admin/dashboard.ts`, `packages/services/src/admin/reports.ts`), following the file's existing convention (client-side aggregation via `getSupabaseClient()`, no multi-hop embeds, `{ data, error }` result shape):

- `getRidesPerDay(): Promise<{ data: { day: string; count: number }[]; error: string | null }>` — completed `ride_requests` in the last 7 days (`requested_at >= now() - 7 days`), grouped client-side by local calendar day, Mon–Sun labels via the existing `en-PH` formatting convention in `lib/format.ts`.
- `getTripStatusBreakdown(): Promise<{ data: { status: TripStatus; count: number }[]; error: string | null }>` — 4 parallel `count: 'exact', head: true` queries on `trips.status`, one per `forming`/`active`/`completed`/`cancelled` (same idiom as `getAdminDashboardStats`'s 4-query `Promise.all`).
- `getRidesRevenueOverTime(sinceIso: string): Promise<{ data: { day: string; rides: number; revenue: number }[]; error: string | null }>` — reuses `getAdminReportSummary`'s two source queries (completed `ride_requests`, paid `transactions`) but buckets both by local calendar day instead of summing to one total.
- `getPeakHourHistogram(sinceIso: string): Promise<{ data: { hourLabel: string; count: number }[]; error: string | null }>` — exposes the 12 two-hour buckets `peakTwoHourWindowLabel()` already computes internally; that function is refactored to return the full histogram, with the existing "winning label" derived from it at the call site so `getAdminReportSummary`'s `peakHourLabel` behavior is unchanged.

**New `apps/admin/src/components/charts/`:**
- `chartTheme.ts` — literal hex constants transcribed from `tokens.css`/`Badge.module.css` (Recharts needs literal strings): `LINE_COLOR` (`--primary`), `GRID_COLOR` (`--line-soft`), `AXIS_COLOR` (`--ink-soft`), `TOOLTIP_BG`/`TOOLTIP_BORDER`, `STATUS_COLORS` keyed by `TripStatus` reusing `Badge`'s tone colors.
- `RidesOverTimeChart.tsx` — `LineChart`, Dashboard.
- `RideStatusChart.tsx` — donut `PieChart` with legend, Dashboard.
- `RidesRevenueChart.tsx` — combo `LineChart` (rides as bars or a second line — pick whichever `recharts` composes cleanest, likely `ComposedChart` with a `Bar` for rides + `Line` for revenue on a second Y-axis), Reports.
- `PeakHoursChart.tsx` — `BarChart` over the 12 two-hour buckets, Reports.
- All four: `ResponsiveContainer` at height 220 (matches `PlaceholderBox`'s default so `.panel` cards don't resize), a `Loading…` state at the same height while `loading` (no layout shift), axis/tooltip styling matching `.panel-title`'s existing font treatment until Part 4 revises that treatment.

**Route changes:** `Dashboard.tsx` and `Reports.tsx` fetch the new datasets in their existing `Promise.all`, and swap the 4 `PlaceholderBox` calls for the 4 new chart components inside the same unchanged `.panel` wrappers.

## Part 2 — Document images

**No new backend permission needed** — verified live against the project: both `driver-docs` and `discount-ids` Storage buckets already have a `SELECT` RLS policy on `storage.objects` allowing `is_pso()` (`driver_docs_read`/`discount_ids_read`), alongside the owner-only policy. A signed-in PSO/Supervisor/Admin session can already call `createSignedUrl` on any path in either bucket.

**New:**
- `apps/admin/src/services/documents.ts` — `getSignedDocumentUrl(bucket: 'driver-docs' | 'discount-ids', path: string, expirySeconds = 300): Promise<{ url: string | null; error: string | null }>`, thin wrapper over `getSupabaseClient().storage.from(bucket).createSignedUrl(...)`.
- `apps/admin/src/components/DocumentImage/` — replaces the `<PlaceholderBox>` call sites in `DocumentPanel.tsx` (bucket `driver-docs`) and `DiscountReview.tsx`'s two ID-photo slots (bucket `discount-ids`). States: loading skeleton (reuse `.ph-box` styling as the loading/error fallback rather than deleting it — it still communicates "no image" cleanly), loaded `<img>` (object-fit: cover, same rounded corners/border as today's box), error falls back to the current crossed-box look with a "Couldn't load document" label instead of the generic placeholder text.
- Fetches the signed URL on mount (and on `path` change); does not cache across unmounts — a stale signed URL past its 5-minute TTL failing open to a re-fetch on next view is acceptable for this admin-only, low-traffic screen.

`PlaceholderBox` itself is not deleted — `DocumentImage`'s own loading/error states reuse its `.ph-box` CSS class directly rather than importing the component, so there's no runtime dependency, but the visual language stays consistent for the (now rare) case where a document genuinely fails to load.

## Part 3 — Live map (Ride Monitoring)

**Privacy constraint carried forward (NFR-2.5):** the query never returns a driver's literal `current_lat`/`current_lng`. Coordinates are rounded to 2 decimal places (~1.1km grid cells) in the database query's `select` (via a computed round, or rounded client-side immediately after fetch — client-side rounding is simpler and equally private since the raw values never render, only the rounded ones are used) before being handed to the map. Multiple drivers snapping to the same cell render as one marker with a count badge, not overlapping exact pins.

**New:** `getActiveTricycleLocations()` in `packages/services/src/admin/monitoring.ts` — for each `is_available` driver already covered by `listActiveTricyclesForAdmin()`'s query, also selects `current_lat`/`current_lng`, rounds both to 2 decimals, drops any driver with a null location (offline/no fix), and groups by the rounded pair into `{ lat: number; lng: number; count: number; driverNames: string[] }[]`.

**Dependencies:** add `leaflet` + `react-leaflet` to `apps/admin/package.json`. `packages/ui`'s `OsmMap` is React Native-only (`react-native-webview`, `Animated`) and cannot be imported into this Vite app, but the same OSM tile server / attribution approach is reused directly in `react-leaflet` — no API key, matching the mobile apps' existing choice.

**New `apps/admin/src/components/LiveMap/`:**
- Leaflet `MapContainer` + `TileLayer` (OSM raster tiles, `TileLayer`'s standard `attribution` prop, a descriptive `User-Agent` isn't settable from a browser `fetch`/tile `<img>` layer the way the mobile WebView could, so tile requests instead go out with the browser's normal UA — acceptable under OSM's policy since this is a low-volume admin-only screen, unlike the passenger app's per-ride tile fetches).
- One `Marker` per grid cell from `getActiveTricycleLocations()`, popup showing the count and driver names in that cell.
- Centered on the pilot barangay's approximate area (reuse `packages/ui`'s `DEFAULT_CENTER` value transcribed as a literal, same reasoning as the chart color constants).
- Fixed, non-interactive-by-default framing consistent with the existing "Live" badge and caption text already on the screen — the caption is unchanged (still accurate: "Locations shown are coarse...").

`RideMonitoring.tsx` swaps its single `PlaceholderBox` call for `<LiveMap cells={...} loading={...} />`, keeping the existing `.panel`/caption structure.

## Part 4 — Visual refinement (not a redesign)

Layout structure is unchanged: same sidebar, same topbar, same panel/card composition, same route-to-route navigation. This part only softens the existing wireframe *texture*:

- `styles/tokens.css` / `globals.css`: `.panel` gets a slightly more pronounced shadow on hover for anything clickable (rows, cards), `.panel-title` moves off all-caps monospace to a normal-weight small heading (mono/uppercase was an explicit wireframe-kit holdover per the file's own comments), spacing rhythm gets minor tightening/loosening where panels currently feel cramped.
- `StatTile`: adds a subtle left accent bar or icon slot colored per metric (reuses existing tone colors — success/warn/danger/primary — no new palette).
- `DataTable`/table rows: hover state on rows, refined empty/loading states.
- `Sidebar`/`TopBar`: kept structurally identical; refine spacing, active-item contrast, and button/link hover states only.
- `.ph-box` (still used as `DocumentImage`'s and `LiveMap`'s loading/error fallback per Parts 2–3) keeps its current crossed-X look — it's explicitly the "no content yet" signal, not something this pass is trying to prettify away.

No new dependencies for this part. Changes land in `tokens.css`, `globals.css`, and the shared components listed above — every route inherits them without per-route edits.

## Explicitly out of scope

- No dark mode (unchanged constraint from the prior charts spec — `tokens.css` still declares `color-scheme: light` only).
- No sidebar/topbar restructuring or new page layout — user explicitly declined a deeper redesign.
- No push toward exact driver coordinates on the map — NFR-2.5's coarse-location constraint is preserved by design, not just left alone.
- No change to `PlaceholderBox`'s own component — it keeps serving as the shared "content not available" visual for `DocumentImage`/`LiveMap` fallback states.
- No email/notification changes, no new RPCs for document viewing (existing Storage RLS already covers it).

## Testing

- New `packages/services/tests/admin-dashboard.test.ts` / `admin-reports.test.ts` / `admin-monitoring.test.ts` cases for `getRidesPerDay`, `getTripStatusBreakdown`, `getRidesRevenueOverTime`, `getPeakHourHistogram`, `getActiveTricycleLocations` — same fake-Supabase-client convention as the existing tests in those files.
- `apps/admin/tests/services.test.ts` gets thin wrapper tests for the new `apps/admin/src/services/*` functions, matching existing coverage there.
- No component-testing library exists in this repo (established pattern) — chart/map/image components are verified via `npm run build` (typecheck) plus manual dev-server checks: Dashboard/Reports charts render with real data and no console errors; Discount Review/Driver Verification documents load a real signed image (or degrade gracefully for a driver with no uploaded docs yet); Ride Monitoring map renders real OSM tiles with grid-snapped markers and resizes without artifacts.
- `npm run typecheck` from repo root must stay clean throughout.
