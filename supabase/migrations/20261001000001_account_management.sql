-- Account management: signed-in devices, reversible self-deactivation.

-- The users column-lock trigger (X1) refuses any status change by a non-PSO caller, which also blocks
-- the self-deactivation RPC below (it was already blocked: the existing self_deactivate_account()
-- cannot work as deployed). Same narrow escape hatch as the payment migration: the SECURITY DEFINER
-- RPCs flip a transaction-local flag around their own update; nothing else sets it.
create or replace function public.enforce_user_self_columns_locked()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if coalesce(current_setting('trisakay.allow_self_status', true), '') = 'on' then
    return new;
  end if;

  if not is_pso() and (
    new.status is distinct from old.status
    or new.email is distinct from old.email
    or (new.must_change_password and not old.must_change_password)
  ) then
    raise exception 'Cannot modify status or email directly, or re-set must_change_password';
  end if;
  return new;
end;
$function$;

-- Devices. auth.sessions is not exposed to the client, so read it through a
-- definer function scoped to the caller. The current session id is in the JWT.
create or replace function public.list_my_sessions()
returns table (id uuid, created_at timestamptz, updated_at timestamptz, user_agent text, is_current boolean)
language sql
stable
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

-- Who deactivated the account: the user themself, or staff. null when the account is not deactivated.
create or replace function public.my_deactivation_origin()
returns text
language sql
stable
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
  if exists (
    select 1 from public.ride_requests rr
    join public.trips t on t.id = rr.trip_id
    where t.driver_id = v_uid and rr.status in ('assigned', 'ongoing')
  ) then
    raise exception 'Finish your current trip before deactivating.';
  end if;
  if exists (
    select 1 from public.ride_requests rr
    where rr.passenger_id = v_uid and rr.status = 'completed'
      and rr.completed_at >= timestamptz '2026-09-30 00:00:00+08'
      and not exists (select 1 from public.transactions t where t.ride_request_id = rr.id and t.status = 'paid')
  ) then
    raise exception 'Settle your last ride before deactivating.';
  end if;

  perform set_config('trisakay.allow_self_status', 'on', true);
  update public.users set status = 'deactivated' where id = v_uid;
  perform set_config('trisakay.allow_self_status', 'off', true);
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
  if public.my_deactivation_origin() is distinct from 'self' then
    raise exception 'This account was deactivated by the PSO — visit the PSO office.';
  end if;
  perform set_config('trisakay.allow_self_status', 'on', true);
  update public.users set status = 'active' where id = v_uid;
  perform set_config('trisakay.allow_self_status', 'off', true);
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
