-- R3 (existing-system audit, UAT panel Adrales): `driver_profiles.current_lat/
-- current_lng/location_updated_at` are written by a plain client-side
-- `.update()` (pushDriverLocation / updateDriverAvailability in
-- packages/services/src/location/index.ts) with no server-side check at
-- all — the client sets its own `location_updated_at`, any lat/lng jump is
-- accepted no matter how far or how fast, and a fake-GPS app's mocked
-- coordinates are indistinguishable from a real fix.
--
-- This also closes L3 ("faked I've arrived") at the source, as F4's own
-- migration (20260927000002) predicted: mark_arrived, Y1's start_ride_leg/
-- complete_ride_leg, and PD1's no-show cancel all read
-- driver_profiles.current_lat/current_lng directly rather than taking a
-- lat/lng argument from the caller — if a mocked fix can never land in that
-- column, none of those checks can ever be fooled by one, without touching
-- any of them individually.
alter table public.driver_profiles
  add column if not exists is_mocked boolean not null default false;

create or replace function public.enforce_driver_location_integrity()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_dt_hours numeric;
  v_speed_kmh numeric;
begin
  -- Only a genuine change to a non-null fix is a "location update" — every
  -- other driver_profiles write (is_available toggle, rating refresh, etc.)
  -- carries the previous current_lat/current_lng through NEW unchanged and
  -- must not be treated as one, or location_updated_at would be bumped (and
  -- the speed check run) on writes that never touched location at all.
  if new.current_lat is not null and new.current_lng is not null
     and (new.current_lat is distinct from old.current_lat or new.current_lng is distinct from old.current_lng) then

    if coalesce(new.is_mocked, false) then
      raise exception 'Mock location detected — location updates from a fake-GPS app are rejected';
    end if;

    -- The client's own location_updated_at is never trusted for freshness
    -- checks (R1's ghost-driver cron, R2's staleness filter) — the server
    -- clock is authoritative for when a fix actually arrived.
    new.location_updated_at := now();

    if old.current_lat is not null and old.current_lng is not null and old.location_updated_at is not null then
      v_dt_hours := extract(epoch from (now() - old.location_updated_at)) / 3600.0;
      -- Guard against a near-zero interval (e.g. a duplicate/retried write)
      -- turning ordinary GPS jitter into a division-by-near-zero false
      -- positive; anything under 1 second is too short to judge speed from.
      if v_dt_hours >= (1.0 / 3600.0) then
        v_speed_kmh := public.haversine_km(old.current_lat, old.current_lng, new.current_lat, new.current_lng) / v_dt_hours;
        if v_speed_kmh > 80 then
          raise exception 'Location update rejected: implies about % km/h, faster than physically possible for a tricycle', round(v_speed_kmh);
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$function$;

create trigger trg_driver_location_integrity
  before update on public.driver_profiles
  for each row execute function public.enforce_driver_location_integrity();

revoke execute on function public.enforce_driver_location_integrity() from public, anon, authenticated;
