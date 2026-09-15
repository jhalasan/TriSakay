-- P1-14 (2026-09-15 launch audit): the driver active-trip map rendered no
-- pins/route because get_active_trip_passengers() never returned pickup/
-- destination coordinates. Adds pickup_lat/pickup_lng/dest_lat/dest_lng to
-- its return table so app/trip/active.tsx can pass real coordinates to
-- <OsmMap> and build a real Navigate deep link.
--
-- Return-type changes require DROP + CREATE (42P13); the default EXECUTE
-- grant is lost on drop, so it is re-granted explicitly below.
--
-- NOTE: this migration was originally applied live (as
-- `add_coords_to_get_active_trip_passengers_v2`, 2026-09-15) without ever
-- being written to disk — this file reconstructs it from the live
-- definition for repo/schema parity. anon EXECUTE was already revoked live
-- by 20260915000008 (this function is one of the 18 real RPCs listed
-- there), so no additional revoke is needed here.
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
  dest_lng numeric
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
    rr.dest_lng
  from public.ride_requests rr
  join public.users u on u.id = rr.passenger_id
  left join public.transactions txn on txn.ride_request_id = rr.id
  where rr.trip_id = p_trip_id
    and rr.status in ('assigned', 'ongoing')
  order by rr.assigned_at asc nulls last;
end;
$$;

grant execute on function public.get_active_trip_passengers(uuid) to authenticated;
