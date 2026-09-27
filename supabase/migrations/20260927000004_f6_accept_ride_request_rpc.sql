-- F6 (UAT panel, Adrales): accepting a ride was several separate client
-- calls (find-or-create trip, then a guarded UPDATE on ride_requests). The
-- guard made sure only one driver could WIN a given ride, but left two
-- open races:
--   1. A losing driver's trip insert could still have gone through, leaving
--      them with an empty active trip they never meant to start.
--   2. The same driver accepting two rides at once could pass the "do I have
--      enough free seats" check twice before either write landed, over-
--      filling the tricycle.
-- This replaces the whole flow with one RPC, one transaction: lock the ride
-- row FOR UPDATE (this alone is what makes "only one driver wins" airtight —
-- a second call blocks here until the first commits, then sees the row is
-- no longer 'pending'), then lock-or-create the driver's trip FOR UPDATE
-- (closing race #2: a driver's second concurrent accept call blocks on the
-- SAME trip row until the first finishes), then check free seats against
-- that trip's own current occupancy, then assign.
--
-- Carries forward X11's hardening (availability, not-declined, cluster —
-- same null-passthrough cluster convention as match-ride-request.ts's
-- isClusterAuthorized(), not the stricter is_cluster_authorized() DB
-- function, for the exact reason X11's migration documents: pickup_barangay_id
-- is always null today, so the strict function would reject every claim).
-- Seat capacity is still double-checked by the existing
-- enforce_trip_seat_capacity trigger on the final UPDATE — defense in depth,
-- not relied on as the only guard.
--
-- With this in place, the driver's direct UPDATE on ride_requests
-- (rr_driver_update, hardened but not removed by X11) is no longer used by
-- any client code — dropped below, same as X9's removal of the passenger's
-- direct cancel UPDATE.

create function public.accept_ride_request(p_ride_request_id uuid)
returns table(ride_request_id uuid, trip_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_driver_id uuid := auth.uid();
  v_trip_id uuid;
  v_trip_max_seats smallint;
  v_tricycle_id uuid;
  v_tricycle_seat_capacity smallint;
  v_tricycle_cluster tricycle_cluster;
  v_barangay_cluster tricycle_cluster;
  v_seats_requested smallint;
  v_pickup_barangay_id uuid;
  v_taken smallint;
begin
  if not coalesce(public.is_account_active(), false) then
    raise exception 'Account is not active';
  end if;

  if not exists (
    select 1 from public.driver_profiles dp where dp.user_id = v_driver_id and dp.is_available
  ) then
    raise exception 'Go online before accepting a ride';
  end if;

  -- The actual "only one driver wins" guarantee: a second caller blocks here
  -- until the first commits, then finds the row no longer pending.
  select rr.seats_requested, rr.pickup_barangay_id
  into v_seats_requested, v_pickup_barangay_id
  from public.ride_requests rr
  where rr.id = p_ride_request_id
    and rr.status = 'pending'
  for update of rr;

  if not found then
    raise exception 'This ride was just accepted by another driver';
  end if;

  if exists (
    select 1 from public.ride_request_declines d
    where d.ride_request_id = p_ride_request_id and d.driver_id = v_driver_id
  ) then
    raise exception 'You already declined this ride';
  end if;

  select tr.id, tr.seat_capacity, tr.cluster
  into v_tricycle_id, v_tricycle_seat_capacity, v_tricycle_cluster
  from public.tricycles tr
  where tr.driver_id = v_driver_id
    and tr.is_active
    and tr.verification_status = 'approved';

  if v_tricycle_id is null then
    raise exception 'No active tricycle assigned yet — finish vehicle verification first';
  end if;

  if v_tricycle_cluster is null then
    raise exception 'Your tricycle has no assigned cluster';
  end if;

  if v_pickup_barangay_id is not null then
    select b.cluster into v_barangay_cluster from public.barangays b where b.id = v_pickup_barangay_id;
    if v_barangay_cluster is not null
       and v_tricycle_cluster <> v_barangay_cluster
       and not (v_barangay_cluster = 'melting_pot' and v_tricycle_cluster <> 'melting_pot')
    then
      raise exception 'This ride is outside your tricycle''s authorized cluster';
    end if;
  end if;

  -- Lock (or create) this driver's active trip. A concurrent accept by the
  -- SAME driver (double-tap, or two screens racing) blocks on this same row
  -- until the first finishes — closing the double-seat-check race.
  select t.id, t.max_seats into v_trip_id, v_trip_max_seats
  from public.trips t
  where t.driver_id = v_driver_id
    and t.status = 'active'
  for update of t;

  if v_trip_id is null then
    begin
      insert into public.trips (driver_id, tricycle_id, max_seats, status, started_at)
      values (v_driver_id, v_tricycle_id, v_tricycle_seat_capacity, 'active', now())
      returning id, max_seats into v_trip_id, v_trip_max_seats;
    exception when unique_violation then
      -- trips_one_active_per_driver: another concurrent accept by this same
      -- driver already created the active trip between the lookup above and
      -- this insert — use it instead of failing outright, same recovery the
      -- old client-side code did for this exact race.
      select t.id, t.max_seats into v_trip_id, v_trip_max_seats
      from public.trips t
      where t.driver_id = v_driver_id
        and t.status = 'active'
      for update of t;

      if v_trip_id is null then
        raise exception 'Could not start a new trip. Please try again';
      end if;
    end;
  end if;

  select coalesce(sum(rr2.seats_requested), 0) into v_taken
  from public.ride_requests rr2
  where rr2.trip_id = v_trip_id
    and rr2.status in ('assigned', 'ongoing');

  if v_seats_requested > (v_trip_max_seats - v_taken) then
    raise exception 'Not enough free seats on your tricycle for this ride';
  end if;

  update public.ride_requests
  set trip_id = v_trip_id,
      status = 'assigned',
      assigned_at = now()
  where id = p_ride_request_id;

  return query select p_ride_request_id, v_trip_id;
end;
$$;

revoke execute on function public.accept_ride_request(uuid) from public, anon, authenticated;
grant execute on function public.accept_ride_request(uuid) to authenticated;

drop policy rr_driver_update on public.ride_requests;
