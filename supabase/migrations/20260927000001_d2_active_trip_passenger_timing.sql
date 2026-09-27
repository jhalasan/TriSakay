-- D2 (UAT panel, Adrales): nearest-next-stop sort on the driver's active trip.
-- Its fairness rule ("a passenger whose ride has taken more than 1.5x the
-- normal time comes next") needs each leg's assigned_at, picked_up_at and
-- distance_km, which get_active_trip_passengers() never returned. This only
-- adds those three return columns; the body, filter and order are unchanged
-- from 20260915000010 (confirmed identical to the live definition 2026-09-27).
--
-- Return-type changes require DROP + CREATE (42P13). A new function gets
-- EXECUTE granted to PUBLIC by default, which anon inherits — so revoke from
-- public as well as anon (see the tracker's "Gotcha confirmed live
-- 2026-09-25"), then grant authenticated.
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
  distance_km numeric
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
    rr.distance_km
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
