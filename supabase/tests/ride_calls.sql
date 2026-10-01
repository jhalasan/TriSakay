-- Assertions for ride calls. Run in ONE execute_sql call after pasting 20261001000006_ride_calls.sql
-- (replace this file's leading 'begin;' by putting the migration after it). Ends with ROLLBACK.
-- A failed assertion raises 'FAIL n: ...'.

begin;

-- >>> paste the body of 20261001000006_ride_calls.sql here when the migration is not yet applied <<<

create temp table _fx as
select rr.id as ride, rr.passenger_id as passenger, t.driver_id as driver, t.id as trip,
  (select u.id from public.users u where u.status = 'active' and u.id not in (rr.passenger_id, t.driver_id) order by u.created_at limit 1) as outsider,
  (select r2.id from public.ride_requests r2 where r2.status = 'completed' and r2.id <> rr.id order by r2.completed_at desc limit 1) as other_ride,
  (select dp.user_id from public.driver_profiles dp where dp.user_id <> t.driver_id order by dp.user_id limit 1) as other_driver
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
  if fx.ride is null or fx.outsider is null or fx.other_ride is null or fx.other_driver is null then raise exception 'FAIL 0: need a completed ride with a driver, an outsider, a second ride and a second driver'; end if;
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

-- 14: a transfer to another driver ends the call. (Earlier checks used up the hourly attempt limit on this ride, so its history is cleared first.)
do $$
declare fx record; v_call uuid;
begin
  select * into fx from _fx;
  perform pg_temp.as_service();
  delete from public.ride_calls where ride_request_id = fx.ride;
  perform pg_temp.as_user(fx.passenger);
  v_call := public.start_ride_call(fx.ride);
  perform pg_temp.as_service();
  update public.trips set driver_id = fx.other_driver where id = fx.trip;
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
