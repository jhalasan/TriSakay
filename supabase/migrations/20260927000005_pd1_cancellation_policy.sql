-- PD1 + PD2 (UAT panel, Adrales): cancellation policy. Adds a stage gate
-- (pending free / assigned needs a reason and counts as a strike / ongoing
-- blocked), `cancelled_by` + `cancel_reason_code` so ride-cancelled.tsx can
-- stop guessing from free-text `cancel_reason`, and cooldown enforcement for
-- both a repeat-canceller (L1's cousin) and a search-spammer (L2).
--
-- Strikes are counted straight from ride_requests (no new table, per the
-- doc's own preference): a passenger strike is
-- cancelled_by='passenger' AND assigned_at is not null (i.e. it happened at
-- the 'assigned' stage, not while still 'pending'/searching). A free
-- search-cancel is the same shape but assigned_at is null.
--
-- L1 (passenger asks the driver to cancel so the driver eats the strike) is
-- NOT solved here — that needs a live confirm handshake between both apps
-- (ask the passenger, wait ~60s, only then decide who's charged), which is a
-- separate, larger realtime feature. Until that exists, the safe default
-- ships here: "Passenger asked to cancel" is one of the driver's own reason
-- codes and is always charged to the driver, same as any other driver
-- cancel — never to the passenger without their own confirmation. That
-- can't be exploited (a driver dodging a fare by falsely blaming the
-- passenger still takes their own strike), it just doesn't yet relieve a
-- driver who is telling the truth. Revisit once the confirm-handshake UI is
-- built.
--
-- L18 (seats undercounted at pickup) is also out of scope here — it touches
-- start_ride_leg/compute_fare, not cancellation, despite being grouped under
-- PD1 in the doc's UI bullet list.
--
-- L4's own fix (100m-from-pickup check on mark_arrived) already landed in
-- F4 (20260927000002); the no-show branch below reuses that same 100m
-- constant and haversine_km() helper for consistency, plus the 5-minute
-- wait spec'd for PD1.

alter table public.ride_requests
  add column if not exists cancelled_by text,
  add column if not exists cancel_reason_code text;

alter table public.ride_requests
  add constraint ride_requests_cancelled_by_check
  check (cancelled_by is null or cancelled_by in ('passenger', 'driver', 'system'));

alter table public.ride_requests
  add constraint ride_requests_cancel_reason_code_check
  check (cancel_reason_code is null or cancel_reason_code in (
    'changed_mind', 'found_other_ride', 'wait_too_long', 'price_concern',
    'vehicle_issue', 'passenger_no_show', 'unsafe_location', 'personal_emergency',
    'passenger_asked_to_cancel', 'expired', 'other'
  ));

alter table public.system_settings
  add column if not exists passenger_cancel_strike_limit smallint not null default 3,
  add column if not exists passenger_cancel_strike_window_hours integer not null default 168,
  add column if not exists passenger_cancel_cooldown_hours integer not null default 24,
  add column if not exists passenger_search_cancel_limit smallint not null default 5,
  add column if not exists passenger_search_cancel_window_minutes integer not null default 60,
  add column if not exists passenger_search_cancel_pause_minutes integer not null default 30;

alter table public.system_settings
  add constraint settings_cancel_strike_limit_positive check (passenger_cancel_strike_limit > 0),
  add constraint settings_cancel_strike_window_positive check (passenger_cancel_strike_window_hours > 0),
  add constraint settings_cancel_cooldown_positive check (passenger_cancel_cooldown_hours > 0),
  add constraint settings_search_cancel_limit_positive check (passenger_search_cancel_limit > 0),
  add constraint settings_search_cancel_window_positive check (passenger_search_cancel_window_minutes > 0),
  add constraint settings_search_cancel_pause_positive check (passenger_search_cancel_pause_minutes > 0);

-- Extends X2's insert-lockdown trigger with the two cooldown checks. Both
-- read system_settings' single active row and auth.uid()'s own past
-- cancellations — cheap (indexed on passenger_id via the trips/rr FKs'
-- default btree, small per-user row counts) and only runs on insert.
-- Needs security definer now (the original didn't): it reads system_settings
-- to enforce the cooldowns below, and settings_read_pso restricts that table
-- to PSO roles — a plain passenger insert would otherwise see zero rows back
-- (RLS-filtered, not an error) and the cooldown checks would silently no-op.
create or replace function public.enforce_ride_request_insert_fields()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_strike_limit smallint;
  v_strike_window interval;
  v_cooldown interval;
  v_search_limit smallint;
  v_search_window interval;
  v_search_pause interval;
  v_strike_count int;
  v_last_strike_at timestamptz;
  v_search_cancel_count int;
  v_last_search_cancel_at timestamptz;
begin
  select passenger_cancel_strike_limit,
         (passenger_cancel_strike_window_hours || ' hours')::interval,
         (passenger_cancel_cooldown_hours || ' hours')::interval,
         passenger_search_cancel_limit,
         (passenger_search_cancel_window_minutes || ' minutes')::interval,
         (passenger_search_cancel_pause_minutes || ' minutes')::interval
  into v_strike_limit, v_strike_window, v_cooldown, v_search_limit, v_search_window, v_search_pause
  from public.system_settings
  where is_active
  limit 1;

  select count(*), max(cancelled_at)
  into v_strike_count, v_last_strike_at
  from public.ride_requests
  where passenger_id = auth.uid()
    and cancelled_by = 'passenger'
    and assigned_at is not null
    and cancelled_at > now() - v_strike_window;

  if v_strike_count >= v_strike_limit and v_last_strike_at > now() - v_cooldown then
    raise exception 'You''ve cancelled too many rides recently. Please try again later.';
  end if;

  select count(*), max(cancelled_at)
  into v_search_cancel_count, v_last_search_cancel_at
  from public.ride_requests
  where passenger_id = auth.uid()
    and cancelled_by = 'passenger'
    and assigned_at is null
    and cancelled_at > now() - v_search_window;

  if v_search_cancel_count >= v_search_limit and v_last_search_cancel_at > now() - v_search_pause then
    raise exception 'Too many cancelled searches recently. Please wait a bit before booking again.';
  end if;

  new.status := 'pending';
  new.trip_id := null;
  new.final_fare := null;
  new.assigned_at := null;
  new.picked_up_at := null;
  new.completed_at := null;
  new.cancelled_at := null;
  new.cancel_reason := null;
  new.cancelled_by := null;
  new.cancel_reason_code := null;
  new.requested_at := now();
  new.expires_at := now() + interval '18 seconds';
  return new;
end;
$function$;

revoke execute on function public.enforce_ride_request_insert_fields() from public;
revoke execute on function public.enforce_ride_request_insert_fields() from anon, authenticated;

-- Replaces X9's cancel_ride_request_as_passenger with the full PD1 stage
-- gate: 'pending' stays free (no reason required), 'assigned' requires a
-- reason code and is recorded as a passenger strike, 'ongoing' (or anything
-- else) is rejected the same way X9 already rejected it — nothing here
-- loosens what X9 closed.
drop function if exists public.cancel_ride_request_as_passenger(uuid, text);

create function public.cancel_ride_request(p_ride_request_id uuid, p_reason_code text default null::text, p_reason text default null::text)
returns table(ride_request_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_status ride_status;
begin
  if not coalesce(public.is_account_active(), false) then
    raise exception 'Account is not active';
  end if;

  if p_reason_code is not null and p_reason_code not in
    ('changed_mind', 'found_other_ride', 'wait_too_long', 'price_concern', 'other')
  then
    raise exception 'Invalid cancellation reason';
  end if;

  select status into v_status
  from public.ride_requests
  where id = p_ride_request_id and passenger_id = auth.uid()
  for update;

  if not found or v_status not in ('pending', 'assigned') then
    raise exception 'Could not cancel — this ride may already be picked up, completed, or no longer active.';
  end if;

  if v_status = 'assigned' and p_reason_code is null then
    raise exception 'Please choose a reason for cancelling';
  end if;

  update public.ride_requests
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = 'passenger',
      cancel_reason_code = p_reason_code,
      cancel_reason = coalesce(p_reason, cancel_reason)
  where id = p_ride_request_id;

  return query select p_ride_request_id;
end;
$$;

revoke execute on function public.cancel_ride_request(uuid, text, text) from public, anon, authenticated;
grant execute on function public.cancel_ride_request(uuid, text, text) to authenticated;

-- cancel_ride_leg (driver-side, mid-trip) gains the same reason-code
-- requirement plus the no-show exception's own gate: only allowed 5+
-- minutes after mark_arrived's arrived_at, and only while the driver's last
-- known position is still within ~100m of the pickup point (mirrors F4's
-- mark_arrived check exactly, so a driver can't drive off and claim a
-- no-show from elsewhere).
drop function if exists public.cancel_ride_leg(uuid, uuid, text);

create function public.cancel_ride_leg(p_trip_id uuid, p_ride_request_id uuid, p_reason_code text, p_reason text default null::text)
returns table(ride_request_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_pickup_lat numeric;
  v_pickup_lng numeric;
  v_arrived_at timestamptz;
  v_driver_lat numeric;
  v_driver_lng numeric;
begin
  if not coalesce(public.is_account_active(), false) then
    raise exception 'Account is not active';
  end if;

  if p_reason_code is null or p_reason_code not in
    ('vehicle_issue', 'passenger_no_show', 'unsafe_location', 'personal_emergency', 'passenger_asked_to_cancel', 'other')
  then
    raise exception 'Invalid cancellation reason';
  end if;

  if not exists (
    select 1 from public.trips
    where id = p_trip_id and driver_id = auth.uid() and status = 'active'
  ) then
    raise exception 'No active trip found for this driver to cancel';
  end if;

  select pickup_lat, pickup_lng, arrived_at
  into v_pickup_lat, v_pickup_lng, v_arrived_at
  from public.ride_requests
  where id = p_ride_request_id and trip_id = p_trip_id and status in ('assigned', 'ongoing')
  for update;

  if not found then
    raise exception 'Ride request not found for this trip';
  end if;

  if p_reason_code = 'passenger_no_show' then
    if v_arrived_at is null or now() < v_arrived_at + interval '5 minutes' then
      raise exception 'You can report a no-show only 5 minutes or more after marking arrived';
    end if;

    select current_lat, current_lng into v_driver_lat, v_driver_lng
    from public.driver_profiles where user_id = auth.uid();

    if v_driver_lat is null or v_driver_lng is null
       or public.haversine_km(v_pickup_lat, v_pickup_lng, v_driver_lat, v_driver_lng) * 1000 > 100
    then
      raise exception 'You must be at the pickup point to report a no-show';
    end if;
  end if;

  update public.ride_requests
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = 'driver',
      cancel_reason_code = p_reason_code,
      cancel_reason = coalesce(p_reason, cancel_reason)
  where id = p_ride_request_id;

  return query select p_ride_request_id;
end;
$$;

revoke execute on function public.cancel_ride_leg(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.cancel_ride_leg(uuid, uuid, text, text) to authenticated;

-- The pg_cron stale-request sweep is also a cancellation now worth tagging
-- consistently, so ride-cancelled.tsx and any future PSO chart can rely on
-- cancelled_by for every row, not just the two RPCs above.
create or replace function public.cancel_stale_pending_ride_requests()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.ride_requests
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = 'system',
      cancel_reason_code = 'expired',
      cancel_reason = 'Expired — no match found in time'
  where status = 'pending'
    and requested_at < now() - interval '15 minutes';
end;
$$;

revoke execute on function public.cancel_stale_pending_ride_requests() from public, anon, authenticated;
