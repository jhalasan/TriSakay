# Account Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give passenger and driver apps one Account screen that holds the personal details (masked), phone edit, password change, two-factor sign-in, signed-in devices and reversible deactivation, and take email and phone off the Profile page.

**Architecture:** Pure mask helpers in `packages/shared`; auth/MFA/session/reactivation calls in a new `packages/services/src/account` module; three small SECURITY DEFINER RPCs plus a tightened `self_deactivate_account` in one migration; one `accountMgmt` i18n section (en + fil) used by both apps; per-app screens that follow the existing duplicated-screen convention (`change-password.tsx` is already one copy per app).

**Tech Stack:** Expo SDK 54 / expo-router, Supabase auth MFA (TOTP), Postgres, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-01-account-management-design.md`

## Global Constraints

- No new color tokens (use `colors` from `@trisakay/ui`); no `fontWeight` (use `fontFamily.*`).
- Every user-visible string goes in `packages/shared/src/i18n/en.ts` AND `fil.ts` under `accountMgmt`; `packages/shared/tests/i18n.test.ts` must stay green.
- Shadows go on a wrapper view, not on `overflow: hidden` views.
- `packages/ui` must not import `@trisakay/shared` (rootDir); the new code lives in services/shared/apps only.
- Do not push, merge or rebuild apps without the user's say-so. Applying the migration to the live project needs the user's approval.
- Work on a new branch `feature/account-management` cut from `feature/payment-settlement`.

## Review Focus

- Show/masking for a missing email or phone (empty string, `null`): must render `—`, never throw.
- Phone with spaces or a `+63` prefix (`+639171234567`): masks without leaking more than the last 4 digits.
- Deactivating while a ride is active, a trip is active, or a completed ride is unpaid: refused with a clear message, account stays active.
- A PSO-deactivated account must NOT be self-reactivatable.
- Signing in with a verified MFA factor but closing the app at the code prompt: next launch must ask for the code again, never land in the app at aal1.
- Wrong or expired 6-digit code: error shown, can retry, no crash.
- Signing out the current device from the device list must be impossible (current device row has no sign-out button).

---

### Task 1: Mask helpers

**Files:**
- Create: `packages/shared/src/utils/mask.ts`
- Modify: `packages/shared/src/utils/index.ts`
- Test: `packages/shared/tests/mask.test.ts`

**Interfaces:**
- Produces: `maskEmail(email: string | null | undefined): string`, `maskPhone(phone: string | null | undefined): string` (both return `'—'` for empty input).

- [ ] **Step 1: Write the failing test** — `packages/shared/tests/mask.test.ts`

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { maskEmail, maskPhone } from '../src/utils/mask.ts';

test('maskEmail keeps the first letter and the domain', () => {
  assert.equal(maskEmail('juan@gmail.com'), 'j***@gmail.com');
  assert.equal(maskEmail('a@b.co'), 'a***@b.co');
});

test('maskEmail handles missing or malformed input', () => {
  assert.equal(maskEmail(null), '—');
  assert.equal(maskEmail(undefined), '—');
  assert.equal(maskEmail(''), '—');
  assert.equal(maskEmail('not-an-email'), '•••');
});

test('maskPhone keeps only the last 4 digits', () => {
  assert.equal(maskPhone('09171234567'), '09•• ••• 4567');
  assert.equal(maskPhone('0922 444 4955'), '09•• ••• 4955');
  assert.equal(maskPhone('+639171234567'), '09•• ••• 4567');
});

test('maskPhone handles missing or too-short input', () => {
  assert.equal(maskPhone(null), '—');
  assert.equal(maskPhone(''), '—');
  assert.equal(maskPhone('123'), '•••');
});
```

- [ ] **Step 2: Run it, expect FAIL** — `cd packages/shared && node --test tests/mask.test.ts` → "Cannot find module '../src/utils/mask.ts'".

- [ ] **Step 3: Implement** — `packages/shared/src/utils/mask.ts`

```ts
/** Masks an email for display: first letter + the domain. `—` when empty, `•••` when it isn't an email. */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '—';
  const at = email.indexOf('@');
  if (at < 1) return '•••';
  return `${email[0]}***${email.slice(at)}`;
}

/** Masks a PH mobile number for display, keeping only the last 4 digits. Accepts `09…`, spaced, or `+639…`. */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return '•••';
  return `09•• ••• ${digits.slice(-4)}`;
}
```

Add to `packages/shared/src/utils/index.ts`: `export * from './mask.ts';`

- [ ] **Step 4: Run, expect PASS** — `node --test tests/mask.test.ts` (5 tests... 4 tests, all pass).
- [ ] **Step 5: Commit** — `git add packages/shared && git commit -m "Add maskEmail and maskPhone helpers"`

---

### Task 2: Account service (MFA, devices, reactivation)

**Files:**
- Create: `packages/services/src/account/index.ts`
- Modify: `packages/services/src/index.ts` (add `export * from './account/index.ts';`), `packages/services/tests/fakeSupabaseClient.ts` (add `mfa` and `getUser` to `auth`)
- Test: `packages/services/tests/account.test.ts`

**Interfaces:**
- Produces:
  - `getMfaStatus(): Promise<{ enrolled: boolean; factorId: string | null; needsChallenge: boolean }>`
  - `startMfaEnrollment(): Promise<{ factorId: string | null; secret: string | null; uri: string | null; error: string | null }>`
  - `confirmMfaEnrollment(factorId: string, code: string): Promise<{ error: string | null }>`
  - `verifyMfaCode(factorId: string, code: string): Promise<{ error: string | null }>`
  - `disableMfa(factorId: string): Promise<{ error: string | null }>`
  - `listMySessions(): Promise<{ sessions: AccountSession[]; error: string | null }>` where `AccountSession = { id: string; createdAt: string; updatedAt: string; userAgent: string | null; isCurrent: boolean }`
  - `revokeMySession(sessionId: string): Promise<{ error: string | null }>`
  - `signOutOtherDevices(): Promise<void>`
  - `reactivateOwnAccount(): Promise<{ error: string | null }>`
  - `getDeactivationOrigin(): Promise<'self' | 'staff' | null>` (calls RPC `my_deactivation_origin`)

- [ ] **Step 1: Extend the fake client.** In `fakeSupabaseClient.ts` add to `FakeClientConfig`:

```ts
  /** Overrides for `auth.mfa.*`. */
  mfa?: {
    listFactors?: () => Promise<{ data: unknown; error: { message: string } | null }>;
    getAuthenticatorAssuranceLevel?: () => Promise<{ data: unknown; error: { message: string } | null }>;
    enroll?: (args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
    challenge?: (args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
    verify?: (args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
    unenroll?: (args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
```

and inside `auth`:

```ts
    mfa: {
      listFactors: config.mfa?.listFactors ?? (async () => ({ data: { totp: [] }, error: null })),
      getAuthenticatorAssuranceLevel:
        config.mfa?.getAuthenticatorAssuranceLevel ?? (async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null })),
      enroll: config.mfa?.enroll ?? (async () => ({ data: null, error: { message: 'enroll not configured' } })),
      challenge: config.mfa?.challenge ?? (async () => ({ data: { id: 'challenge-1' }, error: null })),
      verify: config.mfa?.verify ?? (async () => ({ data: {}, error: null })),
      unenroll: config.mfa?.unenroll ?? (async () => ({ data: {}, error: null })),
    },
```

- [ ] **Step 2: Write the failing tests** — `packages/services/tests/account.test.ts`

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import {
  confirmMfaEnrollment,
  disableMfa,
  getDeactivationOrigin,
  getMfaStatus,
  listMySessions,
  reactivateOwnAccount,
  revokeMySession,
  startMfaEnrollment,
  verifyMfaCode,
} from '../src/account/index.ts';

test('getMfaStatus: no factor means not enrolled and no challenge', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient());
  assert.deepEqual(await getMfaStatus(), { enrolled: false, factorId: null, needsChallenge: false });
});

test('getMfaStatus: a verified factor at aal1 needs a challenge', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      mfa: {
        listFactors: async () => ({ data: { totp: [{ id: 'f1', status: 'verified' }] }, error: null }),
        getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null }),
      },
    })
  );
  assert.deepEqual(await getMfaStatus(), { enrolled: true, factorId: 'f1', needsChallenge: true });
});

test('getMfaStatus: an unverified factor does not count as enrolled', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      mfa: { listFactors: async () => ({ data: { totp: [{ id: 'f1', status: 'unverified' }] }, error: null }) },
    })
  );
  assert.equal((await getMfaStatus()).enrolled, false);
});

test('startMfaEnrollment returns the secret and uri, and surfaces errors', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      mfa: { enroll: async () => ({ data: { id: 'f9', totp: { secret: 'ABCD', uri: 'otpauth://totp/x' } }, error: null }) },
    })
  );
  assert.deepEqual(await startMfaEnrollment(), { factorId: 'f9', secret: 'ABCD', uri: 'otpauth://totp/x', error: null });

  __setSupabaseClientForTests(createFakeSupabaseClient({ mfa: { enroll: async () => ({ data: null, error: { message: 'MFA disabled' } }) } }));
  assert.equal((await startMfaEnrollment()).error, 'MFA disabled');
});

test('verifyMfaCode challenges then verifies with the challenge id', async () => {
  let verifyArgs: any = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      mfa: {
        challenge: async () => ({ data: { id: 'ch1' }, error: null }),
        verify: async (args) => {
          verifyArgs = args;
          return { data: {}, error: null };
        },
      },
    })
  );
  assert.deepEqual(await verifyMfaCode('f1', '123456'), { error: null });
  assert.deepEqual(verifyArgs, { factorId: 'f1', challengeId: 'ch1', code: '123456' });
});

test('verifyMfaCode reports a wrong code and confirmMfaEnrollment shares the same path', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient({ mfa: { verify: async () => ({ data: null, error: { message: 'Invalid TOTP code' } }) } }));
  assert.equal((await verifyMfaCode('f1', '000000')).error, 'Invalid TOTP code');
  assert.equal((await confirmMfaEnrollment('f1', '000000')).error, 'Invalid TOTP code');
});

test('disableMfa unenrolls the factor', async () => {
  let args: any = null;
  __setSupabaseClientForTests(createFakeSupabaseClient({ mfa: { unenroll: async (a) => ((args = a), { data: {}, error: null }) } }));
  assert.deepEqual(await disableMfa('f1'), { error: null });
  assert.deepEqual(args, { factorId: 'f1' });
});

test('listMySessions maps rows and flags the current device', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn) => {
        assert.equal(fn, 'list_my_sessions');
        return {
          data: [{ id: 's1', created_at: 'a', updated_at: 'b', user_agent: 'okhttp', is_current: true }],
          error: null,
        };
      },
    })
  );
  assert.deepEqual(await listMySessions(), {
    sessions: [{ id: 's1', createdAt: 'a', updatedAt: 'b', userAgent: 'okhttp', isCurrent: true }],
    error: null,
  });
});

test('revokeMySession, reactivateOwnAccount and getDeactivationOrigin call their RPCs', async () => {
  const calls: Array<[string, unknown]> = [];
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn, args) => {
        calls.push([fn, args]);
        return { data: fn === 'my_deactivation_origin' ? 'self' : null, error: null };
      },
    })
  );
  assert.deepEqual(await revokeMySession('s2'), { error: null });
  assert.deepEqual(await reactivateOwnAccount(), { error: null });
  assert.equal(await getDeactivationOrigin(), 'self');
  assert.deepEqual(calls, [
    ['revoke_my_session', { p_session_id: 's2' }],
    ['self_reactivate_account', undefined],
    ['my_deactivation_origin', undefined],
  ]);
});
```

- [ ] **Step 3: Run, expect FAIL** — `cd packages/services && node --test tests/account.test.ts` → module not found.
- [ ] **Step 4: Implement** — `packages/services/src/account/index.ts`

```ts
import { getSupabaseClient } from '../supabase/client.ts';

export interface AccountSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  userAgent: string | null;
  isCurrent: boolean;
}

export interface MfaStatus {
  enrolled: boolean;
  factorId: string | null;
  /** True when a verified factor exists but this session has only passed the password step (aal1). */
  needsChallenge: boolean;
}

/** Reads whether the signed-in user has a verified authenticator factor and whether this session still owes a code. */
export async function getMfaStatus(): Promise<MfaStatus> {
  const mfa = getSupabaseClient().auth.mfa;
  const [factors, level] = await Promise.all([mfa.listFactors(), mfa.getAuthenticatorAssuranceLevel()]);
  const verified = (factors.data?.totp ?? []).find((factor) => factor.status === 'verified');
  const needsChallenge = !!verified && level.data?.currentLevel === 'aal1' && level.data?.nextLevel === 'aal2';
  return { enrolled: !!verified, factorId: verified?.id ?? null, needsChallenge };
}

/** Step 1 of setup: creates an unverified factor and returns the secret to type or open in an authenticator app. */
export async function startMfaEnrollment(): Promise<{ factorId: string | null; secret: string | null; uri: string | null; error: string | null }> {
  const { data, error } = await getSupabaseClient().auth.mfa.enroll({ factorType: 'totp' });
  if (error || !data) return { factorId: null, secret: null, uri: null, error: error?.message ?? 'Could not start setup.' };
  return { factorId: data.id, secret: data.totp.secret, uri: data.totp.uri, error: null };
}

/** Challenge + verify in one step: used for finishing setup, and for the code prompt after a password sign-in. */
export async function verifyMfaCode(factorId: string, code: string): Promise<{ error: string | null }> {
  const mfa = getSupabaseClient().auth.mfa;
  const challenge = await mfa.challenge({ factorId });
  if (challenge.error || !challenge.data) return { error: challenge.error?.message ?? 'Could not start verification.' };
  const { error } = await mfa.verify({ factorId, challengeId: challenge.data.id, code });
  return { error: error ? error.message : null };
}

export const confirmMfaEnrollment = verifyMfaCode;

export async function disableMfa(factorId: string): Promise<{ error: string | null }> {
  const { error } = await getSupabaseClient().auth.mfa.unenroll({ factorId });
  return { error: error ? error.message : null };
}

export async function listMySessions(): Promise<{ sessions: AccountSession[]; error: string | null }> {
  const { data, error } = await getSupabaseClient().rpc('list_my_sessions');
  if (error) return { sessions: [], error: error.message };
  const sessions = ((data ?? []) as Array<{ id: string; created_at: string; updated_at: string; user_agent: string | null; is_current: boolean }>).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userAgent: row.user_agent,
    isCurrent: row.is_current,
  }));
  return { sessions, error: null };
}

export async function revokeMySession(sessionId: string): Promise<{ error: string | null }> {
  const { error } = await getSupabaseClient().rpc('revoke_my_session', { p_session_id: sessionId });
  return { error: error ? error.message : null };
}

export async function signOutOtherDevices(): Promise<void> {
  await getSupabaseClient().auth.signOut({ scope: 'others' });
}

/** Undo a self-deactivation. The RPC refuses accounts the PSO deactivated. */
export async function reactivateOwnAccount(): Promise<{ error: string | null }> {
  const { error } = await getSupabaseClient().rpc('self_reactivate_account');
  return { error: error ? error.message : null };
}

/** Who performed the last deactivation: the person themself ('self') or PSO staff ('staff'). null when not deactivated. */
export async function getDeactivationOrigin(): Promise<'self' | 'staff' | null> {
  const { data, error } = await getSupabaseClient().rpc('my_deactivation_origin');
  if (error) return null;
  return data === 'self' || data === 'staff' ? data : null;
}
```

If `tsc` rejects the untyped rpc names (`list_my_sessions`, etc.), add them to `database.types.ts` `Functions` (Task 3 Step 5 regenerates/merges the types, so run this task's typecheck after Task 3).

- [ ] **Step 5: Run, expect PASS** — `node --test tests/account.test.ts` (9 tests) then `npm run --workspace packages/services test` (all previous tests still pass).
- [ ] **Step 6: Commit** — `git add packages/services && git commit -m "Add account service: MFA, devices, reactivation"`

---

### Task 3: Database migration (devices, reactivation, safer deactivation)

**Files:**
- Create: `supabase/migrations/20261001000001_account_management.sql`
- Create: `supabase/tests/account_management.sql`
- Modify: `packages/services/src/supabase/database.types.ts` (add the four functions to `Functions`)

**Interfaces:**
- Produces RPCs: `list_my_sessions()`, `revoke_my_session(p_session_id uuid)`, `my_deactivation_origin()`, `self_reactivate_account()`; replaces `self_deactivate_account()`.

- [ ] **Step 1: Write the migration**

```sql
-- Account management: signed-in devices, reversible self-deactivation.

-- Devices. auth.sessions is not exposed to the client, so read it through a
-- definer function scoped to the caller. The current session id is in the JWT.
create or replace function public.list_my_sessions()
returns table (id uuid, created_at timestamptz, updated_at timestamptz, user_agent text, is_current boolean)
language sql
security definer
set search_path = public, auth
as $$
  select s.id, s.created_at, s.updated_at, s.user_agent,
         s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid as is_current
  from auth.sessions s
  where s.user_id = auth.uid()
  order by s.updated_at desc nulls last;
$$;

create or replace function public.revoke_my_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid then
    raise exception 'Use log out to end this device''s own session.';
  end if;
  delete from auth.sessions where id = p_session_id and user_id = auth.uid();
end;
$$;

-- Who deactivated the account: the user themself, or staff.
create or replace function public.my_deactivation_origin()
returns text
language sql
security definer
set search_path = public
as $$
  select case when a.performed_by = a.target_user_id then 'self' else 'staff' end
  from public.users u
  join lateral (
    select performed_by, target_user_id
    from public.account_actions
    where target_user_id = u.id and action_type = 'deactivate'
    order by created_at desc
    limit 1
  ) a on true
  where u.id = auth.uid() and u.status = 'deactivated';
$$;

-- Deactivation: refuse while something is in flight, and take a driver offline.
create or replace function public.self_deactivate_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status account_status;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select status into v_status from public.users where id = v_uid;
  if v_status is null then raise exception 'Account not found'; end if;
  if v_status <> 'active' then
    raise exception 'This account cannot be self-deactivated from its current status — visit the PSO office.';
  end if;

  if exists (select 1 from public.ride_requests where passenger_id = v_uid and status in ('pending', 'assigned', 'ongoing')) then
    raise exception 'Finish or cancel your current ride before deactivating.';
  end if;
  if exists (select 1 from public.trips where driver_id = v_uid and status = 'active') then
    raise exception 'Finish your current trip before deactivating.';
  end if;
  if exists (
    select 1 from public.ride_requests rr
    where rr.passenger_id = v_uid and rr.status = 'completed'
      and not exists (select 1 from public.transactions t where t.ride_request_id = rr.id and t.status = 'paid')
      and rr.completed_at >= timestamptz '2026-09-30 00:00:00+08'
  ) then
    raise exception 'Settle your last ride before deactivating.';
  end if;

  update public.users set status = 'deactivated' where id = v_uid;
  update public.driver_profiles set is_available = false where user_id = v_uid;

  insert into public.account_actions (target_user_id, action_type, performed_by, reason)
  values (v_uid, 'deactivate', v_uid, 'Self-service deactivation from the app.');
end;
$$;

-- Reactivation: only an account the person deactivated themself.
create or replace function public.self_reactivate_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if (select public.my_deactivation_origin()) is distinct from 'self' then
    raise exception 'This account was deactivated by the PSO — visit the PSO office.';
  end if;
  update public.users set status = 'active' where id = v_uid;
  insert into public.account_actions (target_user_id, action_type, performed_by, reason)
  values (v_uid, 'reactivate', v_uid, 'Self-service reactivation from the app.');
end;
$$;

revoke execute on function public.list_my_sessions() from public, anon;
revoke execute on function public.revoke_my_session(uuid) from public, anon;
revoke execute on function public.my_deactivation_origin() from public, anon;
revoke execute on function public.self_reactivate_account() from public, anon;
revoke execute on function public.self_deactivate_account() from public, anon;
grant execute on function public.list_my_sessions() to authenticated;
grant execute on function public.revoke_my_session(uuid) to authenticated;
grant execute on function public.my_deactivation_origin() to authenticated;
grant execute on function public.self_reactivate_account() to authenticated;
grant execute on function public.self_deactivate_account() to authenticated;
```

Before applying, check against the live schema (the repo migrations are not the whole truth): column names `account_actions.created_at`, `completed_at`, `trips.status = 'active'`, and that `account_actions` has no trigger that rejects a non-supervisor `reactivate` row. Use `execute_sql` on `information_schema.columns` and `pg_trigger`; fix the SQL to match before applying.

- [ ] **Step 2: Write the SQL test** — `supabase/tests/account_management.sql`. Same style as `payment_settlement.sql` (one `execute_sql` call, borrows an existing user, ends with ROLLBACK). Assertions:
  1. A passenger with a `pending` ride cannot self-deactivate (`Finish or cancel…`).
  2. A passenger with no active ride CAN, status becomes `deactivated`, and `my_deactivation_origin()` returns `self`.
  3. `self_reactivate_account()` then returns the status to `active`.
  4. After a staff deactivation (insert `account_actions` with `performed_by` = a different user, set status `deactivated`), `self_reactivate_account()` raises `deactivated by the PSO`.
  5. `revoke_my_session` of a random uuid is a no-op; of the caller's own session id raises.
  Each assertion is a `do $$ … $$` block like the payment test, impersonating the user via `set_config('request.jwt.claims', …)`; assertion 5 sets `session_id` in the claims.

- [ ] **Step 3: Ask the user to approve applying the migration.** Do not apply without approval. When approved, apply with `apply_migration`, then run the SQL test with `execute_sql`; expect the final `result` row and no `FAIL n`.
- [ ] **Step 4: Update `database.types.ts`.** Add the four functions under `Functions` (args `{ p_session_id: string }` for `revoke_my_session`, otherwise `never`; returns as in the migration), then `npx tsc -b packages/shared packages/services packages/ui packages/utils` — expect no errors (this also proves Task 2's rpc names compile).
- [ ] **Step 5: Commit** — `git add supabase packages/services && git commit -m "Account management migration: devices, reversible deactivation (not applied)"` (amend message to "applied" once it is).

---

### Task 4: Make Change password work (both apps)

**Files:**
- Modify: `apps/passenger/app/profile/change-password.tsx`, `apps/driver/app/profile/change-password.tsx`, `packages/shared/src/i18n/en.ts`, `packages/shared/src/i18n/fil.ts` (`changePassword` section)
- Test: `packages/shared/tests/i18n.test.ts` (existing key-parity test)

**Interfaces:**
- Consumes: `verifyCurrentPassword(email, current)` and `updatePassword(next)` from `@trisakay/services`; `useAuthStore((s) => s.user?.email)`.

- [ ] **Step 1: Add strings** to `changePassword` in en and fil: `currentIncorrect` ("Current password is incorrect."), `updateFailedTitle` ("Couldn't update password"), `updatedTitle` ("Password updated"), `updatedMessage` ("Your password was changed and your other devices were signed out."). Remove the `notAvailableTitle`/`notAvailableNotice` usage from both screens (leave the keys; remove them only if nothing else uses them: `grep -rn notAvailable apps packages --include=*.tsx`).
- [ ] **Step 2: Run `npm run --workspace packages/shared test`** — the i18n parity test must pass.
- [ ] **Step 3: Wire the screen** (passenger shown; the driver file gets the identical change). Replace the disabled button and the status card with:

```tsx
const email = useAuthStore((state) => state.user?.email);
const [saving, setSaving] = useState(false);
const [currentError, setCurrentError] = useState<string | null>(null);
const rules = passwordRuleList(c, newPassword);
const allRulesMet = rules.every((rule) => rule.met);
const canSave = currentPassword.length > 0 && allRulesMet && newPassword === confirmNewPassword && !saving;

async function handleSave() {
  if (!email || !canSave) return;
  setSaving(true);
  setCurrentError(null);
  const check = await verifyCurrentPassword(email, currentPassword);
  if (check.error) {
    setSaving(false);
    setCurrentError(c.currentIncorrect);
    return;
  }
  const result = await updatePassword(newPassword);
  setSaving(false);
  if (result.error) {
    Alert.alert(c.updateFailedTitle, result.error);
    return;
  }
  Alert.alert(c.updatedTitle, c.updatedMessage, [{ text: t.common.ok, onPress: () => router.back() }]);
}
```

Pass `error={currentError ?? undefined}` to the current-password field, change the Save button to `<Button label={c.saveButton} fullWidth disabled={!canSave} loading={saving} onPress={handleSave} />`, and import `Alert`, `useRouter`, `useAuthStore`, `updatePassword`, `verifyCurrentPassword`. Check `passwordRuleList`'s return shape in `packages/shared/src/utils/records.ts` first and use its real field name for "met" (the line above assumes `met`). Confirm `t.common.ok` exists; otherwise use the existing OK key (`grep -n "ok:" packages/shared/src/i18n/en.ts`).
- [ ] **Step 4: Typecheck** — `npx tsc --noEmit -p apps/passenger && npx tsc --noEmit -p apps/driver`.
- [ ] **Step 5: Commit** — `git commit -am "Make Change password work: verify current password, update, sign out other devices"`.

---

### Task 5: Account screen, passenger app (and Profile page cleanup)

**Files:**
- Create: `apps/passenger/app/profile/account.tsx`, `apps/passenger/src/styles/profile/account.styles.ts`
- Modify: `apps/passenger/app/(tabs)/profile.tsx` (remove the email/phone card; add an "Account" row), `apps/passenger/app/(tabs)/settings.tsx` (replace the Deactivate row with an "Account" row), `packages/shared/src/i18n/en.ts` and `fil.ts` (new top-level `accountMgmt` section)

**Interfaces:**
- Consumes: `maskEmail`, `maskPhone` (Task 1), `verifyCurrentPassword`, `updateProfile` (existing), `getMfaStatus` (Task 2), `useAuthStore` (`user.email`, `user.phone`, `refreshProfile`).
- Produces: route `/profile/account`; i18n keys below used by Tasks 6–9.

- [ ] **Step 1: Add the `accountMgmt` i18n section** (en shown; write Filipino equivalents in `fil.ts` with the same keys):

```ts
accountMgmt: {
  title: 'Account',
  rowTitle: 'Account',
  rowSubtitle: 'Email, phone, password and security',
  detailsSection: 'Your details',
  email: 'Email',
  phone: 'Phone',
  show: 'Show',
  hide: 'Hide',
  showTitle: 'Show your details',
  showMessage: 'Enter your password to see your email and phone number.',
  passwordLabel: 'Password',
  confirm: 'Confirm',
  incorrect: 'Password is incorrect.',
  editPhone: 'Change phone number',
  savePhone: 'Save',
  phoneSaved: 'Phone number updated',
  securitySection: 'Security',
  changePassword: 'Change password',
  twoFactor: 'Two-step sign-in',
  twoFactorOn: 'On',
  twoFactorOff: 'Off',
  devices: 'Signed-in devices',
  dangerSection: 'Account',
  deactivate: 'Deactivate account',
  deactivateSubtitle: 'Pause your account. You can reactivate it by signing in.',
  mfaTitle: 'Two-step sign-in',
  mfaIntro: 'Add a 6-digit code from an authenticator app (such as Google Authenticator) each time you sign in.',
  mfaStart: 'Set up',
  mfaSecretLabel: 'Setup key',
  mfaOpenApp: 'Open authenticator app',
  mfaOpenAppFailed: 'No authenticator app found. Install one, then type the setup key into it.',
  mfaCodeLabel: '6-digit code',
  mfaVerify: 'Turn on',
  mfaEnabled: 'Two-step sign-in is on.',
  mfaDisable: 'Turn off',
  mfaDisableConfirm: 'Turn off two-step sign-in?',
  mfaChallengeTitle: 'Enter your code',
  mfaChallengeBody: 'Open your authenticator app and enter the 6-digit code for TriSakay.',
  mfaChallengeSubmit: 'Continue',
  mfaWrongCode: "That code didn't work. Check it and try again.",
  mfaUnavailable: "Two-step sign-in isn't available right now. Try again later.",
  devicesTitle: 'Signed-in devices',
  devicesThisDevice: 'This device',
  devicesLastActive: 'Last active',
  devicesSignOut: 'Sign out',
  devicesSignOutOthers: 'Sign out all other devices',
  devicesNone: 'No other devices are signed in.',
  deactivateTitle: 'Deactivate your account?',
  deactivateBody: 'You will not be able to book or take rides. Your ride and payment history is kept. Sign in again any time and tap Reactivate.',
  reactivate: 'Reactivate my account',
  reactivateFailed: "Couldn't reactivate your account.",
  reactivateBody: 'You deactivated this account. Reactivate it to use TriSakay again.',
},
```

- [ ] **Step 2: Remove PII from the passenger Profile.** In `profile.tsx` delete the `detailsCard` block (the email row and phone row, lines ~257-286), the phone `TextField`, the `phone` state, `confirmingPhoneChange`/`confirmPassword`/`confirmError`/`confirming` state, `handleConfirmPhoneChange`, the confirm `<Modal>`, and the now-unused imports (`verifyCurrentPassword`, `Modal`, `Button`, `Card` only if unused). `handleToggleEdit` reduces to: first press → `setIsEditing(true)`; second → `saveProfile()` with `{ firstName, lastName }` only. Check `updateProfile`'s signature in `packages/services/src/auth/index.ts:211`: if `phone` is required, make it optional there and update its test. Add an Account row at the top of the nav `Card`:

```tsx
<ListRow
  title={t.accountMgmt.rowTitle}
  leading={<View style={styles.navIconTile}><Ionicons name="person-circle-outline" size={18} color={colors.accentBluePressed} /></View>}
  onPress={() => router.push('/profile/account')}
  chevron
/>
```

- [ ] **Step 3: Settings.** In `settings.tsx` change the `sectionAccount` card's row to navigate to `/profile/account` with `t.accountMgmt.rowTitle` / `rowSubtitle` (icon `person-circle-outline`). The deactivate screen is now reached from the Account screen only.
- [ ] **Step 4: Create the screen** `apps/passenger/app/profile/account.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Modal, ScrollView, Text, View } from 'react-native';
import { getMfaStatus, updateProfile, verifyCurrentPassword } from '@trisakay/services';
import { maskEmail, maskPhone } from '@trisakay/shared';
import { Button, Card, ListRow, TextField, colors } from '@trisakay/ui';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useTranslation } from '../../src/hooks/useTranslation';
import { styles } from '../../src/styles/profile/account.styles';

const REVEAL_MS = 60_000;

export default function AccountScreen() {
  const router = useRouter();
  const a = useTranslation().accountMgmt;
  const user = useAuthStore((state) => state.user);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const [revealed, setRevealed] = useState(false);
  const [askingPassword, setAskingPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [savingPhone, setSavingPhone] = useState(false);
  const [mfaOn, setMfaOn] = useState<boolean | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getMfaStatus().then((s) => setMfaOn(s.enrolled)).catch(() => setMfaOn(null));
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function startReveal() {
    setPassword('');
    setPasswordError(null);
    setAskingPassword(true);
  }

  async function confirmReveal() {
    if (!user?.email) return;
    setChecking(true);
    const { error } = await verifyCurrentPassword(user.email, password);
    setChecking(false);
    if (error) {
      setPasswordError(a.incorrect);
      return;
    }
    setAskingPassword(false);
    setRevealed(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setRevealed(false);
      setEditingPhone(false);
    }, REVEAL_MS);
  }

  async function savePhone() {
    setSavingPhone(true);
    const { error } = await updateProfile({ firstName: user?.firstName ?? '', lastName: user?.lastName ?? '', phone });
    setSavingPhone(false);
    if (error) {
      Alert.alert(a.title, error);
      return;
    }
    await refreshProfile();
    setEditingPhone(false);
    Alert.alert(a.phoneSaved);
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title={a.title} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>{a.detailsSection}</Text>
        <Card variant="raised" style={styles.card}>
          <View style={styles.detailRow}>
            <View style={styles.detailBody}>
              <Text style={styles.detailLabel}>{a.email}</Text>
              <Text style={styles.detailValue} numberOfLines={1}>{revealed ? user?.email ?? '—' : maskEmail(user?.email)}</Text>
            </View>
            <Button label={revealed ? a.hide : a.show} variant="ghost" tone="neutral" onPress={revealed ? () => setRevealed(false) : startReveal} />
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <View style={styles.detailBody}>
              <Text style={styles.detailLabel}>{a.phone}</Text>
              {editingPhone ? (
                <TextField value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              ) : (
                <Text style={styles.detailValue}>{revealed ? user?.phone ?? '—' : maskPhone(user?.phone)}</Text>
              )}
            </View>
            {revealed && !editingPhone && <Button label={a.editPhone} variant="ghost" tone="neutral" onPress={() => setEditingPhone(true)} />}
            {editingPhone && <Button label={a.savePhone} loading={savingPhone} onPress={savePhone} />}
          </View>
        </Card>

        <Text style={styles.sectionLabel}>{a.securitySection}</Text>
        <Card variant="raised" style={styles.card}>
          <ListRow title={a.changePassword} onPress={() => router.push('/profile/change-password')} chevron />
          <ListRow
            title={a.twoFactor}
            subtitle={mfaOn === null ? undefined : mfaOn ? a.twoFactorOn : a.twoFactorOff}
            onPress={() => router.push('/profile/two-factor')}
            chevron
          />
          <ListRow title={a.devices} onPress={() => router.push('/profile/devices')} chevron divider={false} />
        </Card>

        <Text style={styles.sectionLabel}>{a.dangerSection}</Text>
        <Card variant="raised" style={styles.card}>
          <ListRow title={a.deactivate} subtitle={a.deactivateSubtitle} onPress={() => router.push('/deactivate-account')} chevron divider={false} />
        </Card>
      </ScrollView>

      <Modal visible={askingPassword} transparent animationType="fade" onRequestClose={() => setAskingPassword(false)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{a.showTitle}</Text>
            <Text style={styles.dialogBody}>{a.showMessage}</Text>
            <TextField label={a.passwordLabel} value={password} onChangeText={(v) => { setPassword(v); setPasswordError(null); }} secureTextEntry error={passwordError ?? undefined} />
            <View style={styles.dialogActions}>
              <Button label={useTranslation().common.cancel} variant="outline" tone="neutral" disabled={checking} onPress={() => setAskingPassword(false)} />
              <Button label={a.confirm} loading={checking} disabled={password.length === 0} onPress={confirmReveal} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
```

Fix before running: the Cancel label uses a second `useTranslation()` call inside JSX, which breaks the rules of hooks. Replace it with `const t = useTranslation(); const a = t.accountMgmt;` at the top and `t.common.cancel`. Confirm `ListRow` accepts `subtitle` and `divider` (`grep -n "subtitle\|divider" packages/ui/src/components/ListRow/*.tsx`); if it has no `subtitle`, drop those props.

`account.styles.ts` uses only existing tokens and mirrors `change-password.styles.ts`: `container` (flex 1, `colors.bg`), `content` (padding 16, gap 14), `sectionLabel` (`fontFamily.bold`, 12, `colors.inkFaint`, uppercase), `card` (padding 0), `detailRow` (row, center, gap 12, padding 14), `detailBody` (flex 1, gap 2), `detailLabel`, `detailValue`, `divider` (1 px `colors.lineSoft`), plus `backdrop`/`dialog`/`dialogTitle`/`dialogBody`/`dialogActions` copied from the removed confirm modal styles in `apps/passenger/src/styles/tabs/profile.styles.ts` (`confirmBackdrop`, `confirmCard`, …). Move those style keys rather than duplicating, and delete the then-unused keys from `profile.styles.ts` (`detailsCard`, `detailRow`, `detailIconTile`, `detailTextSlot`, `detailLabel`, `detailValue`, `detailDivider`, `detailEditWrap`, `confirm*`).
- [ ] **Step 5: Typecheck and test** — `npm run --workspace packages/shared test && npx tsc --noEmit -p apps/passenger`. Expected: pass.
- [ ] **Step 6: Commit** — `git add -A apps/passenger packages/shared && git commit -m "Passenger: Account screen with masked details; Profile no longer shows email and phone"`

---

### Task 6: Account screen, driver app

**Files:**
- Create: `apps/driver/app/profile/account.tsx`, `apps/driver/src/styles/profile/account.styles.ts`
- Modify: `apps/driver/app/(tabs)/profile.tsx`, `apps/driver/app/profile/settings.tsx`

Mirror Task 5 Steps 2-5 exactly, with these driver-specific differences:
- Imports: `ScreenHeader`, `useAuthStore`, `useTranslation` come from the driver app's `src/` (same relative layout; verify with `ls apps/driver/src/components/ScreenHeader*`).
- Profile cleanup: remove the email row (`t.driver.profile.email`, ~line 229) and phone row/field/state (~lines 45, 242-252), the phone-change confirm flow, and add the Account row to the driver profile's nav list next to the existing `/profile/settings` row (~line 275).
- Driver `settings.tsx` has no deactivate row, so add one Account row in its account section (before the Log out button) pointing to `/profile/account`.
- Strings: reuse the `accountMgmt` section from Task 5 (single shared section).
- The Account screen's deactivate row routes to `/deactivate-account`, created in Task 7 for the driver.
- Typecheck: `npx tsc --noEmit -p apps/driver`; commit: `Driver: Account screen with masked details; Profile no longer shows email and phone`.

---

### Task 7: Deactivation for drivers, and Reactivate on the suspended screen (both apps)

**Files:**
- Create: `apps/driver/app/deactivate-account.tsx`, `apps/driver/src/styles/deactivate-account.styles.ts` (copy of the passenger one)
- Modify: both apps' `app/account-suspended.tsx`, both `app/_layout.tsx` (register the new driver screen), `packages/shared/src/i18n/en.ts`/`fil.ts` (`auth.deactivateAccount` copy)
- Modify: `apps/*/src/store/useAuthStore.ts` (add `reactivateAccount`)

**Interfaces:**
- Consumes: `reactivateOwnAccount`, `getDeactivationOrigin` (Task 2).
- Produces: store action `reactivateAccount: () => Promise<string | null>` (returns an error message or null).

- [ ] **Step 1: Update the deactivate copy.** In en and fil, change `auth.deactivateAccount.message` to the new meaning (no PSO visit needed): "You won't be able to book rides until you reactivate. Sign in again and tap Reactivate. This does not delete your ride history." and change `factReactivateTitle`/the third fact so it no longer sends people to the PSO office; the third fact becomes: title "Reactivate any time", sub "Sign in and tap Reactivate my account."
- [ ] **Step 2: Store action** in both stores, next to `deactivateAccount`:

```ts
reactivateAccount: async () => {
  const { error } = await accountService.reactivateOwnAccount();
  if (error) return error;
  await authService.getCurrentUserProfile().then((p) => p && set({ user: toAppUser(p) })).catch(() => {});
  return null;
},
```

(import `* as accountService` from `@trisakay/services` the same way `authService` is imported; add the member to `AuthState`.)
- [ ] **Step 3: Driver deactivate screen.** Copy `apps/passenger/app/deactivate-account.tsx` to the driver app, replacing `useBookingStore`/`resetBooking` with nothing (delete those lines), import the driver store/hook paths, and keep the same copy. Register `<Stack.Screen name="deactivate-account" />` in the driver `_layout.tsx` Stack next to `account-suspended` if screens are listed explicitly there (check `grep -n "Stack.Screen" apps/driver/app/_layout.tsx`).
- [ ] **Step 4: Suspended screen.** In both `account-suspended.tsx`: on mount call `getDeactivationOrigin()` when `accountStatus === 'deactivated'`; if it returns `'self'`, show the body `a.reactivateBody` and a primary button `a.reactivate` (calls `reactivateAccount`, on error shows `a.reactivateFailed` + the message; on success the root layout gate clears because `accountStatus` becomes `active`). If origin is `'staff'` or the status is `suspended`, show the existing PSO-office content unchanged.
- [ ] **Step 5: Typecheck both apps and run all package tests.**
- [ ] **Step 6: Commit** — `Deactivation is reversible: Reactivate on the suspended screen; drivers can deactivate`

---

### Task 8: Two-step sign-in (setup screen and sign-in challenge), both apps

**Files:**
- Create (each app): `app/profile/two-factor.tsx`, `app/mfa-challenge.tsx`, styles for each (`src/styles/profile/two-factor.styles.ts`, `src/styles/mfa-challenge.styles.ts`)
- Modify (each app): `app/_layout.tsx` (gate + Stack screens)

**Interfaces:**
- Consumes: `getMfaStatus`, `startMfaEnrollment`, `confirmMfaEnrollment`, `verifyMfaCode`, `disableMfa` (Task 2).

- [ ] **Step 1: Confirm MFA is enabled on the live project.** Ask the user to check Supabase Dashboard → Authentication → Sign In / Providers → "Multi-Factor" → TOTP "Enroll" and "Verify" both enabled (hosted projects have this on by default). Do not change project settings without approval. Verify with a real call in Step 5.
- [ ] **Step 2: Setup screen** `two-factor.tsx`. State machine: `loading` → (`getMfaStatus`) → `off` | `on`. `off`: intro text and a "Set up" button → `startMfaEnrollment()`; on success show the secret (`selectable` Text, monospace via `fontFamily` already in the design system's mono token if present, else regular), an "Open authenticator app" button (`Linking.openURL(uri)`, on rejection `Alert.alert(a.mfaOpenAppFailed)`), a 6-digit `TextField` (`keyboardType="number-pad"`, `maxLength={6}`) and a "Turn on" button → `confirmMfaEnrollment(factorId, code)`; error → show `a.mfaWrongCode`; success → state `on`. `on`: shows `a.mfaEnabled` and a danger "Turn off" button → `Alert.alert(a.mfaDisableConfirm, …, [cancel, confirm→disableMfa(factorId)])`. If `startMfaEnrollment` returns an error show `a.mfaUnavailable`. Abandoned (never-verified) factors are handled by Supabase (they are replaced on the next enroll attempt); before enrolling, if `listFactors` returns an unverified factor, call `disableMfa` on it first (add this to `startMfaEnrollment` in the service, with a test in `account.test.ts` that an unverified factor is unenrolled first).
- [ ] **Step 3: Challenge screen** `mfa-challenge.tsx`: on mount `getMfaStatus()` to get `factorId`; one `TextField` for the code and a "Continue" button → `verifyMfaCode(factorId, code)`; success → `router.replace('/splash')` (same entry the root layout uses after sign-in, so the active-ride restore still runs); failure → `a.mfaWrongCode`. A "Log out" ghost button → `router.push('/logout')`.
- [ ] **Step 4: Gate.** In each root `_layout.tsx`, next to the consent/suspended gates (passenger around line 116-141): track `mfaPending` in the same effect style as `consentStatus`: after `isAuthenticated`, call `getMfaStatus()` once per `sessionUserId`; while it resolves hold position (like the consent `unknown` state); if `needsChallenge` and not already on `mfa-challenge`, `router.replace('/mfa-challenge')`; if on `mfa-challenge` and not `needsChallenge`, leave. The gate must run BEFORE the consent and suspended gates so a half-signed-in session can't reach them. If `getMfaStatus` throws (offline), treat as `needsChallenge = false` only when the user has no cached "mfa enrolled" flag; otherwise hold: store `mfaEnrolled` in the auth store after each successful status call and, when the call fails and `mfaEnrolled` is true, route to `mfa-challenge` (fail closed). Register the screens in the `Stack`.
- [ ] **Step 5: Verify on the live project** (after approval to use a test account): enroll, confirm the factor shows `verified` through `execute_sql` on `auth.mfa_factors`, sign out, sign in, expect the challenge screen, a wrong code is rejected, the right code reaches Home. Then turn it off and confirm sign-in goes straight to Home.
- [ ] **Step 6: Typecheck, run package tests, commit** — `Two-step sign-in: setup screen, sign-in challenge and gate`.

---

### Task 9: Signed-in devices screen, both apps

**Files:**
- Create (each app): `app/profile/devices.tsx`, `src/styles/profile/devices.styles.ts`

**Interfaces:**
- Consumes: `listMySessions`, `revokeMySession`, `signOutOtherDevices` (Task 2).

- [ ] **Step 1: Screen.** Loads `listMySessions()` on mount and on pull-to-refresh. Renders each session as a row: friendly device name from `userAgent` (`okhttp`/`Expo` → "Android app", otherwise the raw agent truncated to 40 characters, `null` → "Unknown device"), "Last active {relative}" from `updatedAt`, and for the current device a "This device" badge with NO sign-out button. Other rows have a "Sign out" button → `revokeMySession(id)` then reload. A bottom button "Sign out all other devices" (hidden when there are none) → `signOutOtherDevices()` then reload. Empty state `a.devicesNone`. Errors show an `Alert`.
- [ ] **Step 2: Typecheck both apps; commit** — `Signed-in devices screen`.

---

### Task 10: Final verification

- [ ] **Step 1:** `npm run --workspace packages/shared test`, `npm run --workspace packages/services test`, and each app's tests (`npm test --workspace apps/passenger`, `apps/driver`); expected: 0 failing.
- [ ] **Step 2:** `npx tsc -b packages/shared packages/services packages/ui packages/utils` then `npx tsc --noEmit -p apps/passenger`, `apps/driver`, `apps/admin`; expected: clean.
- [ ] **Step 3:** Ask the user before building. When told, build both apps with the project's forced-rebuild recipe (`expo export:embed --reset-cache`, `createBundleReleaseJsAndAssets --rerun assembleRelease`, check the APK contains `accountMgmt`-only text such as "Signed-in devices", `adb install -r`).
- [ ] **Step 4:** On the phone, walk through: Profile shows no email/phone; Account → Show asks for a password and re-masks after 60 s; wrong password rejected; change password works and a second signed-in device is signed out; two-step on/off and sign-in challenge; devices list; deactivate refused during an active ride; deactivate then sign in → Reactivate works; a PSO-deactivated account shows the PSO office instead.
- [ ] **Step 5:** Update `docs/UAT_PANELIST_REVIEW_ADRALES.md` with the new account-management row and its status.
