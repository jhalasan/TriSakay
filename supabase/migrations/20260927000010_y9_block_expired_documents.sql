-- Y9 (existing-system audit, UAT panel Adrales): expired documents don't
-- stop a driver working. Neither going online (driver_profiles.is_available
-- is a direct client UPDATE, not an RPC) nor accepting a ride ever checked
-- licence/OR-CR/franchise-permit expiry_date or a tricycle's mtop_expiry_date.
--
-- driver_has_expired_requirements() centralizes the check so it stays in
-- sync between the two enforcement points (going online, accepting) instead
-- of duplicating the same exists-query twice. Plain (non-definer) SQL is
-- enough: it only reads tricycles/driver_documents, and the existing
-- tricycles_select/documents_select RLS policies already let a driver read
-- their own rows in both tables — the same assumption
-- enforce_driver_verified_before_available's own tricycles subquery already
-- relied on before this migration.
--
-- Only 'approved' documents/tricycles with a non-null expiry are checked — a
-- null expiry_date (undocumented today) never blocks; making expiry
-- mandatory at admin approval time (per the doc's own fix text) is an admin
-- form change, not built here (Person 3/admin scope).
--
-- Deliberately NOT touched: start_ride_leg/complete_ride_leg. A ride already
-- accepted is allowed to finish even if a document expires mid-trip — this
-- only gates going online and accepting a NEW ride, matching the doc's own
-- wording ("Block going online and accepting").
create or replace function public.driver_has_expired_requirements(p_driver_id uuid)
returns boolean
language sql
stable
set search_path to 'public'
as $$
  select exists (
    select 1 from public.tricycles t
    where t.driver_id = p_driver_id
      and t.is_active
      and t.verification_status = 'approved'
      and t.mtop_expiry_date is not null
      and t.mtop_expiry_date < current_date
  )
  or exists (
    select 1 from public.driver_documents d
    where d.status = 'approved'
      and d.expiry_date is not null
      and d.expiry_date < current_date
      and (
        (d.doc_type = 'drivers_license' and d.driver_id = p_driver_id)
        or (
          d.doc_type in ('or_cr', 'franchise_permit')
          and d.tricycle_id in (
            select id from public.tricycles
            where driver_id = p_driver_id and is_active and verification_status = 'approved'
          )
        )
      )
  );
$$;

-- Extends the existing false->true availability gate rather than adding a
-- second trigger — same call site, same shape as the two checks already
-- there (verification approved, active verified tricycle assigned).
create or replace function public.enforce_driver_verified_before_available()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  has_verified_active_unit boolean;
begin
  if new.is_available and not old.is_available then
    if new.verification_status <> 'approved' then
      raise exception 'Driver % cannot go available: driver verification is not approved', new.user_id;
    end if;

    select exists(
      select 1 from public.tricycles
      where driver_id = new.user_id
        and is_active
        and verification_status = 'approved'
    ) into has_verified_active_unit;

    if not has_verified_active_unit then
      raise exception 'Driver % cannot go available: no active, verified tricycle assigned', new.user_id;
    end if;

    if public.driver_has_expired_requirements(new.user_id) then
      raise exception 'Driver % cannot go available: a required document or the MTOP franchise has expired', new.user_id;
    end if;
  end if;

  return new;
end $function$;

-- Same check re-run at accept time (a driver could already be online when a
-- document expires) and at transfer-accept time. Plain CREATE OR REPLACE for
-- both — signatures/return types unchanged, so existing grants are preserved
-- automatically.
create or replace function public.accept_ride_request(p_ride_request_id uuid)
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

  if exists (
    select 1 from public.ride_transfers rt
    where rt.from_driver_id = v_driver_id
      and rt.status = 'accepted'
      and rt.after_pickup
      and rt.handoff_completed_at is null
      and rt.responded_at > now() - interval '5 minutes'
  ) then
    raise exception 'Finish handing off your current passenger before accepting a new ride';
  end if;

  if not exists (
    select 1 from public.driver_profiles dp where dp.user_id = v_driver_id and dp.is_available
  ) then
    raise exception 'Go online before accepting a ride';
  end if;

  if public.driver_has_expired_requirements(v_driver_id) then
    raise exception 'A required document or the MTOP franchise has expired — update it before accepting rides';
  end if;

  select rr.seats_requested, rr.pickup_barangay_id
  into v_seats_requested, v_pickup_barangay_id
  from public.ride_requests rr
  where rr.id = p_ride_request_id and rr.status = 'pending'
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
  where tr.driver_id = v_driver_id and tr.is_active and tr.verification_status = 'approved';

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

  update public.ride_requests
  set trip_id = v_trip_id, status = 'assigned', assigned_at = now()
  where id = p_ride_request_id;

  return query select p_ride_request_id, v_trip_id;
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
