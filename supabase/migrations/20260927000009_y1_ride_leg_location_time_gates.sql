-- Y1 (existing-system audit, UAT panel Adrales): start_ride_leg and
-- complete_ride_leg had no location or time check at all — a driver could
-- "complete" a ride seconds after accepting it, from anywhere, and collect
-- the full fare. Adds:
--   - start_ride_leg: driver must be within ~100m of the ride's pickup point
--     (same haversine_km + 100m threshold as F4's mark_arrived and PD1's
--     no-show check, for consistency).
--   - complete_ride_leg: driver must be within ~300m of the ride's booked
--     destination, AND at least the minimum plausible travel time for the
--     ride's booked distance_km must have elapsed since pickup (assumes a
--     generous 60 km/h ceiling — well above the app's own 20 km/h ETA
--     assumption — so this only ever catches genuinely impossible
--     completions, not normal fast trips).
--
-- Deliberately NOT attempted here: L3/mocked-GPS rejection, which the doc
-- itself groups with R3's not-yet-built location-integrity trigger (same
-- deferral F4's mark_arrived and PD1's no-show check already documented) —
-- this only ever checks the position already on file, not whether it can be
-- trusted. Also not attempted: Y10's "early legitimate drop-off" exception
-- (recording an off-destination drop-off point and flagging it for PSO
-- instead of blocking it) — that is Y10's own, separate scope. Until Y10
-- ships, a genuine early drop-off more than ~300m from the booked
-- destination cannot be completed from the app; this is a known interim
-- limitation, not an oversight.

create or replace function public.start_ride_leg(p_trip_id uuid, p_ride_request_id uuid)
returns table(ride_request_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_now timestamptz := now();
  v_pickup_lat numeric;
  v_pickup_lng numeric;
  v_driver_lat numeric;
  v_driver_lng numeric;
begin
  if not exists (
    select 1 from public.trips
    where id = p_trip_id and driver_id = auth.uid() and status = 'active'
  ) then
    raise exception 'No active trip found for this driver to start';
  end if;

  select pickup_lat, pickup_lng into v_pickup_lat, v_pickup_lng
  from public.ride_requests
  where id = p_ride_request_id and trip_id = p_trip_id and status = 'assigned';

  if not found then
    raise exception 'Ride request not found for this trip';
  end if;

  select current_lat, current_lng into v_driver_lat, v_driver_lng
  from public.driver_profiles where user_id = auth.uid();

  if v_driver_lat is null or v_driver_lng is null then
    raise exception 'Current location unknown — enable location and try again';
  end if;

  if public.haversine_km(v_pickup_lat, v_pickup_lng, v_driver_lat, v_driver_lng) * 1000 > 100 then
    raise exception 'Too far from the pickup point to start this ride';
  end if;

  update public.ride_requests
  set status = 'ongoing', picked_up_at = v_now
  where id = p_ride_request_id
    and trip_id = p_trip_id
    and status = 'assigned';

  if not found then
    raise exception 'Ride request not found for this trip';
  end if;

  return query select p_ride_request_id;
end;
$function$;

-- C. Tighten complete_ride_leg: a leg must be started (picked up) before it
-- can be completed. Previously allowed straight from 'assigned'.
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

  select current_lat, current_lng into v_driver_lat, v_driver_lng
  from public.driver_profiles where user_id = auth.uid();

  if v_driver_lat is null or v_driver_lng is null then
    raise exception 'Current location unknown — enable location and try again';
  end if;

  if public.haversine_km(v_dest_lat, v_dest_lng, v_driver_lat, v_driver_lng) * 1000 > 300 then
    raise exception 'Too far from the destination to complete this ride';
  end if;

  if v_distance_km is not null and v_picked_up_at is not null then
    v_min_duration := (v_distance_km / 60.0) * interval '1 hour';
    if v_now - v_picked_up_at < v_min_duration then
      raise exception 'This ride cannot be completed yet — too little time has passed since pickup';
    end if;
  end if;

  perform set_config('trisakay.allow_fare_write', 'on', true);

  update public.ride_requests
  set status = 'completed', completed_at = v_now, final_fare = coalesce(v_estimated_fare, final_fare)
  where id = p_ride_request_id
    and trip_id = p_trip_id
    and status = 'ongoing';

  if not found then
    raise exception 'Ride request not found for this trip';
  end if;

  return query select p_ride_request_id;
end;
$function$;
