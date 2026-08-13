# Admin Dashboard real wiring — design

**Date:** 2026-08-14
**Scope:** `apps/admin` + a new `packages/services/src/admin` module. First sub-project of the admin backend-wiring effort (`docs/ADMIN_TODO.MD` F2 of F2–F13), establishing the pattern later sub-projects (F3–F13) will follow.

## Problem

`routes/Dashboard.tsx` computes its 4 stat tiles by fetching four *other* screens' mock-backed list services (`listDrivers`, `listActiveTricycles`, `listVerificationCases`, `listComplaints`) and counting/filtering the results client-side. None of it is real, and two pieces of data `docs/ADMIN_TODO.MD` explicitly calls out — SLA-overdue complaints (`v_overdue_complaints`) and soon-to-expire MTOP franchises (`v_expiring_franchises`) — aren't surfaced anywhere in the app at all yet, despite `v_overdue_complaints`'s own `docs/SCHEMA.MD` comment saying it "feeds the PSO oversight dashboard."

## What already exists (verified against `docs/SCHEMA.MD` — nothing here needs a migration)

- RLS already grants PSO roles (`is_pso()`) direct `SELECT` on every table this needs: `users` (`users_select_self`), `driver_profiles` (`driver_select`), `trips` (`trips_driver_rw`), `complaints` (`complaints_read`), `tricycles` (`tricycles_owner_rw`). Unlike the driver/passenger apps, **no new security-definer RPC is needed** — the admin portal's own role already has the read access the driver/passenger apps had to route around.
- `v_overdue_complaints` (`docs/SCHEMA.MD` ~L1224, `security_invoker = true`) — `id, submitted_by, against_user_id, category, status, created_at, business_days_elapsed`, pre-filtered to `status in ('open','under_review') and business_days_since(created_at) > 3`.
- `v_expiring_franchises` (~L1199, `security_invoker = true`) — `tricycle_id, driver_id, plate_no, mtop_no, mtop_expiry_date, days_until_expiry`, pre-filtered to active tricycles expiring within 30 days (negative `days_until_expiry` = already expired).
- `trips` (~L308) has `status` (`trip_status`: `forming|active|completed|cancelled`), `driver_id` (FK → `driver_profiles.user_id`), `updated_at`.
- `driver_profiles.user_id` is itself a FK → `users.id`, and its value is identical to `trips.driver_id` — so the driver's name can be resolved with a plain follow-up `users` lookup (`.in('id', driverIds)`), the same pattern used for the two view-backed functions below. This codebase has no precedent anywhere of a multi-hop PostgREST embed (`table(nested(nested))`); every existing cross-user join instead uses either a security-definer RPC or a follow-up lookup like this one — kept consistent here rather than introducing a new pattern.
- `apps/admin/src/lib/supabase.ts` already calls `initSupabase()` from `@trisakay/services` (F1) — any new `packages/services/src/admin/*` module gets a working client for free via the same `getSupabaseClient()` every other module uses.
- `apps/admin/src/components/StatTile` already accepts `{ label, value, hint? }`, and `.stat-grid` (`styles/globals.css`) is `grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))` — adding 2 more tiles (6 total) needs no layout change.
- `apps/admin/src/components/DataTable` already renders its own `EmptyState` via `emptyMessage` when `rows` is empty — no separate empty-state design needed for the two new lists.

## Service layer — `packages/services/src/admin/dashboard.ts`

New module, first of several `packages/services/src/admin/*` modules the rest of the backlog (F3–F13) will add — one per feature area, matching the existing `ratings/`, `trip-history/`, `discount/` convention. All four functions never throw, return `{ data, error }`.

```ts
export interface AdminDashboardStats {
  totalDrivers: number;
  activeRides: number;
  pendingVerifications: number;
  openComplaints: number;
}
export interface GetAdminDashboardStatsResult {
  data: AdminDashboardStats | null;
  error: string | null;
}
export async function getAdminDashboardStats(): Promise<GetAdminDashboardStatsResult>
```
- Four independent `count: 'exact', head: true` queries, run with `Promise.all`:
  - `totalDrivers`: `.from('users').select('*', { count: 'exact', head: true }).eq('role', 'driver')`
  - `activeRides`: `.from('trips').select('*', { count: 'exact', head: true }).eq('status', 'active')`
  - `pendingVerifications`: `.from('driver_profiles').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending')`
  - `openComplaints`: `.from('complaints').select('*', { count: 'exact', head: true }).in('status', ['open', 'under_review', 'escalated', 'mediation_scheduled'])` — the explicit 4-value list matches this codebase's existing `.in()` precedent (`packages/services/src/booking/index.ts`, `consents/index.ts`) rather than introducing the first `.not(...'in'...)` usage.
- If any of the 4 errors, the whole function returns `{ data: null, error: <first error message> }` — this is one stat block, not four independently-rendered tiles, so a partial result would show misleadingly precise-looking wrong numbers. (Contrast with the two list functions below, which the UI renders independently and so keep their own separate error per Design decision "Error handling" below.)

```ts
export interface OverdueComplaintRow {
  id: string;
  submittedByName: string | null;
  againstUserName: string | null;
  category: 'fare' | 'conduct' | 'safety' | 'low_rating' | 'vehicle_condition' | 'other';
  status: 'open' | 'under_review';
  createdAt: string;
  businessDaysElapsed: number;
}
export interface ListOverdueComplaintsResult {
  data: OverdueComplaintRow[];
  error: string | null;
}
export async function listOverdueComplaints(): Promise<ListOverdueComplaintsResult>
```
- Queries `v_overdue_complaints` directly (`.from('v_overdue_complaints').select('*')`, no `.order()` needed — `business_days_elapsed` is already how the view scopes itself, and the row count is expected to stay small).
- The view has no name columns (only `submitted_by`/`against_user_id` UUIDs) and PostgREST's embed-through-view support is inconsistent enough not to depend on for a first pass — instead, the function collects the distinct non-null ids from both columns across the result set, does one follow-up `.from('users').select('id, full_name').in('id', ids)`, and merges names client-side into `submittedByName`/`againstUserName`. A name lookup failure degrades to `null` (rendered as "Unknown"), not a whole-function error — the row itself (category, days overdue) is still actionable without it.

```ts
export interface ExpiringFranchiseRow {
  tricycleId: string;
  driverId: string;
  driverName: string | null;
  plateNo: string;
  mtopNo: string | null;
  mtopExpiryDate: string;
  daysUntilExpiry: number;
}
export interface ListExpiringFranchisesResult {
  data: ExpiringFranchiseRow[];
  error: string | null;
}
export async function listExpiringFranchises(): Promise<ListExpiringFranchisesResult>
```
- Same shape as `listOverdueComplaints`: queries `v_expiring_franchises`, then one follow-up `.from('users').select('id, full_name').in('id', driverIds)` to resolve `driverName`, same null-degrades-gracefully rule.

```ts
export interface RecentTripActivityRow {
  id: string;
  driverName: string | null;
  status: 'forming' | 'active' | 'completed' | 'cancelled';
  updatedAt: string;
}
export interface ListRecentTripActivityResult {
  data: RecentTripActivityRow[];
  error: string | null;
}
export async function listRecentTripActivity(limit = 10): Promise<ListRecentTripActivityResult>
```
- `.from('trips').select('id, status, updated_at, driver_id').order('updated_at', { ascending: false }).limit(limit)`, then the same follow-up `users` name-resolution lookup `listOverdueComplaints`/`listExpiringFranchises` already use (`trips.driver_id` holds the same value as `users.id`, so no hop through `driver_profiles` is needed).
- Replaces the current Dashboard's `listRecentActivity()` mock (relative-time strings like "5 min ago") with a raw ISO `updatedAt` — formatting to a relative label is a display concern, done in the admin app's own `lib/format.ts`, not the shared service.

## App-layer wiring — `apps/admin/src/services/dashboard.ts`

New file (Dashboard.tsx currently has no dedicated service file — it pulls from four *other* screens' service files). Thin wrapper matching the existing one-file-per-feature convention (`services/drivers.ts`, `services/monitoring.ts`, etc.), calling the four new shared functions and re-exporting their `ServiceResult<T>`-shaped output using the admin app's own local `ServiceResult<T>` type (already defined in `services/drivers.ts`) for consistency with every other admin service file.

`routes/Dashboard.tsx` changes:
- Drops its imports of `listDrivers`, `listActiveTricycles`, `listVerificationCases`, `listComplaints`, `listRecentActivity` — none of those are Dashboard's job once this lands; they stay mock-backed for their own screens (F3/F6/F4/F7, not built yet).
- Calls the four new `services/dashboard.ts` functions instead, via `Promise.all`.
- Renders two new `StatTile`s ("Overdue Complaints", "Expiring Franchises") in the existing `.stat-grid`, sourced from `listOverdueComplaints().length` / `listExpiringFranchises().length` — no separate count query needed since the list is already fetched.
- Renders two new `panel`+`DataTable` blocks (matching the existing "Recent Activity" panel's markup exactly — `panel-title` + `DataTable`), one per list, placed after the existing two-chart row and before Recent Activity: "Overdue Complaints" (columns: category, business days elapsed, status) and "Expiring Franchises" (columns: driver, plate no, days until expiry — rendered with a `danger`-toned `Badge` when `daysUntilExpiry < 0`, i.e. already expired, vs. `warn` tone otherwise).
- "Recent Activity" panel's `time` column switches from the mock's canned relative string to a `formatRelativeTime(updatedAt)` helper (new, small, in `lib/format.ts`, following that file's existing style) computed from the real `updatedAt` ISO string.

## Error handling

Each of the 4 real data sources (stats block, overdue complaints, expiring franchises, recent activity) is fetched and rendered independently — a `Promise.all` over the four service calls, but each result's `error` is checked and displayed in only its own tile/panel, never blanking the whole page. This matches how `payment.tsx`/`history.tsx` in the passenger app already handle partial-failure display (inline error text scoped to the affected section, not a full-screen error state) — same principle, applied here for the first time on the admin side.

## Out of scope (explicitly deferred)

- `listDrivers`/`listActiveTricycles`/`listVerificationCases`/`listComplaints` staying mock-backed — those are F3/F6/F4/F7's own sub-projects, not touched here.
- The two `.ph-box` chart placeholders ("Rides Over Time", "Ride Status") — charting library choice is explicitly deferred to F8 per `docs/ADMIN_TODO.MD`'s open decision #4.
- Any visual/layout redesign beyond adding 2 tiles + 2 panels using existing components — a separate, paused effort per the user's own direction this session.
- Realtime — this is a one-shot fetch-on-mount screen (matching the mock's current behavior), not a live subscription. `docs/ADMIN_TODO.MD` reserves Realtime for F6 (Ride Monitoring), a different screen with a different (always-open, needs-to-be-live) use case.

## Testing

New `packages/services/tests/admin-dashboard.test.ts` (mocked Supabase client, matching the existing style used across `packages/services/tests/*`):
- `getAdminDashboardStats` issues all 4 count queries with the right table/filter and maps them correctly.
- `getAdminDashboardStats` returns `{ data: null, error }` when any one of the 4 queries errors.
- `listOverdueComplaints` maps view rows and resolves both name columns via the follow-up `users` query.
- `listOverdueComplaints` degrades a name to `null` when the follow-up user lookup doesn't find a match, without erroring the whole call.
- `listExpiringFranchises` maps view rows and resolves `driverName`.
- `listRecentTripActivity` maps trip rows correctly, including a row whose `driver_id` doesn't resolve to any `users` row (deleted account — degrades to `driverName: null`, doesn't crash).
- Each function returns `{ data: [], error: message }` (list functions) or `{ data: null, error: message }` (stats function) on a query-level error.

No component-level test harness exists for `apps/admin` screens (same situation as the mobile apps) — `Dashboard.tsx`'s changes are verified via `npm run typecheck` plus manual review/dev-server check, not a new screen test.
