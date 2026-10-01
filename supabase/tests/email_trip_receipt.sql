-- Assertions for the email trip receipt migration. Run in ONE execute_sql call after (or, before the migration is
-- applied, right after pasting) 20261001000005_email_trip_receipt.sql. Ends with ROLLBACK; nothing persists.
-- A failed assertion raises 'FAIL n: ...'.

begin;

create temp table _fx as
select
  (select id from public.ride_requests where status = 'completed' order by completed_at desc limit 1) as done_ride,
  (select id from public.ride_requests where status <> 'completed' order by requested_at desc limit 1) as other_ride,
  (select id from public.users where role = 'passenger' and status = 'active' order by created_at limit 1) as some_user;
grant select on _fx to public;

do $$
declare fx record; n int;
begin
  select * into fx from _fx;
  if fx.done_ride is null or fx.other_ride is null then raise exception 'FAIL 0: need a completed and a non-completed ride'; end if;

  -- 1: consent defaults to false for everyone.
  select count(*) into n from public.users where email_receipts;
  if n <> 0 then raise exception 'FAIL 1: % users already have email_receipts on', n; end if;

  -- 2: the receipt lookup returns the completed ride (with an email) and nothing for any other ride.
  select count(*) into n from public.get_receipt_for_email(fx.done_ride) where passenger_email is not null;
  if n <> 1 then raise exception 'FAIL 2a: completed ride returned % rows', n; end if;
  select count(*) into n from public.get_receipt_for_email(fx.other_ride);
  if n <> 0 then raise exception 'FAIL 2b: a non-completed ride returned a receipt'; end if;

  -- 3: one automatic receipt per ride; manual sends may repeat.
  insert into public.receipt_emails (ride_request_id, user_id, kind)
    select fx.done_ride, passenger_id, 'auto' from public.ride_requests where id = fx.done_ride;
  begin
    insert into public.receipt_emails (ride_request_id, user_id, kind)
      select fx.done_ride, passenger_id, 'auto' from public.ride_requests where id = fx.done_ride;
    raise exception 'FAIL 3a: a second auto receipt was allowed';
  exception when unique_violation then null;
  end;
  insert into public.receipt_emails (ride_request_id, user_id, kind)
    select fx.done_ride, passenger_id, 'manual' from public.ride_requests where id = fx.done_ride;
  insert into public.receipt_emails (ride_request_id, user_id, kind)
    select fx.done_ride, passenger_id, 'manual' from public.ride_requests where id = fx.done_ride;
end $$;

-- 4: a signed-in client can neither call the lookup nor read the log.
do $$
declare fx record;
begin
  select * into fx from _fx;
  perform set_config('request.jwt.claims', json_build_object('sub', fx.some_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform * from public.get_receipt_for_email(fx.done_ride);
    raise exception 'FAIL 4a: a client called get_receipt_for_email';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.receipt_emails;
    raise exception 'FAIL 4b: a client read receipt_emails';
  exception when insufficient_privilege then null;
  end;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- 5: completing a ride queues the email call only for a passenger who agreed.
-- The status-transition guard refuses completed -> ongoing, which the test needs to replay completion; it is
-- switched off for this transaction only (rolled back below).
alter table public.ride_requests disable trigger trg_validate_ride_status_transition;

do $$
declare fx record; v_passenger uuid; before_n bigint; after_n bigint;
begin
  select * into fx from _fx;
  select passenger_id into v_passenger from public.ride_requests where id = fx.done_ride;

  update public.ride_requests set status = 'ongoing', completed_at = null where id = fx.done_ride;

  select count(*) into before_n from net.http_request_queue;
  update public.ride_requests set status = 'completed', completed_at = now() where id = fx.done_ride;
  select count(*) into after_n from net.http_request_queue;
  if after_n <> before_n then raise exception 'FAIL 5a: a receipt was queued without consent'; end if;

  update public.ride_requests set status = 'ongoing', completed_at = null where id = fx.done_ride;
  update public.users set email_receipts = true where id = v_passenger;
  select count(*) into before_n from net.http_request_queue;
  update public.ride_requests set status = 'completed', completed_at = now() where id = fx.done_ride;
  select count(*) into after_n from net.http_request_queue;
  if after_n <> before_n + 1 then raise exception 'FAIL 5b: expected one queued receipt call, got %', after_n - before_n; end if;

  -- Updating other columns of an already-completed ride must not queue another.
  select count(*) into before_n from net.http_request_queue;
  update public.ride_requests set distance_km = distance_km where id = fx.done_ride;
  select count(*) into after_n from net.http_request_queue;
  if after_n <> before_n then raise exception 'FAIL 5c: a non-status update queued a receipt'; end if;
end $$;

rollback;
select 'email_trip_receipt: all assertions passed' as result;
