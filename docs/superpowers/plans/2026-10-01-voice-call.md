# In-app Voice Call Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A passenger and their assigned driver can place a private voice call to each other from inside the TriSakay apps, with no phone number ever shown, powered by Agora.

**Architecture:** A `ride_calls` table holds call state and is changed only by security-definer functions; a `call-token` edge function issues short-lived Agora tokens after re-checking the call and ride; a `notify-incoming-call` edge function sends a loud push through a database trigger. Both apps share the services layer, a pure call-state helper, and two presentational screens, and each app carries identical copies of a small call kit (Agora wrapper, session hook, incoming-call listener, screen view).

**Tech Stack:** Supabase (Postgres, RLS, pg_cron, pg_net, Edge Functions on Deno), `react-native-agora` 4.6.x, Expo SDK 54 / React Native 0.81 with expo-router and expo-notifications, TypeScript, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-01-voice-call-design.md`

## Global Constraints

- Expo has changed: AGENTS.md requires reading the versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing Expo code. Notification channels, the foreground handler and tap routing already exist in each app's `useChatNotifications.ts`; extend them, do not add a second `setNotificationHandler` (the last one registered wins and would silently break chat banners).
- Voice only; **no phone number, email or full name appears on any call screen or push**. Screens show first name and photo only. Push text is generic: "Incoming call from your driver" / "Incoming call from your passenger".
- A call is allowed only while `ride_requests.status` is `assigned` or `ongoing`, only between the ride's passenger and its current driver, ring window **30 seconds**, attempt limits **6 per ride per hour** and **40 per user per day**, **no recording**.
- Design rules (existing): no new color tokens (use `colors.*` from `@trisakay/ui`), no `fontWeight` (use `fontFamily`/`typography`), shadows on wrapper views, every user-facing string in both `en.ts` and `fil.ts`, and **no light status bar added on navy headers**. The call screens are light (`colors.bg`).
- Secrets: `AGORA_APP_CERTIFICATE` and `AGORA_APP_ID` are set by the user in Supabase Edge Function secrets. Never write them to a file, a commit or the chat.
- Live-system changes (apply migration, deploy functions, rebuild apps) happen only after the user says so. Do not push or merge to `main`; the user does that in GitHub Desktop. Work on branch `feat/voice-call`.
- `apps/*/android` is git-ignored and generated; edit it locally for the build **and** change `app.json` so a future prebuild reproduces it.
- Repo test commands: services `cd packages/services && npm test`; shared `cd packages/shared && npm test`; ui `cd packages/ui && npm test`; admin untouched. Typecheck: `npx tsc -b packages/shared packages/services packages/ui packages/utils` then `npx tsc --noEmit -p apps/passenger` and `-p apps/driver`.
- Edge-function unit tests run with node: `node --test supabase/functions/<fn>/<file>.test.ts` (pure modules only; no `npm:` or `Deno` imports in tested files).
- File edits on Windows: files may be CRLF. Prefer the Edit tool; if scripting an edit, read with `newline=''`, normalise to `\n`, write back with the original line ending.

## Review Focus

- **Both people tap Call at the same moment** (passenger calls driver while the driver calls the passenger): exactly one call row may exist; the loser gets "A call is already in progress", never two rows. Pinned in Task 1 test 3 (and the unique indexes).
- **Callee answers just after the caller cancelled, or after 30 seconds:** the answer is refused with "This call is no longer ringing" and nothing changes. Task 1 tests 5 and 10.
- **App killed or network lost mid-call:** the surviving side's remote-left event ends the call; a server backstop ends any call answered more than 2 hours ago. Task 1 test 13, Task 6 `useCallSession`.
- **Microphone permission denied:** the call ends cleanly with an explanation and the other side sees "ended", never a stuck "Connecting…". Task 6 `useCallSession`.
- **Ride completes, is cancelled, or is transferred during a ring or call:** the call ends, and the token function refuses a token. Task 1 tests 11 and 14, Task 4 authorize tests.

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20261001000006_ride_calls.sql` | table, indexes, RLS, call functions, expiry + cron, push trigger |
| `supabase/tests/ride_calls.sql` | rolled-back SQL assertions |
| `packages/services/src/calls/index.ts` (+ `tests/calls.test.ts`) | typed wrappers, token fetch, realtime subscriptions |
| `packages/services/src/supabase/database.types.ts` | hand-added `ride_calls` + function types |
| `packages/shared/src/utils/callState.ts` (+ test) | pure UI-state mapper and duration formatter |
| `supabase/functions/call-token/{authorize.ts,authorize.test.ts,index.ts}` | token authorization (pure) + Agora token endpoint |
| `supabase/functions/notify-incoming-call/index.ts` | loud push for a ringing call |
| `packages/ui/src/components/{IncomingCallScreen,InCallScreen}/` | presentational call screens |
| `packages/shared/src/i18n/{en,fil}.ts` | `callUi` strings |
| `apps/{passenger,driver}/src/{lib/callEngine.ts,hooks/useCallSession.ts,hooks/useIncomingCalls.ts,components/CallScreenView.tsx}` | identical call kit in both apps |
| `apps/passenger/app/booking/call.tsx`, `apps/driver/app/trip/call/[callId].tsx` | thin routes |
| `apps/*/src/hooks/useChatNotifications.ts` | `calls` channel + incoming-call banner suppression + tap routing |
| `apps/passenger/app/booking/trip.tsx`, `apps/driver/app/trip/active.tsx` | Call button wiring |
| `packages/shared/src/constants/index.ts` | `features.rideCall` on (last) |

---

### Task 1: Database — `ride_calls`, call functions, expiry, push trigger

**Files:**
- Create: `supabase/migrations/20261001000006_ride_calls.sql`
- Create: `supabase/tests/ride_calls.sql`

**Interfaces:**
- Produces (SQL): table `public.ride_calls`; functions callable by `authenticated`: `start_ride_call(uuid) returns uuid`, `answer_ride_call(uuid)`, `decline_ride_call(uuid)`, `end_ride_call(uuid)`, `list_my_active_calls()`, `get_ride_call(uuid)` (both return `id, ride_request_id, caller_id, callee_id, status, is_caller, age_seconds, answered_age_seconds, peer_first_name, peer_avatar_url`); server-only: `expire_ride_calls()`, `trigger_notify_incoming_call()`.

- [ ] **Step 1: Write the failing SQL test**

Create `supabase/tests/ride_calls.sql`:

```sql
-- Assertions for ride calls. Run in ONE execute_sql call after pasting 20261001000006_ride_calls.sql
-- (replace this file's leading 'begin;' by putting the migration after it). Ends with ROLLBACK.
-- A failed assertion raises 'FAIL n: ...'.

begin;

-- >>> paste the body of 20261001000006_ride_calls.sql here when the migration is not yet applied <<<

create temp table _fx as
select rr.id as ride, rr.passenger_id as passenger, t.driver_id as driver, t.id as trip,
  (select u.id from public.users u where u.status = 'active' and u.id not in (rr.passenger_id, t.driver_id) order by u.created_at limit 1) as outsider,
  (select r2.id from public.ride_requests r2 where r2.status = 'completed' and r2.id <> rr.id order by r2.completed_at desc limit 1) as other_ride
from public.ride_requests rr
join public.trips t on t.id = rr.trip_id
where rr.status = 'completed' and t.driver_id is not null
order by rr.completed_at desc limit 1;
grant select on _fx to public;

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end $$;
grant execute on function pg_temp.as_user(uuid) to public;
grant execute on function pg_temp.as_service() to public;

-- The ride must be active for calls; the status-transition guard refuses completed -> ongoing, so it is off for this transaction only.
alter table public.ride_requests disable trigger trg_validate_ride_status_transition;
update public.ride_requests set status = 'ongoing', completed_at = null where id = (select ride from _fx);

-- 1: a non-party cannot start a call; a party can; the callee is derived on the server.
do $$
declare fx record; v_call uuid; v_callee uuid;
begin
  select * into fx from _fx;
  if fx.ride is null or fx.outsider is null or fx.other_ride is null then raise exception 'FAIL 0: need a completed ride with a driver, an outsider and a second ride'; end if;
  perform pg_temp.as_user(fx.outsider);
  begin
    perform public.start_ride_call(fx.ride);
    raise exception 'FAIL 1a: an outsider started a call';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform pg_temp.as_user(fx.passenger);
  v_call := public.start_ride_call(fx.ride);
  perform pg_temp.as_service();
  select callee_id into v_callee from public.ride_calls where id = v_call;
  if v_callee is distinct from fx.driver then raise exception 'FAIL 1b: callee was not the driver'; end if;
end $$;

-- 2/3: only one active call per ride; the other side calling at the same moment is refused.
do $$
declare fx record;
begin
  select * into fx from _fx;
  perform pg_temp.as_user(fx.driver);
  begin
    perform public.start_ride_call(fx.ride);
    raise exception 'FAIL 3: the driver started a second call on the same ride';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- 4: the caller cannot answer their own call; the callee can.
do $$
declare fx record; v_call uuid;
begin
  select * into fx from _fx;
  perform pg_temp.as_service();
  select id into v_call from public.ride_calls where ride_request_id = fx.ride and status = 'ringing';
  perform pg_temp.as_user(fx.passenger);
  begin
    perform public.answer_ride_call(v_call);
    raise exception 'FAIL 4a: the caller answered their own call';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform pg_temp.as_user(fx.driver);
  perform public.answer_ride_call(v_call);
  perform pg_temp.as_service();
  if (select status from public.ride_calls where id = v_call) <> 'answered' then raise exception 'FAIL 4b: not answered'; end if;
end $$;

-- 6: either side can end an answered call; ending again is harmless.
do $$
declare fx record; v_call uuid;
begin
  select * into fx from _fx;
  perform pg_temp.as_service();
  select id into v_call from public.ride_calls where ride_request_id = fx.ride and status = 'answered';
  perform pg_temp.as_user(fx.driver);
  perform public.end_ride_call(v_call);
  perform public.end_ride_call(v_call);
  perform pg_temp.as_service();
  if (select status from public.ride_calls where id = v_call) <> 'ended' then raise exception 'FAIL 6: not ended'; end if;
end $$;

-- 7/5: decline; and answering a call the caller already cancelled is refused.
do $$
declare fx record; v_call uuid; v_call2 uuid;
begin
  select * into fx from _fx;
  perform pg_temp.as_user(fx.passenger);
  v_call := public.start_ride_call(fx.ride);
  perform pg_temp.as_user(fx.driver);
  perform public.decline_ride_call(v_call);
  perform pg_temp.as_service();
  if (select status from public.ride_calls where id = v_call) <> 'declined' then raise exception 'FAIL 7: not declined'; end if;

  perform pg_temp.as_user(fx.passenger);
  v_call2 := public.start_ride_call(fx.ride);
  perform pg_temp.as_user(fx.driver);
  begin
    perform public.end_ride_call(v_call2);
    raise exception 'FAIL 8a: the callee ended a ringing call instead of declining';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform pg_temp.as_user(fx.passenger);
  perform public.end_ride_call(v_call2);
  perform pg_temp.as_user(fx.driver);
  begin
    perform public.answer_ride_call(v_call2);
    raise exception 'FAIL 5: answered a cancelled call';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform pg_temp.as_service();
  if (select status from public.ride_calls where id = v_call2) <> 'cancelled' then raise exception 'FAIL 8b: not cancelled'; end if;
end $$;

-- 9: busy: the driver is already ringing on another ride, so the passenger's call is refused.
do $$
declare fx record;
begin
  select * into fx from _fx;
  perform pg_temp.as_service();
  insert into public.ride_calls (ride_request_id, caller_id, callee_id, status) values (fx.other_ride, fx.outsider, fx.driver, 'ringing');
  perform pg_temp.as_user(fx.passenger);
  begin
    perform public.start_ride_call(fx.ride);
    raise exception 'FAIL 9: a call to a busy person was started';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform pg_temp.as_service();
  delete from public.ride_calls where ride_request_id = fx.other_ride;
end $$;

-- 10: a ring older than 30 seconds cannot be answered, and expiry marks it missed.
do $$
declare fx record; v_call uuid;
begin
  select * into fx from _fx;
  perform pg_temp.as_user(fx.passenger);
  v_call := public.start_ride_call(fx.ride);
  perform pg_temp.as_service();
  update public.ride_calls set created_at = now() - interval '40 seconds' where id = v_call;
  perform pg_temp.as_user(fx.driver);
  begin
    perform public.answer_ride_call(v_call);
    raise exception 'FAIL 10a: answered after the ring window';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform pg_temp.as_service();
  perform public.expire_ride_calls();
  if (select status from public.ride_calls where id = v_call) <> 'missed' then raise exception 'FAIL 10b: not missed'; end if;
end $$;

-- 11: a ride that is no longer active ends its call.
do $$
declare fx record; v_call uuid;
begin
  select * into fx from _fx;
  perform pg_temp.as_user(fx.passenger);
  v_call := public.start_ride_call(fx.ride);
  perform pg_temp.as_user(fx.driver);
  perform public.answer_ride_call(v_call);
  perform pg_temp.as_service();
  update public.ride_requests set status = 'completed', completed_at = now() where id = fx.ride;
  perform public.expire_ride_calls();
  if (select status from public.ride_calls where id = v_call) <> 'ended' then raise exception 'FAIL 11: call survived the ride ending'; end if;
  update public.ride_requests set status = 'ongoing', completed_at = null where id = fx.ride;
end $$;

-- 12: clients cannot write the table; an outsider sees no rows.
do $$
declare fx record; n int;
begin
  select * into fx from _fx;
  perform pg_temp.as_user(fx.passenger);
  begin
    insert into public.ride_calls (ride_request_id, caller_id, callee_id) values (fx.ride, fx.passenger, fx.driver);
    raise exception 'FAIL 12a: a client inserted a call';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.ride_calls set status = 'ended';
    raise exception 'FAIL 12b: a client updated calls';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.ride_calls;
    raise exception 'FAIL 12c: a client deleted calls';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.as_user(fx.outsider);
  select count(*) into n from public.ride_calls;
  if n <> 0 then raise exception 'FAIL 12d: an outsider can read % calls', n; end if;
end $$;

-- 13: a call answered more than two hours ago is ended as a backstop.
do $$
declare fx record; v_call uuid;
begin
  select * into fx from _fx;
  perform pg_temp.as_user(fx.passenger);
  v_call := public.start_ride_call(fx.ride);
  perform pg_temp.as_user(fx.driver);
  perform public.answer_ride_call(v_call);
  perform pg_temp.as_service();
  update public.ride_calls set answered_at = now() - interval '3 hours' where id = v_call;
  perform public.expire_ride_calls();
  if (select end_reason from public.ride_calls where id = v_call) <> 'max_duration' then raise exception 'FAIL 13: no max-duration backstop'; end if;
end $$;

-- 14: a transfer to another driver ends the call.
do $$
declare fx record; v_call uuid;
begin
  select * into fx from _fx;
  perform pg_temp.as_user(fx.passenger);
  v_call := public.start_ride_call(fx.ride);
  perform pg_temp.as_service();
  update public.trips set driver_id = fx.outsider where id = fx.trip;
  perform public.expire_ride_calls();
  if (select status from public.ride_calls where id = v_call) not in ('cancelled', 'ended') then raise exception 'FAIL 14: call survived a driver change'; end if;
  update public.trips set driver_id = fx.driver where id = fx.trip;
end $$;

-- 15: attempt limit: six attempts on a ride in the last hour block a seventh.
do $$
declare fx record; n int;
begin
  select * into fx from _fx;
  perform pg_temp.as_service();
  select count(*) into n from public.ride_calls where ride_request_id = fx.ride and created_at > now() - interval '1 hour';
  while n < 6 loop
    insert into public.ride_calls (ride_request_id, caller_id, callee_id, status, ended_at) values (fx.ride, fx.passenger, fx.driver, 'ended', now());
    n := n + 1;
  end loop;
  perform pg_temp.as_user(fx.passenger);
  begin
    perform public.start_ride_call(fx.ride);
    raise exception 'FAIL 15: attempt limit not enforced';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- 16: list/get return the peer's first name only.
do $$
declare fx record; r record;
begin
  select * into fx from _fx;
  perform pg_temp.as_service();
  insert into public.ride_calls (ride_request_id, caller_id, callee_id, status) values (fx.other_ride, fx.driver, fx.passenger, 'ringing');
  perform pg_temp.as_user(fx.passenger);
  select * into r from public.list_my_active_calls() limit 1;
  if r.id is null or r.is_caller then raise exception 'FAIL 16a: incoming call not listed for the callee'; end if;
  if r.peer_first_name is null then raise exception 'FAIL 16b: no peer name'; end if;
end $$;

rollback;
select 'ride_calls: all assertions passed' as result;
```

- [ ] **Step 2: Run it to see it fail**

Run (before the migration exists): execute `supabase/tests/ride_calls.sql` in one `execute_sql` call on project `ygdgbvxxqrkxlezpckif` with the migration body not yet pasted.
Expected: FAIL with `relation "public.ride_calls" does not exist` (or `function public.start_ride_call(uuid) does not exist`). The transaction rolls back, nothing persists.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20261001000006_ride_calls.sql`:

```sql
-- In-app voice call (docs/superpowers/specs/2026-10-01-voice-call-design.md).
-- Call state lives here; the audio itself goes through Agora and is never recorded. Every change goes through
-- the functions below — clients can only read their own calls.

create table public.ride_calls (
  id uuid primary key default gen_random_uuid(),
  ride_request_id uuid not null references public.ride_requests(id) on delete cascade,
  caller_id uuid not null references public.users(id) on delete cascade,
  callee_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'ringing'
    check (status in ('ringing', 'answered', 'declined', 'cancelled', 'missed', 'ended')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  end_reason text,
  check (caller_id <> callee_id)
);

-- Backstops for the checks inside start_ride_call (two near-simultaneous calls cannot both get in).
create unique index ride_calls_one_active_per_ride on public.ride_calls (ride_request_id) where status in ('ringing', 'answered');
create unique index ride_calls_one_active_per_caller on public.ride_calls (caller_id) where status in ('ringing', 'answered');
create unique index ride_calls_one_active_per_callee on public.ride_calls (callee_id) where status in ('ringing', 'answered');
create index ride_calls_ride_created on public.ride_calls (ride_request_id, created_at);
create index ride_calls_caller_created on public.ride_calls (caller_id, created_at);

alter table public.ride_calls enable row level security;
create policy ride_calls_read on public.ride_calls for select
  using (caller_id = auth.uid() or callee_id = auth.uid());
revoke all on public.ride_calls from public, anon, authenticated;
grant select on public.ride_calls to authenticated;

alter publication supabase_realtime add table public.ride_calls;

create or replace function public.start_ride_call(p_ride_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_passenger uuid;
  v_driver uuid;
  v_status ride_status;
  v_callee uuid;
  v_id uuid;
begin
  if v_me is null then raise exception 'Not authenticated'; end if;
  if not coalesce(public.is_account_active(), false) then
    raise exception 'Your account cannot place calls right now';
  end if;

  select rr.passenger_id, t.driver_id, rr.status
    into v_passenger, v_driver, v_status
  from public.ride_requests rr
  left join public.trips t on t.id = rr.trip_id
  where rr.id = p_ride_request_id;

  if not found then raise exception 'Ride not found'; end if;
  if v_me <> v_passenger and v_me is distinct from v_driver then
    raise exception 'You are not part of this ride';
  end if;
  if v_status not in ('assigned', 'ongoing') then
    raise exception 'Calls are only available during an active ride';
  end if;

  v_callee := case when v_me = v_passenger then v_driver else v_passenger end;
  if v_callee is null then raise exception 'This ride has no driver yet'; end if;

  -- Free rows whose ring window has passed before looking for conflicts, so a stale 'ringing' row never
  -- blocks a new call while the cron job is up to a minute behind.
  update public.ride_calls
  set status = 'missed', ended_at = now(), end_reason = 'no_answer'
  where status = 'ringing'
    and created_at < now() - interval '30 seconds'
    and (ride_request_id = p_ride_request_id or caller_id in (v_me, v_callee) or callee_id in (v_me, v_callee));

  if (select count(*) from public.ride_calls
      where ride_request_id = p_ride_request_id and created_at > now() - interval '1 hour') >= 6 then
    raise exception 'Too many call attempts for this ride. Please try again later';
  end if;
  if (select count(*) from public.ride_calls
      where caller_id = v_me and created_at > now() - interval '1 day') >= 40 then
    raise exception 'Daily call limit reached. Please try again tomorrow';
  end if;

  if exists (select 1 from public.ride_calls
             where status in ('ringing', 'answered') and ride_request_id = p_ride_request_id) then
    raise exception 'A call is already in progress for this ride';
  end if;
  if exists (select 1 from public.ride_calls
             where status in ('ringing', 'answered') and v_me in (caller_id, callee_id)) then
    raise exception 'You are already on another call';
  end if;
  if exists (select 1 from public.ride_calls
             where status in ('ringing', 'answered') and v_callee in (caller_id, callee_id)) then
    raise exception 'The other person is on another call. Please try again in a moment';
  end if;

  begin
    insert into public.ride_calls (ride_request_id, caller_id, callee_id)
    values (p_ride_request_id, v_me, v_callee)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'A call is already in progress for this ride';
  end;

  return v_id;
end;
$function$;

create or replace function public.answer_ride_call(p_call_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  update public.ride_calls c
  set status = 'answered', answered_at = now()
  where c.id = p_call_id
    and c.callee_id = auth.uid()
    and c.status = 'ringing'
    and c.created_at > now() - interval '30 seconds'
    and exists (select 1 from public.ride_requests rr
                where rr.id = c.ride_request_id and rr.status in ('assigned', 'ongoing'));

  if not found then raise exception 'This call is no longer ringing'; end if;
end;
$function$;

create or replace function public.decline_ride_call(p_call_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  update public.ride_calls
  set status = 'declined', ended_at = now(), end_reason = 'declined'
  where id = p_call_id and callee_id = auth.uid() and status = 'ringing';

  if not found then raise exception 'This call is no longer ringing'; end if;
end;
$function$;

create or replace function public.end_ride_call(p_call_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_caller uuid;
  v_callee uuid;
  v_status text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select caller_id, callee_id, status into v_caller, v_callee, v_status
  from public.ride_calls where id = p_call_id for update;

  if not found or auth.uid() not in (v_caller, v_callee) then raise exception 'Call not found'; end if;
  if v_status not in ('ringing', 'answered') then return; end if;
  if v_status = 'ringing' and auth.uid() <> v_caller then
    raise exception 'Use decline to reject an incoming call';
  end if;

  update public.ride_calls
  set status = case when v_status = 'ringing' then 'cancelled' else 'ended' end,
      ended_at = now(),
      end_reason = case when v_status = 'ringing' then 'cancelled' else 'hung_up' end
  where id = p_call_id;
end;
$function$;

-- Cleanup run every minute by pg_cron (and callable by the service role): stale rings become missed, calls on
-- a ride that is no longer active or whose driver changed are ended, and any call answered over 2 hours ago is
-- ended as a backstop for a phone that vanished without leaving.
create or replace function public.expire_ride_calls()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.ride_calls
  set status = 'missed', ended_at = now(), end_reason = 'no_answer'
  where status = 'ringing' and created_at < now() - interval '30 seconds';

  update public.ride_calls c
  set status = case when c.status = 'ringing' then 'cancelled' else 'ended' end,
      ended_at = now(),
      end_reason = 'ride_changed'
  from public.ride_requests rr
  left join public.trips t on t.id = rr.trip_id
  where c.ride_request_id = rr.id
    and c.status in ('ringing', 'answered')
    and (
      rr.status not in ('assigned', 'ongoing')
      or not (
        (c.caller_id = rr.passenger_id and c.callee_id = t.driver_id)
        or (c.caller_id = t.driver_id and c.callee_id = rr.passenger_id)
      )
    );

  update public.ride_calls
  set status = 'ended', ended_at = now(), end_reason = 'max_duration'
  where status = 'answered' and answered_at < now() - interval '2 hours';
end;
$function$;

-- A call for the apps, with the other person's first name and photo (a passenger cannot read a driver's users
-- row directly). Ages are measured on the server so a phone with a wrong clock still counts the ring window right.
create or replace function public.list_my_active_calls()
returns table (
  id uuid, ride_request_id uuid, caller_id uuid, callee_id uuid, status text, is_caller boolean,
  age_seconds double precision, answered_age_seconds double precision,
  peer_first_name text, peer_avatar_url text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select c.id, c.ride_request_id, c.caller_id, c.callee_id, c.status,
         c.caller_id = auth.uid(),
         extract(epoch from (now() - c.created_at))::double precision,
         case when c.answered_at is null then null else extract(epoch from (now() - c.answered_at))::double precision end,
         p.first_name, p.avatar_url
  from public.ride_calls c
  join public.users p on p.id = case when c.caller_id = auth.uid() then c.callee_id else c.caller_id end
  where c.status in ('ringing', 'answered') and auth.uid() in (c.caller_id, c.callee_id);
$function$;

create or replace function public.get_ride_call(p_call_id uuid)
returns table (
  id uuid, ride_request_id uuid, caller_id uuid, callee_id uuid, status text, is_caller boolean,
  age_seconds double precision, answered_age_seconds double precision,
  peer_first_name text, peer_avatar_url text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select c.id, c.ride_request_id, c.caller_id, c.callee_id, c.status,
         c.caller_id = auth.uid(),
         extract(epoch from (now() - c.created_at))::double precision,
         case when c.answered_at is null then null else extract(epoch from (now() - c.answered_at))::double precision end,
         p.first_name, p.avatar_url
  from public.ride_calls c
  join public.users p on p.id = case when c.caller_id = auth.uid() then c.callee_id else c.caller_id end
  where c.id = p_call_id and auth.uid() in (c.caller_id, c.callee_id);
$function$;

-- Rings the other phone: fire-and-forget through pg_net with the shared Vault secret, like trigger_notify_new_message.
create or replace function public.trigger_notify_incoming_call()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_shared_secret';
  if v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://ygdgbvxxqrkxlezpckif.supabase.co/functions/v1/notify-incoming-call',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := jsonb_build_object('callId', new.id)
  );
  return new;
exception when others then
  return new;
end;
$$;

create trigger trg_notify_incoming_call
after insert on public.ride_calls
for each row
when (new.status = 'ringing')
execute function public.trigger_notify_incoming_call();

revoke execute on function public.start_ride_call(uuid) from public, anon;
revoke execute on function public.answer_ride_call(uuid) from public, anon;
revoke execute on function public.decline_ride_call(uuid) from public, anon;
revoke execute on function public.end_ride_call(uuid) from public, anon;
revoke execute on function public.list_my_active_calls() from public, anon;
revoke execute on function public.get_ride_call(uuid) from public, anon;
revoke execute on function public.expire_ride_calls() from public, anon, authenticated;
revoke execute on function public.trigger_notify_incoming_call() from public, anon, authenticated;
grant execute on function public.start_ride_call(uuid) to authenticated;
grant execute on function public.answer_ride_call(uuid) to authenticated;
grant execute on function public.decline_ride_call(uuid) to authenticated;
grant execute on function public.end_ride_call(uuid) to authenticated;
grant execute on function public.list_my_active_calls() to authenticated;
grant execute on function public.get_ride_call(uuid) to authenticated;

create extension if not exists pg_cron with schema extensions;

select cron.schedule('expire-ride-calls', '* * * * *', 'select public.expire_ride_calls();');
```

- [ ] **Step 4: Run the test against the migration, rolled back**

Build one `execute_sql` call: `begin;` + the migration body + the test body after its fixtures header (the test file's own `begin;` is replaced by the one at the top, and the paste marker line removed), ending with the test's `rollback; select ...`.
Expected: one row `ride_calls: all assertions passed`. If a `FAIL n` appears, fix the migration (not the test) and re-run. Then confirm the live database is unchanged:
`select count(*) from information_schema.tables where table_name = 'ride_calls'` returns `0`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261001000006_ride_calls.sql supabase/tests/ride_calls.sql
git commit -m "Voice call: ride_calls table, call functions, expiry, ring trigger (not applied)"
```

### Task 2: Services — typed call functions, token fetch, live updates

**Files:**
- Modify: `packages/services/src/supabase/database.types.ts`
- Create: `packages/services/src/calls/index.ts`
- Modify: `packages/services/src/index.ts`
- Test: `packages/services/tests/calls.test.ts`

**Interfaces:**
- Consumes (Task 1): RPCs `start_ride_call`, `answer_ride_call`, `decline_ride_call`, `end_ride_call`, `list_my_active_calls`, `get_ride_call`; edge function `call-token` (Task 4) returning `{ appId, channel, uid, token }` or `{ error }`.
- Consumes (existing): `extractFunctionErrorMessage` exported from `packages/services/src/payments/index.ts`; `uniqueChannelName` from `../supabase/channelName.ts`.
- Produces: types `RideCallStatus`, `RideCall`, `CallToken`; functions `startRideCall(rideRequestId) → {data: string|null, error}`, `answerRideCall(callId)`, `declineRideCall(callId)`, `endRideCall(callId)` → `{error: string|null}`, `getRideCall(callId) → {data: RideCall|null, error}`, `listMyActiveCalls() → {data: RideCall[], error}`, `getCallToken(callId) → {data: CallToken|null, error}`, `subscribeToMyCalls(userId, onData(rows), onError?) → () => void`, `subscribeToCall(callId, onData(call|null), onError?) → () => void`.

`RideCall` is `{ id, rideRequestId, callerId, calleeId, status, isCaller, ageSeconds, answeredAgeSeconds: number|null, peerFirstName: string|null, peerAvatarUrl: string|null }`. `ageSeconds` is measured on the server when the row was fetched.

- [ ] **Step 1: Write the failing tests**

Create `packages/services/tests/calls.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { __setSupabaseClientForTests } from '../src/supabase/client.ts';
import { createFakeSupabaseClient } from './fakeSupabaseClient.ts';
import {
  answerRideCall,
  declineRideCall,
  endRideCall,
  getCallToken,
  getRideCall,
  listMyActiveCalls,
  startRideCall,
  subscribeToCall,
  subscribeToMyCalls,
} from '../src/calls/index.ts';

const ROW = {
  id: 'c1',
  ride_request_id: 'rr1',
  caller_id: 'p1',
  callee_id: 'd1',
  status: 'ringing',
  is_caller: true,
  age_seconds: 4.2,
  answered_age_seconds: null,
  peer_first_name: 'Jomar',
  peer_avatar_url: 'https://example.test/a.png',
};

test('startRideCall calls the RPC with the ride id and returns the new call id', async () => {
  let captured: { fn: string; args: unknown } | null = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn, args) => {
        captured = { fn, args };
        return { data: 'c1', error: null };
      },
    }),
  );
  assert.deepEqual(await startRideCall('rr1'), { data: 'c1', error: null });
  assert.deepEqual(captured, { fn: 'start_ride_call', args: { p_ride_request_id: 'rr1' } });
});

test('startRideCall returns the database message when the call is refused', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ rpc: async () => ({ data: null, error: { message: 'A call is already in progress for this ride' } }) }),
  );
  assert.deepEqual(await startRideCall('rr1'), { data: null, error: 'A call is already in progress for this ride' });
});

test('answer, decline and end each call their RPC with only the call id', async () => {
  const calls: { fn: string; args: unknown }[] = [];
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      rpc: async (fn, args) => {
        calls.push({ fn, args });
        return { data: null, error: null };
      },
    }),
  );
  assert.deepEqual(await answerRideCall('c1'), { error: null });
  assert.deepEqual(await declineRideCall('c1'), { error: null });
  assert.deepEqual(await endRideCall('c1'), { error: null });
  assert.deepEqual(calls, [
    { fn: 'answer_ride_call', args: { p_call_id: 'c1' } },
    { fn: 'decline_ride_call', args: { p_call_id: 'c1' } },
    { fn: 'end_ride_call', args: { p_call_id: 'c1' } },
  ]);
});

test('answerRideCall surfaces the refusal message', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ rpc: async () => ({ data: null, error: { message: 'This call is no longer ringing' } }) }),
  );
  assert.deepEqual(await answerRideCall('c1'), { error: 'This call is no longer ringing' });
});

test('getRideCall maps the row, with the other person\'s first name and photo', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient({ rpc: async () => ({ data: [ROW], error: null }) }));
  assert.deepEqual(await getRideCall('c1'), {
    data: {
      id: 'c1',
      rideRequestId: 'rr1',
      callerId: 'p1',
      calleeId: 'd1',
      status: 'ringing',
      isCaller: true,
      ageSeconds: 4.2,
      answeredAgeSeconds: null,
      peerFirstName: 'Jomar',
      peerAvatarUrl: 'https://example.test/a.png',
    },
    error: null,
  });
});

test('getRideCall returns null data when there is no such call for this user', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient({ rpc: async () => ({ data: [], error: null }) }));
  assert.deepEqual(await getRideCall('nope'), { data: null, error: null });
});

test('listMyActiveCalls maps every row and returns an empty list on error', async () => {
  __setSupabaseClientForTests(createFakeSupabaseClient({ rpc: async () => ({ data: [ROW, { ...ROW, id: 'c2', is_caller: false }], error: null }) }));
  const ok = await listMyActiveCalls();
  assert.equal(ok.data.length, 2);
  assert.equal(ok.data[1].isCaller, false);

  __setSupabaseClientForTests(createFakeSupabaseClient({ rpc: async () => ({ data: null, error: { message: 'boom' } }) }));
  assert.deepEqual(await listMyActiveCalls(), { data: [], error: 'boom' });
});

test('getCallToken invokes call-token with only the call id and returns the credentials', async () => {
  let captured: { name: string; options: unknown } | null = null;
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      functionsInvoke: async (name, options) => {
        captured = { name, options };
        return { data: { appId: 'app', channel: 'call_c1', uid: 4242, token: 'tok' }, error: null };
      },
    }),
  );
  assert.deepEqual(await getCallToken('c1'), {
    data: { appId: 'app', channel: 'call_c1', uid: 4242, token: 'tok' },
    error: null,
  });
  assert.deepEqual(captured, { name: 'call-token', options: { body: { callId: 'c1' } } });
});

test('getCallToken surfaces the function\'s own message, and rejects an incomplete answer', async () => {
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      functionsInvoke: async () => ({
        data: null,
        error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({ error: 'This call has ended' }) } },
      }),
    }),
  );
  assert.deepEqual(await getCallToken('c1'), { data: null, error: 'This call has ended' });

  __setSupabaseClientForTests(createFakeSupabaseClient({ functionsInvoke: async () => ({ data: { appId: 'app' }, error: null }) }));
  assert.deepEqual(await getCallToken('c1'), { data: null, error: 'Could not get a call token' });
});

function fakeChannelHarness() {
  const handlers: (() => void)[] = [];
  const filters: string[] = [];
  const status: { cb: ((s: string) => void) | null } = { cb: null };
  let removed: unknown = null;
  const channel = {
    on: (_type: string, filter: { filter?: string }, handler: () => void) => {
      filters.push(filter.filter ?? '');
      handlers.push(handler);
      return channel;
    },
    subscribe: (cb?: (s: string) => void) => {
      status.cb = cb ?? null;
      return channel;
    },
  };
  return { channel, handlers, filters, status, wasRemoved: () => removed, setRemoved: (c: unknown) => (removed = c) };
}

test('subscribeToCall refetches on SUBSCRIBED and on every change, and removes the channel on unsubscribe', async () => {
  const h = fakeChannelHarness();
  let fetches = 0;
  const seen: unknown[] = [];
  __setSupabaseClientForTests(
    createFakeSupabaseClient({
      channel: () => h.channel,
      removeChannel: (c) => h.setRemoved(c),
      rpc: async () => {
        fetches++;
        return { data: [ROW], error: null };
      },
    }),
  );

  const unsubscribe = subscribeToCall('c1', (call) => seen.push(call));
  assert.deepEqual(h.filters, ['id=eq.c1']);
  h.status.cb!('SUBSCRIBED');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(fetches, 1);
  h.handlers[0]();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(fetches, 2);
  assert.equal(seen.length, 2);

  unsubscribe();
  assert.equal(h.wasRemoved(), h.channel);
});

test('subscribeToMyCalls listens for calls to and from the user and reports a channel error', async () => {
  const h = fakeChannelHarness();
  __setSupabaseClientForTests(
    createFakeSupabaseClient({ channel: () => h.channel, removeChannel: (c) => h.setRemoved(c), rpc: async () => ({ data: [], error: null }) }),
  );
  const errors: string[] = [];
  const unsubscribe = subscribeToMyCalls('u1', () => {}, (m) => errors.push(m));
  assert.deepEqual(h.filters, ['callee_id=eq.u1', 'caller_id=eq.u1']);
  h.status.cb!('CHANNEL_ERROR');
  assert.equal(errors.length, 1);
  unsubscribe();
});
```

- [ ] **Step 2: Run to confirm they fail**

Run: `cd packages/services && node --test tests/calls.test.ts`
Expected: FAIL with `Cannot find module '../src/calls/index.ts'`.

- [ ] **Step 3: Add the database types**

In `packages/services/src/supabase/database.types.ts`, under `Tables` add (next to `complaint_assignments`):

```ts
      ride_calls: {
        Row: {
          answered_at: string | null
          callee_id: string
          caller_id: string
          created_at: string
          end_reason: string | null
          ended_at: string | null
          id: string
          ride_request_id: string
          status: string
        }
        Insert: {
          answered_at?: string | null
          callee_id: string
          caller_id: string
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          ride_request_id: string
          status?: string
        }
        Update: {
          answered_at?: string | null
          callee_id?: string
          caller_id?: string
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          ride_request_id?: string
          status?: string
        }
        Relationships: []
      }
```

Under `Functions` add (before `get_passenger_trip_history`):

```ts
      answer_ride_call: {
        Args: { p_call_id: string }
        Returns: undefined
      }
      decline_ride_call: {
        Args: { p_call_id: string }
        Returns: undefined
      }
      end_ride_call: {
        Args: { p_call_id: string }
        Returns: undefined
      }
      start_ride_call: {
        Args: { p_ride_request_id: string }
        Returns: string
      }
      get_ride_call: {
        Args: { p_call_id: string }
        Returns: {
          age_seconds: number
          answered_age_seconds: number | null
          callee_id: string
          caller_id: string
          id: string
          is_caller: boolean
          peer_avatar_url: string | null
          peer_first_name: string | null
          ride_request_id: string
          status: string
        }[]
      }
      list_my_active_calls: {
        Args: never
        Returns: {
          age_seconds: number
          answered_age_seconds: number | null
          callee_id: string
          caller_id: string
          id: string
          is_caller: boolean
          peer_avatar_url: string | null
          peer_first_name: string | null
          ride_request_id: string
          status: string
        }[]
      }
```

- [ ] **Step 4: Write the implementation**

Create `packages/services/src/calls/index.ts`:

```ts
import { getSupabaseClient } from '../supabase/client.ts';
import { uniqueChannelName } from '../supabase/channelName.ts';
import type { Database } from '../supabase/database.types.ts';
import { extractFunctionErrorMessage } from '../payments/index.ts';

export type RideCallStatus = 'ringing' | 'answered' | 'declined' | 'cancelled' | 'missed' | 'ended';

export interface RideCall {
  id: string;
  rideRequestId: string;
  callerId: string;
  calleeId: string;
  status: RideCallStatus;
  /** True when this user placed the call. */
  isCaller: boolean;
  /** Seconds since the call was created, measured on the server when this row was fetched. */
  ageSeconds: number;
  /** Seconds since it was answered (server-measured), or null while it is not answered. */
  answeredAgeSeconds: number | null;
  /** The other person's first name and photo. Never a phone number or full name. */
  peerFirstName: string | null;
  peerAvatarUrl: string | null;
}

type CallRow = Database['public']['Functions']['get_ride_call']['Returns'][number];

function mapCall(row: CallRow): RideCall {
  return {
    id: row.id,
    rideRequestId: row.ride_request_id,
    callerId: row.caller_id,
    calleeId: row.callee_id,
    status: row.status as RideCallStatus,
    isCaller: row.is_caller,
    ageSeconds: row.age_seconds,
    answeredAgeSeconds: row.answered_age_seconds,
    peerFirstName: row.peer_first_name,
    peerAvatarUrl: row.peer_avatar_url,
  };
}

export interface CallWriteResult {
  error: string | null;
}

/** Places a call to the other person on this ride. The server derives who that is and checks the ride is active. */
export async function startRideCall(rideRequestId: string): Promise<{ data: string | null; error: string | null }> {
  const { data, error } = await getSupabaseClient().rpc('start_ride_call', { p_ride_request_id: rideRequestId });
  if (error) return { data: null, error: error.message };
  return { data: data ?? null, error: null };
}

export async function answerRideCall(callId: string): Promise<CallWriteResult> {
  const { error } = await getSupabaseClient().rpc('answer_ride_call', { p_call_id: callId });
  return { error: error?.message ?? null };
}

export async function declineRideCall(callId: string): Promise<CallWriteResult> {
  const { error } = await getSupabaseClient().rpc('decline_ride_call', { p_call_id: callId });
  return { error: error?.message ?? null };
}

/** Hang up. For a ringing call only the caller can use this (it cancels); the callee declines instead. */
export async function endRideCall(callId: string): Promise<CallWriteResult> {
  const { error } = await getSupabaseClient().rpc('end_ride_call', { p_call_id: callId });
  return { error: error?.message ?? null };
}

export async function getRideCall(callId: string): Promise<{ data: RideCall | null; error: string | null }> {
  const { data, error } = await getSupabaseClient().rpc('get_ride_call', { p_call_id: callId });
  if (error) return { data: null, error: error.message };
  const row = (data ?? [])[0];
  return { data: row ? mapCall(row) : null, error: null };
}

/** Calls this user is part of that are still ringing or connected. */
export async function listMyActiveCalls(): Promise<{ data: RideCall[]; error: string | null }> {
  const { data, error } = await getSupabaseClient().rpc('list_my_active_calls');
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map(mapCall), error: null };
}

export interface CallToken {
  appId: string;
  channel: string;
  uid: number;
  token: string;
}

/** Short-lived Agora credentials for one call. The server re-checks the call and the ride before issuing them. */
export async function getCallToken(callId: string): Promise<{ data: CallToken | null; error: string | null }> {
  const { data, error } = await getSupabaseClient().functions.invoke('call-token', { body: { callId } });
  if (error) return { data: null, error: await extractFunctionErrorMessage(error) };

  const result = data as (Partial<CallToken> & { error?: string }) | null;
  if (!result?.token || !result.appId || !result.channel || typeof result.uid !== 'number') {
    return { data: null, error: result?.error ?? 'Could not get a call token' };
  }
  return { data: { appId: result.appId, channel: result.channel, uid: result.uid, token: result.token }, error: null };
}

/** Safety net under realtime: a missed event during a reconnect matters for something that rings for 30 seconds. */
const POLL_MS = 5000;

/**
 * Live feed of this user's active calls (ringing or connected), for the "someone is calling you" listener.
 * Refetches on SUBSCRIBED and on any change to a call where the user is caller or callee, same shape as
 * subscribeToTransferInvites.
 */
export function subscribeToMyCalls(
  userId: string,
  onData: (rows: RideCall[]) => void,
  onError?: (message: string) => void,
): () => void {
  const client = getSupabaseClient();
  let cancelled = false;

  async function refetch() {
    const { data, error } = await listMyActiveCalls();
    if (cancelled) return;
    if (error) {
      onError?.(error);
      return;
    }
    onData(data);
  }

  const channel = client
    .channel(uniqueChannelName(`my_calls_${userId}`))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_calls', filter: `callee_id=eq.${userId}` }, () => void refetch())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_calls', filter: `caller_id=eq.${userId}` }, () => void refetch())
    .subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        void refetch();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (!cancelled) onError?.('Lost connection while listening for calls. Please check your connection.');
      }
    });

  const poll = setInterval(() => void refetch(), POLL_MS);

  return () => {
    cancelled = true;
    clearInterval(poll);
    client.removeChannel(channel);
  };
}

/** Follows one call (any status, including after it ends) so the call screen can show every state. */
export function subscribeToCall(
  callId: string,
  onData: (call: RideCall | null) => void,
  onError?: (message: string) => void,
): () => void {
  const client = getSupabaseClient();
  let cancelled = false;

  async function refetch() {
    const { data, error } = await getRideCall(callId);
    if (cancelled) return;
    if (error) {
      onError?.(error);
      return;
    }
    onData(data);
  }

  const channel = client
    .channel(uniqueChannelName(`ride_call_${callId}`))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_calls', filter: `id=eq.${callId}` }, () => void refetch())
    .subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        void refetch();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (!cancelled) onError?.('Lost connection during the call. Please check your connection.');
      }
    });

  const poll = setInterval(() => void refetch(), POLL_MS);

  return () => {
    cancelled = true;
    clearInterval(poll);
    client.removeChannel(channel);
  };
}
```

Add to `packages/services/src/index.ts` after the receipts export line:

```ts
export * from './calls/index.ts';
```

- [ ] **Step 5: Run the tests and typecheck**

Run: `cd packages/services && node --test tests/calls.test.ts`
Expected: PASS, 11 tests.
Run: `cd packages/services && npm test` — Expected: all pass (398 + 11), 0 fail.
Run (repo root): `npx tsc -b packages/shared packages/services` — Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add packages/services
git commit -m "Voice call: services layer (start/answer/decline/end, token, live subscriptions)"
```

---

### Task 3: Shared call-state helper

**Files:**
- Create: `packages/shared/src/utils/callState.ts`
- Modify: `packages/shared/src/utils/index.ts`
- Test: `packages/shared/tests/callState.test.ts`

**Interfaces:**
- Produces: `RING_WINDOW_SECONDS = 30`; `type CallStatus`; `type CallUiState = 'incoming' | 'calling' | 'connecting' | 'connected' | 'reconnecting' | 'declined' | 'no_answer' | 'cancelled' | 'ended'`; `callUiState(call, engine): CallUiState`; `isCallFinished(state): boolean`; `formatCallDuration(totalSeconds): string`.

- [ ] **Step 1: Write the failing test**

Create `packages/shared/tests/callState.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { RING_WINDOW_SECONDS, callUiState, formatCallDuration, isCallFinished } from '../src/utils/callState.ts';

const engine = { remoteJoined: false, connectionLost: false };
const ring = (isCaller: boolean, ageSeconds: number) => ({ status: 'ringing' as const, isCaller, ageSeconds });

test('a ringing call is "calling" for the caller and "incoming" for the callee', () => {
  assert.equal(callUiState(ring(true, 3), engine), 'calling');
  assert.equal(callUiState(ring(false, 3), engine), 'incoming');
});

test('a ring older than the window shows as no answer on both sides', () => {
  assert.equal(callUiState(ring(true, RING_WINDOW_SECONDS), engine), 'no_answer');
  assert.equal(callUiState(ring(false, RING_WINDOW_SECONDS + 5), engine), 'no_answer');
  assert.equal(callUiState(ring(true, RING_WINDOW_SECONDS - 1), engine), 'calling');
});

test('an answered call is connecting, then connected once the other side is in, and reconnecting if the link drops', () => {
  const answered = { status: 'answered' as const, isCaller: true, ageSeconds: 10 };
  assert.equal(callUiState(answered, engine), 'connecting');
  assert.equal(callUiState(answered, { remoteJoined: true, connectionLost: false }), 'connected');
  assert.equal(callUiState(answered, { remoteJoined: true, connectionLost: true }), 'reconnecting');
});

test('final statuses map to their own states, and a missing call is ended', () => {
  const base = { isCaller: true, ageSeconds: 5 };
  assert.equal(callUiState({ ...base, status: 'declined' }, engine), 'declined');
  assert.equal(callUiState({ ...base, status: 'missed' }, engine), 'no_answer');
  assert.equal(callUiState({ ...base, status: 'cancelled' }, engine), 'cancelled');
  assert.equal(callUiState({ ...base, status: 'ended' }, engine), 'ended');
  assert.equal(callUiState(null, engine), 'ended');
});

test('isCallFinished is true only for the end states', () => {
  for (const s of ['declined', 'no_answer', 'cancelled', 'ended'] as const) assert.equal(isCallFinished(s), true);
  for (const s of ['incoming', 'calling', 'connecting', 'connected', 'reconnecting'] as const) assert.equal(isCallFinished(s), false);
});

test('formatCallDuration shows m:ss, floors seconds, never goes negative, and adds hours past 60 minutes', () => {
  assert.equal(formatCallDuration(0), '0:00');
  assert.equal(formatCallDuration(9.9), '0:09');
  assert.equal(formatCallDuration(65), '1:05');
  assert.equal(formatCallDuration(3599), '59:59');
  assert.equal(formatCallDuration(3661), '1:01:01');
  assert.equal(formatCallDuration(-4), '0:00');
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `cd packages/shared && node --test tests/callState.test.ts`
Expected: FAIL with `Cannot find module '../src/utils/callState.ts'`.

- [ ] **Step 3: Write the implementation**

Create `packages/shared/src/utils/callState.ts`:

```ts
export const RING_WINDOW_SECONDS = 30;

export type CallStatus = 'ringing' | 'answered' | 'declined' | 'cancelled' | 'missed' | 'ended';

export type CallUiState =
  | 'incoming'
  | 'calling'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'declined'
  | 'no_answer'
  | 'cancelled'
  | 'ended';

export interface CallStateInput {
  status: CallStatus;
  isCaller: boolean;
  /** Seconds since the call was created, already corrected for the time passed since it was fetched. */
  ageSeconds: number;
}

export interface CallEngineState {
  remoteJoined: boolean;
  connectionLost: boolean;
}

/** What the call screen should show, from the server's call row plus what the audio engine reports. */
export function callUiState(call: CallStateInput | null, engine: CallEngineState): CallUiState {
  if (!call) return 'ended';
  switch (call.status) {
    case 'ringing':
      if (call.ageSeconds >= RING_WINDOW_SECONDS) return 'no_answer';
      return call.isCaller ? 'calling' : 'incoming';
    case 'answered':
      if (engine.connectionLost) return 'reconnecting';
      return engine.remoteJoined ? 'connected' : 'connecting';
    case 'declined':
      return 'declined';
    case 'missed':
      return 'no_answer';
    case 'cancelled':
      return 'cancelled';
    case 'ended':
      return 'ended';
  }
}

export function isCallFinished(state: CallUiState): boolean {
  return state === 'declined' || state === 'no_answer' || state === 'cancelled' || state === 'ended';
}

/** "m:ss", or "h:mm:ss" past an hour. */
export function formatCallDuration(totalSeconds: number): string {
  const total = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}
```

In `packages/shared/src/utils/index.ts` add (match the file's existing export style):

```ts
export * from './callState.ts';
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `cd packages/shared && npm test` — Expected: all pass (60 + 6), 0 fail.
Run (repo root): `npx tsc -b packages/shared` — Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "Voice call: shared call-state mapper and duration formatter"
```

### Task 4: Edge functions — `call-token` and `notify-incoming-call`

**Files:**
- Create: `supabase/functions/call-token/authorize.ts`, `supabase/functions/call-token/authorize.test.ts`, `supabase/functions/call-token/index.ts`
- Create: `supabase/functions/notify-incoming-call/message.ts`, `supabase/functions/notify-incoming-call/message.test.ts`, `supabase/functions/notify-incoming-call/index.ts`

**Interfaces:**
- Consumes (Task 1): table `ride_calls (id, status, caller_id, callee_id, ride_request_id, created_at)`; the trigger posts `{ callId }` to `notify-incoming-call` with `Authorization: Bearer <notify_shared_secret>`.
- Produces: `POST /functions/v1/call-token` (JWT required) body `{ callId }` → `200 { appId, channel, uid, token }` or `{ error }` with status 401/403/404/409/503. `notify-incoming-call` (shared-secret auth, `verify_jwt` false).

- [ ] **Step 1: Write the failing tests**

Create `supabase/functions/call-token/authorize.test.ts`:

```ts
// Run with: node --test supabase/functions/call-token/authorize.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeCallToken, randomUid } from './authorize.ts';

const call = { status: 'answered', caller_id: 'p1', callee_id: 'd1' };
const ride = { status: 'ongoing', passenger_id: 'p1', driver_id: 'd1' };

test('either party may get a token for an answered call on an active ride', () => {
  assert.deepEqual(authorizeCallToken('p1', call, ride), { ok: true });
  assert.deepEqual(authorizeCallToken('d1', call, ride), { ok: true });
});

test('the caller may join while it rings, but the callee must answer first', () => {
  const ringing = { ...call, status: 'ringing' };
  assert.deepEqual(authorizeCallToken('p1', ringing, ride), { ok: true });
  assert.deepEqual(authorizeCallToken('d1', ringing, ride), { ok: false, status: 409, error: 'Answer the call first' });
});

test('a stranger, a missing call, and a finished call are refused', () => {
  assert.deepEqual(authorizeCallToken('x', call, ride), { ok: false, status: 403, error: 'This call is not yours' });
  assert.deepEqual(authorizeCallToken('p1', null, ride), { ok: false, status: 404, error: 'Call not found' });
  for (const status of ['declined', 'cancelled', 'missed', 'ended']) {
    assert.deepEqual(authorizeCallToken('p1', { ...call, status }, ride), { ok: false, status: 409, error: 'This call has ended' });
  }
});

test('an inactive ride, or a ride whose driver changed, is refused', () => {
  for (const status of ['pending', 'completed', 'cancelled']) {
    assert.deepEqual(authorizeCallToken('p1', call, { ...ride, status }), { ok: false, status: 409, error: 'This ride is no longer active' });
  }
  assert.deepEqual(authorizeCallToken('p1', call, null), { ok: false, status: 409, error: 'This ride is no longer active' });
  assert.deepEqual(authorizeCallToken('p1', call, { ...ride, driver_id: 'other' }), {
    ok: false,
    status: 409,
    error: 'This call no longer matches the ride',
  });
  assert.deepEqual(authorizeCallToken('p1', call, { ...ride, driver_id: null }), {
    ok: false,
    status: 409,
    error: 'This call no longer matches the ride',
  });
});

test('randomUid is a positive 31-bit integer', () => {
  for (let i = 0; i < 200; i++) {
    const uid = randomUid();
    assert.ok(Number.isInteger(uid) && uid >= 1 && uid <= 2147483646);
  }
});
```

Create `supabase/functions/notify-incoming-call/message.test.ts`:

```ts
// Run with: node --test supabase/functions/notify-incoming-call/message.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { incomingCallTitle, isFreshRing } from './message.ts';

test('the push names only the caller\'s role, never a name or number', () => {
  assert.equal(incomingCallTitle(true), 'Incoming call from your driver');
  assert.equal(incomingCallTitle(false), 'Incoming call from your passenger');
});

test('a ring is only worth a push for the first minute', () => {
  const now = Date.parse('2026-10-01T10:00:00Z');
  assert.equal(isFreshRing('2026-10-01T09:59:30Z', now), true);
  assert.equal(isFreshRing('2026-10-01T09:58:30Z', now), false);
  assert.equal(isFreshRing('not a date', now), false);
});
```

- [ ] **Step 2: Run to confirm they fail**

Run: `node --test supabase/functions/call-token/authorize.test.ts supabase/functions/notify-incoming-call/message.test.ts`
Expected: FAIL with `Cannot find module` for both.

- [ ] **Step 3: Write the pure modules**

Create `supabase/functions/call-token/authorize.ts`:

```ts
// Pure helpers for call-token, free of Deno APIs so they can be unit-tested with node (see authorize.test.ts).

export interface CallRow {
  status: string;
  caller_id: string;
  callee_id: string;
}

export interface RideRow {
  status: string;
  passenger_id: string;
  driver_id: string | null;
}

export type Authorization = { ok: true } | { ok: false; status: number; error: string };

/**
 * May this user get Agora credentials for this call right now? Checked against the server's own rows on every
 * request: a stranger, an ended call, a ride that is no longer active, or a ride whose driver changed all get
 * refused. The callee must have answered first; the caller may join while it rings.
 */
export function authorizeCallToken(userId: string, call: CallRow | null, ride: RideRow | null): Authorization {
  if (!call) return { ok: false, status: 404, error: 'Call not found' };
  if (userId !== call.caller_id && userId !== call.callee_id) {
    return { ok: false, status: 403, error: 'This call is not yours' };
  }
  if (call.status !== 'ringing' && call.status !== 'answered') {
    return { ok: false, status: 409, error: 'This call has ended' };
  }
  if (userId === call.callee_id && call.status !== 'answered') {
    return { ok: false, status: 409, error: 'Answer the call first' };
  }
  if (!ride || (ride.status !== 'assigned' && ride.status !== 'ongoing')) {
    return { ok: false, status: 409, error: 'This ride is no longer active' };
  }
  const parties = new Set([call.caller_id, call.callee_id]);
  if (!ride.driver_id || !parties.has(ride.passenger_id) || !parties.has(ride.driver_id)) {
    return { ok: false, status: 409, error: 'This call no longer matches the ride' };
  }
  return { ok: true };
}

/** A random positive 31-bit id for the audio channel, so no name or phone number is ever used as an identity. */
export function randomUid(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return (buffer[0] % 2147483646) + 1;
}
```

Create `supabase/functions/notify-incoming-call/message.ts`:

```ts
// Pure helpers for notify-incoming-call (node-testable, see message.test.ts).

/** Role only, from the receiver's point of view. No name, no number. */
export function incomingCallTitle(calleeIsPassenger: boolean): string {
  return calleeIsPassenger ? 'Incoming call from your driver' : 'Incoming call from your passenger';
}

/** A ring lasts 30 seconds; a push delivered more than a minute after the call was placed is stale. */
export function isFreshRing(createdAtIso: string, nowMs: number): boolean {
  const created = Date.parse(createdAtIso);
  if (Number.isNaN(created)) return false;
  return nowMs - created <= 60_000;
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test supabase/functions/call-token/authorize.test.ts supabase/functions/notify-incoming-call/message.test.ts`
Expected: PASS, 7 tests (5 + 2).

- [ ] **Step 5: Write the two edge functions**

Create `supabase/functions/call-token/index.ts`:

```ts
// Issues a short-lived Agora RTC token for one call. verify_jwt is ON: the caller is a signed-in user. The call and
// the ride are re-read here with the service role and re-checked on EVERY request (authorize.ts), so a token can
// never be had for a finished call, a stranger's call, or a ride that is no longer active. The channel is named
// after the call (not the ride) and the uid is random, so an old token can never join a later call and no
// identity (name, phone) ever reaches the audio service.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { RtcRole, RtcTokenBuilder } from 'npm:agora-token@2';
import { authorizeCallToken, randomUid } from './authorize.ts';

const APP_ID = Deno.env.get('AGORA_APP_ID') ?? '';
const APP_CERTIFICATE = Deno.env.get('AGORA_APP_CERTIFICATE') ?? '';
const TOKEN_SECONDS = 3600;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Not authenticated' }, 401);

    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const callId = typeof body.callId === 'string' && UUID.test(body.callId) ? body.callId : null;
    if (!callId) return json({ error: 'callId is required' }, 400);

    if (!APP_ID || !APP_CERTIFICATE) {
      console.error('call-token: AGORA_APP_ID / AGORA_APP_CERTIFICATE are not configured');
      return json({ error: 'Calling is not set up yet' }, 503);
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: call, error: callError } = await supabase
      .from('ride_calls')
      .select('status, caller_id, callee_id, ride_request_id')
      .eq('id', callId)
      .maybeSingle();
    if (callError) return json({ error: callError.message }, 500);

    let ride: { status: string; passenger_id: string; driver_id: string | null } | null = null;
    if (call) {
      const { data: rideRow, error: rideError } = await supabase
        .from('ride_requests')
        .select('status, passenger_id, trip_id')
        .eq('id', call.ride_request_id)
        .maybeSingle();
      if (rideError) return json({ error: rideError.message }, 500);
      if (rideRow) {
        let driverId: string | null = null;
        if (rideRow.trip_id) {
          const { data: trip } = await supabase.from('trips').select('driver_id').eq('id', rideRow.trip_id).maybeSingle();
          driverId = trip?.driver_id ?? null;
        }
        ride = { status: rideRow.status, passenger_id: rideRow.passenger_id, driver_id: driverId };
      }
    }

    const decision = authorizeCallToken(userData.user.id, call, ride);
    if (!decision.ok) return json({ error: decision.error }, decision.status);

    const uid = randomUid();
    const channel = `call_${callId}`;
    const token = RtcTokenBuilder.buildTokenWithUid(APP_ID, APP_CERTIFICATE, channel, uid, RtcRole.PUBLISHER, TOKEN_SECONDS, TOKEN_SECONDS);

    return json({ appId: APP_ID, channel, uid, token });
  } catch (err) {
    console.error('call-token: unexpected error', err instanceof Error ? err.message : err);
    return json({ error: 'Internal error' }, 500);
  }
});
```

Create `supabase/functions/notify-incoming-call/index.ts`:

```ts
// Rings the other phone for a new call. Fired by trg_notify_incoming_call (AFTER INSERT on ride_calls, status
// 'ringing') through pg_net — same shared-secret auth as notify-new-message (no end-user session exists at
// trigger time). verify_jwt is deliberately false at deploy time; the header check below is the actual gate.
// Nothing from the request body is trusted beyond the call id: the call, the ride, and the callee's push token are
// re-read with the service role. The push carries only the caller's role, never a name or number.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { incomingCallTitle, isFreshRing } from './message.ts';

const SHARED_SECRET = Deno.env.get('NOTIFY_SHARED_SECRET') ?? '';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  try {
    if (!SHARED_SECRET) {
      console.error('notify-incoming-call: NOTIFY_SHARED_SECRET is not configured');
      return json({ error: 'Server misconfigured' }, 500);
    }
    const provided = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!timingSafeEqual(provided, SHARED_SECRET)) return json({ error: 'Unauthorized' }, 401);

    const payload = await req.json().catch(() => ({}) as Record<string, unknown>);
    const callId = typeof payload.callId === 'string' ? payload.callId : undefined;
    if (!callId) return json({ error: 'callId required' }, 400);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: call, error: callError } = await supabase
      .from('ride_calls')
      .select('id, status, callee_id, ride_request_id, created_at')
      .eq('id', callId)
      .maybeSingle();
    if (callError) return json({ error: callError.message }, 500);
    if (!call) return json({ sent: 0, skipped: 'call not found' });
    if (call.status !== 'ringing') return json({ sent: 0, skipped: 'no longer ringing' });
    if (!isFreshRing(call.created_at, Date.now())) return json({ sent: 0, skipped: 'stale' });

    const { data: ride, error: rideError } = await supabase
      .from('ride_requests')
      .select('passenger_id')
      .eq('id', call.ride_request_id)
      .maybeSingle();
    if (rideError) return json({ error: rideError.message }, 500);
    if (!ride) return json({ sent: 0, skipped: 'ride not found' });

    const { data: callee, error: calleeError } = await supabase
      .from('users')
      .select('push_token')
      .eq('id', call.callee_id)
      .maybeSingle();
    if (calleeError) return json({ error: calleeError.message }, 500);
    const token = callee?.push_token;
    if (!token) return json({ sent: 0, skipped: 'no push token' });

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify([
        {
          to: token,
          sound: 'default',
          title: incomingCallTitle(ride.passenger_id === call.callee_id),
          body: '',
          priority: 'high',
          ttl: 30,
          channelId: 'calls',
          data: { type: 'incoming_call', callId: call.id, rideRequestId: call.ride_request_id },
        },
      ]),
    }).catch((err) => {
      console.error('notify-incoming-call: Expo push send failed', err instanceof Error ? err.message : err);
      return null;
    });

    return json({ sent: res?.ok ? 1 : 0 });
  } catch (err) {
    console.error('notify-incoming-call: unexpected error', err instanceof Error ? err.message : err);
    return json({ error: 'Internal error' }, 500);
  }
});
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/call-token supabase/functions/notify-incoming-call
git commit -m "Voice call: call-token and notify-incoming-call edge functions (not deployed)"
```

---

### Task 5: Shared call screens and strings

**Files:**
- Create: `packages/ui/src/components/IncomingCallScreen/{IncomingCallScreen.tsx,IncomingCallScreen.styles.ts,index.ts}`
- Create: `packages/ui/src/components/InCallScreen/{InCallScreen.tsx,InCallScreen.styles.ts,index.ts}`
- Modify: `packages/ui/src/components/index.ts`
- Modify: `packages/shared/src/i18n/en.ts`, `packages/shared/src/i18n/fil.ts`

**Interfaces:**
- Produces: `IncomingCallScreen` props `{ name, avatarUrl?, eyebrow, subtitle, answerLabel, declineLabel, onAnswer, onDecline, busy?, topInset?, bottomInset? }`; `InCallScreen` props `{ name, avatarUrl?, stateText, timerText?, errorText?, finished, muted, speaker, muteLabel, unmuteLabel, speakerLabel, endLabel, closeLabel, onToggleMute, onToggleSpeaker, onEnd, onClose, topInset?, bottomInset? }`; i18n section `callUi` in both languages with the keys listed in Step 1.

- [ ] **Step 1: Add the strings (both languages)**

In `packages/shared/src/i18n/en.ts`, insert immediately before the line `  accountMgmt: {`:

```ts
  callUi: {
    incomingEyebrow: 'Incoming voice call',
    incomingSubtitle: 'TriSakay voice call',
    unknownCaller: 'TriSakay user',
    answer: 'Answer',
    decline: 'Decline',
    end: 'End call',
    mute: 'Mute',
    unmute: 'Unmute',
    speaker: 'Speaker',
    close: 'Close',
    stateCalling: 'Calling…',
    stateConnecting: 'Connecting…',
    stateConnected: 'Connected',
    stateReconnecting: 'Reconnecting…',
    stateDeclined: 'Call declined',
    stateNoAnswer: 'No answer',
    stateCancelled: 'Call cancelled',
    stateEnded: 'Call ended',
    micDeniedTitle: 'Microphone is off',
    micDeniedBody: 'Allow microphone access in your phone settings to make voice calls.',
    connectionFailed: "Couldn't connect the call. Please try again.",
    cannotStartTitle: "Can't place the call",
  },
```

In `packages/shared/src/i18n/fil.ts`, insert before its `  accountMgmt: {` line:

```ts
  callUi: {
    incomingEyebrow: 'May tumatawag (voice call)',
    incomingSubtitle: 'Voice call sa TriSakay',
    unknownCaller: 'User ng TriSakay',
    answer: 'Sagutin',
    decline: 'Tanggihan',
    end: 'Tapusin',
    mute: 'I-mute',
    unmute: 'I-unmute',
    speaker: 'Speaker',
    close: 'Isara',
    stateCalling: 'Tumatawag…',
    stateConnecting: 'Kumokonekta…',
    stateConnected: 'Konektado',
    stateReconnecting: 'Kumokonekta ulit…',
    stateDeclined: 'Tinanggihan ang tawag',
    stateNoAnswer: 'Walang sumagot',
    stateCancelled: 'Kinansela ang tawag',
    stateEnded: 'Tapos na ang tawag',
    micDeniedTitle: 'Naka-off ang mikropono',
    micDeniedBody: 'Payagan ang mikropono sa settings ng phone para makatawag.',
    connectionFailed: 'Hindi makakonekta ang tawag. Subukan ulit.',
    cannotStartTitle: 'Hindi matawagan',
  },
```

Run: `cd packages/shared && npm test` — Expected: all pass (the existing i18n parity test fails if the two files differ in shape).

- [ ] **Step 2: Write `IncomingCallScreen`**

`packages/ui/src/components/IncomingCallScreen/IncomingCallScreen.styles.ts`:

```ts
import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  eyebrow: { ...typography.label, color: colors.inkSoft },
  name: { ...typography.h2, color: colors.ink, textAlign: 'center', maxWidth: '90%' },
  subtitle: { ...typography.body, color: colors.inkSoft, textAlign: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: spacing.lg },
  action: { alignItems: 'center', gap: 8, minWidth: 96 },
  round: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  declineRound: { backgroundColor: colors.danger },
  answerRound: { backgroundColor: colors.accentGreen },
  hangUpIcon: { transform: [{ rotate: '135deg' }] },
  actionLabel: { ...typography.body, color: colors.ink, textAlign: 'center' },
});
```

`packages/ui/src/components/IncomingCallScreen/IncomingCallScreen.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../../theme';
import { Avatar } from '../Avatar';
import { styles } from './IncomingCallScreen.styles';

export interface IncomingCallScreenProps {
  /** The caller's first name. Never a phone number. */
  name: string;
  avatarUrl?: string | null;
  eyebrow: string;
  subtitle: string;
  answerLabel: string;
  declineLabel: string;
  onAnswer: () => void;
  onDecline: () => void;
  busy?: boolean;
  topInset?: number;
  bottomInset?: number;
}

export function IncomingCallScreen({
  name,
  avatarUrl,
  eyebrow,
  subtitle,
  answerLabel,
  declineLabel,
  onAnswer,
  onDecline,
  busy = false,
  topInset = 0,
  bottomInset = 0,
}: IncomingCallScreenProps) {
  return (
    <View style={[styles.screen, { paddingTop: topInset, paddingBottom: Math.max(24, bottomInset + 12) }]}>
      <View style={styles.center}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Avatar name={name} source={avatarUrl ? { uri: avatarUrl } : undefined} size="xl" />
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={declineLabel}
            disabled={busy}
            onPress={onDecline}
            style={[styles.round, styles.declineRound]}
          >
            <Ionicons name="call" size={28} color={colors.white} style={styles.hangUpIcon} />
          </Pressable>
          <Text style={styles.actionLabel}>{declineLabel}</Text>
        </View>
        <View style={styles.action}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={answerLabel}
            disabled={busy}
            onPress={onAnswer}
            style={[styles.round, styles.answerRound]}
          >
            <Ionicons name="call" size={28} color={colors.white} />
          </Pressable>
          <Text style={styles.actionLabel}>{answerLabel}</Text>
        </View>
      </View>
    </View>
  );
}
```

`packages/ui/src/components/IncomingCallScreen/index.ts`:

```ts
export * from './IncomingCallScreen';
```

- [ ] **Step 3: Write `InCallScreen`**

`packages/ui/src/components/InCallScreen/InCallScreen.styles.ts`:

```ts
import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  name: { ...typography.h2, color: colors.ink, textAlign: 'center', maxWidth: '90%' },
  state: { ...typography.body, color: colors.inkSoft, textAlign: 'center' },
  timer: { ...typography.h2, color: colors.ink },
  error: { ...typography.body, color: colors.danger, textAlign: 'center', maxWidth: '90%' },
  controls: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start', paddingTop: spacing.lg },
  control: { alignItems: 'center', gap: 8, minWidth: 88 },
  toggle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  toggleOff: { backgroundColor: colors.accentBlueSoft },
  toggleOn: { backgroundColor: colors.accentBlue },
  endRound: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger },
  hangUpIcon: { transform: [{ rotate: '135deg' }] },
  controlLabel: { ...typography.body, color: colors.ink, textAlign: 'center' },
  closeWrap: { paddingTop: spacing.lg },
});
```

`packages/ui/src/components/InCallScreen/InCallScreen.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../../theme';
import { Avatar } from '../Avatar';
import { Button } from '../Button';
import { styles } from './InCallScreen.styles';

export interface InCallScreenProps {
  /** The other person's first name. Never a phone number. */
  name: string;
  avatarUrl?: string | null;
  stateText: string;
  /** Shown while connected, e.g. "1:05". */
  timerText?: string;
  errorText?: string | null;
  /** True once the call is over: the controls give way to a Close button. */
  finished: boolean;
  muted: boolean;
  speaker: boolean;
  muteLabel: string;
  unmuteLabel: string;
  speakerLabel: string;
  endLabel: string;
  closeLabel: string;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onEnd: () => void;
  onClose: () => void;
  topInset?: number;
  bottomInset?: number;
}

export function InCallScreen({
  name,
  avatarUrl,
  stateText,
  timerText,
  errorText,
  finished,
  muted,
  speaker,
  muteLabel,
  unmuteLabel,
  speakerLabel,
  endLabel,
  closeLabel,
  onToggleMute,
  onToggleSpeaker,
  onEnd,
  onClose,
  topInset = 0,
  bottomInset = 0,
}: InCallScreenProps) {
  return (
    <View style={[styles.screen, { paddingTop: topInset, paddingBottom: Math.max(24, bottomInset + 12) }]}>
      <View style={styles.center}>
        <Avatar name={name} source={avatarUrl ? { uri: avatarUrl } : undefined} size="xl" />
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.state}>{stateText}</Text>
        {timerText ? <Text style={styles.timer}>{timerText}</Text> : null}
        {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
      </View>

      {finished ? (
        <View style={styles.closeWrap}>
          <Button label={closeLabel} fullWidth onPress={onClose} />
        </View>
      ) : (
        <View style={styles.controls}>
          <View style={styles.control}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={muted ? unmuteLabel : muteLabel}
              accessibilityState={{ selected: muted }}
              onPress={onToggleMute}
              style={[styles.toggle, muted ? styles.toggleOn : styles.toggleOff]}
            >
              <Ionicons name={muted ? 'mic-off' : 'mic'} size={24} color={muted ? colors.white : colors.accentBlue} />
            </Pressable>
            <Text style={styles.controlLabel}>{muted ? unmuteLabel : muteLabel}</Text>
          </View>
          <View style={styles.control}>
            <Pressable accessibilityRole="button" accessibilityLabel={endLabel} onPress={onEnd} style={styles.endRound}>
              <Ionicons name="call" size={28} color={colors.white} style={styles.hangUpIcon} />
            </Pressable>
            <Text style={styles.controlLabel}>{endLabel}</Text>
          </View>
          <View style={styles.control}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={speakerLabel}
              accessibilityState={{ selected: speaker }}
              onPress={onToggleSpeaker}
              style={[styles.toggle, speaker ? styles.toggleOn : styles.toggleOff]}
            >
              <Ionicons name="volume-high" size={24} color={speaker ? colors.white : colors.accentBlue} />
            </Pressable>
            <Text style={styles.controlLabel}>{speakerLabel}</Text>
          </View>
        </View>
      )}
    </View>
  );
}
```

`packages/ui/src/components/InCallScreen/index.ts`:

```ts
export * from './InCallScreen';
```

In `packages/ui/src/components/index.ts` add (keep the file's existing style and alphabetical-ish grouping):

```ts
export * from './IncomingCallScreen';
export * from './InCallScreen';
```

- [ ] **Step 4: Typecheck**

Run (repo root): `npx tsc -b packages/shared packages/services packages/ui packages/utils`
Expected: no output. If `colors.accentBlueSoft`, `typography.h2/body/label`, or `spacing.lg` is reported missing, use the nearest existing token from `packages/ui/src/theme` (do not add a new token).

- [ ] **Step 5: Commit**

```bash
git add packages/ui packages/shared
git commit -m "Voice call: incoming and in-call screens, strings in English and Filipino"
```

### Task 6: Passenger app — call kit and wiring

The call kit is four files that are **byte-identical in both apps** (Task 7 copies them with a command), so they take no app-specific imports beyond `../hooks/useTranslation`, which both apps have.

**Files:**
- Create: `apps/passenger/src/lib/callEngine.ts`, `apps/passenger/src/hooks/useCallSession.ts`, `apps/passenger/src/hooks/useIncomingCalls.ts`, `apps/passenger/src/components/CallScreenView.tsx`
- Create: `apps/passenger/app/booking/call.tsx`
- Modify: `apps/passenger/src/hooks/useChatNotifications.ts`, `apps/passenger/app/_layout.tsx`, `apps/passenger/app/booking/trip.tsx`
- Modify: `apps/passenger/package.json` and `apps/driver/package.json` (Step 0 installs `react-native-agora` in both apps, so the driver's typecheck in Task 7 works too).

**Interfaces:**
- Consumes (Tasks 2, 3, 5): `@trisakay/services` call functions and `RideCall`; `@trisakay/shared` `callUiState`, `formatCallDuration`, `isCallFinished`, `CallUiState`; `@trisakay/ui` `IncomingCallScreen`, `InCallScreen`, `colors`; i18n `t.callUi.*`.
- Produces: `createCallEngine(events): CallEngine`, `ensureMicPermission(): Promise<boolean>`, `useCallSession(callId): CallSession`, `useIncomingCalls(userId, callRoute)`, `<CallScreenView callId onClose />`.

There is no automated test for the native engine wrapper or the hooks (they drive Agora and the router); the pure logic they use is tested in Tasks 2 and 3, and the end-to-end behaviour is verified on two phones in Task 8. Typecheck is the gate in this task.

- [ ] **Step 0: Install the Agora package in both apps**

Run (repo root): `npm install react-native-agora@4.6.4 --workspace apps/passenger --workspace apps/driver`
Expected: both `apps/passenger/package.json` and `apps/driver/package.json` now list `react-native-agora` at 4.6.4; the package is present in `node_modules` (repo root or the app's own). Do not run `expo prebuild`. Commit the package files and lockfile with this task.

- [ ] **Step 1: Write `callEngine.ts`**

`apps/passenger/src/lib/callEngine.ts`:

```ts
import { PermissionsAndroid, Platform } from 'react-native';
import {
  ChannelProfileType,
  ClientRoleType,
  ConnectionStateType,
  createAgoraRtcEngine,
  type IRtcEngine,
  type IRtcEngineEventHandler,
  type RtcConnection,
} from 'react-native-agora';

export interface CallEngineEvents {
  onRemoteJoined: () => void;
  onRemoteLeft: () => void;
  onConnectionLost: () => void;
  onConnectionRestored: () => void;
  onError: (message: string) => void;
}

export interface CallCredentials {
  appId: string;
  channel: string;
  uid: number;
  token: string;
}

export interface CallEngine {
  join: (credentials: CallCredentials) => void;
  setMuted: (muted: boolean) => void;
  setSpeaker: (on: boolean) => void;
  leave: () => void;
}

/** Asks for the microphone at call time. iOS prompts on first use of the audio engine itself. */
export async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/** A thin, audio-only wrapper around the Agora engine. One engine per call; `leave` releases it. */
export function createCallEngine(events: CallEngineEvents): CallEngine {
  const engine: IRtcEngine = createAgoraRtcEngine();
  let released = false;

  const handler: IRtcEngineEventHandler = {
    onUserJoined: () => events.onRemoteJoined(),
    onUserOffline: () => events.onRemoteLeft(),
    onConnectionStateChanged: (_connection: RtcConnection, state: ConnectionStateType) => {
      if (state === ConnectionStateType.ConnectionStateReconnecting) events.onConnectionLost();
      else if (state === ConnectionStateType.ConnectionStateConnected) events.onConnectionRestored();
      else if (state === ConnectionStateType.ConnectionStateFailed) events.onError('connection_failed');
    },
    onError: (_code, message) => events.onError(message),
  };

  return {
    join({ appId, channel, uid, token }) {
      engine.initialize({ appId, channelProfile: ChannelProfileType.ChannelProfileCommunication });
      engine.registerEventHandler(handler);
      engine.enableAudio();
      engine.setEnableSpeakerphone(false);
      engine.joinChannel(token, channel, uid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        autoSubscribeAudio: true,
      });
    },
    setMuted(muted) {
      if (!released) engine.muteLocalAudioStream(muted);
    },
    setSpeaker(on) {
      if (!released) engine.setEnableSpeakerphone(on);
    },
    leave() {
      if (released) return;
      released = true;
      engine.unregisterEventHandler(handler);
      engine.leaveChannel();
      engine.release();
    },
  };
}
```

- [ ] **Step 2: Write `useCallSession.ts`**

`apps/passenger/src/hooks/useCallSession.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  answerRideCall,
  declineRideCall,
  endRideCall,
  getCallToken,
  subscribeToCall,
  type RideCall,
} from '@trisakay/services';
import { callUiState, formatCallDuration, isCallFinished, type CallUiState } from '@trisakay/shared';
import { createCallEngine, ensureMicPermission, type CallEngine } from '../lib/callEngine';

export type CallFailure = 'mic_denied' | 'connection_failed' | null;

export interface CallSession {
  call: RideCall | null;
  /** False until the first answer from the server. */
  loaded: boolean;
  uiState: CallUiState;
  finished: boolean;
  /** "1:05" while connected. */
  timerText: string | undefined;
  muted: boolean;
  speaker: boolean;
  failure: CallFailure;
  actionError: string | null;
  busy: boolean;
  answer: () => Promise<void>;
  decline: () => Promise<void>;
  end: () => Promise<void>;
  toggleMute: () => void;
  toggleSpeaker: () => void;
}

function isActive(call: RideCall | null): boolean {
  return call?.status === 'ringing' || call?.status === 'answered';
}

/**
 * Everything one call screen needs: follows the call row on the server, joins the audio channel once the call is
 * answered (microphone permission, then a token, then Agora), reports mute/speaker state, and cleans up. The
 * server row is the source of truth for whether the call is on: if the other side leaves the audio channel, this
 * hangs up so both screens end together.
 */
export function useCallSession(callId: string | undefined): CallSession {
  const [call, setCall] = useState<RideCall | null>(null);
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [loaded, setLoaded] = useState(false);
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [connectionLost, setConnectionLost] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [failure, setFailure] = useState<CallFailure>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const engineRef = useRef<CallEngine | null>(null);
  const joiningRef = useRef(false);
  const callRef = useRef<RideCall | null>(null);
  callRef.current = call;

  useEffect(() => {
    if (!callId) {
      setLoaded(true);
      return;
    }
    return subscribeToCall(
      callId,
      (next) => {
        setCall(next);
        setFetchedAt(Date.now());
        setLoaded(true);
      },
      // A failed refetch is retried by the poll; only stop the spinner if nothing has ever loaded.
      () => {
        if (!callRef.current) setLoaded(true);
      },
    );
  }, [callId]);

  const active = isActive(call);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);

  const elapsedSeconds = Math.max(0, (now - fetchedAt) / 1000);
  const uiState = callUiState(
    call ? { status: call.status, isCaller: call.isCaller, ageSeconds: call.ageSeconds + elapsedSeconds } : null,
    { remoteJoined, connectionLost },
  );
  const finished = isCallFinished(uiState);
  const answeredSeconds = call?.answeredAgeSeconds != null ? call.answeredAgeSeconds + elapsedSeconds : null;
  const timerText = uiState === 'connected' && answeredSeconds != null ? formatCallDuration(answeredSeconds) : undefined;

  // Join the audio channel once the call is answered. Both sides do this; the token endpoint re-checks everything.
  useEffect(() => {
    if (!call || call.status !== 'answered' || joiningRef.current || engineRef.current) return;
    joiningRef.current = true;
    const id = call.id;

    (async () => {
      const granted = await ensureMicPermission();
      if (!granted) {
        setFailure('mic_denied');
        await endRideCall(id);
        return;
      }

      const { data, error } = await getCallToken(id);
      if (error || !data) {
        setFailure('connection_failed');
        await endRideCall(id);
        return;
      }

      // The call may have ended while the permission prompt or the token request was in flight.
      if (!isActive(callRef.current)) return;

      const engine = createCallEngine({
        onRemoteJoined: () => {
          setRemoteJoined(true);
          setConnectionLost(false);
        },
        // The other phone left the audio channel (hung up, app killed, network gone for good): end it for both.
        onRemoteLeft: () => {
          void endRideCall(id);
        },
        onConnectionLost: () => setConnectionLost(true),
        onConnectionRestored: () => setConnectionLost(false),
        // Agora also reports recoverable warnings here; a real failure shows up as a lost connection or the other
        // side leaving, which are handled above.
        onError: () => {},
      });
      engineRef.current = engine;
      engine.join(data);
    })();
  }, [call?.status, call?.id]);

  useEffect(() => {
    if (!finished) return;
    engineRef.current?.leave();
    engineRef.current = null;
  }, [finished]);

  // Leaving the screen ends whatever is still on: the caller cancels or hangs up, the callee declines or hangs up.
  useEffect(
    () => () => {
      engineRef.current?.leave();
      engineRef.current = null;
      const current = callRef.current;
      if (current && isActive(current)) {
        void (current.status === 'ringing' && !current.isCaller ? declineRideCall(current.id) : endRideCall(current.id));
      }
    },
    [],
  );

  const answer = useCallback(async () => {
    if (!callId) return;
    setBusy(true);
    setActionError(null);
    const { error } = await answerRideCall(callId);
    setBusy(false);
    if (error) setActionError(error);
  }, [callId]);

  const decline = useCallback(async () => {
    if (!callId) return;
    setBusy(true);
    const { error } = await declineRideCall(callId);
    setBusy(false);
    if (error) setActionError(error);
  }, [callId]);

  const end = useCallback(async () => {
    if (!callId) return;
    const { error } = await endRideCall(callId);
    if (error) setActionError(error);
  }, [callId]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    engineRef.current?.setMuted(next);
    setMuted(next);
  }, [muted]);

  const toggleSpeaker = useCallback(() => {
    const next = !speaker;
    engineRef.current?.setSpeaker(next);
    setSpeaker(next);
  }, [speaker]);

  return { call, loaded, uiState, finished, timerText, muted, speaker, failure, actionError, busy, answer, decline, end, toggleMute, toggleSpeaker };
}
```

- [ ] **Step 3: Write `useIncomingCalls.ts`**

`apps/passenger/src/hooks/useIncomingCalls.ts`:

```ts
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { subscribeToMyCalls } from '@trisakay/services';

type Route = Parameters<ReturnType<typeof useRouter>['navigate']>[0];

/** A ring older than this is not worth interrupting the screen for (the ring window is 30 seconds). */
const MAX_AGE_SECONDS = 35;

/**
 * "Someone is calling you": watches this user's calls while the app is open and, for each new ringing call
 * addressed to them, opens the answer screen. `router.navigate` (not `push`) so a notification tap that routes to
 * the same call screen does not stack a second copy.
 */
export function useIncomingCalls(userId: string | null, callRoute: (callId: string) => Route) {
  const router = useRouter();
  const handled = useRef(new Set<string>());
  const routeRef = useRef(callRoute);
  routeRef.current = callRoute;

  useEffect(() => {
    if (!userId) return;
    return subscribeToMyCalls(userId, (calls) => {
      for (const call of calls) {
        if (call.isCaller || call.status !== 'ringing' || call.ageSeconds > MAX_AGE_SECONDS) continue;
        if (handled.current.has(call.id)) continue;
        handled.current.add(call.id);
        router.navigate(routeRef.current(call.id));
      }
    });
  }, [userId, router]);
}
```

- [ ] **Step 4: Write `CallScreenView.tsx`**

`apps/passenger/src/components/CallScreenView.tsx`:

```tsx
import { useEffect } from 'react';
import { ActivityIndicator, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IncomingCallScreen, InCallScreen, colors } from '@trisakay/ui';
import type { CallUiState } from '@trisakay/shared';
import { useTranslation } from '../hooks/useTranslation';
import { useCallSession } from '../hooks/useCallSession';

/** One screen for every state of a call: the answer screen while it rings for you, the in-call screen otherwise. */
export function CallScreenView({ callId, onClose }: { callId: string | undefined; onClose: () => void }) {
  const t = useTranslation().callUi;
  const insets = useSafeAreaInsets();
  const session = useCallSession(callId);
  const { call, uiState, finished } = session;

  // Ring the phone while someone is calling and the app is open (the push covers the closed-app case).
  useEffect(() => {
    if (uiState !== 'incoming') return;
    Vibration.vibrate([0, 600, 400], true);
    return () => Vibration.cancel();
  }, [uiState]);

  // A finished call closes itself after a moment, unless there is something the person should read.
  useEffect(() => {
    if (!finished || session.failure || session.actionError) return;
    const timer = setTimeout(onClose, 1800);
    return () => clearTimeout(timer);
  }, [finished, session.failure, session.actionError, onClose]);

  if (!session.loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accentBlue} />
      </View>
    );
  }

  const name = call?.peerFirstName ?? t.unknownCaller;
  const avatarUrl = call?.peerAvatarUrl ?? null;

  if (uiState === 'incoming') {
    return (
      <IncomingCallScreen
        name={name}
        avatarUrl={avatarUrl}
        eyebrow={t.incomingEyebrow}
        subtitle={t.incomingSubtitle}
        answerLabel={t.answer}
        declineLabel={t.decline}
        onAnswer={session.answer}
        onDecline={session.decline}
        busy={session.busy}
        topInset={insets.top}
        bottomInset={insets.bottom}
      />
    );
  }

  const stateText: Record<Exclude<CallUiState, 'incoming'>, string> = {
    calling: t.stateCalling,
    connecting: t.stateConnecting,
    connected: t.stateConnected,
    reconnecting: t.stateReconnecting,
    declined: t.stateDeclined,
    no_answer: t.stateNoAnswer,
    cancelled: t.stateCancelled,
    ended: t.stateEnded,
  };

  const errorText =
    session.failure === 'mic_denied'
      ? `${t.micDeniedTitle}. ${t.micDeniedBody}`
      : session.failure === 'connection_failed'
        ? t.connectionFailed
        : session.actionError;

  return (
    <InCallScreen
      name={name}
      avatarUrl={avatarUrl}
      stateText={stateText[uiState as Exclude<CallUiState, 'incoming'>]}
      timerText={session.timerText}
      errorText={errorText}
      finished={finished}
      muted={session.muted}
      speaker={session.speaker}
      muteLabel={t.mute}
      unmuteLabel={t.unmute}
      speakerLabel={t.speaker}
      endLabel={t.end}
      closeLabel={t.close}
      onToggleMute={session.toggleMute}
      onToggleSpeaker={session.toggleSpeaker}
      onEnd={session.end}
      onClose={onClose}
      topInset={insets.top}
      bottomInset={insets.bottom}
    />
  );
}
```

- [ ] **Step 5: Write the passenger route**

`apps/passenger/app/booking/call.tsx`:

```tsx
import { useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CallScreenView } from '../../src/components/CallScreenView';

export default function CallScreen() {
  const { callId } = useLocalSearchParams<{ callId: string }>();
  const router = useRouter();

  // Opened from a notification on a cold start there is nothing to go back to; splash re-resolves where to land.
  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/splash');
  }, [router]);

  return <CallScreenView callId={callId} onClose={close} />;
}
```

- [ ] **Step 6: Extend the existing notification hook (calls channel, banner suppression, tap routing)**

In `apps/passenger/src/hooks/useChatNotifications.ts`:

(a) After the `messages` channel block, add inside the same `if (Platform.OS === 'android') { ... }`:

```ts
          await Notifications.setNotificationChannelAsync('calls', {
            name: 'Calls',
            importance: Notifications.AndroidImportance.MAX,
            sound: 'default',
            vibrationPattern: [0, 600, 400, 600, 400, 600],
          });
```

(b) In `handleNotification`, replace the body so a call push never shows a banner while the app is open (the in-app answer screen opens instead):

```ts
          handleNotification: async (notification) => {
            const data = notification.request.content.data as Record<string, unknown> | undefined;
            const path = pathnameRef.current ?? '';
            const alreadyVisible =
              (data?.type === 'chat_message' && (path.startsWith('/booking/chat') || path.startsWith('/booking/trip'))) ||
              data?.type === 'incoming_call';
            return {
              shouldShowBanner: !alreadyVisible,
              shouldShowList: !alreadyVisible,
              shouldPlaySound: !alreadyVisible,
              shouldSetBadge: false,
            };
          },
```

(c) Replace `routeFromData` with:

```ts
        function routeFromData(data: Record<string, unknown> | undefined) {
          if (!data) return;
          if (data.type === 'incoming_call' && typeof data.callId === 'string') {
            router.navigate({ pathname: '/booking/call', params: { callId: data.callId } });
            return;
          }
          if (data.type !== 'chat_message') return;
          router.push('/booking/chat');
        }
```

Update the file's header comment to mention that it now also registers the `calls` channel and routes incoming-call taps.

- [ ] **Step 7: Mount the incoming-call listener in the root layout**

In `apps/passenger/app/_layout.tsx` add the import next to the other hooks:

```ts
import { useIncomingCalls } from '../src/hooks/useIncomingCalls';
```

and after `useChatNotifications();` (around line 452) add:

```ts
  useIncomingCalls(syncUserId, (callId) => ({ pathname: '/booking/call', params: { callId } }));
```

`syncUserId` is already `mfaStatus === 'ok' ? sessionUserId : null`, so no call listener runs before the MFA code is entered.

- [ ] **Step 8: Wire the Call button on the trip screen**

In `apps/passenger/app/booking/trip.tsx`: add `startRideCall` to the existing `@trisakay/services` import (or add a new import line if none exists), make sure `Alert` is imported from `react-native`, and add this handler inside the component next to the other handlers (it uses `rideRequestId` from the booking store and `tutorialDemo`, both already in scope near the Message button at ~line 722):

```ts
  async function handleCall() {
    if (tutorialDemo.active || !rideRequestId) return;
    const { data: callId, error } = await startRideCall(rideRequestId);
    if (error || !callId) {
      Alert.alert(t.callUi.cannotStartTitle, error ?? '');
      return;
    }
    router.push({ pathname: '/booking/call', params: { callId } });
  }
```

Replace the stub `onPress={() => {}}` on the Call `Pressable` (inside `{features.rideCall && (...)}`) with `onPress={handleCall}`. Do **not** change the `features.rideCall` flag yet (Task 8).

- [ ] **Step 9: Typecheck**

Run (repo root): `npx tsc --noEmit -p apps/passenger`
Expected: no output. If a Agora symbol name does not exist in the installed version's types (`registerEventHandler`, `unregisterEventHandler`, `setEnableSpeakerphone`, `muteLocalAudioStream`, `ConnectionStateType.*`), open `node_modules/react-native-agora/lib/typescript/` and use the exact name from the installed typings; keep the wrapper's own exported interface unchanged.

- [ ] **Step 10: Commit**

```bash
git add apps/passenger apps/driver/package.json package-lock.json
git commit -m "Voice call: passenger call kit, call screen, incoming-call listener, Call button wiring"
```

---

### Task 7: Driver app — same call kit and wiring

**Files:**
- Create (by copying, no edits): `apps/driver/src/lib/callEngine.ts`, `apps/driver/src/hooks/useCallSession.ts`, `apps/driver/src/hooks/useIncomingCalls.ts`, `apps/driver/src/components/CallScreenView.tsx`
- Create: `apps/driver/app/trip/call/[callId].tsx`
- Modify: `apps/driver/src/hooks/useChatNotifications.ts`, `apps/driver/app/_layout.tsx`, `apps/driver/app/trip/active.tsx`

**Interfaces:**
- Consumes: everything from Task 6 (same files), and the driver's existing `useTranslation` at `apps/driver/src/hooks/useTranslation.ts`.
- Produces: driver-side `/trip/call/[callId]` route and a per-passenger Call button.

- [ ] **Step 1: Copy the call kit**

Run (repo root, bash):

```bash
mkdir -p apps/driver/src/lib apps/driver/src/components apps/driver/app/trip/call
cp apps/passenger/src/lib/callEngine.ts apps/driver/src/lib/callEngine.ts
cp apps/passenger/src/hooks/useCallSession.ts apps/driver/src/hooks/useCallSession.ts
cp apps/passenger/src/hooks/useIncomingCalls.ts apps/driver/src/hooks/useIncomingCalls.ts
cp apps/passenger/src/components/CallScreenView.tsx apps/driver/src/components/CallScreenView.tsx
diff -q apps/passenger/src/lib/callEngine.ts apps/driver/src/lib/callEngine.ts
ls apps/driver/src/hooks/useTranslation.ts
```

Expected: `diff` prints nothing (identical); `ls` lists the file. If the driver's `src/lib` or `src/components` already holds files with these names, stop and report instead of overwriting.

- [ ] **Step 2: Write the driver route**

`apps/driver/app/trip/call/[callId].tsx`:

```tsx
import { useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CallScreenView } from '../../../src/components/CallScreenView';

export default function DriverCallScreen() {
  const { callId } = useLocalSearchParams<{ callId: string }>();
  const router = useRouter();

  // Opened from a notification on a cold start there is nothing to go back to; splash re-resolves where to land.
  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/splash');
  }, [router]);

  return <CallScreenView callId={callId} onClose={close} />;
}
```

- [ ] **Step 3: Extend the driver's notification hook**

In `apps/driver/src/hooks/useChatNotifications.ts` make the same three changes as Task 6 Step 6, with the driver's own paths:

(a) inside the Android `if`, after the `messages` channel, add the `calls` channel (identical code to Task 6 Step 6a).

(b) `handleNotification` body:

```ts
          handleNotification: async (notification) => {
            const data = notification.request.content.data as Record<string, unknown> | undefined;
            const path = pathnameRef.current ?? '';
            const alreadyVisible =
              (data?.type === 'chat_message' && (path.startsWith('/trip/chat') || path.startsWith('/trip/active'))) ||
              data?.type === 'incoming_call';
            return {
              shouldShowBanner: !alreadyVisible,
              shouldShowList: !alreadyVisible,
              shouldPlaySound: !alreadyVisible,
              shouldSetBadge: false,
            };
          },
```

(c) `routeFromData`:

```ts
        function routeFromData(data: Record<string, unknown> | undefined) {
          if (!data) return;
          if (data.type === 'incoming_call' && typeof data.callId === 'string') {
            router.navigate(`/trip/call/${data.callId}`);
            return;
          }
          if (data.type !== 'chat_message' || typeof data.rideRequestId !== 'string') return;
          router.push(`/trip/chat/${data.rideRequestId}`);
        }
```

- [ ] **Step 4: Mount the listener in the driver root layout**

In `apps/driver/app/_layout.tsx` add `import { useIncomingCalls } from '../src/hooks/useIncomingCalls';` next to the other hook imports, and after `useChatNotifications();` (around line 552) add:

```ts
  useIncomingCalls(syncUserId, (callId) => `/trip/call/${callId}`);
```

Check `useProtectedRoute` in this file for an allow-list of routes that stay reachable during a trip or for a blocked account; `/trip/call/...` must not be bounced. The call route starts with `trip`, the same root segment as `/trip/chat/...`, which already works; if the guard names exact sub-routes, add `call` beside `chat`.

- [ ] **Step 5: Wire the per-passenger Call button**

In `apps/driver/app/trip/active.tsx`:

1. Add `startRideCall` to the existing `@trisakay/services` import (or add one), and make sure `Alert` is imported from `react-native`.
2. In the screen component (the one that renders `<NextStopCard ... onOpenChat={(id) => router.push(`/trip/chat/${id}`)} />` near line 552), add:

```ts
  async function handleCall(rideRequestId: string) {
    const { data: callId, error } = await startRideCall(rideRequestId);
    if (error || !callId) {
      Alert.alert(t.callUi.cannotStartTitle, error ?? '');
      return;
    }
    router.push(`/trip/call/${callId}`);
  }
```

and pass `onCall={handleCall}` to `NextStopCard` beside `onOpenChat`.
3. In `NextStopCardProps` (near line 841) add `onCall: (rideRequestId: string) => void;` after `onOpenChat`, destructure `onCall` in `NextStopCard`'s parameter list beside `onOpenChat`, and replace the stub (near line 989):

```tsx
              <Pressable style={styles.contactButton} accessibilityRole="button" onPress={() => {}}>
```

with

```tsx
              <Pressable style={styles.contactButton} accessibilityRole="button" onPress={() => onCall(passenger.id)}>
```

Do not change the flag yet.

- [ ] **Step 6: Typecheck**

Run (repo root): `npx tsc --noEmit -p apps/driver` — Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add apps/driver
git commit -m "Voice call: driver call route, copied call kit, Call button wiring"
```

### Task 8: Permissions, deploy, build, and on-device verification

**Files:**
- Modify: `apps/passenger/app.json`, `apps/driver/app.json`
- Modify (local, git-ignored, regenerated by prebuild): `apps/passenger/android/app/src/main/AndroidManifest.xml`, `apps/driver/android/app/src/main/AndroidManifest.xml`
- Modify: `packages/shared/src/constants/index.ts`
- Create (scratch, not committed): `<scratchpad>/call_build.sh`
- Modify: `docs/UAT_PANELIST_REVIEW_ADRALES.md`

**Interfaces:**
- Consumes: everything from Tasks 1–7.
- Produces: voice calling live on two installed apps with `features.rideCall = true`.

- [ ] **Step 1: Microphone permission in both apps**

The image-picker plugin in both `app.json` files currently has `"microphonePermission": false`, which makes the generated manifest *remove* `RECORD_AUDIO` (the driver's local manifest has `tools:node="remove"` on it). Change both files to a message, which adds the permission and the iOS usage text:

```json
          "microphonePermission": "TriSakay needs the microphone for in-app voice calls with your driver or passenger."
```

(in `apps/passenger/app.json` around line 56 and `apps/driver/app.json` around line 52, inside the `expo-image-picker` plugin options).

Because `apps/*/android` is git-ignored and carries local build customizations, do **not** run a full prebuild. Edit the local manifests by hand:

- `apps/driver/android/app/src/main/AndroidManifest.xml`: replace `<uses-permission android:name="android.permission.RECORD_AUDIO" tools:node="remove"/>` with `<uses-permission android:name="android.permission.RECORD_AUDIO"/>`.
- Both manifests: add `<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>` with the other `uses-permission` lines (if not already present).

Check release minification is off (no extra Agora keep-rules needed): `grep -n "enableMinifyInReleaseBuilds" apps/passenger/android/gradle.properties apps/driver/android/gradle.properties` — Expected: no output (the default is `false`). If it is `true`, add `-keep class io.agora.**{*;}` to each app's `android/app/proguard-rules.pro`.

- [ ] **Step 2: Full local verification**

Run (repo root, expect all green):

```bash
npx tsc -b packages/shared packages/services packages/ui packages/utils
npx tsc --noEmit -p apps/passenger
npx tsc --noEmit -p apps/driver
(cd packages/services && npm test)
(cd packages/shared && npm test)
node --test supabase/functions/call-token/authorize.test.ts supabase/functions/notify-incoming-call/message.test.ts
```

Expected: no type errors; services all pass (398 + 11); shared all pass (60 + 6); 7 function tests pass. Commit:

```bash
git add apps/passenger/app.json apps/driver/app.json
git commit -m "Voice call: allow the microphone in both apps' config"
```

- [ ] **Step 3: Agora project and secrets (the user does this)**

Ask the user to: create a free account and a project at https://console.agora.io (App Certificate enabled, "Secured mode: APP ID + Token"); then in Supabase → Edge Functions → Secrets add `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE`. The App Certificate must never be pasted into chat or a file. Wait for the user to confirm both secrets are saved. Also ask them to have the second Android phone ready with USB debugging on.

- [ ] **Step 4: Apply the migration (needs the user's go-ahead)**

State what will change (new table, six functions, an every-minute cleanup job, a push trigger) and get an explicit OK. Then apply `supabase/migrations/20261001000006_ride_calls.sql` with the Supabase `apply_migration` tool (name `ride_calls`, project `ygdgbvxxqrkxlezpckif`). Verify with `execute_sql`:

```sql
select
 (select count(*) from information_schema.tables where table_name = 'ride_calls') as tbl,
 (select count(*) from pg_proc where proname in ('start_ride_call','answer_ride_call','decline_ride_call','end_ride_call','list_my_active_calls','get_ride_call','expire_ride_calls')) as fns,
 (select count(*) from pg_trigger where tgname = 'trg_notify_incoming_call') as trg,
 (select count(*) from cron.job where jobname = 'expire-ride-calls') as cron_job,
 has_function_privilege('authenticated', 'public.expire_ride_calls()', 'execute') as client_can_expire,
 has_table_privilege('authenticated', 'public.ride_calls', 'insert') as client_can_insert;
```

Expected: `tbl 1, fns 7, trg 1, cron_job 1, client_can_expire false, client_can_insert false`.

- [ ] **Step 5: Deploy the two functions (needs the user's go-ahead, same OK as Step 4)**

With the Supabase `deploy_edge_function` tool (project `ygdgbvxxqrkxlezpckif`):
- `call-token`: `verify_jwt: true`, files `index.ts` and `authorize.ts` from `supabase/functions/call-token/`.
- `notify-incoming-call`: `verify_jwt: false`, files `index.ts` and `message.ts` from `supabase/functions/notify-incoming-call/`.

Verify:

```bash
curl -s -o /dev/null -w "call-token no auth: %{http_code}\n" -X POST https://ygdgbvxxqrkxlezpckif.supabase.co/functions/v1/call-token -H "Content-Type: application/json" -d '{"callId":"00000000-0000-4000-8000-000000000000"}'
curl -s -o /dev/null -w "notify bad secret: %{http_code}\n" -X POST https://ygdgbvxxqrkxlezpckif.supabase.co/functions/v1/notify-incoming-call -H "Content-Type: application/json" -H "Authorization: Bearer wrong" -d '{"callId":"x"}'
```

Expected: `call-token no auth: 401` and `notify bad secret: 401`. The first real token request is exercised by the device test (Step 8); confirm there that the token starts with `007`.

- [ ] **Step 6: Turn the feature on**

In `packages/shared/src/constants/index.ts` change `export const features = { rideCall: false } as const;` to `{ rideCall: true }` and replace its doc comment with one saying calls are in-app (Agora), numbers are never shown, and the flag can switch the Call buttons off. Run `npx tsc -b packages/shared packages/services packages/ui packages/utils`, then both app typechecks, then:

```bash
git add packages/shared/src/constants/index.ts
git commit -m "Voice call: switch the Call buttons on"
```

- [ ] **Step 7: Build and install both apps (needs the user's go-ahead for the rebuild)**

Create the scratch script `call_build.sh` (adapted from the earlier `receipt_build.sh`): for each of `passenger` and `driver` run `npx expo export:embed --platform android --bundle-output .release-bundle-backup/index.android.bundle --sourcemap-output .release-bundle-backup/index.android.bundle.packager.map --assets-dest .release-bundle-backup/assets --dev false --reset-cache` inside `apps/<app>`, then `./gradlew :app:createBundleReleaseJsAndAssets --rerun :app:assembleRelease` inside `apps/<app>/android`, then unzip `assets/index.android.bundle` from `apps/<app>/android/app/build/outputs/apk/release/app-release.apk` and require `grep -ac start_ride_call` > 0 (stale-bundle guard from the saved note). Do not install in the script.

Run it in the background and read its log. Expected: two `BUILD SUCCESSFUL` lines and `start_ride_call in <app> APK: N` with N ≥ 1 for both. Then install, one app per phone, after `adb devices` lists both:

```bash
adb -s <phone-A-serial> install -r apps/passenger/android/app/build/outputs/apk/release/app-release.apk
adb -s <phone-B-serial> install -r apps/driver/android/app/build/outputs/apk/release/app-release.apk
```

Expected: `Success` for both. Check the microphone permission reached the device: `adb -s <serial> shell dumpsys package com.trisakay.driver | grep RECORD_AUDIO` shows `android.permission.RECORD_AUDIO` (granted=false until first use is fine).

- [ ] **Step 8: On-device verification (the user holds the phones; walk through it with them)**

Set up: phone A has the passenger app, phone B the driver app, two different accounts. Passenger books a ride; driver goes online and accepts it, so the ride is `assigned`. For each case record Expected vs what happened:

1. **Passenger calls, driver app open:** driver sees the answer screen (passenger first name, photo or initials, no number); Answer → both show Connected with a running timer; speak both ways and hear each other; the first connect should take a few seconds.
2. **Mute and speaker:** mute on one phone → the other hears nothing, the label flips to Unmute; speaker toggles loudspeaker.
3. **End:** End on either phone → both screens show "Call ended" and close themselves.
4. **Driver calls, passenger app in the background (screen on, another app open):** a loud notification "Incoming call from your driver" with no name or number; tap → answer screen; Answer → connected.
5. **Decline:** caller sees "Call declined" and the screen closes.
6. **No answer:** leave it ringing; caller shows "No answer" after about 30 seconds; the callee's notification, if tapped later, shows an ended call, not a live one.
7. **Caller cancels while ringing:** the callee's answer screen closes (shows "Call cancelled").
8. **Microphone denied:** deny the permission prompt → the call ends on both phones, the denying phone shows "Microphone is off. Allow microphone access in your phone settings…", nothing stays on "Connecting…".
9. **App killed mid-call:** swipe the app away on one phone → the other phone ends the call within about 30 seconds.
10. **Weak network:** airplane mode on for about 10 seconds mid-call → "Reconnecting…", then back to Connected (or ended cleanly if it stays down).
11. **Ride ends during a call:** with a call connected, have the driver complete (or the passenger cancel) the ride → the call ends on both phones within a minute.
12. **Simultaneous calls:** both people tap Call at the same moment → exactly one call proceeds; the other gets "A call is already in progress for this ride", never two calls.
13. **Closed app:** force-stop the callee's app and call → the push rings; tap → opens straight to the answer screen.
14. **Privacy:** across every screen and notification above, no phone number, email or full name appears.

If any case fails, use superpowers:systematic-debugging against `adb logcat`, the `ride_calls` rows (`select id, status, end_reason, created_at, answered_at from ride_calls order by created_at desc limit 5`), and the function logs, rather than guessing.

- [ ] **Step 9: Record it**

Update `docs/UAT_PANELIST_REVIEW_ADRALES.md`: change the C2 tracker row from `FUTURE` to **DONE** with the date, the migration name, the two functions, and the note "tested on two Android phones; lock-screen call UI, missed-call notifications, PSO call log and iOS not built". Add a one-line memory note (`project_domain_and_email_receipts.md` or a new `project_voice_call.md`) stating the call feature is live, the secrets involved (`AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`), and the known limits. Commit:

```bash
git add docs/UAT_PANELIST_REVIEW_ADRALES.md
git commit -m "UAT tracker: voice call (C2) done"
```

