-- D1 (UAT panel, Adrales): transfer to a chosen driver, before or after
-- pickup. Builds on PD1's `cancelled_by`/reason-code columns (a transfer is
-- never a cancellation, so it deliberately never touches those) and F6's
-- lock-then-act pattern for `accept_ride_request` (reused here for
-- respond_transfer's find-or-create-trip step).
--
-- SCOPE — built here:
--   - ride_transfers: one row per invite (up to 3 per round) or per
--     pool-release. Doubles as both the invite audit trail and the L5
--     strike/transfer-count data (every release_to_pool call inserts one
--     'pooled' row for the releasing driver; PSO/admin can count
--     from_driver_id rows over 7 days without a separate table).
--   - invite_transfer / respond_transfer / release_to_pool / complete_handoff
--     / list_transfer_candidates RPCs.
--   - release_expired_transfer_invites(): pg_cron sweep that expires stale
--     invites and auto-releases to the pool after ~2 minutes with nothing
--     accepted, per the doc's "whichever comes first" rule.
--   - accept_ride_request gains L6's stranding guard (the FROM driver of an
--     un-handed-off after-pickup transfer can't accept a new ride for up to
--     5 minutes, or until the TO driver calls complete_handoff).
--   - get_active_trip_passengers exposes the pending handoff point.
--   - ratings: unique(ride_request_id) -> unique(ride_request_id, driver_id),
--     and validate_rating() accepts either driver on a transferred ride, so
--     the passenger can rate both.
--
-- SCOPE — deliberately deferred (documented, not an oversight):
--   - The passenger UI for rating two drivers after a transferred ride. The
--     server now allows it (this migration); prompting for a second rating
--     is its own UI change to the existing single-driver rate-ride screen.
--   - A dedicated high-priority push channel for transfer invites
--     ("transfer-invite" Android channel, full-screen banner). Ships here on
--     the existing `notifications` row + a foreground Realtime subscription
--     instead — adequate for UAT, not as instant as a dedicated push channel.
--   - The PSO admin transfer log UI (Person 3/admin scope) — the data
--     (ride_transfers) is fully queryable now.
--   - Verifying paymongo-webhook still credits the finishing driver correctly
--     for a transferred, GCash-paid-in-advance ride. transactions rows key
--     off ride_request_id, not driver_id, so nothing here should need to
--     change, but this needs an explicit check against a real webhook
--     payload before relying on it — not done in this migration.
--   - Cluster-authorization filtering on transfer candidates/invites (F3/F6
--     enforce it for normal matching; not restated here since the doc's D1
--     section never mentions cluster for transfers).

create table public.ride_transfers (
  id uuid not null default gen_random_uuid() primary key,
  ride_request_id uuid not null references public.ride_requests(id) on delete cascade,
  from_driver_id uuid not null references public.driver_profiles(user_id) on delete cascade,
  -- null only for a 'pooled' release row (no specific recipient).
  to_driver_id uuid references public.driver_profiles(user_id) on delete cascade,
  reason text not null,
  after_pickup boolean not null default false,
  handoff_lat numeric(9,6),
  handoff_lng numeric(9,6),
  status text not null default 'invited'
    check (status in ('invited', 'accepted', 'declined', 'expired', 'superseded', 'pooled')),
  expires_at timestamptz,
  responded_at timestamptz,
  -- Set by the TO driver once they've physically taken the passenger from
  -- the FROM driver (after_pickup transfers only) — this, not a ride_status
  -- change, is what clears L6's stranding guard on the FROM driver.
  handoff_completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_ride_transfers_ride_request on public.ride_transfers (ride_request_id);
create index idx_ride_transfers_to_driver on public.ride_transfers (to_driver_id, status);
create index idx_ride_transfers_from_driver on public.ride_transfers (from_driver_id, created_at);

-- Prevents inviting the same driver twice while their first invite is still
-- outstanding — respond_transfer's own supersede step is what actually
-- resolves a round, this just stops a duplicate invite_transfer call for the
-- same pair from racing it.
create unique index ride_transfers_one_outstanding_invite
  on public.ride_transfers (ride_request_id, to_driver_id)
  where status = 'invited';

alter table public.ride_transfers enable row level security;

create policy ride_transfers_read on public.ride_transfers for select
  using (from_driver_id = auth.uid() or to_driver_id = auth.uid() or is_pso());

-- No insert/update/delete policies: every write goes through the
-- security-definer RPCs below, same as ride_request_declines' sibling tables
-- with invariants (trips, ride_requests writes).

-- Widens the ride_status state machine for D1's release-to-pool: a driver
-- sending an assigned/ongoing ride back to the open pool needs it to become
-- 'pending' again, which the pre-D1 machine never allowed (a ride could only
-- ever move forward or to a terminal state). Nothing else changes — the
-- original 6 transitions are untouched.
create or replace function public.validate_ride_status_transition()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.status = old.status then
    return new;
  end if;

  if (old.status, new.status) not in (
    ('pending', 'assigned'),
    ('pending', 'cancelled'),
    ('assigned', 'ongoing'),
    ('assigned', 'cancelled'),
    ('assigned', 'pending'),
    ('ongoing', 'cancelled'),
    ('ongoing', 'completed'),
    ('ongoing', 'pending')
  ) then
    raise exception 'Invalid ride_requests status transition: % -> %', old.status, new.status;
  end if;

  return new;
end;
$function$;

-- Lets the passenger rate BOTH drivers on a transferred ride (one rating row
-- per driver per ride, instead of one per ride total).
alter table public.ratings drop constraint ratings_ride_request_id_key;
alter table public.ratings add constraint ratings_ride_request_id_driver_id_key unique (ride_request_id, driver_id);

-- Accepts a rating naming either the ride's current trip driver OR any prior
-- driver who actually held an accepted transfer leg of it — previously only
-- the current trip's driver could ever be named, which would have rejected a
-- rating for the FROM driver of a transferred ride.
create or replace function public.validate_rating()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  rr public.ride_requests%rowtype;
  trip_driver uuid;
begin
  select * into rr from public.ride_requests where id = new.ride_request_id;

  if rr.passenger_id <> new.passenger_id then
    raise exception 'Rating must be submitted by the ride''s own passenger';
  end if;
  if rr.status <> 'completed' then
    raise exception 'Cannot rate a ride that is not completed';
  end if;

  select driver_id into trip_driver from public.trips where id = rr.trip_id;
  if new.driver_id <> trip_driver and not exists (
    select 1 from public.ride_transfers rt
    where rt.ride_request_id = rr.id
      and rt.status = 'accepted'
      and (rt.from_driver_id = new.driver_id or rt.to_driver_id = new.driver_id)
  ) then
    raise exception 'Rating must name a driver who actually drove this trip';
  end if;

  return new;
end $function$;

-- invite_transfer: the FROM driver picks a reason and up to 3 online,
-- adequately-seated drivers to invite. Each gets its own 30s-expiring row.
-- Advisory capacity/availability checks here save an obviously-doomed round
-- trip; respond_transfer re-checks capacity authoritatively at accept time
-- (same belt-and-suspenders duplication F6 already uses for
-- accept_ride_request).
create function public.invite_transfer(
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

revoke execute on function public.invite_transfer(uuid, text, uuid[], numeric, numeric) from public, anon, authenticated;
grant execute on function public.invite_transfer(uuid, text, uuid[], numeric, numeric) to authenticated;

-- respond_transfer: locks the invite row first (guards against a stale/
-- superseded double-tap), then locks the ride_requests row before touching
-- trips — the same ride-row-then-trip-row lock order F6 established, for
-- the same reason (this is the only thing making "only one driver wins" and
-- "no double-seat-check race" airtight, not the status check alone).
create function public.respond_transfer(p_invite_id uuid, p_accept boolean)
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

revoke execute on function public.respond_transfer(uuid, boolean) from public, anon, authenticated;
grant execute on function public.respond_transfer(uuid, boolean) to authenticated;

-- release_to_pool: the FROM driver's fallback when no invited driver
-- accepts. Every call is a strike (L5: "unless an invite was accepted" — if
-- one had been, respond_transfer already handled it and this is never
-- called for that ride). Reuses ride_request_declines so the releasing
-- driver doesn't immediately see their own just-released ride resurface on
-- their own board (match-ride-request already excludes declined rows).
create function public.release_to_pool(p_ride_request_id uuid, p_reason text)
returns table(ride_request_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $$
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

revoke execute on function public.release_to_pool(uuid, text) from public, anon, authenticated;
grant execute on function public.release_to_pool(uuid, text) to authenticated;

-- complete_handoff: the TO driver's confirmation that they've physically
-- taken the passenger from the FROM driver — the signal that clears L6's
-- stranding guard on the FROM driver immediately, instead of only after the
-- 5-minute timeout.
create function public.complete_handoff(p_ride_request_id uuid)
returns table(ride_request_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $$
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

revoke execute on function public.complete_handoff(uuid) from public, anon, authenticated;
grant execute on function public.complete_handoff(uuid) to authenticated;

-- list_transfer_candidates: nearby online, adequately-seated drivers for the
-- FROM driver's invite picker. Distance is measured from the FROM driver's
-- own current position (a proxy for the handoff point — the handoff happens
-- wherever they currently are), not the ride's original pickup point.
create function public.list_transfer_candidates(p_ride_request_id uuid)
returns table(driver_id uuid, driver_name text, avatar_url text, plate_no text, distance_km numeric, free_seats smallint)
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  v_driver_id uuid := auth.uid();
  v_seats_requested smallint;
  v_ref_lat numeric;
  v_ref_lng numeric;
begin
  select rr.seats_requested into v_seats_requested
  from public.ride_requests rr
  join public.trips t on t.id = rr.trip_id
  where rr.id = p_ride_request_id and t.driver_id = v_driver_id and t.status = 'active' and rr.status in ('assigned', 'ongoing');

  if v_seats_requested is null then
    raise exception 'This ride is not yours to transfer';
  end if;

  select current_lat, current_lng into v_ref_lat, v_ref_lng
  from public.driver_profiles where user_id = v_driver_id;

  if v_ref_lat is null or v_ref_lng is null then
    raise exception 'Current location unknown — enable location and try again';
  end if;

  return query
  select
    dp.user_id,
    u.full_name,
    u.avatar_url,
    tr.plate_no,
    public.haversine_km(v_ref_lat, v_ref_lng, dp.current_lat, dp.current_lng),
    (tr.seat_capacity - coalesce((
      select sum(rr4.seats_requested) from public.ride_requests rr4
      where rr4.trip_id = t.id and rr4.status in ('assigned', 'ongoing')
    ), 0))::smallint as free_seats
  from public.driver_profiles dp
  join public.users u on u.id = dp.user_id
  join public.tricycles tr on tr.driver_id = dp.user_id and tr.is_active and tr.verification_status = 'approved'
  left join public.trips t on t.driver_id = dp.user_id and t.status = 'active'
  where dp.user_id <> v_driver_id
    and dp.is_available
    and dp.current_lat is not null
    and dp.current_lng is not null
    and (tr.seat_capacity - coalesce((
      select sum(rr5.seats_requested) from public.ride_requests rr5
      where rr5.trip_id = t.id and rr5.status in ('assigned', 'ongoing')
    ), 0)) >= v_seats_requested
  order by public.haversine_km(v_ref_lat, v_ref_lng, dp.current_lat, dp.current_lng) asc
  limit 20;
end;
$$;

revoke execute on function public.list_transfer_candidates(uuid) from public, anon, authenticated;
grant execute on function public.list_transfer_candidates(uuid) to authenticated;

-- release_expired_transfer_invites: pg_cron sweep (every minute — invites
-- expire in 30s, and the "about 2 minutes" auto-release needs roughly that
-- resolution). Expires stale invited rows, then auto-releases any ride whose
-- most recent round is fully resolved (nothing invited/accepted) and at
-- least 2 minutes old, so the passenger never depends on the FROM driver
-- acting again after a failed round.
create function public.release_expired_transfer_invites()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r record;
begin
  update public.ride_transfers
  set status = 'expired'
  where status = 'invited' and expires_at < now();

  for r in
    select rr.id as ride_request_id, t.driver_id as from_driver_id, rr.status as rr_status
    from public.ride_requests rr
    join public.trips t on t.id = rr.trip_id
    where rr.status in ('assigned', 'ongoing')
      and exists (
        select 1 from public.ride_transfers rt
        where rt.ride_request_id = rr.id and rt.created_at > now() - interval '10 minutes'
      )
      and not exists (
        select 1 from public.ride_transfers rt
        where rt.ride_request_id = rr.id and rt.status in ('invited', 'accepted')
      )
      and exists (
        select 1 from public.ride_transfers rt
        where rt.ride_request_id = rr.id
          and rt.status in ('expired', 'declined')
          and rt.created_at < now() - interval '2 minutes'
      )
  loop
    insert into public.ride_transfers (ride_request_id, from_driver_id, to_driver_id, reason, after_pickup, status, responded_at)
    values (r.ride_request_id, r.from_driver_id, null, 'Auto-released: no driver accepted in time', r.rr_status = 'ongoing', 'pooled', now());

    insert into public.ride_request_declines (ride_request_id, driver_id)
    values (r.ride_request_id, r.from_driver_id)
    on conflict (ride_request_id, driver_id) do nothing;

    update public.ride_requests
    set status = 'pending', trip_id = null, assigned_at = null
    where id = r.ride_request_id;
  end loop;
end;
$$;

revoke execute on function public.release_expired_transfer_invites() from public, anon, authenticated;

select cron.schedule(
  'release-expired-transfer-invites', '* * * * *', 'select public.release_expired_transfer_invites();'
);

-- L6: a FROM driver mid-handoff on an after-pickup transfer can't accept a
-- new ride until the TO driver confirms the handoff (complete_handoff) or 5
-- minutes pass — whichever comes first. Plain CREATE OR REPLACE: the
-- signature/return type are unchanged from F6's version, so existing grants
-- on this function are preserved automatically (no revoke/grant needed).
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

-- get_active_trip_passengers gains the pending handoff point (null unless an
-- after-pickup transfer was accepted and the TO driver hasn't confirmed the
-- handoff yet) — same DROP+CREATE requirement (42P13) and PUBLIC-grant
-- gotcha as every prior extension of this function.
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
  arrived_at timestamptz,
  handoff_lat numeric,
  handoff_lng numeric
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
    rr.arrived_at,
    rt.handoff_lat,
    rt.handoff_lng
  from public.ride_requests rr
  join public.users u on u.id = rr.passenger_id
  left join public.transactions txn on txn.ride_request_id = rr.id
  left join public.ride_transfers rt on rt.ride_request_id = rr.id
    and rt.to_driver_id = auth.uid() and rt.status = 'accepted' and rt.after_pickup and rt.handoff_completed_at is null
  where rr.trip_id = p_trip_id
    and rr.status in ('assigned', 'ongoing')
  order by rr.assigned_at asc nulls last;
end;
$$;

revoke execute on function public.get_active_trip_passengers(uuid) from public, anon;
grant execute on function public.get_active_trip_passengers(uuid) to authenticated;
