-- Assertions for the account_management migration. Run the whole file in ONE execute_sql call.
-- It borrows existing users as fixtures, edits them inside this transaction, impersonates them,
-- and ends with ROLLBACK, so nothing persists. A failed assertion raises 'FAIL n: ...'.

begin;

create temp table _fx as
select
  (select id from public.users where role = 'passenger' and status = 'active' order by created_at limit 1) as passenger_id,
  (select id from public.users where role = 'passenger' and status = 'active' order by created_at desc limit 1) as other_id;

grant select on _fx to authenticated;

-- Start from a clean slate for the borrowed passenger: no in-flight or unpaid rides.
set local session_replication_role = replica;
update public.ride_requests
set status = 'cancelled'
where passenger_id = (select passenger_id from _fx) and status in ('pending', 'assigned', 'ongoing');
update public.ride_requests
set completed_at = timestamptz '2026-01-01 00:00:00+08'
where passenger_id = (select passenger_id from _fx) and status = 'completed';
set local session_replication_role = origin;

-- 1: a pending ride blocks deactivation.
do $$
declare fx record; refused boolean := false; rid uuid;
begin
  select * into fx from _fx;
  set local session_replication_role = replica;
  insert into public.ride_requests (passenger_id, status, pickup_lat, pickup_lng, dest_lat, dest_lng, seats_requested)
  select fx.passenger_id, 'pending', pickup_lat, pickup_lng, dest_lat, dest_lng, 1
  from public.ride_requests limit 1
  returning id into rid;
  set local session_replication_role = origin;

  perform set_config('request.jwt.claims', json_build_object('sub', fx.passenger_id, 'role', 'authenticated')::text, true);
  begin
    perform public.self_deactivate_account();
  exception when others then
    refused := sqlerrm like '%Finish or cancel your current ride%';
  end;
  if not refused then raise exception 'FAIL 1: deactivation was allowed (or failed for another reason) with a pending ride'; end if;

  set local session_replication_role = replica;
  delete from public.ride_requests where id = rid;
  set local session_replication_role = origin;
end $$;

-- 2: with nothing in flight, deactivation works and the origin is 'self'.
do $$
declare fx record; st account_status; origin text;
begin
  select * into fx from _fx;
  perform set_config('request.jwt.claims', json_build_object('sub', fx.passenger_id, 'role', 'authenticated')::text, true);
  perform public.self_deactivate_account();
  select status into st from public.users where id = fx.passenger_id;
  origin := public.my_deactivation_origin();
  if st <> 'deactivated' or origin <> 'self' then raise exception 'FAIL 2: status %, origin %', st, origin; end if;
end $$;

-- 3: reactivation by the person brings the account back.
do $$
declare fx record; st account_status;
begin
  select * into fx from _fx;
  perform set_config('request.jwt.claims', json_build_object('sub', fx.passenger_id, 'role', 'authenticated')::text, true);
  perform public.self_reactivate_account();
  select status into st from public.users where id = fx.passenger_id;
  if st <> 'active' then raise exception 'FAIL 3: status % after reactivation', st; end if;
end $$;

-- 4: an account deactivated by staff cannot be self-reactivated.
do $$
declare fx record; refused boolean := false;
begin
  select * into fx from _fx;
  set local session_replication_role = replica;
  update public.users set status = 'deactivated' where id = fx.passenger_id;
  -- created_at is the transaction start for every row here, so give the staff row a later time.
  insert into public.account_actions (target_user_id, action_type, performed_by, reason, created_at)
  values (fx.passenger_id, 'deactivate', fx.other_id, 'staff test', now() + interval '1 minute');
  set local session_replication_role = origin;

  perform set_config('request.jwt.claims', json_build_object('sub', fx.passenger_id, 'role', 'authenticated')::text, true);
  if public.my_deactivation_origin() <> 'staff' then raise exception 'FAIL 4: origin should be staff'; end if;
  begin
    perform public.self_reactivate_account();
  exception when others then
    refused := sqlerrm like '%deactivated by the PSO%';
  end;
  if not refused then raise exception 'FAIL 4: a staff deactivation was self-reactivated'; end if;
end $$;

-- 3b: a direct status change is still refused after the RPCs ran (the flag is closed).
do $$
declare fx record; refused boolean := false;
begin
  select * into fx from _fx;
  begin
    update public.users set status = 'active' where id = fx.passenger_id;
  exception when others then refused := true;
  end;
  if not refused then raise exception 'FAIL 3b: a direct status change was allowed after the RPC'; end if;
end $$;

-- 5: revoking a session that is not the caller's is a no-op; revoking the caller's own is refused.
do $$
declare fx record; refused boolean := false;
begin
  select * into fx from _fx;
  perform set_config('request.jwt.claims',
    json_build_object('sub', fx.passenger_id, 'role', 'authenticated', 'session_id', '11111111-1111-1111-1111-111111111111')::text, true);
  perform public.revoke_my_session('22222222-2222-2222-2222-222222222222');
  begin
    perform public.revoke_my_session('11111111-1111-1111-1111-111111111111');
  exception when others then
    refused := sqlerrm like '%Use log out%';
  end;
  if not refused then raise exception 'FAIL 5: the own session could be revoked'; end if;
end $$;

-- 6: a deactivated status with no action row after an older self-deactivation reads as staff, not self.
do $$
declare fx record;
begin
  select * into fx from _fx;
  set local session_replication_role = replica;
  delete from public.account_actions where target_user_id = fx.passenger_id;
  insert into public.account_actions (target_user_id, action_type, performed_by, reason, created_at)
  values (fx.passenger_id, 'deactivate', fx.passenger_id, 'old self deactivation', now() - interval '2 days'),
         (fx.passenger_id, 'reactivate', fx.passenger_id, 'old self reactivation', now() - interval '1 day');
  update public.users set status = 'deactivated' where id = fx.passenger_id;
  set local session_replication_role = origin;
  perform set_config('request.jwt.claims', json_build_object('sub', fx.passenger_id, 'role', 'authenticated')::text, true);
  if public.my_deactivation_origin() <> 'staff' then raise exception 'FAIL 6: an unlogged deactivation read as self'; end if;
end $$;

-- 7: a driver with a completed ride whose payment is not confirmed cannot deactivate.
do $$
declare drv uuid; rid uuid; refused boolean := false;
begin
  select t.driver_id, rr.id into drv, rid
  from public.ride_requests rr join public.trips t on t.id = rr.trip_id
  join public.users u on u.id = t.driver_id and u.status = 'active'
  where rr.status = 'completed' limit 1;
  if drv is null then raise notice 'FAIL 7 skipped: no completed ride with a driver to borrow'; return; end if;

  set local session_replication_role = replica;
  update public.ride_requests set status = 'cancelled' where status in ('assigned', 'ongoing') and trip_id in (select id from public.trips where driver_id = drv);
  update public.ride_requests set completed_at = now() where id = rid;
  delete from public.transactions where ride_request_id = rid;
  set local session_replication_role = origin;

  perform set_config('request.jwt.claims', json_build_object('sub', drv, 'role', 'authenticated')::text, true);
  begin
    perform public.self_deactivate_account();
  exception when others then
    refused := sqlerrm like '%Confirm the payment%';
  end;
  if not refused then raise exception 'FAIL 7: a driver deactivated with an unconfirmed ride payment'; end if;
end $$;

select 'account_management: all assertions passed' as result;

rollback;
