-- D1 follow-up (UAT audit, same day as 20260927000006): the loophole table
-- tags L7-L10 as D1's own safeguards. Re-checking against the actual
-- migration found L7 and L10 already closed by construction (L7: the
-- pre-existing txn_driver_confirm_cash RLS policy scopes to whichever trip
-- currently owns the ride via rr.trip_id, which a transfer already moves
-- away from the old driver; L10: validate_rating's accepted-ride_transfers
-- check from 20260927000006). L8 and L9 were genuinely missed:
--
-- L8: respond_transfer already re-checked free seats and tricycle
-- verification fresh at accept time, but not driver_profiles.is_available —
-- an invited driver who went offline between the invite being sent and
-- responding could still accept.
--
-- L9: nothing blocked starting or accepting a transfer while the ride had
-- an unresolved (non-'closed') emergency_alerts row, which could move a
-- passenger away from the middle of an active SOS.
--
-- Plain CREATE OR REPLACE for both — signatures/return types unchanged from
-- 20260927000006, so existing grants are preserved automatically.

create or replace function public.invite_transfer(
  p_ride_request_id uuid,
  p_reason text,
  p_to_driver_ids uuid[],
  p_handoff_lat numeric default null,
  p_handoff_lng numeric default null
)
returns table(invite_id uuid, to_driver_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_driver_id uuid := auth.uid();
  v_status ride_status;
  v_pickup_lat numeric;
  v_pickup_lng numeric;
  v_after_pickup boolean;
  v_handoff_lat numeric;
  v_handoff_lng numeric;
  v_expires_at timestamptz;
  v_to_driver_id uuid;
  v_free_seats smallint;
  v_invite_id uuid;
begin
  if not coalesce(public.is_account_active(), false) then
    raise exception 'Account is not active';
  end if;

  if p_to_driver_ids is null or array_length(p_to_driver_ids, 1) is null or array_length(p_to_driver_ids, 1) > 3 then
    raise exception 'Invite between 1 and 3 drivers at a time';
  end if;

  if exists (select 1 from public.emergency_alerts where ride_request_id = p_ride_request_id and status <> 'closed') then
    raise exception 'Cannot transfer a ride with an active emergency alert';
  end if;

  if exists (select 1 from public.ride_transfers where ride_request_id = p_ride_request_id and status = 'invited' and expires_at > now()) then
    raise exception 'A transfer invite is already in progress for this ride';
  end if;

  select rr.status, rr.pickup_lat, rr.pickup_lng
  into v_status, v_pickup_lat, v_pickup_lng
  from public.ride_requests rr
  join public.trips t on t.id = rr.trip_id
  where rr.id = p_ride_request_id and t.driver_id = v_driver_id and t.status = 'active'
  for update of rr;

  if not found or v_status not in ('assigned', 'ongoing') then
    raise exception 'This ride is not yours to transfer';
  end if;

  v_after_pickup := v_status = 'ongoing';

  if v_after_pickup then
    select coalesce(p_handoff_lat, current_lat), coalesce(p_handoff_lng, current_lng)
    into v_handoff_lat, v_handoff_lng
    from public.driver_profiles where user_id = v_driver_id;

    if v_handoff_lat is null or v_handoff_lng is null then
      raise exception 'Current location unknown — enable location and try again';
    end if;
  else
    v_handoff_lat := v_pickup_lat;
    v_handoff_lng := v_pickup_lng;
  end if;

  v_expires_at := now() + interval '30 seconds';

  for v_to_driver_id in select distinct unnest(p_to_driver_ids) loop
    if v_to_driver_id = v_driver_id then
      raise exception 'Cannot invite yourself';
    end if;

    if not exists (select 1 from public.driver_profiles where user_id = v_to_driver_id and is_available) then
      raise exception 'One of the invited drivers is not online';
    end if;

    select tr.seat_capacity - coalesce((
      select sum(rr3.seats_requested) from public.ride_requests rr3
      where rr3.trip_id = t.id and rr3.status in ('assigned', 'ongoing')
    ), 0)
    into v_free_seats
    from public.tricycles tr
    left join public.trips t on t.driver_id = tr.driver_id and t.status = 'active'
    where tr.driver_id = v_to_driver_id and tr.is_active and tr.verification_status = 'approved'
    limit 1;

    if v_free_seats is null or v_free_seats < (select seats_requested from public.ride_requests where id = p_ride_request_id) then
      raise exception 'One of the invited drivers does not have enough free seats';
    end if;

    insert into public.ride_transfers (ride_request_id, from_driver_id, to_driver_id, reason, after_pickup, handoff_lat, handoff_lng, status, expires_at)
    values (p_ride_request_id, v_driver_id, v_to_driver_id, p_reason, v_after_pickup, v_handoff_lat, v_handoff_lng, 'invited', v_expires_at)
    returning id into v_invite_id;

    insert into public.notifications (user_id, type, title, message, ref_id)
    values (v_to_driver_id, 'ride_status'::notification_type, 'Transfer request', p_reason, p_ride_request_id);

    invite_id := v_invite_id;
    to_driver_id := v_to_driver_id;
    expires_at := v_expires_at;
    return next;
  end loop;
end;
$$;

create or replace function public.respond_transfer(p_invite_id uuid, p_accept boolean)
returns table(ride_request_id uuid, trip_id uuid, accepted boolean)
language plpgsql
security definer
set search_path to 'public'
as $$
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
