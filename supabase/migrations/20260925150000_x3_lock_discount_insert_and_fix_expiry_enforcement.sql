-- X3: discounts_submit_own only checked passenger_id — a passenger could
-- INSERT their own discount directly as status='approved' with no expiry,
-- for permanent 20% off. Also no is_account_active() gate (unlike most other
-- self-insert policies — part of X8 too).
--
-- While reviewing the doc's fix text ("expires_at is set by the database on
-- approval"), found the DB doesn't actually do that today: expires_at is
-- only ever set by client-side JS in packages/services/src/admin/discounts.ts's
-- reviewDiscount(), and discounts_review_supervisor's WITH CHECK doesn't
-- constrain it — so a raw PATCH by a supervisor session (or a client bug)
-- could set status='approved' with expires_at left NULL. That matters because
-- compute_fare() currently treats a NULL expires_at as *eligible forever*,
-- the exact opposite of the doc's stated rule ("an approved discount with
-- NULL expiry counts as expired"). Separately, enforce_ride_request_fare_integrity()'s
-- discount-eligibility check (added 20260915000001, before expires_at existed)
-- never got updated to test expiry at all when 20260921000006 added the
-- column — so a genuinely expired discount would still show discount_applied=true
-- on new ride requests even though compute_fare (used elsewhere) would already
-- exclude it, once fixed.
--
-- This migration closes all of it: the INSERT-lock trigger, is_account_active(),
-- a server-side BEFORE UPDATE trigger that sets expires_at on approval instead
-- of trusting the client, and the two corrected/added expiry checks.

create or replace function public.enforce_discount_insert_fields()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.status := 'pending';
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.remarks := null;
  new.expires_at := null;
  return new;
end;
$function$;

create trigger trg_discounts_insert_fields
before insert on public.passenger_discounts
for each row execute function enforce_discount_insert_fields();

revoke execute on function public.enforce_discount_insert_fields() from public;
revoke execute on function public.enforce_discount_insert_fields() from anon, authenticated;

drop policy discounts_submit_own on public.passenger_discounts;
create policy discounts_submit_own on public.passenger_discounts for insert
  with check (passenger_id = auth.uid() and is_account_active());

-- expires_at is now database-set on approval, matching the doc's wording,
-- rather than trusted from the client.
create or replace function public.set_discount_expiry_on_approval()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.status = 'approved' then
    new.expires_at := coalesce(new.reviewed_at, now()) + interval '1 year';
  else
    new.expires_at := null;
  end if;
  return new;
end;
$function$;

create trigger trg_discounts_set_expiry_on_approval
before update on public.passenger_discounts
for each row execute function set_discount_expiry_on_approval();

revoke execute on function public.set_discount_expiry_on_approval() from public;
revoke execute on function public.set_discount_expiry_on_approval() from anon, authenticated;

-- Fix inverted null-expiry semantics: NULL must mean expired, not eligible forever.
create or replace function public.compute_fare(
  p_distance_km  numeric,
  p_seats        smallint default 1,
  p_passenger_id uuid default null
) returns numeric language plpgsql stable set search_path = public as $$
declare
  cfg  public.fare_config%rowtype;
  base_fare_per_seat numeric;
  total_fare numeric;
  is_eligible boolean;
begin
  select * into cfg from public.fare_config where is_active limit 1;
  if not found then
    raise exception 'No active fare_config row found';
  end if;

  if p_distance_km <= cfg.base_km then
    base_fare_per_seat := cfg.base_fare;
  else
    base_fare_per_seat := cfg.base_fare + ceil(p_distance_km - cfg.base_km) * cfg.rate_per_km;
  end if;

  total_fare := base_fare_per_seat * p_seats;

  if p_passenger_id is not null then
    select exists(
      select 1 from public.passenger_discounts
      where passenger_id = p_passenger_id
        and status = 'approved'
        and expires_at is not null
        and expires_at > now()
    ) into is_eligible;

    if is_eligible then
      -- Subtract one seat's worth of discount only — the verified
      -- requester's own portion, not the whole group's fare.
      total_fare := total_fare - (base_fare_per_seat * cfg.discount_rate_percent / 100);
    end if;
  end if;

  return round(total_fare, 2);
end $$;

-- Add the same expiry test to the ride_request-insert discount check, which
-- never got it when the expires_at column was added.
create or replace function public.enforce_ride_request_fare_integrity()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  straight_km numeric;
  min_km numeric;
  max_km numeric;
  is_eligible boolean;
begin
  straight_km := public.haversine_km(new.pickup_lat, new.pickup_lng, new.dest_lat, new.dest_lng);

  -- 15% slack below straight-line accounts for float/rounding only — no
  -- real road route is shorter than the straight line. Upper bound is a
  -- generous detour allowance (3x, or +5km for short trips) so legitimate
  -- routed distances on winding streets aren't clipped.
  min_km := straight_km * 0.85;
  max_km := greatest(straight_km * 3, straight_km + 5);

  if new.distance_km is null or new.distance_km < min_km then
    new.distance_km := straight_km;
  elsif new.distance_km > max_km then
    new.distance_km := max_km;
  end if;

  select exists(
    select 1 from public.passenger_discounts
    where passenger_id = new.passenger_id
      and status = 'approved'
      and expires_at is not null
      and expires_at > now()
  ) into is_eligible;

  new.discount_applied := is_eligible;

  if is_eligible then
    select discount_rate_percent into new.discount_percent
    from public.fare_config where is_active limit 1;
  else
    new.discount_percent := null;
  end if;

  new.estimated_fare := public.compute_fare(new.distance_km, new.seats_requested, new.passenger_id);

  return new;
end;
$$;
