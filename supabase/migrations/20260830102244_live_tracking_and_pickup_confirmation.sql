-- 20260830120000_live_tracking_and_pickup_confirmation.sql
-- Live driver tracking + pickup confirmation (docs/superpowers/specs/2026-08-30-live-tracking-and-pickup-confirmation-design.md)

-- A. Scoped SELECT so a passenger's Realtime subscription on driver_profiles
-- delivers rows only for the driver currently matched to them, and only
-- while that leg is 'assigned' (not yet picked up, not completed/cancelled).
create policy driver_select_matched_passenger on public.driver_profiles
  for select using (
    exists (
      select 1 from public.ride_requests rr
      join public.trips t on t.id = rr.trip_id
      where t.driver_id = driver_profiles.user_id
        and rr.passenger_id = auth.uid()
        and rr.status = 'assigned'
    )
  );

-- B. New RPC: marks one passenger's leg picked up. Same ownership-check shape
-- as complete_ride_leg/cancel_ride_leg.
create or replace function public.start_ride_leg(p_trip_id uuid, p_ride_request_id uuid)
 returns table(ride_request_id uuid)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_now timestamptz := now();
begin
  if not exists (
    select 1 from public.trips
    where id = p_trip_id and driver_id = auth.uid() and status = 'active'
  ) then
    raise exception 'No active trip found for this driver to start';
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
begin
  if not exists (
    select 1 from public.trips
    where id = p_trip_id and driver_id = auth.uid() and status = 'active'
  ) then
    raise exception 'No active trip found for this driver to complete';
  end if;

  select estimated_fare into v_estimated_fare
  from public.ride_requests
  where id = p_ride_request_id
    and trip_id = p_trip_id;

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

-- D. get_active_trip_passengers now also returns each leg's status, so the
-- driver UI can tell 'assigned' (needs Start) apart from 'ongoing' (needs
-- Complete) after an app restart / trip rehydrate.
-- Must be dropped first: Postgres rejects CREATE OR REPLACE when the OUT
-- parameters (return row type) change shape.
drop function if exists public.get_active_trip_passengers(uuid);

create or replace function public.get_active_trip_passengers(p_trip_id uuid)
 returns table(ride_request_id uuid, seats_requested smallint, preferred_method payment_method, estimated_fare numeric, passenger_id uuid, passenger_name text, avatar_url text, cash_confirmed boolean, status ride_status)
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
    rr.status
  from public.ride_requests rr
  join public.users u on u.id = rr.passenger_id
  left join public.transactions txn on txn.ride_request_id = rr.id
  where rr.trip_id = p_trip_id
    and rr.status in ('assigned', 'ongoing')
  order by rr.assigned_at asc nulls last;
end;
$function$;
