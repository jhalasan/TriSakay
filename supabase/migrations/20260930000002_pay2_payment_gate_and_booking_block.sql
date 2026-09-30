-- Payment settlement, Phase B (the gate). APPLY ONLY AFTER Phase A (pay1) is
-- live AND both apps with the request/switch buttons are installed on every
-- test phone: from this point a ride cannot be completed until its
-- transaction is paid, and an app without the buttons could not finish a
-- GCash ride. See docs/superpowers/specs/2026-09-30-payment-settlement-design.md.

-- 1) complete_ride_leg: identical to the live body (20260927000018_y10) plus a
--    payment check right after the ride is found. Cash is paid once the driver
--    taps Received (the transactions constraint requires cash_confirmed_by);
--    GCash is paid once PayMongo confirms it. `create or replace` keeps the
--    existing grants.
create or replace function public.complete_ride_leg(p_trip_id uuid, p_ride_request_id uuid)
returns table(ride_request_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_now timestamptz := now();
  v_estimated_fare numeric;
  v_dest_lat numeric;
  v_dest_lng numeric;
  v_distance_km numeric;
  v_picked_up_at timestamptz;
  v_driver_lat numeric;
  v_driver_lng numeric;
  v_min_duration interval;
  v_dropoff_distance_m numeric;
  v_fare_flagged boolean;
  v_payment_status public.payment_status;
begin
  if not exists (
    select 1 from public.trips
    where id = p_trip_id and driver_id = auth.uid() and status = 'active'
  ) then
    raise exception 'No active trip found for this driver to complete';
  end if;

  select estimated_fare, dest_lat, dest_lng, distance_km, picked_up_at
  into v_estimated_fare, v_dest_lat, v_dest_lng, v_distance_km, v_picked_up_at
  from public.ride_requests
  where id = p_ride_request_id
    and trip_id = p_trip_id
    and status = 'ongoing';

  if not found then
    raise exception 'Ride request not found for this trip';
  end if;

  -- Payment settlement: the fare must be confirmed paid before the ride can be completed.
  select status into v_payment_status
  from public.transactions
  where ride_request_id = p_ride_request_id;

  if v_payment_status is distinct from 'paid' then
    raise exception 'Payment has not been confirmed for this ride yet';
  end if;

  select current_lat, current_lng into v_driver_lat, v_driver_lng
  from public.driver_profiles where user_id = auth.uid();

  if v_driver_lat is null or v_driver_lng is null then
    raise exception 'Current location unknown — enable location and try again';
  end if;

  -- Y10: recorded and flagged for PSO review, not blocked.
  v_dropoff_distance_m := public.haversine_km(v_dest_lat, v_dest_lng, v_driver_lat, v_driver_lng) * 1000;
  v_fare_flagged := v_dropoff_distance_m > 500;

  if v_distance_km is not null and v_picked_up_at is not null then
    v_min_duration := (v_distance_km / 60.0) * interval '1 hour';
    if v_now - v_picked_up_at < v_min_duration then
      raise exception 'This ride cannot be completed yet — too little time has passed since pickup';
    end if;
  end if;

  perform set_config('trisakay.allow_fare_write', 'on', true);

  update public.ride_requests
  set status = 'completed',
      completed_at = v_now,
      final_fare = coalesce(v_estimated_fare, final_fare),
      dropoff_lat = v_driver_lat,
      dropoff_lng = v_driver_lng,
      fare_flagged = v_fare_flagged
  where id = p_ride_request_id
    and trip_id = p_trip_id
    and status = 'ongoing';

  if not found then
    raise exception 'Ride request not found for this trip';
  end if;

  return query select p_ride_request_id;
end;
$function$;

-- 2) A passenger with a completed-but-unpaid ride cannot book again. Only rides
--    completed on/after the cutoff count (keep equal to UNPAID_RIDE_CUTOFF_ISO
--    in packages/services/src/payments/index.ts). No unpaid completed rides
--    existed on 2026-09-30, so no account is locked by this. Cancelled rides
--    (some carry a pending cash row) are ignored: only 'completed' counts.
create or replace function public.enforce_no_unpaid_completed_ride()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if exists (
    select 1
    from public.ride_requests rr
    left join public.transactions t on t.ride_request_id = rr.id
    where rr.passenger_id = new.passenger_id
      and rr.status = 'completed'
      and rr.completed_at >= timestamptz '2026-09-30 00:00:00+08'
      and t.status is distinct from 'paid'
  ) then
    raise exception 'Please settle your last ride before booking another.';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_ride_requests_no_unpaid_completed on public.ride_requests;
create trigger trg_ride_requests_no_unpaid_completed
  before insert on public.ride_requests
  for each row execute function public.enforce_no_unpaid_completed_ride();
