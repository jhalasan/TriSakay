-- Assertions for the staff MFA gate. Run the whole file in ONE execute_sql call. It borrows an existing admin and a
-- passenger, impersonates them, flips the gate on and off INSIDE this transaction, and ends with ROLLBACK, so
-- nothing persists. A failed assertion raises 'FAIL n: ...'. Works whether or not the gate is live.

begin;

create temp table _fx as
select
  (select id from public.users where role = 'admin' and status = 'active' order by created_at limit 1) as admin_id,
  (select id from public.users where role = 'passenger' and status = 'active' order by created_at limit 1) as passenger_id;

-- Helper: sets the caller's JWT claims (sub + aal).
create function pg_temp.as_user(uid uuid, aal text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
end $$;

-- ===== Gate OFF: behaviour unchanged =====
create or replace function public.staff_mfa_enforced() returns boolean language sql immutable as $$ select false $$;

do $$
declare fx record;
begin
  select * into fx from _fx;
  perform pg_temp.as_user(fx.admin_id, 'aal1');
  if not public.is_pso() or not public.is_admin() or not public.is_supervisor() then
    raise exception 'FAIL 1: with the gate off an aal1 admin lost staff privileges';
  end if;
  perform pg_temp.as_user(fx.passenger_id, 'aal1');
  if public.is_pso() or public.is_admin() or public.is_supervisor() then
    raise exception 'FAIL 2: a passenger gained staff privileges';
  end if;
end $$;

-- ===== Gate ON =====
create or replace function public.staff_mfa_enforced() returns boolean language sql immutable as $$ select true $$;

do $$
declare fx record;
begin
  select * into fx from _fx;
  perform pg_temp.as_user(fx.admin_id, 'aal1');
  if public.is_pso() or public.is_admin() or public.is_supervisor() then
    raise exception 'FAIL 3: an aal1 admin kept staff privileges with the gate on';
  end if;
  perform pg_temp.as_user(fx.admin_id, 'aal2');
  if not public.is_pso() or not public.is_admin() or not public.is_supervisor() then
    raise exception 'FAIL 4: an aal2 admin lost staff privileges with the gate on';
  end if;
  perform pg_temp.as_user(fx.passenger_id, 'aal2');
  if public.is_pso() or public.is_admin() or public.is_supervisor() then
    raise exception 'FAIL 5: a passenger gained staff privileges at aal2';
  end if;
  -- No JWT at all (service role / cron): the helpers were already false without a user, and still are.
  perform set_config('request.jwt.claims', '', true);
  if public.is_pso() then raise exception 'FAIL 6: staff privileges without any caller'; end if;
end $$;

select 'staff_mfa_gate: all assertions passed' as result;

rollback;
