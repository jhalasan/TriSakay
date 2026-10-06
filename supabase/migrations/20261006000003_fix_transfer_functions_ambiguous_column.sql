-- Fix "column reference "ride_request_id" is ambiguous" in the driver transfer functions.
--
-- release_to_pool, respond_transfer and complete_handoff return a table whose first column is called
-- ride_request_id. Inside them, queries such as
--     update ride_transfers ... where ride_request_id = p_ride_request_id
-- name that same column without a table prefix, so Postgres cannot tell the output column from the table
-- column and stops with the ambiguity error. It showed up when a driver tapped "release passenger", and the
-- same line sits on the Accept path of respond_transfer and in complete_handoff.
--
-- "#variable_conflict use_column" tells plpgsql to read such a name as the table column. Every variable in
-- these functions is prefixed (v_, p_), so nothing else changes. The rest of each body is identical to the
-- version that is live now.

create or replace function public.release_to_pool(p_ride_request_id uuid, p_reason text)
returns table(ride_request_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $$
#variable_conflict use_column
declare
  v_driver_id uuid := auth.uid();
  v_status ride_status;
begin
  if not coalesce(public.is_account_active(), false) then
    raise exception 'Account is not active';
  end if;

  select rr.status into v_status
  from public.ride_requests rr
  join public.trips t on t.id = rr.trip_id
  where rr.id = p_ride_request_id and t.driver_id = v_driver_id and t.status = 'active' and rr.status in ('assigned', 'ongoing')
  for update of rr;

  if not found then
    raise exception 'This ride is not yours to release';
  end if;

  update public.ride_transfers set status = 'expired' where ride_request_id = p_ride_request_id and status = 'invited';

  insert into public.ride_transfers (ride_request_id, from_driver_id, to_driver_id, reason, after_pickup, status, responded_at)
  values (p_ride_request_id, v_driver_id, null, p_reason, v_status = 'ongoing', 'pooled', now());

  insert into public.ride_request_declines (ride_request_id, driver_id)
  values (p_ride_request_id, v_driver_id)
  on conflict (ride_request_id, driver_id) do nothing;

  update public.ride_requests
  set status = 'pending', trip_id = null, assigned_at = null
  where id = p_ride_request_id;

  return query select p_ride_request_id;
end;
$$;

create or replace function public.respond_transfer(p_invite_id uuid, p_accept boolean)
returns table(ride_request_id uuid, trip_id uuid, accepted boolean)
language plpgsql
security definer
set search_path to 'public'
as $$
#variable_conflict use_column
declare
  v_driver_id uuid := auth.uid();
  v_ride_request_id uuid;
  v_expires_at timestamptz;
  v_status ride_status;
  v_seats_requested smallint;
  v_trip_id uuid;
  v_trip_max_seats smallint;
  v_tricycle_id uuid;
  v_tricycle_seat_capacity smallint;
  v_taken smallint;
begin
  if not coalesce(public.is_account_active(), false) then
    raise exception 'Account is not active';
  end if;

  select rt.ride_request_id, rt.expires_at
  into v_ride_request_id, v_expires_at
  from public.ride_transfers rt
  where rt.id = p_invite_id and rt.to_driver_id = v_driver_id and rt.status = 'invited'
  for update;

  if not found then
    raise exception 'This transfer request has expired or was already handled';
  end if;

  if v_expires_at < now() then
    update public.ride_transfers set status = 'expired' where id = p_invite_id;
    raise exception 'This transfer request has expired';
  end if;

  if not p_accept then
    update public.ride_transfers set status = 'declined', responded_at = now() where id = p_invite_id;
    return query select v_ride_request_id, null::uuid, false;
    return;
  end if;

  if exists (select 1 from public.emergency_alerts where ride_request_id = v_ride_request_id and status <> 'closed') then
    raise exception 'Cannot accept a transfer for a ride with an active emergency alert';
  end if;

  if not exists (select 1 from public.driver_profiles where user_id = v_driver_id and is_available) then
    raise exception 'Go online before accepting a transfer';
  end if;

  if public.driver_has_expired_requirements(v_driver_id) then
    raise exception 'A required document or the MTOP franchise has expired — update it before accepting rides';
  end if;

  select rr.status, rr.seats_requested into v_status, v_seats_requested
  from public.ride_requests rr
  where rr.id = v_ride_request_id and rr.status in ('assigned', 'ongoing')
  for update of rr;

  if not found then
    update public.ride_transfers set status = 'expired' where id = p_invite_id;
    raise exception 'This ride is no longer available for transfer';
  end if;

  update public.ride_transfers set status = 'superseded' where ride_request_id = v_ride_request_id and status = 'invited' and id <> p_invite_id;
  update public.ride_transfers set status = 'accepted', responded_at = now() where id = p_invite_id;

  select tr.id, tr.seat_capacity
  into v_tricycle_id, v_tricycle_seat_capacity
  from public.tricycles tr
  where tr.driver_id = v_driver_id and tr.is_active and tr.verification_status = 'approved';

  if v_tricycle_id is null then
    raise exception 'No active tricycle assigned yet — finish vehicle verification first';
  end if;

  select t.id, t.max_seats into v_trip_id, v_trip_max_seats
  from public.trips t where t.driver_id = v_driver_id and t.status = 'active'
  for update of t;

  if v_trip_id is null then
    begin
      insert into public.trips (driver_id, tricycle_id, max_seats, status, started_at)
      values (v_driver_id, v_tricycle_id, v_tricycle_seat_capacity, 'active', now())
      returning id, max_seats into v_trip_id, v_trip_max_seats;
    exception when unique_violation then
      select t.id, t.max_seats into v_trip_id, v_trip_max_seats
      from public.trips t where t.driver_id = v_driver_id and t.status = 'active'
      for update of t;
      if v_trip_id is null then
        raise exception 'Could not start a new trip. Please try again';
      end if;
    end;
  end if;

  select coalesce(sum(rr2.seats_requested), 0) into v_taken
  from public.ride_requests rr2
  where rr2.trip_id = v_trip_id and rr2.status in ('assigned', 'ongoing');

  if v_seats_requested > (v_trip_max_seats - v_taken) then
    raise exception 'Not enough free seats on your tricycle for this ride';
  end if;

  update public.ride_requests set trip_id = v_trip_id where id = v_ride_request_id;

  return query select v_ride_request_id, v_trip_id, true;
end;
$$;

create or replace function public.complete_handoff(p_ride_request_id uuid)
returns table(ride_request_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $$
#variable_conflict use_column
begin
  if not coalesce(public.is_account_active(), false) then
    raise exception 'Account is not active';
  end if;

  update public.ride_transfers
  set handoff_completed_at = now()
  where ride_request_id = p_ride_request_id
    and to_driver_id = auth.uid()
    and status = 'accepted'
    and after_pickup
    and handoff_completed_at is null;

  if not found then
    raise exception 'No pending handoff found for this ride';
  end if;

  return query select p_ride_request_id;
end;
$$;

revoke execute on function public.release_to_pool(uuid, text) from public, anon, authenticated;
grant execute on function public.release_to_pool(uuid, text) to authenticated;
revoke execute on function public.respond_transfer(uuid, boolean) from public, anon, authenticated;
grant execute on function public.respond_transfer(uuid, boolean) to authenticated;
revoke execute on function public.complete_handoff(uuid) from public, anon, authenticated;
grant execute on function public.complete_handoff(uuid) to authenticated;
