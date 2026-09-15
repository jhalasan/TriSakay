-- P0-1 security fix (2026-09-15 launch audit): the client supplied
-- distance_km, estimated_fare, discount_applied and discount_percent on
-- ride_requests insert, and nothing recomputed them server-side. A tampered
-- insert (e.g. estimated_fare: 1, distance_km: 50) propagated unchanged
-- through provision_cash_transaction_on_assignment() -> transactions.amount
-- and complete_ride_leg() -> final_fare -> the PayMongo GCash charge.
--
-- distance_km is clamped to a physically plausible band around the
-- haversine straight-line distance (not replaced outright) because the
-- client's routed OSRM distance legitimately exceeds straight-line and
-- should be kept for fare accuracy in the honest case. estimated_fare is
-- always recomputed from the (now-validated) distance via the existing
-- compute_fare() RPC, which already applies the correct discount
-- internally. discount_applied/discount_percent (display/audit columns,
-- separate from compute_fare's internal calc) are derived from the
-- passenger's actual approved passenger_discounts row, never from the
-- client-submitted value.
--
-- Verified live 2026-09-15: a rolled-back insert with
-- {distance_km: 50, estimated_fare: 1, discount_applied: true, discount_percent: 20}
-- against a ~350m real pickup/dest pair stored distance_km=5.35,
-- estimated_fare=17.00, discount_applied=false, discount_percent=null.

create or replace function public.haversine_km(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
returns numeric
language sql
immutable
set search_path to 'public'
as $$
  select 6371 * 2 * asin(least(1, sqrt(
    sin(radians(lat2 - lat1) / 2) ^ 2 +
    cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lng2 - lng1) / 2) ^ 2
  )));
$$;

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
    where passenger_id = new.passenger_id and status = 'approved'
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

drop trigger if exists trg_ride_requests_fare_integrity on public.ride_requests;
create trigger trg_ride_requests_fare_integrity
before insert on public.ride_requests
for each row execute function public.enforce_ride_request_fare_integrity();
