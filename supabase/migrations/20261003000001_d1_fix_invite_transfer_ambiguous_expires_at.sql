-- D1 fix: invite_transfer() failed on every call with
--   column reference "expires_at" is ambiguous
-- because the function RETURNS TABLE(..., expires_at ...) makes `expires_at`
-- an OUT variable, and the "invite already in progress" check read the
-- ride_transfers column of the same name unqualified. Postgres cannot tell
-- the two apart. The only change below is aliasing that table (rt) and
-- qualifying the column; everything else is the live body unchanged.
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
as $function$
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

  if exists (
    select 1 from public.ride_transfers rt
    where rt.ride_request_id = p_ride_request_id and rt.status = 'invited' and rt.expires_at > now()
  ) then
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
$function$;
