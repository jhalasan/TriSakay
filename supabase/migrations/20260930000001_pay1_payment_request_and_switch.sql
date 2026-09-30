-- Payment settlement, Phase A (additive). See
-- docs/superpowers/specs/2026-09-30-payment-settlement-design.md.
-- Nothing here changes what an existing app can do: it adds a marker column,
-- two driver RPCs and one extra column on get_active_trip_passengers.

alter table public.ride_requests
  add column if not exists payment_requested_at timestamptz;

alter table public.transactions
  add column if not exists switched_from_method public.payment_method,
  add column if not exists switch_reason text,
  add column if not exists switched_at timestamptz,
  add column if not exists previous_paymongo_session_id text;

-- Narrow escape hatches, same pattern as trisakay.allow_fare_write: only
-- switch_payment_to_cash sets this (transaction-local), and it only changes
-- preferred_method / transactions.method.
create or replace function public.enforce_driver_claim_columns_locked()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if coalesce(current_setting('trisakay.allow_method_switch', true), '') = 'on' then
    return new;
  end if;

  if public.app_current_role() = 'driver' and (
    new.passenger_id is distinct from old.passenger_id
    or new.pickup_lat is distinct from old.pickup_lat
    or new.pickup_lng is distinct from old.pickup_lng
    or new.pickup_label is distinct from old.pickup_label
    or new.dest_lat is distinct from old.dest_lat
    or new.dest_lng is distinct from old.dest_lng
    or new.dest_label is distinct from old.dest_label
    or new.seats_requested is distinct from old.seats_requested
    or new.preferred_method is distinct from old.preferred_method
    or new.requested_at is distinct from old.requested_at
    or new.pickup_barangay_id is distinct from old.pickup_barangay_id
    or new.distance_km is distinct from old.distance_km
  ) then
    raise exception 'Drivers cannot modify ride request details — only trip assignment and lifecycle fields';
  end if;

  return new;
end;
$function$;

create or replace function public.enforce_driver_transaction_columns_locked()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if coalesce(current_setting('trisakay.allow_method_switch', true), '') = 'on' then
    return new;
  end if;

  if public.app_current_role() = 'driver' and (
    new.amount is distinct from old.amount
    or new.ride_request_id is distinct from old.ride_request_id
    or new.method is distinct from old.method
  ) then
    raise exception 'Drivers cannot modify the transaction amount, ride, or method — only confirm cash receipt';
  end if;

  return new;
end;
$function$;

-- The driver of an ONGOING GCash ride asks the passenger to pay now.
-- Idempotent: a second tap returns the first timestamp.
create or replace function public.request_gcash_payment(p_ride_request_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_requested_at timestamptz;
  v_passenger_id uuid;
  v_method public.payment_method;
  v_tx_status public.payment_status;
begin
  if not coalesce(public.is_account_active(), false) then
    raise exception 'Account is not active';
  end if;

  select rr.payment_requested_at, rr.passenger_id, rr.preferred_method
  into v_requested_at, v_passenger_id, v_method
  from public.ride_requests rr
  join public.trips t on t.id = rr.trip_id
  where rr.id = p_ride_request_id
    and t.driver_id = auth.uid()
    and rr.status = 'ongoing'
  for update of rr;

  if not found then
    raise exception 'Could not request payment — this ride is not yours or is not in progress';
  end if;

  if v_method <> 'gcash' then
    raise exception 'This ride is paying by cash';
  end if;

  select status into v_tx_status from public.transactions where ride_request_id = p_ride_request_id;
  if v_tx_status = 'paid' then
    return coalesce(v_requested_at, now());
  end if;

  if v_requested_at is not null then
    return v_requested_at;
  end if;

  update public.ride_requests
  set payment_requested_at = now()
  where id = p_ride_request_id
  returning payment_requested_at into v_requested_at;

  insert into public.notifications (user_id, type, title, message, ref_id)
  values (v_passenger_id, 'payment_status'::notification_type,
          'Your driver is asking for payment',
          'Please pay your fare by GCash to finish your ride.',
          p_ride_request_id);

  return v_requested_at;
end;
$function$;

-- The driver of an ONGOING GCash ride converts it to cash when GCash cannot
-- work (no signal, failed payment...). Refused if already paid. Locks the
-- transaction row, so it cannot race the webhook marking it paid.
create or replace function public.switch_payment_to_cash(p_ride_request_id uuid, p_reason_code text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_passenger_id uuid;
  v_method public.payment_method;
  v_fare numeric;
  v_tx_id uuid;
  v_tx_status public.payment_status;
  v_session text;
begin
  if not coalesce(public.is_account_active(), false) then
    raise exception 'Account is not active';
  end if;

  if p_reason_code not in ('no_signal', 'payment_failed', 'passenger_request', 'other') then
    raise exception 'Invalid reason';
  end if;

  select rr.passenger_id, rr.preferred_method, rr.estimated_fare
  into v_passenger_id, v_method, v_fare
  from public.ride_requests rr
  join public.trips t on t.id = rr.trip_id
  where rr.id = p_ride_request_id
    and t.driver_id = auth.uid()
    and rr.status = 'ongoing'
  for update of rr;

  if not found then
    raise exception 'Could not switch to cash — this ride is not yours or is not in progress';
  end if;

  if v_method = 'cash' then
    return; -- already cash: idempotent
  end if;

  select id, status, paymongo_session_id
  into v_tx_id, v_tx_status, v_session
  from public.transactions
  where ride_request_id = p_ride_request_id
  for update;

  if v_tx_id is not null and v_tx_status = 'paid' then
    raise exception 'This ride is already paid by GCash';
  end if;

  perform set_config('trisakay.allow_method_switch', 'on', true);

  update public.ride_requests set preferred_method = 'cash' where id = p_ride_request_id;

  if v_tx_id is null then
    insert into public.transactions (ride_request_id, method, amount, status, switched_from_method, switch_reason, switched_at)
    values (p_ride_request_id, 'cash', coalesce(v_fare, 0), 'pending', 'gcash', p_reason_code, now());
  else
    update public.transactions
    set method = 'cash',
        status = 'pending',
        paymongo_session_id = null,
        paymongo_payload = null,
        switched_from_method = 'gcash',
        switch_reason = p_reason_code,
        switched_at = now(),
        previous_paymongo_session_id = v_session
    where id = v_tx_id;
  end if;

  perform set_config('trisakay.allow_method_switch', 'off', true);

  insert into public.notifications (user_id, type, title, message, ref_id)
  values (v_passenger_id, 'payment_status'::notification_type,
          'Payment changed to cash',
          'Your driver switched this ride to cash. Please pay in cash and do not pay by GCash.',
          p_ride_request_id);
end;
$function$;

-- Return type gains a column, so DROP + CREATE (Postgres 42P13), then re-grant.
drop function if exists public.get_active_trip_passengers(uuid);

create function public.get_active_trip_passengers(p_trip_id uuid)
returns table(ride_request_id uuid, seats_requested smallint, preferred_method payment_method, estimated_fare numeric, passenger_id uuid, passenger_name text, avatar_url text, cash_confirmed boolean, status ride_status, pickup_lat numeric, pickup_lng numeric, dest_lat numeric, dest_lng numeric, assigned_at timestamptz, picked_up_at timestamptz, distance_km numeric, arrived_at timestamptz, handoff_lat numeric, handoff_lng numeric, payment_requested_at timestamptz)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
begin
  if not exists (
    select 1 from public.trips where id = p_trip_id and driver_id = auth.uid()
  ) then
    return;
  end if;

  return query
  select
    rr.id,
    rr.seats_requested,
    rr.preferred_method,
    rr.estimated_fare,
    u.id,
    u.full_name,
    u.avatar_url,
    coalesce(txn.status = 'paid', false),
    rr.status,
    rr.pickup_lat,
    rr.pickup_lng,
    rr.dest_lat,
    rr.dest_lng,
    rr.assigned_at,
    rr.picked_up_at,
    rr.distance_km,
    rr.arrived_at,
    rt.handoff_lat,
    rt.handoff_lng,
    rr.payment_requested_at
  from public.ride_requests rr
  join public.users u on u.id = rr.passenger_id
  left join public.transactions txn on txn.ride_request_id = rr.id
  left join public.ride_transfers rt on rt.ride_request_id = rr.id
    and rt.to_driver_id = auth.uid() and rt.status = 'accepted' and rt.after_pickup and rt.handoff_completed_at is null
  where rr.trip_id = p_trip_id
    and rr.status in ('assigned', 'ongoing')
  order by rr.assigned_at asc nulls last;
end;
$function$;

revoke execute on function public.request_gcash_payment(uuid) from public, anon;
grant execute on function public.request_gcash_payment(uuid) to authenticated;
revoke execute on function public.switch_payment_to_cash(uuid, text) from public, anon;
grant execute on function public.switch_payment_to_cash(uuid, text) to authenticated;
revoke execute on function public.get_active_trip_passengers(uuid) from public, anon;
grant execute on function public.get_active_trip_passengers(uuid) to authenticated;
