-- Y10 (existing-system audit, UAT panel Adrales): fare is fixed at booking
-- time regardless of where the ride actually ends. Y1's own 300m hard block
-- on complete_ride_leg (20260927000009) made the "early/off-destination
-- drop-off" side of this WORSE: a genuine early drop-off (or a ride that
-- legitimately ended somewhere other than the booked destination) simply
-- could not be completed from the app at all past 300m — a known interim
-- limitation documented in that migration's own header, explicitly waiting
-- on this one.
--
-- Replaces the hard block with: always record the actual completion point
-- (`dropoff_lat/lng` — there was previously no column for this at all, only
-- the booked `dest_lat/lng`), and flag the ride for PSO (`fare_flagged`)
-- when that point is more than ~500m from the booked destination, instead
-- of refusing the completion outright. Full fare recalculation based on the
-- actual route is explicitly future work per the doc's own scope note —
-- this migration only records and flags.
alter table public.ride_requests
  add column if not exists dropoff_lat numeric,
  add column if not exists dropoff_lng numeric,
  add column if not exists fare_flagged boolean not null default false;

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

  -- Y10: recorded and flagged for PSO review, not blocked — see this
  -- migration's own header. Replaces Y1's unconditional "> 300m rejected".
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

-- get_passenger_trip_history needs fare_flagged so trip-complete.tsx can
-- show "Report a fare issue" only when actually warranted. Return-type
-- change (new column) needs DROP+CREATE (42P13) — body otherwise unchanged
-- from the live version.
drop function if exists public.get_passenger_trip_history(integer, uuid);

create function public.get_passenger_trip_history(p_limit integer default 50, p_ride_request_id uuid default null)
returns table(
  ride_request_id uuid,
  driver_name text,
  driver_avatar_url text,
  driver_rating numeric,
  plate_no text,
  body_no text,
  pickup_label text,
  dest_label text,
  status ride_status,
  fare numeric,
  seats smallint,
  payment_method payment_method,
  payment_status payment_status,
  requested_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  distance_km numeric,
  duration_minutes numeric,
  discount_applied boolean,
  discount_percent numeric,
  cancel_reason text,
  fare_flagged boolean
)
language plpgsql
stable security definer
set search_path to 'public'
as $$
begin
  return query
  select
    rr.id,
    u.full_name,
    u.avatar_url,
    dp.rating_avg,
    tr.plate_no,
    tr.body_no,
    rr.pickup_label,
    rr.dest_label,
    rr.status,
    coalesce(rr.final_fare, rr.estimated_fare),
    rr.seats_requested,
    tx.method,
    tx.status,
    rr.requested_at,
    rr.completed_at,
    rr.cancelled_at,
    rr.distance_km,
    case when t.started_at is not null and t.completed_at is not null
      then extract(epoch from (t.completed_at - t.started_at)) / 60.0
      else null end,
    rr.discount_applied,
    rr.discount_percent,
    rr.cancel_reason,
    rr.fare_flagged
  from public.ride_requests rr
  left join public.trips t on t.id = rr.trip_id
  left join public.users u on u.id = t.driver_id
  left join public.driver_profiles dp on dp.user_id = t.driver_id
  left join public.tricycles tr on tr.id = t.tricycle_id
  left join public.transactions tx on tx.ride_request_id = rr.id
  where rr.passenger_id = auth.uid()
    and rr.status in ('completed', 'cancelled')
    and (p_ride_request_id is null or rr.id = p_ride_request_id)
  order by coalesce(rr.completed_at, rr.cancelled_at, rr.requested_at) desc
  limit p_limit;
end;
$$;

revoke execute on function public.get_passenger_trip_history(integer, uuid) from public, anon, authenticated;
grant execute on function public.get_passenger_trip_history(integer, uuid) to authenticated;
