# Admin Dashboard Real Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin Dashboard's mock-derived stat tiles with real Supabase queries, and surface two pieces of data (`v_overdue_complaints`, `v_expiring_franchises`) the dashboard doesn't show at all today.

**Architecture:** A new shared module `packages/services/src/admin/dashboard.ts` holds four read-only functions, all plain PostgREST queries against tables PSO roles already have direct RLS `SELECT` access to (`is_pso()`) — no new RPCs or schema changes. A thin `apps/admin/src/services/dashboard.ts` wrapper calls them; `routes/Dashboard.tsx` switches from reusing four other screens' mock services to this one new file, and gains two more `StatTile`s plus two more `panel`+`DataTable` blocks using existing components only.

**Tech Stack:** React 19 + Vite + `react-router-dom` (admin), `@trisakay/services` (shared Supabase client, already initialized via `apps/admin/src/lib/supabase.ts`), `node --test` for the shared module's unit tests.

**Spec:** `docs/superpowers/specs/2026-08-14-admin-dashboard-wiring-design.md`

## Global Constraints

- No schema changes, no new RPCs — every query in this plan runs against a table/view PSO roles already have direct RLS `SELECT` access to.
- Service functions never throw across their public API — always return `{ data, error }`, matching every existing module in `packages/services`.
- `getAdminDashboardStats()` is all-or-nothing on error (`{ data: null, error }`) since its 4 counts render as one block; `listOverdueComplaints()`/`listExpiringFranchises()`/`listRecentTripActivity()` each degrade a missing name to `null` rather than erroring the whole call — a name-lookup miss doesn't invalidate an otherwise-actionable row.
- `Dashboard.tsx` stops importing from `services/drivers`, `services/monitoring`, `services/verification`, `services/complaints` — those stay mock-backed for their own future sub-projects (F3/F6/F4/F7), untouched by this plan.
- No new UI primitives — reuse `StatTile`, `DataTable`, `Badge`, and the existing `.panel`/`.panel-title` global CSS classes exactly as `Dashboard.tsx`'s current "Recent Activity" block already does.

---

### Task 1: `packages/services/src/admin/dashboard.ts` — stats + tests

**Files:**
- Create: `packages/services/src/admin/dashboard.ts`
- Modify: `packages/services/src/index.ts` (add barrel export)
- Test: `packages/services/tests/admin-dashboard.test.ts`

**Interfaces:**
- Produces:
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
  Task 4 (`apps/admin/src/services/dashboard.ts`) imports this from `@trisakay/services`.

- [ ] **Step 1: Write the failing tests**

Create `packages/services/tests/admin-dashboard.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { getAdminDashboardStats } from '../src/admin/dashboard.ts';

function countQuery(count: number) {
  return {
    eq: async () => ({ count, error: null }),
    in: async () => ({ count, error: null }),
  };
}

test('getAdminDashboardStats issues the right table/filter per count and maps them', async () => {
  const captured: { table: string; column?: string; value?: unknown }[] = [];

  __setSupabaseClientForTests({
    from: (table: string) => ({
      select: (_columns: string, _opts: unknown) => ({
        eq: async (column: string, value: unknown) => {
          captured.push({ table, column, value });
          if (table === 'users') return { count: 12, error: null };
          if (table === 'trips') return { count: 3, error: null };
          if (table === 'driver_profiles') return { count: 5, error: null };
          throw new Error(`unexpected eq() on ${table}`);
        },
        in: async (column: string, value: unknown) => {
          captured.push({ table, column, value });
          return { count: 7, error: null };
        },
      }),
    }),
  } as any);

  const { data, error } = await getAdminDashboardStats();

  assert.equal(error, null);
  assert.deepEqual(data, { totalDrivers: 12, activeRides: 3, pendingVerifications: 5, openComplaints: 7 });

  assert.deepEqual(captured.find((c) => c.table === 'users'), { table: 'users', column: 'role', value: 'driver' });
  assert.deepEqual(captured.find((c) => c.table === 'trips'), { table: 'trips', column: 'status', value: 'active' });
  assert.deepEqual(captured.find((c) => c.table === 'driver_profiles'), {
    table: 'driver_profiles',
    column: 'verification_status',
    value: 'pending',
  });
  assert.deepEqual(captured.find((c) => c.table === 'complaints'), {
    table: 'complaints',
    column: 'status',
    value: ['open', 'under_review', 'escalated', 'mediation_scheduled'],
  });
});

test('getAdminDashboardStats returns { data: null, error } when any one count query errors', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => ({
      select: () => ({
        eq: async () => (table === 'trips' ? { count: null, error: { message: 'connection refused' } } : { count: 1, error: null }),
        in: async () => ({ count: 1, error: null }),
      }),
    }),
  } as any);

  const { data, error } = await getAdminDashboardStats();
  assert.equal(data, null);
  assert.equal(error, 'connection refused');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/services && node --test ./tests/admin-dashboard.test.ts`
Expected: FAIL — `Cannot find module '../src/admin/dashboard.ts'`.

- [ ] **Step 3: Write the implementation**

Create `packages/services/src/admin/dashboard.ts`:

```ts
import { getSupabaseClient } from '../supabase/client.ts';

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

/**
 * Four independent counts (not four independently-rendered tiles — this is
 * one stat block) run as one Promise.all. A partial result would show
 * misleadingly precise-looking wrong numbers, so any single query error
 * fails the whole call.
 */
export async function getAdminDashboardStats(): Promise<GetAdminDashboardStatsResult> {
  const client = getSupabaseClient();

  const [totalDrivers, activeRides, pendingVerifications, openComplaints] = await Promise.all([
    client.from('users').select('*', { count: 'exact', head: true }).eq('role', 'driver'),
    client.from('trips').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    client.from('driver_profiles').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),
    client
      .from('complaints')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'under_review', 'escalated', 'mediation_scheduled']),
  ]);

  const firstError = [totalDrivers, activeRides, pendingVerifications, openComplaints].find((r) => r.error)?.error;
  if (firstError) return { data: null, error: firstError.message };

  return {
    data: {
      totalDrivers: totalDrivers.count ?? 0,
      activeRides: activeRides.count ?? 0,
      pendingVerifications: pendingVerifications.count ?? 0,
      openComplaints: openComplaints.count ?? 0,
    },
    error: null,
  };
}
```

- [ ] **Step 4: Add the barrel export**

In `packages/services/src/index.ts`, add a new line after `export * from './trip-history/index.ts';`:

```ts
export * from './admin/dashboard.ts';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/services && node --test ./tests/admin-dashboard.test.ts`
Expected: PASS, 2/2.

- [ ] **Step 6: Commit**

```bash
git add packages/services/src/admin/dashboard.ts packages/services/src/index.ts packages/services/tests/admin-dashboard.test.ts
git commit -m "feat(services): add getAdminDashboardStats"
```

---

### Task 2: `listOverdueComplaints` + `listExpiringFranchises`

**Files:**
- Modify: `packages/services/src/admin/dashboard.ts`
- Test: `packages/services/tests/admin-dashboard.test.ts`

**Interfaces:**
- Consumes: `getSupabaseClient` (already imported in Task 1).
- Produces:
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
  Task 4 imports both from `@trisakay/services`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/services/tests/admin-dashboard.test.ts`:

```ts
import { listExpiringFranchises, listOverdueComplaints } from '../src/admin/dashboard.ts';

test('listOverdueComplaints maps view rows and resolves both name columns', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'v_overdue_complaints') {
        return {
          select: async () => ({
            data: [
              {
                id: 'c1',
                submitted_by: 'u-passenger',
                against_user_id: 'u-driver',
                category: 'fare',
                status: 'open',
                created_at: '2026-08-01T00:00:00.000Z',
                business_days_elapsed: 5,
              },
            ],
            error: null,
          }),
        };
      }
      if (table === 'users') {
        return {
          select: () => ({
            in: async () => ({
              data: [
                { id: 'u-passenger', full_name: 'Maria Clara' },
                { id: 'u-driver', full_name: 'Juan Dela Cruz' },
              ],
              error: null,
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listOverdueComplaints();

  assert.equal(error, null);
  assert.deepEqual(data, [
    {
      id: 'c1',
      submittedByName: 'Maria Clara',
      againstUserName: 'Juan Dela Cruz',
      category: 'fare',
      status: 'open',
      createdAt: '2026-08-01T00:00:00.000Z',
      businessDaysElapsed: 5,
    },
  ]);
});

test('listOverdueComplaints degrades a name to null when the user lookup misses it', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'v_overdue_complaints') {
        return {
          select: async () => ({
            data: [
              {
                id: 'c1',
                submitted_by: 'u-passenger',
                against_user_id: 'u-deleted',
                category: 'conduct',
                status: 'under_review',
                created_at: '2026-08-01T00:00:00.000Z',
                business_days_elapsed: 4,
              },
            ],
            error: null,
          }),
        };
      }
      if (table === 'users') {
        // u-deleted no longer exists — only u-passenger comes back.
        return { select: () => ({ in: async () => ({ data: [{ id: 'u-passenger', full_name: 'Maria Clara' }], error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listOverdueComplaints();
  assert.equal(error, null);
  assert.equal(data[0].submittedByName, 'Maria Clara');
  assert.equal(data[0].againstUserName, null);
});

test('listOverdueComplaints returns { data: [], error } when the view query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: async () => ({ data: null, error: { message: 'connection refused' } }) }),
  } as any);

  const { data, error } = await listOverdueComplaints();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});

test('listExpiringFranchises maps view rows and resolves driverName', async () => {
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'v_expiring_franchises') {
        return {
          select: async () => ({
            data: [
              {
                tricycle_id: 't1',
                driver_id: 'u-driver',
                plate_no: 'GSC-1234',
                mtop_no: 'MTOP-001',
                mtop_expiry_date: '2026-09-01',
                days_until_expiry: 18,
              },
            ],
            error: null,
          }),
        };
      }
      if (table === 'users') {
        return { select: () => ({ in: async () => ({ data: [{ id: 'u-driver', full_name: 'Juan Dela Cruz' }], error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listExpiringFranchises();
  assert.equal(error, null);
  assert.deepEqual(data, [
    {
      tricycleId: 't1',
      driverId: 'u-driver',
      driverName: 'Juan Dela Cruz',
      plateNo: 'GSC-1234',
      mtopNo: 'MTOP-001',
      mtopExpiryDate: '2026-09-01',
      daysUntilExpiry: 18,
    },
  ]);
});

test('listExpiringFranchises returns { data: [], error } when the view query fails', async () => {
  __setSupabaseClientForTests({
    from: () => ({ select: async () => ({ data: null, error: { message: 'connection refused' } }) }),
  } as any);

  const { data, error } = await listExpiringFranchises();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/services && node --test ./tests/admin-dashboard.test.ts`
Expected: FAIL — `listOverdueComplaints`/`listExpiringFranchises` not exported.

- [ ] **Step 3: Write the implementation**

Append to `packages/services/src/admin/dashboard.ts`:

```ts
async function resolveUserNames(client: ReturnType<typeof getSupabaseClient>, ids: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return new Map();

  const { data } = await client.from('users').select('id, full_name').in('id', uniqueIds);
  const names = new Map<string, string>();
  for (const row of data ?? []) names.set(row.id, row.full_name);
  return names;
}

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

/**
 * Reads v_overdue_complaints (docs/SCHEMA.MD ~L1224 — its own comment says
 * "Feeds the PSO oversight dashboard"). The view has no name columns, only
 * submitted_by/against_user_id ids, and PostgREST's embed-through-view
 * support is inconsistent enough not to depend on — so this does one
 * follow-up `users` lookup instead and merges names client-side. A missing
 * name degrades to null rather than failing the whole row; the category and
 * days-overdue are still actionable without it.
 */
export async function listOverdueComplaints(): Promise<ListOverdueComplaintsResult> {
  const client = getSupabaseClient();
  const { data, error } = await client.from('v_overdue_complaints').select('*');

  if (error) return { data: [], error: error.message };

  const ids = (data ?? []).flatMap((row) => [row.submitted_by, row.against_user_id].filter((id): id is string => !!id));
  const names = await resolveUserNames(client, ids);

  const rows = (data ?? []).map((row) => ({
    id: row.id!,
    submittedByName: row.submitted_by ? (names.get(row.submitted_by) ?? null) : null,
    againstUserName: row.against_user_id ? (names.get(row.against_user_id) ?? null) : null,
    category: row.category!,
    status: row.status as 'open' | 'under_review',
    createdAt: row.created_at!,
    businessDaysElapsed: row.business_days_elapsed ?? 0,
  }));

  return { data: rows, error: null };
}

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

/** Reads v_expiring_franchises (docs/SCHEMA.MD ~L1199). Same name-resolution approach as listOverdueComplaints above. */
export async function listExpiringFranchises(): Promise<ListExpiringFranchisesResult> {
  const client = getSupabaseClient();
  const { data, error } = await client.from('v_expiring_franchises').select('*');

  if (error) return { data: [], error: error.message };

  const ids = (data ?? []).map((row) => row.driver_id).filter((id): id is string => !!id);
  const names = await resolveUserNames(client, ids);

  const rows = (data ?? []).map((row) => ({
    tricycleId: row.tricycle_id!,
    driverId: row.driver_id!,
    driverName: row.driver_id ? (names.get(row.driver_id) ?? null) : null,
    plateNo: row.plate_no!,
    mtopNo: row.mtop_no,
    mtopExpiryDate: row.mtop_expiry_date!,
    daysUntilExpiry: row.days_until_expiry ?? 0,
  }));

  return { data: rows, error: null };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/services && node --test ./tests/admin-dashboard.test.ts`
Expected: PASS, 7/7 (2 from Task 1 + 5 new).

- [ ] **Step 5: Commit**

```bash
git add packages/services/src/admin/dashboard.ts packages/services/tests/admin-dashboard.test.ts
git commit -m "feat(services): add listOverdueComplaints and listExpiringFranchises"
```

---

### Task 3: `listRecentTripActivity`

**Files:**
- Modify: `packages/services/src/admin/dashboard.ts`
- Test: `packages/services/tests/admin-dashboard.test.ts`

**Interfaces:**
- Produces:
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
  export async function listRecentTripActivity(limit?: number): Promise<ListRecentTripActivityResult>
  ```
  Task 4 imports this from `@trisakay/services`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/services/tests/admin-dashboard.test.ts`:

```ts
import { listRecentTripActivity } from '../src/admin/dashboard.ts';

test('listRecentTripActivity maps trip rows, resolves driver names, and respects the limit arg', async () => {
  let capturedLimit: number | null = null;
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'trips') {
        return {
          select: () => ({
            order: () => ({
              limit: async (n: number) => {
                capturedLimit = n;
                return {
                  data: [
                    { id: 'trip1', status: 'active', updated_at: '2026-08-14T00:00:00.000Z', driver_id: 'u1' },
                    { id: 'trip2', status: 'completed', updated_at: '2026-08-13T23:50:00.000Z', driver_id: 'u-deleted' },
                  ],
                  error: null,
                };
              },
            }),
          }),
        };
      }
      if (table === 'users') {
        // u-deleted no longer exists — only u1 comes back.
        return { select: () => ({ in: async () => ({ data: [{ id: 'u1', full_name: 'Ronnie Bautista' }], error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as any);

  const { data, error } = await listRecentTripActivity(20);

  assert.equal(error, null);
  assert.equal(capturedLimit, 20);
  assert.deepEqual(data, [
    { id: 'trip1', driverName: 'Ronnie Bautista', status: 'active', updatedAt: '2026-08-14T00:00:00.000Z' },
    { id: 'trip2', driverName: null, status: 'completed', updatedAt: '2026-08-13T23:50:00.000Z' },
  ]);
});

test('listRecentTripActivity defaults the limit to 10', async () => {
  let capturedLimit: number | null = null;
  __setSupabaseClientForTests({
    from: (table: string) => {
      if (table === 'trips') {
        return { select: () => ({ order: () => ({ limit: async (n: number) => { capturedLimit = n; return { data: [], error: null }; } }) }) };
      }
      return { select: () => ({ in: async () => ({ data: [], error: null }) }) };
    },
  } as any);

  await listRecentTripActivity();
  assert.equal(capturedLimit, 10);
});

test('listRecentTripActivity returns { data: [], error } on a query error', async () => {
  __setSupabaseClientForTests({
    from: () => ({
      select: () => ({ order: () => ({ limit: async () => ({ data: null, error: { message: 'connection refused' } }) }) }),
    }),
  } as any);

  const { data, error } = await listRecentTripActivity();
  assert.deepEqual(data, []);
  assert.equal(error, 'connection refused');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/services && node --test ./tests/admin-dashboard.test.ts`
Expected: FAIL — `listRecentTripActivity` not exported.

- [ ] **Step 3: Write the implementation**

Append to `packages/services/src/admin/dashboard.ts`:

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

/**
 * Deliberately not a nested PostgREST embed (`driver_profiles(users(...))`)
 * — this codebase has no precedent of multi-hop embeds anywhere, and every
 * existing cross-user join instead uses either a security-definer RPC or,
 * as here, a plain follow-up lookup (same resolveUserNames() helper
 * listOverdueComplaints/listExpiringFranchises above already use). trips.driver_id
 * holds the same value as users.id (driver_profiles.user_id IS users.id),
 * so the follow-up .in() lookup works without hopping through driver_profiles.
 */
export async function listRecentTripActivity(limit = 10): Promise<ListRecentTripActivityResult> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('trips')
    .select('id, status, updated_at, driver_id')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: error.message };

  const names = await resolveUserNames(client, (data ?? []).map((row) => row.driver_id));

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    driverName: names.get(row.driver_id) ?? null,
    status: row.status,
    updatedAt: row.updated_at,
  }));

  return { data: rows, error: null };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/services && node --test ./tests/admin-dashboard.test.ts`
Expected: PASS, 10/10 (7 from Tasks 1-2 + 3 new).

- [ ] **Step 5: Run the full services suite to confirm nothing else broke**

Run: `cd packages/services && npm test`
Expected: all tests pass (previous count + 10).

- [ ] **Step 6: Commit**

```bash
git add packages/services/src/admin/dashboard.ts packages/services/tests/admin-dashboard.test.ts
git commit -m "feat(services): add listRecentTripActivity"
```

---

### Task 4: `apps/admin/src/services/dashboard.ts` wrapper

**Files:**
- Create: `apps/admin/src/services/dashboard.ts`

**Interfaces:**
- Consumes: `getAdminDashboardStats`, `listOverdueComplaints`, `listExpiringFranchises`, `listRecentTripActivity` from `@trisakay/services` (Tasks 1-3).
- Produces:
  ```ts
  export interface DashboardStats { totalDrivers: number; activeRides: number; pendingVerifications: number; openComplaints: number; }
  export async function getDashboardStats(): Promise<ServiceResult<DashboardStats | null>>
  export async function listOverdueComplaints(): Promise<ServiceResult<OverdueComplaintRow[]>>
  export async function listExpiringFranchises(): Promise<ServiceResult<ExpiringFranchiseRow[]>>
  export async function listRecentTripActivity(limit?: number): Promise<ServiceResult<RecentTripActivityRow[]>>
  ```
  (Re-exports the `OverdueComplaintRow`/`ExpiringFranchiseRow`/`RecentTripActivityRow` types from `@trisakay/services` too.) Task 5 (`routes/Dashboard.tsx`) imports all of the above from `../services/dashboard`.

- [ ] **Step 1: Write the file**

Create `apps/admin/src/services/dashboard.ts`:

```ts
import {
  getAdminDashboardStats,
  listExpiringFranchises as listExpiringFranchisesShared,
  listOverdueComplaints as listOverdueComplaintsShared,
  listRecentTripActivity as listRecentTripActivityShared,
} from '@trisakay/services';
import type { ExpiringFranchiseRow, OverdueComplaintRow, RecentTripActivityRow } from '@trisakay/services';
import type { ServiceResult } from './drivers';

export type { ExpiringFranchiseRow, OverdueComplaintRow, RecentTripActivityRow };

export interface DashboardStats {
  totalDrivers: number;
  activeRides: number;
  pendingVerifications: number;
  openComplaints: number;
}

/**
 * Thin wrapper over the shared packages/services/src/admin/dashboard module,
 * matching this app's one-file-per-feature service convention (drivers.ts,
 * monitoring.ts, etc.). Unlike those, this one is real from the start —
 * Dashboard.tsx never had its own mock service to begin with.
 */
export async function getDashboardStats(): Promise<ServiceResult<DashboardStats | null>> {
  const { data, error } = await getAdminDashboardStats();
  return { data, error };
}

export async function listOverdueComplaints(): Promise<ServiceResult<OverdueComplaintRow[]>> {
  const { data, error } = await listOverdueComplaintsShared();
  return { data, error };
}

export async function listExpiringFranchises(): Promise<ServiceResult<ExpiringFranchiseRow[]>> {
  const { data, error } = await listExpiringFranchisesShared();
  return { data, error };
}

export async function listRecentTripActivity(limit?: number): Promise<ServiceResult<RecentTripActivityRow[]>> {
  const { data, error } = await listRecentTripActivityShared(limit);
  return { data, error };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck` from the repo root.
Expected: no new errors (the one pre-existing `packages/services/tests/discount.test.ts` error is unrelated and predates this work).

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/services/dashboard.ts
git commit -m "feat(admin): add dashboard service wrapper"
```

---

### Task 5: Wire `routes/Dashboard.tsx` + `formatRelativeTime`

**Files:**
- Modify: `apps/admin/src/lib/format.ts`
- Modify: `apps/admin/src/routes/Dashboard.tsx`

**Interfaces:**
- Consumes: `getDashboardStats`, `listOverdueComplaints`, `listExpiringFranchises`, `listRecentTripActivity` and their row types from `../services/dashboard` (Task 4); `titleCaseLabel` (existing, `lib/format.ts`); `Badge`, `StatTile`, `DataTable` (existing components).

- [ ] **Step 1: Add `formatRelativeTime` to `lib/format.ts`**

Append to `apps/admin/src/lib/format.ts`:

```ts
/** ISO timestamp -> 'Just now' / 'N min ago' / 'N hr ago' / 'N days ago', matching the wireframe's relative-time labels. */
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
```

- [ ] **Step 2: Rewrite `routes/Dashboard.tsx`**

Replace the full contents of `apps/admin/src/routes/Dashboard.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatTile } from '../components/StatTile';
import { PlaceholderBox } from '../components/PlaceholderBox';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import {
  getDashboardStats,
  listExpiringFranchises,
  listOverdueComplaints,
  listRecentTripActivity,
  type DashboardStats,
  type ExpiringFranchiseRow,
  type OverdueComplaintRow,
  type RecentTripActivityRow,
} from '../services/dashboard';
import { formatRelativeTime, titleCaseLabel } from '../lib/format';

const ACTIVITY_TONE: Record<string, 'neutral' | 'success' | 'warn' | 'danger' | 'info'> = {
  active: 'info',
  forming: 'warn',
  completed: 'success',
  cancelled: 'danger',
};

const activityColumns: DataTableColumn<RecentTripActivityRow>[] = [
  { key: 'driver', header: 'Driver', render: (r) => r.driverName ?? 'Unknown', sortValue: (r) => r.driverName ?? '' },
  {
    key: 'status',
    header: 'Status',
    render: (r) => <Badge label={titleCaseLabel(r.status)} tone={ACTIVITY_TONE[r.status] ?? 'neutral'} />,
  },
  { key: 'time', header: 'Time', render: (r) => formatRelativeTime(r.updatedAt) },
];

const overdueColumns: DataTableColumn<OverdueComplaintRow>[] = [
  { key: 'category', header: 'Category', render: (r) => titleCaseLabel(r.category), sortValue: (r) => r.category },
  {
    key: 'days',
    header: 'Days overdue',
    render: (r) => r.businessDaysElapsed,
    sortValue: (r) => r.businessDaysElapsed,
    align: 'right',
  },
  { key: 'status', header: 'Status', render: (r) => <Badge label={titleCaseLabel(r.status)} tone="warn" /> },
];

const expiringColumns: DataTableColumn<ExpiringFranchiseRow>[] = [
  { key: 'driver', header: 'Driver', render: (r) => r.driverName ?? 'Unknown', sortValue: (r) => r.driverName ?? '' },
  { key: 'plate', header: 'Plate No.', render: (r) => r.plateNo },
  {
    key: 'expiry',
    header: 'Days until expiry',
    render: (r) => (
      <Badge
        label={r.daysUntilExpiry < 0 ? `Expired ${Math.abs(r.daysUntilExpiry)}d ago` : `${r.daysUntilExpiry}d`}
        tone={r.daysUntilExpiry < 0 ? 'danger' : 'warn'}
      />
    ),
    sortValue: (r) => r.daysUntilExpiry,
    align: 'right',
  },
];

/** Wireframe screen 2 "Dashboard / Overview" (FR-5.1, 5.4, 5.5). */
export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [overdue, setOverdue] = useState<OverdueComplaintRow[]>([]);
  const [overdueError, setOverdueError] = useState<string | null>(null);
  const [expiring, setExpiring] = useState<ExpiringFranchiseRow[]>([]);
  const [expiringError, setExpiringError] = useState<string | null>(null);
  const [activity, setActivity] = useState<RecentTripActivityRow[]>([]);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [statsResult, overdueResult, expiringResult, activityResult] = await Promise.all([
        getDashboardStats(),
        listOverdueComplaints(),
        listExpiringFranchises(),
        listRecentTripActivity(),
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
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page">
      {statsError && <div className="form-error">{statsError}</div>}
      <div className="stat-grid">
        <StatTile label="Total Drivers" value={loading ? '—' : (stats?.totalDrivers ?? '—')} />
        <StatTile label="Active Rides" value={loading ? '—' : (stats?.activeRides ?? '—')} />
        <StatTile label="Pending Verifications" value={loading ? '—' : (stats?.pendingVerifications ?? '—')} />
        <StatTile label="Open Complaints" value={loading ? '—' : (stats?.openComplaints ?? '—')} />
        <StatTile label="Overdue Complaints" value={loading ? '—' : overdue.length} hint="Past 3-business-day ARTA target" />
        <StatTile label="Expiring Franchises" value={loading ? '—' : expiring.length} hint="MTOP renewal due within 30 days" />
      </div>

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

      <div className="panel">
        <div className="panel-title">Overdue Complaints</div>
        {overdueError && <div className="form-error">{overdueError}</div>}
        <DataTable columns={overdueColumns} rows={overdue} getRowKey={(r) => r.id} loading={loading} emptyMessage="No overdue complaints." />
      </div>

      <div className="panel">
        <div className="panel-title">Expiring Franchises</div>
        {expiringError && <div className="form-error">{expiringError}</div>}
        <DataTable
          columns={expiringColumns}
          rows={expiring}
          getRowKey={(r) => r.tricycleId}
          loading={loading}
          emptyMessage="No franchises expiring soon."
        />
      </div>

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="panel-title" style={{ marginBottom: 0 }}>
            Recent Activity
          </div>
          <Link to="/monitoring">
            <Button variant="outline" tone="neutral" size="sm">
              View all
            </Button>
          </Link>
        </div>
        {activityError && <div className="form-error">{activityError}</div>}
        <DataTable columns={activityColumns} rows={activity} getRowKey={(r) => r.id} loading={loading} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Confirm the `form-error` class exists**

Run: `grep -n "\.form-error" apps/admin/src/styles/globals.css`
Expected: at least one match (this class is already used elsewhere in the admin app for inline error text — e.g. `Login.tsx`'s own error display). If no match is found, add this rule to `apps/admin/src/styles/globals.css` instead of assuming it exists:

```css
.form-error {
  color: var(--danger);
  font-size: 13px;
  margin-bottom: var(--sp-sm);
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck` from the repo root.
Expected: no new errors.

- [ ] **Step 5: Manual smoke check**

Run: `cd apps/admin && npm run dev`, sign in with a PSO test account, open the Dashboard. Expected: the 6 stat tiles render real numbers (or `—` momentarily while loading), the two new panels render either real rows or their empty-state message, and Recent Activity shows real trip rows with relative-time labels instead of the old mock's canned strings. Stop the dev server once confirmed.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/lib/format.ts apps/admin/src/routes/Dashboard.tsx apps/admin/src/styles/globals.css
git commit -m "feat(admin): wire Dashboard to real Supabase queries"
```

(Only include `apps/admin/src/styles/globals.css` in the `git add` if Step 3 actually modified it.)

---

### Task 6: Full verification pass + docs update

**Files:** none (verification), plus docs.

- [ ] **Step 1: Full typecheck**

Run: `npm run typecheck` from the repo root.
Expected: only the pre-existing `packages/services/tests/discount.test.ts(11,22)` error, nothing else.

- [ ] **Step 2: Full services test suite**

Run: `cd packages/services && npm test`
Expected: all tests pass, including the 10 new `admin-dashboard.test.ts` tests.

- [ ] **Step 3: Confirm Dashboard no longer imports the other screens' mock services**

Run: `grep -n "from '../services/drivers'\|from '../services/monitoring'\|from '../services/verification'\|from '../services/complaints'" apps/admin/src/routes/Dashboard.tsx`
Expected: no output.

- [ ] **Step 4: Update `docs/ADMIN_TODO.MD`**

Open `docs/ADMIN_TODO.MD`, find the F2 row in the build-order table (starts `| F2 | **Dashboard (FR-5.5, FR-1.7).**`). Replace its description with a done summary in the same style as F1's already-done row directly above it — name the real files touched (`packages/services/src/admin/dashboard.ts`, `apps/admin/src/services/dashboard.ts`, `apps/admin/src/routes/Dashboard.tsx`), the 4 real counts, the two new `v_overdue_complaints`/`v_expiring_franchises` panels, and that the two `.ph-box` chart placeholders are unchanged (still blocked on F8's charting-library decision, per the doc's own open-decision #4).

- [ ] **Step 5: Update `docs/CHECKLIST.MD`**

Search `docs/CHECKLIST.MD` for its admin P0 line referencing the Dashboard/admin backend-wiring backlog (the "Admin Web App — frontend built..., backend wiring in progress" line, which currently only calls out F1 as done). Add a note that F2 (Dashboard) is now also done, matching that line's existing style (see how it already appended the F1 sub-bullet).

- [ ] **Step 6: Commit the doc updates**

```bash
git add docs/ADMIN_TODO.MD docs/CHECKLIST.MD
git commit -m "docs: mark admin dashboard wiring (F2) done"
```
