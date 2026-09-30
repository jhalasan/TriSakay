-- Assertions for the payment settlement migrations (pay1 = Phase A, pay2 = Phase B).
-- Run the whole file in ONE execute_sql call. It borrows an existing ride and
-- its driver as a fixture, edits them inside this transaction, impersonates
-- users, and ends with ROLLBACK, so nothing persists. Any failed assertion
-- raises 'FAIL n: ...'. Section B assertions only apply once pay2 is applied.

begin;

-- Fixture edits bypass triggers (a completed ride cannot legally go back to ongoing).
set local session_replication_role = replica;

create temp table _fx as
select rr.id as ride_id, t.id as trip_id, t.driver_id, rr.passenger_id
from public.ride_requests rr
join public.trips t on t.id = rr.trip_id
where t.driver_id is not null
order by rr.requested_at desc
limit 1;

grant select on _fx to authenticated;

update public.trips set status = 'active' where id = (select trip_id from _fx);
update public.ride_requests
set status = 'ongoing', preferred_method = 'gcash', payment_requested_at = null,
    picked_up_at = now() - interval '2 hours'
where id = (select ride_id from _fx);
delete from public.transactions where ride_request_id = (select ride_id from _fx);

set local session_replication_role = origin;

-- ===== Section A: Phase A behaviour =====

-- 1: a caller who is not the trip's driver cannot request payment.
do $$
declare fx record; refused boolean := false;
begin
  select * into fx from _fx;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', fx.passenger_id, 'role', 'authenticated')::text, true);
  begin
    perform public.request_gcash_payment(fx.ride_id);
  exception when others then refused := true;
  end;
  reset role;
  if not refused then raise exception 'FAIL 1: a non-driver could request payment'; end if;
end $$;

-- 2: the driver can request; a second tap is idempotent (same timestamp, one notification).
do $$
declare fx record; ts1 timestamptz; ts2 timestamptz; n int;
begin
  select * into fx from _fx;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', fx.driver_id, 'role', 'authenticated')::text, true);
  ts1 := public.request_gcash_payment(fx.ride_id);
  ts2 := public.request_gcash_payment(fx.ride_id);
  reset role;
  if ts1 is null or ts1 <> ts2 then raise exception 'FAIL 2: request is not idempotent (% vs %)', ts1, ts2; end if;
  select count(*) into n from public.notifications
  where ref_id = fx.ride_id and title = 'Your driver is asking for payment';
  if n <> 1 then raise exception 'FAIL 2: expected 1 notification, got %', n; end if;
end $$;

-- 3: switch refuses a bogus reason.
do $$
declare fx record; refused boolean := false;
begin
  select * into fx from _fx;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', fx.driver_id, 'role', 'authenticated')::text, true);
  begin
    perform public.switch_payment_to_cash(fx.ride_id, 'bogus');
  exception when others then refused := true;
  end;
  reset role;
  if not refused then raise exception 'FAIL 3: a bogus reason was accepted'; end if;
end $$;

-- 4: switch with NO transaction row creates a pending cash row and flips the ride to cash.
do $$
declare fx record; m public.payment_method; tm public.payment_method; ts public.payment_status; sr text;
begin
  select * into fx from _fx;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', fx.driver_id, 'role', 'authenticated')::text, true);
  perform public.switch_payment_to_cash(fx.ride_id, 'no_signal');
  reset role;
  select preferred_method into m from public.ride_requests where id = fx.ride_id;
  select method, status, switch_reason into tm, ts, sr from public.transactions where ride_request_id = fx.ride_id;
  if m <> 'cash' or tm <> 'cash' or ts <> 'pending' or sr <> 'no_signal' then
    raise exception 'FAIL 4: ride %, tx % %, reason %', m, tm, ts, sr;
  end if;
end $$;

-- 5: after the RPC the escape hatch is closed: a driver changing the method directly is still refused.
-- Runs WITHOUT `set role authenticated`: as a real driver, RLS gives no UPDATE on ride_requests at all,
-- so the update would silently touch zero rows and never reach the column-lock trigger under test.
-- The trigger keys off auth.uid() (the JWT claim), so impersonating the driver's id is enough.
do $$
declare fx record; refused boolean := false;
begin
  select * into fx from _fx;
  perform set_config('request.jwt.claims', json_build_object('sub', fx.driver_id, 'role', 'authenticated')::text, true);
  begin
    update public.ride_requests set preferred_method = 'gcash' where id = fx.ride_id;
  exception when others then refused := true;
  end;
  if not refused then raise exception 'FAIL 5: driver could change preferred_method directly'; end if;
end $$;

-- 6: a paid GCash transaction cannot be switched to cash.
do $$
declare fx record; refused boolean := false;
begin
  select * into fx from _fx;
  set local session_replication_role = replica;
  update public.ride_requests set preferred_method = 'gcash' where id = fx.ride_id;
  update public.transactions
  set method = 'gcash', status = 'paid', paymongo_session_id = 'cs_test_fixture', cash_confirmed_by = null
  where ride_request_id = fx.ride_id;
  set local session_replication_role = origin;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', fx.driver_id, 'role', 'authenticated')::text, true);
  begin
    perform public.switch_payment_to_cash(fx.ride_id, 'other');
  exception when others then refused := true;
  end;
  reset role;
  if not refused then raise exception 'FAIL 6: a paid GCash ride was switched to cash'; end if;
end $$;

-- ===== Section B: Phase B behaviour (only meaningful after pay2 is applied) =====

do $$
declare
  fx record; gate_installed boolean; refused boolean;
begin
  select * into fx from _fx;
  select position('Payment has not been confirmed' in pg_get_functiondef('public.complete_ride_leg(uuid,uuid)'::regprocedure)) > 0
  into gate_installed;

  if not gate_installed then
    raise notice 'Section B skipped: pay2 not applied yet';
    return;
  end if;

  -- 7: completing with a PENDING transaction is refused.
  set local session_replication_role = replica;
  update public.transactions set status = 'pending', method = 'cash', paymongo_session_id = null where ride_request_id = fx.ride_id;
  update public.driver_profiles set current_lat = (select dest_lat from public.ride_requests where id = fx.ride_id),
                                    current_lng = (select dest_lng from public.ride_requests where id = fx.ride_id)
  where user_id = fx.driver_id;
  set local session_replication_role = origin;
  refused := false;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', fx.driver_id, 'role', 'authenticated')::text, true);
  begin
    perform public.complete_ride_leg(fx.trip_id, fx.ride_id);
  exception when others then
    refused := sqlerrm like '%Payment has not been confirmed%';
  end;
  reset role;
  if not refused then raise exception 'FAIL 7: an unpaid ride could be completed (or failed for another reason)'; end if;

  -- 8: completing with NO transaction row is refused.
  set local session_replication_role = replica;
  delete from public.transactions where ride_request_id = fx.ride_id;
  set local session_replication_role = origin;
  refused := false;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', fx.driver_id, 'role', 'authenticated')::text, true);
  begin
    perform public.complete_ride_leg(fx.trip_id, fx.ride_id);
  exception when others then
    refused := sqlerrm like '%Payment has not been confirmed%';
  end;
  reset role;
  if not refused then raise exception 'FAIL 8: a ride with no transaction could be completed'; end if;

  -- 9: completing with a PAID transaction succeeds.
  set local session_replication_role = replica;
  insert into public.transactions (ride_request_id, method, amount, status, cash_confirmed_by, cash_confirmed_at)
  values (fx.ride_id, 'cash', 0, 'paid', fx.driver_id, now());
  set local session_replication_role = origin;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', fx.driver_id, 'role', 'authenticated')::text, true);
  perform public.complete_ride_leg(fx.trip_id, fx.ride_id);
  reset role;

  -- 10: a passenger with a completed-but-unpaid ride cannot book again.
  set local session_replication_role = replica;
  update public.ride_requests set status = 'completed', completed_at = now() where id = fx.ride_id;
  update public.transactions set status = 'pending', cash_confirmed_by = null, cash_confirmed_at = null where ride_request_id = fx.ride_id;
  set local session_replication_role = origin;
  -- Isolate the booking block: switch off the other BEFORE INSERT guards (this whole
  -- transaction is rolled back), so only the unpaid-ride check can refuse the insert.
  alter table public.ride_requests disable trigger trg_ride_requests_fare_integrity;
  alter table public.ride_requests disable trigger trg_ride_requests_insert_fields;
  alter table public.ride_requests disable trigger trg_ride_requests_one_active_per_passenger;
  alter table public.ride_requests disable trigger trg_ride_requests_seat_cap;
  create temp table _newride as select * from public.ride_requests where id = fx.ride_id;
  update _newride set id = gen_random_uuid(), status = 'pending', trip_id = null, completed_at = null;
  refused := false;
  begin
    insert into public.ride_requests select * from _newride;
  exception when others then
    refused := sqlerrm like '%settle your last ride%';
  end;
  if not refused then raise exception 'FAIL 10: booking was allowed with an unpaid completed ride (or failed for another reason)'; end if;
end $$;

select 'payment_settlement: all assertions passed' as result;

rollback;
