-- F4 (UAT panel, Adrales): "driver arrived" step. Gives the driver a way to
-- mark that they're at the pickup point, gives PD1's future no-show timer a
-- start time to count from (PD1 itself is not built yet — this only lays
-- the column/RPC groundwork), and gives the passenger something better than
-- silence between being matched and actually being picked up.
--
-- L4 (loophole, tracker): "arrive, then leave" — a driver taps arrived,
-- drives off, and claims a no-show a few minutes later from far away. Closed
-- here at the source: mark_arrived only accepts the tap while the driver's
-- last known position (driver_profiles.current_lat/lng) is within ~100m of
-- the ride's pickup point, using the same haversine_km() helper
-- enforce_ride_request_fare_integrity() already relies on. L3 (mocked-GPS
-- rejection) is a separate, larger piece shared with R3's not-yet-built
-- location trigger — deliberately not attempted here, so this only ever
-- checks the position already on file, not whether it can be trusted.
--
-- Idempotent by design: a second tap (or a UI double-tap) sees arrived_at
-- already set and returns it as-is rather than raising an error — a driver
-- standing still and pressing the button twice should never see a failure.

alter table public.ride_requests add column if not exists arrived_at timestamptz;

create or replace function public.mark_arrived(p_ride_request_id uuid)
returns table(ride_request_id uuid, arrived_at timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_arrived_at timestamptz;
  v_pickup_lat numeric;
  v_pickup_lng numeric;
  v_passenger_id uuid;
  v_driver_lat numeric;
  v_driver_lng numeric;
begin
  if not coalesce(public.is_account_active(), false) then
    raise exception 'Account is not active';
  end if;

  -- Locks the row for the rest of this call so a genuinely concurrent
  -- double-tap sees the first call's committed arrived_at (idempotent path)
  -- instead of racing the distance check twice.
  select rr.arrived_at, rr.pickup_lat, rr.pickup_lng, rr.passenger_id
  into v_arrived_at, v_pickup_lat, v_pickup_lng, v_passenger_id
  from public.ride_requests rr
  join public.trips t on t.id = rr.trip_id
  where rr.id = p_ride_request_id
    and t.driver_id = auth.uid()
    and rr.status = 'assigned'
  for update of rr;

  if not found then
    raise exception 'Could not mark arrived — this ride is not yours or is no longer awaiting pickup';
  end if;

  if v_arrived_at is not null then
    return query select p_ride_request_id, v_arrived_at;
    return;
  end if;

  select current_lat, current_lng into v_driver_lat, v_driver_lng
  from public.driver_profiles where user_id = auth.uid();

  if v_driver_lat is null or v_driver_lng is null then
    raise exception 'Current location unknown — enable location and try again';
  end if;

  if public.haversine_km(v_pickup_lat, v_pickup_lng, v_driver_lat, v_driver_lng) * 1000 > 100 then
    raise exception 'Too far from the pickup point to mark arrived';
  end if;

  update public.ride_requests
  set arrived_at = now()
  where id = p_ride_request_id
  returning ride_requests.arrived_at into v_arrived_at;

  insert into public.notifications (user_id, type, title, message, ref_id)
  values (v_passenger_id, 'ride_status'::notification_type,
          'Your driver has arrived',
          'Your tricycle has arrived at the pickup point.',
          p_ride_request_id);

  return query select p_ride_request_id, v_arrived_at;
end;
$$;

revoke execute on function public.mark_arrived(uuid) from public, anon, authenticated;
grant execute on function public.mark_arrived(uuid) to authenticated;

-- get_active_trip_passengers needs arrived_at too, so the driver app can
-- show/hide the "I've arrived" button and its state without a second round
-- trip. Same DROP+CREATE requirement (42P13) and PUBLIC-grant gotcha as
-- 20260927000001 — body/filter/order otherwise unchanged from that version.
drop function if exists public.get_active_trip_passengers(uuid);

create function public.get_active_trip_passengers(p_trip_id uuid)
returns table(
  ride_request_id uuid,
  seats_requested smallint,
  preferred_method payment_method,
  estimated_fare numeric,
  passenger_id uuid,
  passenger_name text,
  avatar_url text,
  cash_confirmed boolean,
  status ride_status,
  pickup_lat numeric,
  pickup_lng numeric,
  dest_lat numeric,
  dest_lng numeric,
  assigned_at timestamptz,
  picked_up_at timestamptz,
  distance_km numeric,
  arrived_at timestamptz
)
language plpgsql
stable security definer
set search_path to 'public'
as $$
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
    rr.arrived_at
  from public.ride_requests rr
  join public.users u on u.id = rr.passenger_id
  left join public.transactions txn on txn.ride_request_id = rr.id
  where rr.trip_id = p_trip_id
    and rr.status in ('assigned', 'ongoing')
  order by rr.assigned_at asc nulls last;
end;
$$;

revoke execute on function public.get_active_trip_passengers(uuid) from public, anon;
grant execute on function public.get_active_trip_passengers(uuid) to authenticated;
